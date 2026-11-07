import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listCampuses } from '@/features/campuses/api';
import { mutate, resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import {
  APPLY_DUPLICATE,
  APPLY_FULL,
  APPLY_NOT_VERIFIED,
  CANCEL_INVALID,
  DECISION_FULL,
  MY_TOURS_HIGH_SCHOOL,
} from '@/test/fixtures/backend/applications';
import { TOUR_DETAIL } from '@/test/fixtures/backend/tours';
import { loginAs } from '@/test/loginAs';
import { wireFail, wireOk, wirePage } from '@/test/wire';
import {
  getApplicantsBoard,
  getGuideTours,
  getMyApplication,
  getMyApplications,
  patchDecision,
  postApplication,
  postCancelApplication,
} from './api';

// 명세 예시 봉투를 그대로 받았을 때의 어댑터(2C-R15 세분 · 확장 없는 대체 경로)와 합성의 병렬성(errata G6 · G13).
// 시드 계정으로 목업을 끝까지 도는 흐름은 `mocks/handlers/handlers.test.ts`의 applications에 있다.

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

/** 명세 S-05 내 쿠폰 예시의 항목(탐방 31). */
const COUPON_TOUR_31 = {
  coupon_id: 501,
  code: '483920',
  tour_id: 31,
  store: { store_id: 201, name: '용인 분식' },
  discount_text: '음료 1,000원 할인',
  status: 'ISSUED',
  valid_until: '2027-01-15T23:59:59+09:00',
  used_at: null,
  reviewed: false,
};

describe('신청 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });
  afterEach(() => configureHttp({ getToken: () => null }));

  it('고교생: 신청 → 내 신청 목록 · 상세 → 취소 (캠퍼스는 약속째 넘긴다)', async () => {
    loginAs(STUDENT);
    const campuses = listCampuses();
    const created = await postApplication(3, '밥집이 궁금해요', campuses);
    expect(created).toMatchObject({ status: 'PENDING', motivation: '밥집이 궁금해요' });
    expect(created.tour.id).toBe(3);

    expect((await getMyApplications(campuses)).map((a) => a.id)).toContain(created.id);
    expect((await getMyApplication(created.id, campuses)).motivation).toBe('밥집이 궁금해요');

    const canceled = await postCancelApplication(created.id, campuses);
    expect(canceled.status).toBe('CANCELED');
  });

  it('신청 응답의 탐방 id로 내 탐방 행과 탐방 상세를 함께 부른다(errata G6)', async () => {
    loginAs(STUDENT);
    const events: string[] = [];
    server.use(
      http.get('/api/users/me/tours', async () => {
        events.push('rows:start');
        await delay(30);
        events.push('rows:end');
        return undefined; // 기본 핸들러로 넘긴다
      }),
      http.get('/api/tours/:tourId', ({ params }) => {
        events.push(`tour${String(params.tourId)}:start`);
        return undefined;
      }),
    );
    await postApplication(3, '밥집이 궁금해요', listCampuses());
    expect(events.indexOf('tour3:start')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('tour3:start')).toBeLessThan(events.indexOf('rows:end'));
  });

  it('신청자 보드는 신청자 목록 · 탐방 상세 · 코스 상태를 함께 부른다(errata G6)', async () => {
    loginAs(DEMO_EMAILS.guide);
    const started: string[] = [];
    let listDone = false;
    server.use(
      http.get('/api/tours/:tourId/applications', async () => {
        await delay(30);
        listDone = true;
        return undefined;
      }),
    );
    server.events.on('request:start', ({ request }) => {
      if (!listDone) started.push(new URL(request.url).pathname);
    });
    try {
      await getApplicantsBoard(1, listCampuses());
    } finally {
      server.events.removeAllListeners('request:start');
    }
    expect(started).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\/api\/tours\/1\/applications$/),
        '/api/tours/1',
        '/api/tours/1/course',
      ]),
    );
  });

  it('가이드 탐방 목록: 확정 코스는 코스를 다시 부르지 않고, 확정이 아닌 탐방만 코스 상태를 부른다', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    loginAs(DEMO_EMAILS.guide);
    let tours: Awaited<ReturnType<typeof getGuideTours>> = [];
    const seen = await requestsDuring(async () => {
      tours = await getGuideTours(await listCampuses());
    });
    expect(tours.find((t) => t.id === 1)?.courseStatus).toBe('CONFIRMED');
    const courseGets = seen.filter((r) => /^GET \/tours\/\d+\/course$/.test(r));
    expect(courseGets).not.toContain('GET /tours/1/course');
    expect(courseGets).toHaveLength(tours.filter((t) => t.courseStatus !== 'CONFIRMED').length);
  });
});

