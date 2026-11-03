import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMockNow } from '@/mocks/clock';
import type { DB } from '@/mocks/db/schema';
import { createSeed, DEMO_TOUR_ID } from '@/mocks/db/seed';
import type { ErrorCode } from '@/shared/lib/errors';
import { approveApplication, cancelApplication } from './applications';
import {
  canViewCourse,
  confirmCourse,
  createDraft,
  deleteStop,
  isCourseAudience,
  reorderStops,
  updateStopDescription,
} from './courses';

const today = new Date('2026-11-15T01:00:00Z'); // 시연일 KST 10:00, 탐방 1은 그날 14:00
const now = new Date('2026-11-15T01:30:00Z'); // KST 10:30
const NOW_ISO = '2026-11-15T10:30:00+09:00';
const later = new Date('2026-11-15T02:00:00Z'); // KST 11:00
const LATER_ISO = '2026-11-15T11:00:00+09:00';
const dayBefore = new Date('2026-11-14T03:00:00Z'); // 전날 KST 12:00 — 취소는 탐방 전날까지

let db: DB;
beforeEach(() => {
  db = createSeed(today, 'APPROVED'); // 탐방 1 승인: 박서준 · 이하은 · 김민지, 대기: 최유진
});
afterEach(() => setMockNow(null));

const id = (email: string) => db.users.find((u) => u.email === email)!.id;
const guideId = () => id('guide@demo.kr');
const courseOf = (tourId = DEMO_TOUR_ID) => db.courses.find((c) => c.tourId === tourId);
const stopsOf = (tourId = DEMO_TOUR_ID) =>
  db.courseStops.filter((s) => s.tourId === tourId).sort((a, b) => a.stopOrder - b.stopOrder);
const appOf = (email: string, tourId = DEMO_TOUR_ID) =>
  db.applications.find((a) => a.tourId === tourId && a.userId === id(email))!;
const couponsOf = (applicationId: number) =>
  db.coupons.filter((c) => c.applicationId === applicationId);

/** 규칙이 이 상태 · 코드로 던지고, DB는 하나도 바뀌지 않았는지 확인한다. */
function expectRejected(fn: () => unknown, status: number, code: ErrorCode) {
  const before = structuredClone(db);
  expect(fn).toThrow(expect.objectContaining({ status, code }));
  expect(db).toEqual(before);
}

/** 탐방 1 초안을 만들고 지점 id를 순서대로 돌려준다. */
function draft(): number[] {
  createDraft(db, guideId(), DEMO_TOUR_ID, now);
  return stopsOf().map((s) => s.id);
}

