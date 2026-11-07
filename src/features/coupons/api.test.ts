import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listCampuses } from '@/features/campuses/api';
import { getDb, mutate, resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { DEMO_EMAILS, DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import { MY_TOURS_HIGH_SCHOOL } from '@/test/fixtures/backend/applications';
import {
  COUPON_LOOKUP,
  COUPON_OTHER_STORE,
  MY_COUPONS,
  REDEEM_ALREADY_USED,
  REDEEM_DAILY_LIMIT,
  REDEEM_EXPIRED,
  REDEEM_OK,
} from '@/test/fixtures/backend/coupons';
import { MY_STORE } from '@/test/fixtures/backend/stores';
import { TOUR_DETAIL } from '@/test/fixtures/backend/tours';
import { loginAs } from '@/test/loginAs';
import { wireFail, wireOk, wirePage } from '@/test/wire';
import { getCouponLookup, getMyCoupon, getMyCoupons, postRedeem } from './api';

// 시드 계정으로 목업을 끝까지 도는 흐름과 명세 예시 봉투를 그대로(확장 없이) 받았을 때의 어댑터(2C-R8 대체 경로 · 2C-R15 · 2C-R27).
// 와이어 모양 일치와 핸들러 규칙은 `mocks/handlers/handlers.test.ts`의 coupons에 있다.

const STUDENT = DEMO_EMAILS.student;

/** 이 콜백을 도는 동안 나간 `/api` 요청(`메서드 경로?쿼리`, `/api` 뗌). */
async function requestsDuring(run: () => Promise<unknown>): Promise<string[]> {
  const seen: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      seen.push(`${request.method} ${url.pathname.replace(/^\/api/, '')}${url.search}`);
    }
  });
  try {
    await run();
  } finally {
    server.events.removeAllListeners('request:start');
  }
  return seen;
}

afterEach(() => configureHttp({ getToken: () => null }));

