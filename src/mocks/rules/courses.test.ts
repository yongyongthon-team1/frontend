import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMockNow } from '@/mocks/clock';
import type { DB } from '@/mocks/db/schema';
import { createSeed, DEMO_TOUR_ID } from '@/mocks/db/seed';
import type { SpotInput } from '@/features/courses/wire';
import type { ErrorCode } from '@/shared/lib/errors';
import { approveApplication, cancelApplication } from './applications';
import {
  canViewCourse,
  confirmCourse,
  createDraft,
  isCourseAudience,
  replaceSpots,
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

/** 규칙이 이 상태 · 코드(+ 칸 오류)로 던지고, DB는 하나도 바뀌지 않았는지 확인한다. */
function expectRejected(
  fn: () => unknown,
  status: number,
  code: ErrorCode,
  fieldErrors?: Record<string, string>,
) {
  const before = structuredClone(db);
  expect(fn).toThrow(
    expect.objectContaining(fieldErrors ? { status, code, fieldErrors } : { status, code }),
  );
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
    replaceSpots(
      db,
      guideId(),
      DEMO_TOUR_ID,
      [
        { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '14:00' },
        { stopType: 'STORE', storeId: 1, startTime: '15:10', comment: '한줄평' },
      ],
      now,
    );

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

describe('replaceSpots (C-02 전체 교체)', () => {
  /** 탐방 1 초안의 지점 행 [캠퍼스(건물 3), 서천 밥상(상점 1), 카페 모래시계(상점 2)]. */
  const draftRows = () => {
    draft();
    return stopsOf().map((s) => ({ ...s }));
  };

  it('같은 상점 · 건물은 지점 id · 추천 이유를 지키고, 새 상점은 이유 null, 순서 · 시각 · 한줄평은 입력대로', () => {
    const [campus, , cafe] = draftRows();
    replaceSpots(
      db,
      guideId(),
      DEMO_TOUR_ID,
      [
        { stopType: 'STORE', storeId: 2, startTime: '13:30', comment: '  과제하기 좋은 카페 ' },
        { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '15:00' },
        { stopType: 'STORE', storeId: 5, startTime: '16:45', comment: '   ' },
      ],
      later,
    );
    const rows = stopsOf();
    expect(rows.map((s) => [s.id, s.stopOrder, s.visitTime, s.stopType, s.storeId])).toEqual([
      [cafe.id, 1, '13:30', 'STORE', 2],
      [campus.id, 2, '15:00', 'CAMPUS', null],
      [rows[2].id, 3, '16:45', 'STORE', 5],
    ]);
    expect(rows[2].id).not.toBe(cafe.id);
    expect(rows.some((s) => s.storeId === 1)).toBe(false); // 서천 밥상은 빠졌다
    expect(rows.map((s) => s.recommendationReason)).toEqual([
      cafe.recommendationReason,
      campus.recommendationReason,
      null,
    ]);
    expect(rows.map((s) => s.description)).toEqual(['과제하기 좋은 카페', null, null]);
    expect(rows[1].campusBuildingId).toBe(3);
    expect(courseOf()!.updatedAt).toBe(LATER_ISO);
  });

  it('같은 상점을 두 번 넣으면 기존 행은 첫 자리만 지키고 둘째는 새 지점', () => {
    const [, meal] = draftRows();
    replaceSpots(
      db,
      guideId(),
      DEMO_TOUR_ID,
      [
        { stopType: 'STORE', storeId: 1, startTime: '14:00' },
        { stopType: 'STORE', storeId: 1, startTime: '15:10' },
      ],
      now,
    );
    const rows = stopsOf();
    expect(rows[0]).toMatchObject({ id: meal.id, recommendationReason: meal.recommendationReason });
    expect(rows[1]).toMatchObject({ storeId: 1, recommendationReason: null });
    expect(rows[1].id).not.toBe(meal.id);
  });

  it('빈 배열이면 VALIDATION과 spots 칸 오류', () => {
    draft();
    expectRejected(() => replaceSpots(db, guideId(), DEMO_TOUR_ID, [], now), 400, 'VALIDATION', {
      spots: '지점을 1곳 이상 넣어 주세요.',
    });
    expectRejected(
      () => replaceSpots(db, guideId(), DEMO_TOUR_ID, 'x' as unknown as SpotInput[], now),
      400,
      'VALIDATION',
      { spots: '지점을 1곳 이상 넣어 주세요.' },
    );
  });

  it('한줄평은 100자까지, 101자면 VALIDATION', () => {
    draft();
    const spot = (comment: unknown) =>
      [{ stopType: 'STORE', storeId: 1, startTime: '14:00', comment }] as SpotInput[];
    replaceSpots(db, guideId(), DEMO_TOUR_ID, spot('가'.repeat(100)), now);
    expect(stopsOf()[0].description).toBe('가'.repeat(100));
    for (const comment of ['가'.repeat(101), 3]) {
      expectRejected(
        () => replaceSpots(db, guideId(), DEMO_TOUR_ID, spot(comment), now),
        400,
        'VALIDATION',
        { spots: '한줄평은 100자 이내로 적어 주세요.' },
      );
    }
  });

  it('없는 상점 · 다른 학교 건물 · 모르는 유형이면 고를 수 없는 장소', () => {
    draft();
    for (const bad of [
      { stopType: 'STORE', storeId: 999, startTime: '14:00' },
      { stopType: 'STORE', startTime: '14:00' },
      { stopType: 'CAMPUS', campusBuildingId: 1, startTime: '14:00' }, // 1은 강남대 건물
      { stopType: 'CAMPUS', storeId: 1, startTime: '14:00' },
      { stopType: 'PARK', storeId: 1, startTime: '14:00' },
    ]) {
      expectRejected(
        () => replaceSpots(db, guideId(), DEMO_TOUR_ID, [bad] as SpotInput[], now),
        400,
        'VALIDATION',
        { spots: '고를 수 없는 장소예요.' },
      );
    }
  });

  it('시각이 HH:mm이 아니면 VALIDATION', () => {
    draft();
    for (const startTime of ['9:00', '14:00:00', '', undefined]) {
      expectRejected(
        () =>
          replaceSpots(
            db,
            guideId(),
            DEMO_TOUR_ID,
            [{ stopType: 'STORE', storeId: 1, startTime }] as SpotInput[],
            now,
          ),
        400,
        'VALIDATION',
        { spots: '입력값을 확인해 주세요.' },
      );
    }
  });

  it('확정 뒤에는 COURSE_NOT_DRAFT', () => {
    draft();
    confirmCourse(db, guideId(), DEMO_TOUR_ID, now);
    expectRejected(
      () =>
        replaceSpots(
          db,
          guideId(),
          DEMO_TOUR_ID,
          [{ stopType: 'STORE', storeId: 1, startTime: '14:00' }],
          later,
        ),
      409,
      'COURSE_NOT_DRAFT',
    );
  });

  it('코스가 없으면 NOT_FOUND, 남의 탐방이면 FORBIDDEN', () => {
    const spots: SpotInput[] = [{ stopType: 'STORE', storeId: 1, startTime: '14:00' }];
    expectRejected(() => replaceSpots(db, guideId(), DEMO_TOUR_ID, spots, now), 404, 'NOT_FOUND');
    draft();
    expectRejected(
      () => replaceSpots(db, id('guide-dku@demo.kr'), DEMO_TOUR_ID, spots, now),
      403,
      'FORBIDDEN',
    );
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

  it('관련 업종 상점이 모두 비제휴면 제휴 지점 없이 만들고, 확정은 422 COURSE_PARTNER_REQUIRED (2C-R11)', () => {
    db.partnerships = db.partnerships.filter((p) => ![1, 2, 3].includes(p.storeId));
    draft();
    expect(stopsOf().map((s) => [s.storeId, s.partnershipId])).toEqual([
      [null, null],
      [1, null],
      [2, null],
    ]);
    expectRejected(
      () => confirmCourse(db, guideId(), DEMO_TOUR_ID, now),
      422,
      'COURSE_PARTNER_REQUIRED',
    );
    expect(courseOf()!.status).toBe('DRAFT');
  });

  it('반경 안에 제휴가 하나도 없으면 확정은 422 COURSE_PARTNER_REQUIRED', () => {
    db.partnerships = [];
    draft();
    expectRejected(
      () => confirmCourse(db, guideId(), DEMO_TOUR_ID, now),
      422,
      'COURSE_PARTNER_REQUIRED',
    );
  });

  it('제휴가 탐방 날짜에 유효하지 않으면 제휴 지점이 아니다(422)', () => {
    draft();
    for (const p of db.partnerships) p.endDate = '2000-01-01';
    expectRejected(
      () => confirmCourse(db, guideId(), DEMO_TOUR_ID, now),
      422,
      'COURSE_PARTNER_REQUIRED',
    );
  });

  it('지점이 없으면 COURSE_EMPTY(제휴 검사보다 먼저)', () => {
    draft();
    // 백엔드 규칙(spots 1개 이상)으로는 빈 코스를 만들 수 없어 DB를 직접 비운다.
    db.courseStops = db.courseStops.filter((s) => s.tourId !== DEMO_TOUR_ID);
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
