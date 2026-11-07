import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { CourseStatus } from '@/features/courses/model';
import type { CourseStopRow, DB } from '@/mocks/db/schema';
import { createSeed, DEMO_TOUR_ID } from '@/mocks/db/seed';
import { nextId } from '@/mocks/db/store';
import type { ErrorCode } from '@/shared/lib/errors';
import { approveApplication, cancelApplication } from './applications';
import {
  expireCouponsForApplication,
  generateCouponCode,
  issueCouponsForApplication,
  redeemCoupon,
} from './coupons';

const now = new Date('2026-11-14T03:00:00Z'); // 시연일 전날 KST 12:00 — 승인 · 발급, "아직 아님"
const dayOf = new Date('2026-11-15T05:00:00Z'); // 시연일 KST 14:00 — 사용 처리
const nextDay = new Date('2026-11-16T03:00:00Z'); // 다음 날 KST 12:00 — 만료
const DAY_OF_ISO = '2026-11-15T14:00:00+09:00';

/** `Math.floor(r * 1_000_000)`이 정확히 `code`가 되는 난수. */
const randomFor = (code: string) => (Number(code) + 0.5) / 1_000_000;

let db: DB;
let random: MockInstance<() => number>;
beforeEach(() => {
  db = createSeed(new Date('2026-11-15T01:00:00Z')); // 시연일 2026-11-15, 탐방 1은 그날 14:00
  // 쿠폰 코드를 100000, 100001, … 순서로 고정한다(시드 코드 · '000000'과 겹치지 않는다).
  let n = 100_000;
  random = vi.spyOn(Math, 'random').mockImplementation(() => randomFor(String(n++)));
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** 다음 `Math.random` 결과가 차례로 이 코드들이 되게 한다. */
const queueCodes = (...codes: string[]) =>
  codes.forEach((code) => random.mockImplementationOnce(() => randomFor(code)));

const id = (email: string) => db.users.find((u) => u.email === email)!.id;
const owner = (n: number) => id(`owner${n}@demo.kr`);
const appOf = (email: string) =>
  db.applications.find((a) => a.tourId === DEMO_TOUR_ID && a.userId === id(email))!;
/** 시드의 탐방 7 USED 쿠폰 10장이 섞이지 않게 신청 ID로 센다. */
const couponsOf = (applicationId: number) =>
  db.coupons.filter((c) => c.applicationId === applicationId);
const partnershipOf = (storeId: number) => db.partnerships.find((p) => p.storeId === storeId)!;

/** 규칙이 이 상태 · 코드(· 부가 값)로 던지고, DB는 하나도 바뀌지 않았는지 확인한다. */
function expectRejected(
  fn: () => unknown,
  status: number,
  code: ErrorCode,
  details?: Record<string, unknown>,
) {
  const before = structuredClone(db);
  expect(fn).toThrow(expect.objectContaining({ status, code, ...(details && { details }) }));
  expect(db).toEqual(before);
}

/** 탐방 1에 캠퍼스 지점 하나 + `storeIds` 상점 지점이 차례로 있는 코스를 직접 넣는다. */
function putCourse(storeIds: number[], status: CourseStatus = 'CONFIRMED') {
  const at = '2026-11-14T10:00:00+09:00';
  db.courses.push({
    tourId: DEMO_TOUR_ID,
    status,
    createdAt: at,
    updatedAt: at,
    confirmedAt: status === 'CONFIRMED' ? at : null,
    interests: [],
  });
  const stop = (stopOrder: number, storeId: number | null): CourseStopRow => ({
    id: nextId(db),
    tourId: DEMO_TOUR_ID,
    stopType: storeId === null ? 'CAMPUS' : 'STORE',
    campusBuildingId: storeId === null ? 3 : null,
    storeId,
    partnershipId:
      storeId === null ? null : (db.partnerships.find((p) => p.storeId === storeId)?.id ?? null),
    stopOrder,
    visitTime: null,
    description: null,
    recommendationReason: null,
  });
  db.courseStops.push(stop(1, null), ...storeIds.map((storeId, i) => stop(i + 2, storeId)));
}

/** 대기 중인 최유진을 가이드가 승인한다. 코스가 확정돼 있으면 이때 쿠폰이 발급된다. */
function approveYujin() {
  const app = appOf('yujin@demo.kr');
  approveApplication(db, id('guide@demo.kr'), app.id, now);
  return app;
}

/** 확정 코스(상점 1 · 2)에서 최유진을 승인하고 상점별 쿠폰 코드를 돌려준다. */
function issueToYujin() {
  putCourse([1, 2]);
  const app = approveYujin();
  const codeAt = (storeId: number) => couponsOf(app.id).find((c) => c.storeId === storeId)!.code;
  return { app, store1: codeAt(1), store2: codeAt(2) };
}

describe('쿠폰 발급', () => {
  it('확정 코스가 있으면 늦은 승인자에게도 쿠폰', () => {
    putCourse([1, 2]);
    const app = approveYujin();
    const coupons = couponsOf(app.id);
    expect(coupons).toHaveLength(2);
    expect(coupons.map((c) => c.storeId)).toEqual([1, 2]);
    expect(coupons.map((c) => c.discountSnapshot)).toEqual([
      '식사 금액 10% 할인',
      '음료 1,000원 할인',
    ]);
    for (const c of coupons) {
      expect(c).toMatchObject({
        partnershipId: partnershipOf(c.storeId).id,
        status: 'ISSUED',
        issuedAt: '2026-11-14T12:00:00+09:00',
        expiresAt: '2026-11-15T23:59:59+09:00',
        usedAt: null,
      });
      expect(c.code).toMatch(/^\d{6}$/);
    }
  });

  it('코스가 없으면 승인해도 쿠폰이 없다', () => {
    const app = approveYujin();
    expect(app.status).toBe('APPROVED');
    expect(couponsOf(app.id)).toEqual([]);
  });

  it('초안 코스면 발급하지 않는다', () => {
    putCourse([1, 2], 'DRAFT');
    const app = approveYujin();
    expect(couponsOf(app.id)).toEqual([]);
    const seojun = appOf('seojun@demo.kr');
    expect(issueCouponsForApplication(db, seojun.id, now)).toEqual([]);
    expect(couponsOf(seojun.id)).toEqual([]);
  });

  it('승인되지 않은 신청에는 발급하지 않는다', () => {
    putCourse([1, 2]);
    const yujin = appOf('yujin@demo.kr'); // 대기
    expect(issueCouponsForApplication(db, yujin.id, now)).toEqual([]);
    expect(couponsOf(yujin.id)).toEqual([]);
  });

  it('이미 승인된 신청자에게 발급하면 새로 발급한 쿠폰을 돌려준다', () => {
    putCourse([1, 2]);
    const seojun = appOf('seojun@demo.kr');
    const issued = issueCouponsForApplication(db, seojun.id, now);
    expect(issued.map((c) => c.storeId)).toEqual([1, 2]);
    expect(couponsOf(seojun.id)).toEqual(issued);
  });

  it('같은 신청 · 상점에는 한 번만 발급한다', () => {
    putCourse([1, 2, 1]); // 상점 1이 두 번 들어간 코스
    const app = approveYujin();
    expect(couponsOf(app.id).map((c) => c.storeId)).toEqual([1, 2]);
    expect(issueCouponsForApplication(db, app.id, now)).toEqual([]); // 다시 불러도 그대로
    expect(couponsOf(app.id)).toHaveLength(2);
  });

  it('탐방 날짜에 유효한 제휴가 있는 상점만 발급한다', () => {
    putCourse([1, 2, 3, 5]);
    Object.assign(partnershipOf(1), { startDate: '2026-11-15', endDate: '2026-11-15' }); // 당일 하루
    partnershipOf(2).endDate = '2026-11-14'; // 전날 끝남
    partnershipOf(3).startDate = '2026-11-16'; // 다음 날 시작
    // 상점 5(죽전 돼지국밥)는 제휴가 없다
    const app = approveYujin();
    expect(couponsOf(app.id).map((c) => c.storeId)).toEqual([1]);
  });

  it('지점 순서(stopOrder)대로 발급한다', () => {
    putCourse([1, 2]);
    db.courseStops.reverse(); // 배열 순서와 stopOrder를 어긋나게 한다
    const app = approveYujin();
    expect(couponsOf(app.id).map((c) => [c.storeId, c.code])).toEqual([
      [1, '100000'],
      [2, '100001'],
    ]);
  });

  it('쿠폰 코드는 시드 쿠폰 코드와도 겹치지 않는다', () => {
    const seeded = db.coupons.map((c) => c.code);
    queueCodes(seeded[0], '500000', seeded[5], '600000');
    putCourse([1, 2]);
    const app = approveYujin();
    expect(couponsOf(app.id).map((c) => c.code)).toEqual(['500000', '600000']);
  });

  it('한 번에 발급하는 쿠폰끼리도 코드가 겹치지 않는다', () => {
    queueCodes('123456', '123456', '654321');
    putCourse([1, 2]);
    const app = approveYujin();
    expect(couponsOf(app.id).map((c) => c.code)).toEqual(['123456', '654321']);
  });

  it('신청이 없으면 NOT_FOUND', () =>
    expectRejected(() => issueCouponsForApplication(db, 999, now), 404, 'NOT_FOUND'));
});

describe('쿠폰 만료', () => {
  it('승인 취소하면 쿠폰이 만료된다', () => {
    const { app } = issueToYujin();
    cancelApplication(db, id('yujin@demo.kr'), app.id, now);
    expect(couponsOf(app.id).map((c) => c.status)).toEqual(['EXPIRED', 'EXPIRED']);
  });

  it('발급 상태 쿠폰만 만료시키고 그 수를 돌려준다', () => {
    const { app, store1 } = issueToYujin();
    redeemCoupon(db, owner(1), store1, dayOf);
    expect(expireCouponsForApplication(db, app.id)).toBe(1);
    expect(couponsOf(app.id).map((c) => c.status)).toEqual(['USED', 'EXPIRED']);
    expect(expireCouponsForApplication(db, app.id)).toBe(0);
  });
});

describe('generateCouponCode', () => {
  it('쿠폰 코드는 6자리이고 겹치면 다시 뽑는다', () => {
    const s = new Set(['000001']);
    let i = 0;
    const seq = [0.000001, 0.5];
    expect(generateCouponCode(s, () => seq[i++] ?? 0.5)).toBe('500000');
  });

  it('앞자리를 0으로 채운다', () => {
    expect(generateCouponCode(new Set(), () => 0)).toBe('000000');
    expect(generateCouponCode(new Set(), () => randomFor('000042'))).toBe('000042');
  });

  it('random을 주지 않으면 Math.random을 쓴다', () =>
    expect(generateCouponCode(new Set(['100000']))).toBe('100001'));
});

describe('redeemCoupon', () => {
  it('사용하면 이번 탐방 방문 수 1', () => {
    const { app, store1 } = issueToYujin();
    const result = redeemCoupon(db, owner(1), store1, dayOf);
    expect(result.tourVisitorCount).toBe(1);
    expect(result.totalVisitorCount).toBe(6); // 지난 탐방 7에서 쓴 5장 + 방금 1장
    expect(couponsOf(app.id).find((c) => c.code === store1)).toMatchObject({
      status: 'USED',
      usedAt: DAY_OF_ISO,
    });
  });

  it('없는 코드는 COUPON_NOT_FOUND', () => {
    issueToYujin();
    expectRejected(() => redeemCoupon(db, owner(1), '000000', dayOf), 404, 'COUPON_NOT_FOUND');
  });

  it('다른 가게 쿠폰은 COUPON_OTHER_STORE', () => {
    const { store1 } = issueToYujin();
    expectRejected(() => redeemCoupon(db, owner(2), store1, dayOf), 403, 'COUPON_OTHER_STORE');
  });

  it('이미 사용한 쿠폰은 COUPON_ALREADY_USED와 처음 사용한 시각', () => {
    const { store1 } = issueToYujin();
    redeemCoupon(db, owner(1), store1, dayOf);
    expectRejected(
      () => redeemCoupon(db, owner(1), store1, new Date('2026-11-15T05:10:00Z')),
      409,
      'COUPON_ALREADY_USED',
      { usedAt: DAY_OF_ISO },
    );
  });

  it('기한이 지난 쿠폰은 COUPON_EXPIRED', () => {
    const { store1 } = issueToYujin();
    expectRejected(() => redeemCoupon(db, owner(1), store1, nextDay), 409, 'COUPON_EXPIRED');
  });

  it('신청 취소로 만료된 쿠폰도 COUPON_EXPIRED', () => {
    const { app, store1 } = issueToYujin();
    cancelApplication(db, id('yujin@demo.kr'), app.id, now);
    expectRejected(() => redeemCoupon(db, owner(1), store1, dayOf), 409, 'COUPON_EXPIRED');
  });

  it('탐방 전날에는 COUPON_NOT_YET', () => {
    const { store1 } = issueToYujin();
    expectRejected(() => redeemCoupon(db, owner(1), store1, now), 409, 'COUPON_NOT_YET');
  });

  it('방문 수는 같은 상점의 사용 쿠폰을 이번 탐방 · 전체로 센다', () => {
    const { store1, store2 } = issueToYujin();
    // 코스 확정 전에 승인된 박서준도 쿠폰을 받는다
    const seojun = issueCouponsForApplication(db, appOf('seojun@demo.kr').id, now);
    const seojunStore1 = seojun.find((c) => c.storeId === 1)!.code;
    expect(redeemCoupon(db, owner(1), store1, dayOf)).toMatchObject({
      tourVisitorCount: 1,
      totalVisitorCount: 6,
    });
    expect(redeemCoupon(db, owner(1), seojunStore1, dayOf)).toMatchObject({
      tourVisitorCount: 2,
      totalVisitorCount: 7,
    });
    expect(redeemCoupon(db, owner(2), store2, dayOf)).toMatchObject({
      tourVisitorCount: 1,
      totalVisitorCount: 6,
    });
  });
});