describe('쿠폰 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
  });

  /** 김민지가 탐방 1에서 받은 서천 밥상(상점 1, 사장님 1)의 아직 안 쓴 쿠폰 코드. */
  const unusedCode = () => {
    const db = getDb();
    const studentId = db.users.find((u) => u.email === STUDENT)!.id;
    const app = db.applications.find((a) => a.userId === studentId && a.tourId === 1)!;
    return db.coupons.find((c) => c.storeId === 1 && c.applicationId === app.id)!.code;
  };

  it('학생: 내 쿠폰은 id 오름차순이고 신청으로 거르며, 상세는 목록에서 찾는다', async () => {
    loginAs(STUDENT);
    const all = await getMyCoupons(undefined, listCampuses());
    expect(all.map((c) => c.storeName)).toEqual(['서천 밥상', '카페 모래시계']);
    expect(all[0].id).toBeLessThan(all[1].id);
    expect(all[0]).toMatchObject({
      status: 'ISSUED',
      state: 'USABLE',
      discount: '식사 금액 10% 할인',
      storeId: 1,
      storeCategory: '한식', // 목업 확장 store.category
      tourId: 1,
      reviewWritten: false,
      usedAt: null,
    });
    expect(all[0].tourTitle).toEqual(expect.stringContaining('탐방'));
    expect(await getMyCoupons(all[0].applicationId, listCampuses())).toEqual(all);
    expect(await getMyCoupons(999999, listCampuses())).toEqual([]);
    expect(await getMyCoupon(all[1].id, listCampuses())).toEqual(all[1]);
  });

  it('남의 쿠폰 · 없는 쿠폰 id는 내 쿠폰 목록에 없어 NOT_FOUND', async () => {
    loginAs(STUDENT);
    const others = getDb().coupons.find((c) => c.applicationId !== getDb().applications[0].id)!;
    const mine = new Set((await getMyCoupons(undefined, listCampuses())).map((c) => c.id));
    for (const id of [others.id, 999999]) {
      expect(mine.has(id)).toBe(false);
      await expect(getMyCoupon(id, listCampuses())).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    }
  });

  it('쿠폰 목록은 내 탐방 행 · 쿠폰 · 탐방 상세(탐방당 한 번)를 부르고 캠퍼스 목록과 함께 나간다', async () => {
    loginAs(STUDENT);
    const seen = await requestsDuring(() => getMyCoupons(undefined, listCampuses()));
    expect(seen.filter((r) => r.startsWith('GET /users/me/coupons'))).toHaveLength(1);
    expect(seen.filter((r) => r.startsWith('GET /users/me/tours'))).toHaveLength(1);
    expect(seen.filter((r) => r.startsWith('GET /tours/1'))).toEqual(['GET /tours/1']); // 쿠폰 2장, 탐방 1번
  });

  it('신청을 주면 쿠폰을 그 탐방으로 좁혀 부른다', async () => {
    loginAs(STUDENT);
    const [first] = await getMyCoupons(undefined, listCampuses());
    const seen = await requestsDuring(() => getMyCoupons(first.applicationId, listCampuses()));
    expect(seen.filter((r) => r.startsWith('GET /users/me/coupons'))).toEqual([
      'GET /users/me/coupons?tour_id=1&page=1&size=50',
    ]);
  });

  it('사장님: 코드 조회 → 사용 처리 → 다시 쓰면 COUPON_ALREADY_USED(사용 시각 포함)', async () => {
    const code = unusedCode();

    loginAs(DEMO_STORE_OWNERS[1]!);
    expect(await getCouponLookup(code)).toMatchObject({
      code,
      state: 'USABLE',
      storeName: '서천 밥상',
      studentName: '김민지', // 목업 확장 student_name
      usedAt: null,
    });
    const result = await postRedeem(code);
    expect(result.coupon).toMatchObject({
      code,
      state: 'USED',
      storeName: '서천 밥상',
      usedAt: expect.any(String),
    });
    expect(result.tourVisitorCount).toBe(1);
    expect(result.totalVisitorCount).toBeGreaterThanOrEqual(1);
    await expect(postRedeem(code)).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_ALREADY_USED',
      backendCode: 'E409_ALREADY_USED',
      details: { usedAt: result.coupon.usedAt },
    });
    // 사용한 쿠폰도 조회는 된다(명세: 내 가게 쿠폰이면 USED여도 정보를 준다).
    expect(await getCouponLookup(code)).toMatchObject({
      state: 'USED',
      usedAt: result.coupon.usedAt,
    });
  });

  it('다른 가게 쿠폰은 COUPON_OTHER_STORE, 없는 코드는 COUPON_NOT_FOUND(조회 · 사용 처리 모두)', async () => {
    const otherStoreCode = getDb().coupons.find((c) => c.storeId === 2)!.code;
    loginAs(DEMO_STORE_OWNERS[1]!);
    for (const run of [() => getCouponLookup(otherStoreCode), () => postRedeem(otherStoreCode)]) {
      await expect(run()).rejects.toMatchObject({
        status: 403,
        code: 'COUPON_OTHER_STORE',
        backendCode: 'E403_OTHER_STORE',
      });
    }
    for (const run of [() => getCouponLookup('000000'), () => postRedeem('000000')]) {
      await expect(run()).rejects.toMatchObject({
        status: 404,
        code: 'COUPON_NOT_FOUND',
        backendCode: 'E404',
      });
    }
  });

  it('만료된 쿠폰은 조회는 EXPIRED, 사용 처리는 COUPON_EXPIRED(410)', async () => {
    const code = unusedCode();
    loginAs(DEMO_STORE_OWNERS[1]!);
    mutate((db) => {
      db.coupons.find((c) => c.code === code)!.status = 'EXPIRED';
    });
    expect(await getCouponLookup(code)).toMatchObject({ state: 'EXPIRED' });
    await expect(postRedeem(code)).rejects.toMatchObject({
      status: 410,
      code: 'COUPON_EXPIRED',
      backendCode: 'E410_EXPIRED',
    });
  });

  it('탐방 당일 전 쿠폰은 조회는 BEFORE_DAY, 사용 처리는 목업 확장 코드 COUPON_NOT_YET', async () => {
    const code = unusedCode();
    mutate((db) => {
      const coupon = db.coupons.find((c) => c.code === code)!;
      const tour = db.tours.find(
        (t) => t.id === db.applications.find((a) => a.id === coupon.applicationId)!.tourId,
      )!;
      tour.startsAt = '2099-01-15T14:00:00+09:00';
      coupon.expiresAt = '2099-01-15T23:59:59+09:00';
    });
    loginAs(DEMO_STORE_OWNERS[1]!);
    expect(await getCouponLookup(code)).toMatchObject({ state: 'BEFORE_DAY' });
    await expect(postRedeem(code)).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_NOT_YET',
      backendCode: 'E409_COUPON_NOT_YET',
    });
  });

  it('하루 한 장 오류(E409_DAILY_LIMIT)는 COUPON_DAILY_LIMIT — 목업은 이 규칙을 내지 않는다', async () => {
    const code = unusedCode();
    loginAs(DEMO_STORE_OWNERS[1]!);
    server.use(
      http.post('/api/coupons/:couponCode/redeem', () => wireFail(REDEEM_DAILY_LIMIT.code)),
    );
    await expect(postRedeem(code)).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_DAILY_LIMIT',
      backendCode: 'E409_DAILY_LIMIT',
    });
    // 같은 날 같은 가게의 다른 쿠폰도 목업에서는 모두 쓸 수 있다.
    server.resetHandlers();
    await expect(postRedeem(code)).resolves.toMatchObject({ coupon: { state: 'USED' } });
    const sameDay = getDb().coupons.find(
      (c) => c.storeId === 1 && c.status === 'ISSUED' && c.code !== code,
    )!;
    await expect(postRedeem(sameDay.code)).resolves.toMatchObject({ coupon: { state: 'USED' } });
  });
});