describe('신청 오류 세분 (2C-R15, 명세 A-01 · A-02 · A-03 예시 봉투 그대로)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });
  afterEach(() => configureHttp({ getToken: () => null }));

  const applyFails = (body: object, status: number) =>
    server.use(
      http.post('/api/tours/:tourId/applications', () => HttpResponse.json(body, { status })),
    );

  it('E403_VERIFICATION_REQUIRED: GET /users/me의 인증이 APPROVED가 아니면 NOT_VERIFIED', async () => {
    loginAs(DEMO_EMAILS.unverified); // 인증 NONE
    applyFails(APPLY_NOT_VERIFIED, 403);
    await expect(postApplication(1, '수업이 궁금해요', listCampuses())).rejects.toMatchObject({
      status: 403,
      code: 'NOT_VERIFIED',
      backendCode: 'E403_VERIFICATION_REQUIRED',
    });
  });

  it('E403_VERIFICATION_REQUIRED: 인증은 APPROVED인데 막혔으면 보호자 동의 차례(GUARDIAN_NOT_AGREED)', async () => {
    loginAs('expired@demo.kr'); // 인증 APPROVED · 동의 만료
    applyFails(APPLY_NOT_VERIFIED, 403);
    await expect(postApplication(1, '수업이 궁금해요', listCampuses())).rejects.toMatchObject({
      status: 403,
      code: 'GUARDIAN_NOT_AGREED',
      message: '보호자 동의가 끝난 뒤에 신청할 수 있어요.',
      backendCode: 'E403_VERIFICATION_REQUIRED',
    });
  });

  it.each([
    ['RECRUITING', 'TOUR_CLOSED'],
    ['CLOSED', 'TOUR_CLOSED'],
    ['COMPLETED', 'TOUR_NOT_RECRUITING'],
    ['CANCELED', 'TOUR_NOT_RECRUITING'],
  ] as const)('E409_TOUR_FULL: 다시 읽은 탐방이 %s면 %s', async (tourStatus, code) => {
    loginAs(STUDENT);
    applyFails(APPLY_FULL, 409);
    server.use(
      http.get('/api/tours/:tourId', () => wireOk({ ...TOUR_DETAIL.data, status: tourStatus })),
    );
    await expect(postApplication(31, '수업이 궁금해요', listCampuses())).rejects.toMatchObject({
      status: 409,
      code,
      backendCode: 'E409_TOUR_FULL',
    });
  });

  it('세분할 탐방을 다시 읽지 못하면 기본 표의 코드(TOUR_CLOSED)로 둔다', async () => {
    loginAs(STUDENT);
    applyFails(APPLY_FULL, 409);
    server.use(http.get('/api/tours/:tourId', () => wireFail('E500')));
    await expect(postApplication(31, '수업이 궁금해요', listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'TOUR_CLOSED',
      backendCode: 'E409_TOUR_FULL',
    });
  });

  it('E403_VERIFICATION_REQUIRED: 내 정보를 다시 읽지 못하면 기본 표의 코드(NOT_VERIFIED)로 둔다', async () => {
    loginAs(STUDENT);
    applyFails(APPLY_NOT_VERIFIED, 403);
    server.use(http.get('/api/users/me', () => wireFail('E500')));
    await expect(postApplication(1, '수업이 궁금해요', listCampuses())).rejects.toMatchObject({
      status: 403,
      code: 'NOT_VERIFIED',
      backendCode: 'E403_VERIFICATION_REQUIRED',
    });
  });

  it('E409_ALREADY_APPLIED는 DUPLICATE_APPLICATION', async () => {
    loginAs(STUDENT);
    applyFails(APPLY_DUPLICATE, 409);
    await expect(postApplication(1, '수업이 궁금해요', listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_APPLICATION',
      backendCode: 'E409_ALREADY_APPLIED',
    });
  });

  it('승인 · 거절의 E409_TOUR_FULL은 정원 초과(CAPACITY_EXCEEDED)', async () => {
    loginAs(DEMO_EMAILS.guide);
    server.use(
      http.patch('/api/applications/:applicationId/decision', () =>
        HttpResponse.json(DECISION_FULL, { status: 409 }),
      ),
    );
    await expect(patchDecision(1, 77, 'APPROVED', listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'CAPACITY_EXCEEDED',
      backendCode: 'E409_TOUR_FULL',
    });
  });

  it('취소의 E409_INVALID_APPLICATION_STATUS: 신청을 다시 읽어 대기 · 승인이면 CANCEL_AFTER_TOUR_DATE, 아니면 ALREADY_PROCESSED', async () => {
    loginAs(STUDENT);
    server.use(
      http.post('/api/applications/:applicationId/cancel', () =>
        HttpResponse.json(CANCEL_INVALID, { status: 409 }),
      ),
    );
    const live = { ...MY_TOURS_HIGH_SCHOOL.data.items[0], application_status: 'PENDING' };
    server.use(http.get('/api/users/me/tours', () => wirePage([live])));
    await expect(postCancelApplication(77, listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'CANCEL_AFTER_TOUR_DATE',
      backendCode: 'E409_INVALID_APPLICATION_STATUS',
    });

    const done = { ...live, application_status: 'CANCELED' };
    server.use(http.get('/api/users/me/tours', () => wirePage([done])));
    await expect(postCancelApplication(77, listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_INVALID_APPLICATION_STATUS',
    });
  });
});