describe('createDraft', () => {
  it('초안 코스 행 하나와 지점 3개를 만든다', () => {
    const course = createDraft(db, guideId(), DEMO_TOUR_ID, now);
    expect(course).toEqual({
      tourId: DEMO_TOUR_ID,
      status: 'DRAFT',
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      confirmedAt: null,
      interests: ['전공 수업', '캠퍼스 시설', '식사', '카페'],
    });
    expect(db.courses).toEqual([course]);
    const stops = stopsOf();
    expect(stops.map((s) => [s.stopOrder, s.visitTime, s.stopType, s.storeId])).toEqual([
      [1, '14:00', 'CAMPUS', null],
      [2, '15:10', 'STORE', 1],
      [3, '16:00', 'STORE', 2],
    ]);
    // 체크포인트가 1000(신청)을 썼으니 지점은 1001부터
    expect(stops.map((s) => s.id)).toEqual([1001, 1002, 1003]);
    expect(stops.every((s) => s.tourId === DEMO_TOUR_ID && s.description === null)).toBe(true);
  });

  it('now를 주지 않으면 목업 시계를 쓴다', () => {
    setMockNow(now);
    expect(createDraft(db, guideId(), DEMO_TOUR_ID).createdAt).toBe(NOW_ISO);
  });

  it('다시 만들면 기존 초안 지점을 지우고 새로 만든다(코스 행은 하나)', () => {
    const first = draft();
    updateStopDescription(db, guideId(), DEMO_TOUR_ID, first[1], '한줄평');
    deleteStop(db, guideId(), DEMO_TOUR_ID, first[2]);

    const again = createDraft(db, guideId(), DEMO_TOUR_ID, later);
    expect(db.courses.filter((c) => c.tourId === DEMO_TOUR_ID)).toEqual([again]);
    expect(again).toMatchObject({ status: 'DRAFT', createdAt: NOW_ISO, updatedAt: LATER_ISO });
    const stops = stopsOf();
    expect(stops.map((s) => s.storeId)).toEqual([null, 1, 2]);
    expect(stops.some((s) => first.includes(s.id))).toBe(false);
    expect(stops.every((s) => s.description === null)).toBe(true);
    expect(db.courseStops).toHaveLength(3);
  });

  it('탐방이 없으면 NOT_FOUND', () =>
    expectRejected(() => createDraft(db, guideId(), 999, now), 404, 'NOT_FOUND'));

  it('남의 탐방이면 FORBIDDEN', () =>
    expectRejected(
      () => createDraft(db, id('guide-dku@demo.kr'), DEMO_TOUR_ID, now),
      403,
      'FORBIDDEN',
    ));

  it('승인 0명이면 NO_APPROVED_APPLICANTS', () => {
    expectRejected(() => createDraft(db, guideId(), 6, now), 409, 'NO_APPROVED_APPLICANTS');
    // 대기 신청만 있어도 마찬가지
    const start = createSeed(today);
    for (const email of ['seojun@demo.kr', 'haeun@demo.kr']) {
      const app = start.applications.find(
        (a) => a.tourId === DEMO_TOUR_ID && a.userId === id(email),
      )!;
      cancelApplication(start, app.userId, app.id, dayBefore);
    }
    expect(() => createDraft(start, guideId(), DEMO_TOUR_ID, now)).toThrow(
      expect.objectContaining({ status: 409, code: 'NO_APPROVED_APPLICANTS' }),
    );
  });

  it('확정된 코스면 COURSE_NOT_DRAFT(승인자가 없어져도 확정이 먼저)', () => {
    draft();
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expectRejected(() => createDraft(db, guideId(), DEMO_TOUR_ID, now), 409, 'COURSE_NOT_DRAFT');
    for (const a of db.applications) {
      if (a.tourId === DEMO_TOUR_ID && a.status === 'APPROVED') a.status = 'CANCELED';
    }
    expectRejected(() => createDraft(db, guideId(), DEMO_TOUR_ID, now), 409, 'COURSE_NOT_DRAFT');
  });
});