describe('확장 없는 실서버 응답 (2C-R8 대체 경로)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-15T10:00:00+09:00')); // 탐방 당일
  });
  afterEach(() => vi.useRealTimers());

  const [tourRow] = MY_TOURS_HIGH_SCHOOL.data.items; // 신청 77(승인), 탐방 31

  it('S-05 예시: 신청 id는 내 탐방 행에서, 탐방 제목은 상세에서, 상점 분류는 빈 문자열, 상태는 계산', async () => {
    loginAs(STUDENT);
    server.use(
      http.get('/api/users/me/coupons', () => wireOk(MY_COUPONS.data)),
      http.get('/api/users/me/tours', () => wirePage([tourRow])),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
    );
    const [coupon] = await getMyCoupons(undefined, listCampuses());
    expect(coupon).toEqual({
      id: 501,
      code: '483920',
      status: 'ISSUED',
      state: 'USABLE',
      discount: '음료 1,000원 할인',
      storeId: 201,
      storeName: '용인 분식',
      storeCategory: '',
      applicationId: 77,
      tourId: 31,
      tourTitle: '단국대 죽전캠퍼스 컴퓨터공학과 탐방',
      tourStartsAt: '2027-01-15T13:00:00+09:00',
      expiresAt: '2027-01-15T23:59:59+09:00',
      usedAt: null,
      reviewWritten: false,
    });
    expect(await getMyCoupon(501, listCampuses())).toEqual(coupon);
  });

  it('같은 탐방의 신청이 여럿이면 승인된 신청을, 승인이 없으면 id가 가장 큰 신청을 쿠폰의 신청으로 삼는다(2C-R27)', async () => {
    loginAs(STUDENT);
    const approved = { ...tourRow, application_id: 77 };
    const newerCanceled = { ...tourRow, application_id: 90, application_status: 'CANCELED' };
    const olderCanceled = { ...tourRow, application_id: 70, application_status: 'CANCELED' };
    let rows = [newerCanceled, approved, olderCanceled];
    server.use(
      http.get('/api/users/me/coupons', () => wireOk(MY_COUPONS.data)),
      http.get('/api/users/me/tours', () => wirePage(rows)),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
    );
    expect((await getMyCoupons(undefined, listCampuses()))[0].applicationId).toBe(77);
    // 신청 id를 주면 쿠폰이 속한 그 신청만 쿠폰을 갖는다.
    expect(await getMyCoupons(77, listCampuses())).toHaveLength(1);
    expect(await getMyCoupons(90, listCampuses())).toEqual([]);
    rows = [olderCanceled, newerCanceled];
    expect((await getMyCoupons(undefined, listCampuses()))[0].applicationId).toBe(90);
  });

  it('내 탐방 행이 없는 탐방의 쿠폰은 갈 곳이 없어 빼고, 그 탐방 상세는 부르지 않는다', async () => {
    loginAs(STUDENT);
    server.use(
      http.get('/api/users/me/coupons', () => wireOk(MY_COUPONS.data)),
      http.get('/api/users/me/tours', () => wirePage([])),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
    );
    const seen = await requestsDuring(async () =>
      expect(await getMyCoupons(undefined, listCampuses())).toEqual([]),
    );
    expect(seen.some((r) => r.startsWith('GET /tours/'))).toBe(false);
  });

  it('S-06 예시: 가게 이름은 GET /users/me/store, 탐방 제목 · 학생 이름 · 사용 시각은 대체값', async () => {
    loginAs(DEMO_STORE_OWNERS[1]!);
    server.use(
      http.get('/api/coupons/:couponCode', () => wireOk(COUPON_LOOKUP.data)),
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
    );
    expect(await getCouponLookup('483920')).toEqual({
      code: '483920',
      state: 'USABLE',
      discount: '음료 1,000원 할인',
      storeName: '용인 분식',
      tourTitle: '탐방',
      tourStartsAt: '2027-01-15T00:00:00+09:00',
      studentName: '',
      usedAt: null,
    });
  });

  it('S-06 사용 처리 예시: 방문 수가 없으면 null, 사용 시각 · 상태는 사용 처리 응답으로 덮는다', async () => {
    loginAs(DEMO_STORE_OWNERS[1]!);
    server.use(
      http.post('/api/coupons/:couponCode/redeem', () => wireOk(REDEEM_OK.data)),
      http.get('/api/coupons/:couponCode', () => wireOk(COUPON_LOOKUP.data)), // 아직 ISSUED로 읽는 응답이어도
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
    );
    expect(await postRedeem('483920')).toEqual({
      coupon: {
        code: '483920',
        state: 'USED',
        discount: '음료 1,000원 할인',
        storeName: '용인 분식',
        tourTitle: '탐방',
        tourStartsAt: '2027-01-15T00:00:00+09:00',
        studentName: '',
        usedAt: '2027-01-15T13:40:00+09:00',
      },
      tourVisitorCount: null,
      totalVisitorCount: null,
    });
  });

  it('명세 오류 봉투: 다른 가게 · 이미 사용(사용 시각 없음) · 만료 · 하루 한 장', async () => {
    loginAs(DEMO_STORE_OWNERS[1]!);
    const cases = [
      [COUPON_OTHER_STORE, 403, 'COUPON_OTHER_STORE'],
      [REDEEM_ALREADY_USED, 409, 'COUPON_ALREADY_USED'],
      [REDEEM_EXPIRED, 410, 'COUPON_EXPIRED'],
      [REDEEM_DAILY_LIMIT, 409, 'COUPON_DAILY_LIMIT'],
    ] as const;
    for (const [envelope, status, code] of cases) {
      server.use(http.post('/api/coupons/:couponCode/redeem', () => wireFail(envelope.code)));
      const error = await postRedeem('483920').catch((e: unknown) => e);
      expect(error).toMatchObject({ status, code, backendCode: envelope.code });
      expect((error as { details?: unknown }).details).toBeUndefined();
    }
  });

  it('확인이 실패하면 가게 조회 실패보다 확인 오류가 먼저 보인다', async () => {
    loginAs(DEMO_STORE_OWNERS[1]!);
    server.use(
      http.get('/api/coupons/:couponCode', () => wireFail('E404')),
      http.get('/api/users/me/store', () => wireFail('E500')),
    );
    await expect(getCouponLookup('000000')).rejects.toMatchObject({ code: 'COUPON_NOT_FOUND' });
  });
});