describe('취소 오류 세분의 다시 읽기 실패', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });
  afterEach(() => configureHttp({ getToken: () => null }));

  it('E409_INVALID_APPLICATION_STATUS: 신청을 다시 읽지 못하면 기본 표의 코드(ALREADY_PROCESSED)로 둔다', async () => {
    loginAs(STUDENT);
    server.use(
      http.post('/api/applications/:applicationId/cancel', () =>
        HttpResponse.json(CANCEL_INVALID, { status: 409 }),
      ),
      http.get('/api/users/me/tours', () => wireFail('E500')),
    );
    await expect(postCancelApplication(77, listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_INVALID_APPLICATION_STATUS',
    });
  });
});

describe('확장 없는 실서버 응답 (2C-R8 대체 경로)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });
  afterEach(() => configureHttp({ getToken: () => null }));

  it('coupon_count가 없으면 GET /users/me/coupons?tour_id로 센다 — 승인 행에만 주고, 탐방이 같은 행은 탐방 상세 · 쿠폰을 한 번씩만 부른다', async () => {
    loginAs(STUDENT);
    const [row] = MY_TOURS_HIGH_SCHOOL.data.items; // 확장 없음
    const older = { ...row, application_id: 70, application_status: 'CANCELED' };
    server.use(
      http.get('/api/users/me/tours', () => wirePage([row, older])),
      http.get('/api/users/me/coupons', () => wireOk({ items: [COUPON_TOUR_31] })),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
    );
    let apps: Awaited<ReturnType<typeof getMyApplications>> = [];
    const seen = await requestsDuring(async () => {
      apps = await getMyApplications(listCampuses());
    });

    expect(apps.map((a) => a.id)).toEqual([77, 70]); // 행 순서 그대로
    expect(apps[0]).toMatchObject({
      motivation: '',
      createdAt: '',
      couponCount: 1,
      courseStatus: 'CONFIRMED',
      tour: { id: 31, universityName: '단국대학교', campusName: '죽전캠퍼스' },
    });
    expect(apps[1]).toMatchObject({ id: 70, status: 'CANCELED', couponCount: 0 }); // 2C-R27: 승인 행만
    expect(seen.filter((r) => r.startsWith('GET /tours/31'))).toEqual(['GET /tours/31']);
    expect(seen.filter((r) => r.startsWith('GET /users/me/coupons'))).toEqual([
      'GET /users/me/coupons?tour_id=31&page=1&size=50',
    ]);
  });

  it('확장 coupon_count가 있으면 쿠폰을 부르지 않는다(목업)', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    loginAs(STUDENT);
    const seen = await requestsDuring(() => getMyApplications(listCampuses()));
    expect(seen.some((r) => r.includes('/coupons'))).toBe(false);
  });

  it('남의 신청 · 없는 신청 id는 내 탐방 행에 없으니 404 NOT_FOUND', async () => {
    loginAs(STUDENT);
    const others = mutate((db) => db.applications.find((a) => a.tourId === 1)!.id); // 박서준의 신청
    for (const id of [others, 999_999]) {
      await expect(getMyApplication(id, listCampuses())).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    }
  });
});