describe('reorderStops', () => {
  it('순서를 바꾸면 시간은 칸에 고정', () => {
    const g = guideId();
    createDraft(db, g, 1);
    const ids = db.courseStops
      .filter((s) => s.tourId === 1)
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .map((s) => s.id);
    reorderStops(db, g, 1, [ids[2], ids[0], ids[1]]);
    const after = db.courseStops
      .filter((s) => s.tourId === 1)
      .sort((a, b) => a.stopOrder - b.stopOrder);
    expect(after.map((s) => s.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(after.map((s) => s.visitTime)).toEqual(['14:00', '15:10', '16:00']);
    expect(after.map((s) => s.stopOrder)).toEqual([1, 2, 3]);
  });

  it('바꾼 시각을 코스 수정 시각으로 남긴다', () => {
    const ids = draft();
    setMockNow(later);
    reorderStops(db, guideId(), DEMO_TOUR_ID, [ids[1], ids[0], ids[2]]);
    expect(courseOf()!.updatedAt).toBe(LATER_ISO);
  });

  it('지점 id 목록이 지금 지점들과 다르면 VALIDATION', () => {
    const [a, b, c] = draft();
    const g = guideId();
    for (const stopIds of [[a, b], [a, b, c, c], [a, b, b], [a, b, 999], [a, b, c, 999], []]) {
      expectRejected(() => reorderStops(db, g, DEMO_TOUR_ID, stopIds), 400, 'VALIDATION');
    }
    expectRejected(
      () => reorderStops(db, g, DEMO_TOUR_ID, 'x' as unknown as number[]),
      400,
      'VALIDATION',
    );
    expectRejected(
      () => reorderStops(db, g, DEMO_TOUR_ID, [String(a), b, c] as unknown as number[]),
      400,
      'VALIDATION',
    );
  });

  it('확정 뒤에는 COURSE_NOT_DRAFT', () => {
    const [a, b, c] = draft();
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expectRejected(
      () => reorderStops(db, guideId(), DEMO_TOUR_ID, [c, b, a]),
      409,
      'COURSE_NOT_DRAFT',
    );
  });

  it('코스가 없으면 NOT_FOUND, 남의 탐방이면 FORBIDDEN', () => {
    expectRejected(() => reorderStops(db, guideId(), DEMO_TOUR_ID, []), 404, 'NOT_FOUND');
    const ids = draft();
    expectRejected(
      () => reorderStops(db, id('guide-dku@demo.kr'), DEMO_TOUR_ID, ids),
      403,
      'FORBIDDEN',
    );
  });
});

describe('updateStopDescription', () => {
  it('한줄평을 앞뒤 공백 없이 저장하고, 비우면 null', () => {
    const ids = draft();
    setMockNow(later);
    updateStopDescription(db, guideId(), DEMO_TOUR_ID, ids[1], '  여기 된장찌개가 맛있어요 \n');
    expect(stopsOf()[1].description).toBe('여기 된장찌개가 맛있어요');
    expect(courseOf()!.updatedAt).toBe(LATER_ISO);
    updateStopDescription(db, guideId(), DEMO_TOUR_ID, ids[1], '   ');
    expect(stopsOf()[1].description).toBeNull();
  });

  it('문자열이 아니면 VALIDATION', () => {
    const ids = draft();
    expectRejected(
      () =>
        updateStopDescription(db, guideId(), DEMO_TOUR_ID, ids[0], undefined as unknown as string),
      400,
      'VALIDATION',
    );
  });

  it('이 탐방의 지점이 아니면 NOT_FOUND', () => {
    draft();
    expectRejected(
      () => updateStopDescription(db, guideId(), DEMO_TOUR_ID, 999, '한줄평'),
      404,
      'NOT_FOUND',
    );
  });

  it('확정 뒤에는 COURSE_NOT_DRAFT, 남의 탐방이면 FORBIDDEN', () => {
    const ids = draft();
    expectRejected(
      () => updateStopDescription(db, id('guide-dku@demo.kr'), DEMO_TOUR_ID, ids[0], '한줄평'),
      403,
      'FORBIDDEN',
    );
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expectRejected(
      () => updateStopDescription(db, guideId(), DEMO_TOUR_ID, ids[0], '한줄평'),
      409,
      'COURSE_NOT_DRAFT',
    );
  });
});

describe('deleteStop', () => {
  it('지점을 빼면 남은 지점의 순서 · 시간을 다시 맞춘다', () => {
    const [a, b, c] = draft();
    deleteStop(db, guideId(), DEMO_TOUR_ID, a);
    expect(stopsOf().map((s) => [s.id, s.stopOrder, s.visitTime])).toEqual([
      [b, 1, '14:00'],
      [c, 2, '15:10'],
    ]);
    deleteStop(db, guideId(), DEMO_TOUR_ID, c);
    deleteStop(db, guideId(), DEMO_TOUR_ID, b);
    expect(stopsOf()).toEqual([]);
    expect(courseOf()!.status).toBe('DRAFT');
  });

  it('이 탐방의 지점이 아니면 NOT_FOUND', () => {
    draft();
    expectRejected(() => deleteStop(db, guideId(), DEMO_TOUR_ID, 999), 404, 'NOT_FOUND');
  });

  it('확정 뒤에는 COURSE_NOT_DRAFT', () => {
    const ids = draft();
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expectRejected(() => deleteStop(db, guideId(), DEMO_TOUR_ID, ids[0]), 409, 'COURSE_NOT_DRAFT');
  });
});

describe('confirmCourse', () => {
  it('확정하면 승인자 × 제휴 지점만큼 쿠폰', () => {
    draft();
    expect(confirmCourse(db, guideId(), DEMO_TOUR_ID, now)).toEqual({ issuedCouponCount: 6 });
    expect(courseOf()).toMatchObject({
      status: 'CONFIRMED',
      confirmedAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    for (const email of ['seojun@demo.kr', 'haeun@demo.kr', 'student@demo.kr']) {
      const coupons = couponsOf(appOf(email).id);
      expect(coupons.map((c) => [c.storeId, c.status, c.issuedAt])).toEqual([
        [1, 'ISSUED', NOW_ISO],
        [2, 'ISSUED', NOW_ISO],
      ]);
    }
    expect(couponsOf(appOf('yujin@demo.kr').id)).toEqual([]); // 대기 중이라 발급 안 됨
  });

  it('확정 뒤에 승인한 신청자에게도 쿠폰', () => {
    draft();
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    approveApplication(db, guideId(), appOf('yujin@demo.kr').id, later);
    expect(couponsOf(appOf('yujin@demo.kr').id).map((c) => c.storeId)).toEqual([1, 2]);
  });

  it('관련 업종 상점이 모두 비제휴면 제휴 지점 없이 만들고, 확정 시 쿠폰 0장', () => {
    db.partnerships = db.partnerships.filter((p) => ![1, 2, 3].includes(p.storeId));
    draft();
    expect(stopsOf().map((s) => [s.storeId, s.partnershipId])).toEqual([
      [null, null],
      [1, null],
      [2, null],
    ]);
    expect(confirmCourse(db, guideId(), DEMO_TOUR_ID, now)).toEqual({ issuedCouponCount: 0 });
    expect(courseOf()!.status).toBe('CONFIRMED');
  });

  it('반경 안에 제휴가 하나도 없으면 확정 시 쿠폰 0장', () => {
    db.partnerships = [];
    draft();
    expect(confirmCourse(db, guideId(), DEMO_TOUR_ID, now)).toEqual({ issuedCouponCount: 0 });
  });

  it('지점이 없으면 COURSE_EMPTY', () => {
    for (const stopId of draft()) deleteStop(db, guideId(), DEMO_TOUR_ID, stopId);
    expectRejected(() => confirmCourse(db, guideId(), DEMO_TOUR_ID, now), 409, 'COURSE_EMPTY');
  });

  it('이미 확정했으면 COURSE_NOT_DRAFT', () => {
    draft();
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expectRejected(
      () => confirmCourse(db, guideId(), DEMO_TOUR_ID, later),
      409,
      'COURSE_NOT_DRAFT',
    );
  });

  it('코스가 없으면 NOT_FOUND, 남의 탐방이면 FORBIDDEN', () => {
    expectRejected(() => confirmCourse(db, guideId(), DEMO_TOUR_ID, now), 404, 'NOT_FOUND');
    expectRejected(() => confirmCourse(db, guideId(), 999, now), 404, 'NOT_FOUND');
    draft();
    expectRejected(
      () => confirmCourse(db, id('guide-dku@demo.kr'), DEMO_TOUR_ID, now),
      403,
      'FORBIDDEN',
    );
  });
});

describe('코스 조회 권한', () => {
  it('isCourseAudience: 그 탐방의 승인 신청자이거나 가이드', () => {
    const audience = (email: string, tourId = DEMO_TOUR_ID) =>
      isCourseAudience(db, id(email), tourId);
    expect(audience('student@demo.kr')).toBe(true); // 승인(체크포인트)
    expect(audience('seojun@demo.kr')).toBe(true);
    expect(audience('guide@demo.kr')).toBe(true);
    expect(audience('yujin@demo.kr')).toBe(false); // 대기
    expect(audience('newbie@demo.kr')).toBe(false); // 신청 없음
    expect(audience('guide-dku@demo.kr')).toBe(false); // 다른 가이드
    expect(audience('owner1@demo.kr')).toBe(false);
    expect(audience('seojun@demo.kr', 6)).toBe(false); // 다른 탐방
    expect(isCourseAudience(db, id('guide@demo.kr'), 999)).toBe(false);
    cancelApplication(db, id('seojun@demo.kr'), appOf('seojun@demo.kr').id, dayBefore);
    expect(audience('seojun@demo.kr')).toBe(false); // 취소하면 빠진다
  });

  it('canViewCourse: 코스가 CONFIRMED일 때만 audience에게', () => {
    const canView = (email: string) => canViewCourse(db, id(email), DEMO_TOUR_ID);
    expect(canView('student@demo.kr')).toBe(false); // 코스 없음
    draft();
    expect(canView('student@demo.kr')).toBe(false); // DRAFT
    expect(canView('guide@demo.kr')).toBe(false);
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expect(canView('student@demo.kr')).toBe(true);
    expect(canView('guide@demo.kr')).toBe(true);
    expect(canView('yujin@demo.kr')).toBe(false); // PENDING
    expect(canView('guide-dku@demo.kr')).toBe(false);
  });

  it('CONFIRMED 체크포인트: 승인 학생 · 가이드는 볼 수 있고 최유진(PENDING)은 못 본다', () => {
    db = createSeed(today, 'CONFIRMED');
    expect(canViewCourse(db, id('student@demo.kr'), DEMO_TOUR_ID)).toBe(true);
    expect(canViewCourse(db, id('haeun@demo.kr'), DEMO_TOUR_ID)).toBe(true);
    expect(canViewCourse(db, id('guide@demo.kr'), DEMO_TOUR_ID)).toBe(true);
    expect(canViewCourse(db, id('yujin@demo.kr'), DEMO_TOUR_ID)).toBe(false);
  });
});
