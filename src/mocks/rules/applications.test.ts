import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMockNow } from '@/mocks/clock';
import type { DB } from '@/mocks/db/schema';
import { createSeed, DEMO_TOUR_ID } from '@/mocks/db/seed';
import { ERROR_MESSAGES, type ErrorCode } from '@/shared/lib/errors';
import {
  activeApplication,
  applyToTour,
  approveApplication,
  cancelApplication,
  isCancellable,
  rejectApplication,
  remainingSeats,
} from './applications';
import { MockApiError } from './errors';

const now = new Date('2026-11-14T03:00:00Z'); // 시연일 전날 KST 12:00
const NOW_ISO = '2026-11-14T12:00:00+09:00';

let db: DB;
beforeEach(() => {
  db = createSeed(new Date('2026-11-15T01:00:00Z')); // 시연일 2026-11-15, 탐방 1은 그날 14:00
});
afterEach(() => setMockNow(null));

const id = (email: string) => db.users.find((u) => u.email === email)!.id;
const guideId = () => id('guide@demo.kr');
const tour = (tourId: number) => db.tours.find((t) => t.id === tourId)!;
/** 시드에 들어 있는 신청(사용자마다 탐방당 하나). */
const seedApp = (email: string, tourId = DEMO_TOUR_ID) =>
  db.applications.find((a) => a.tourId === tourId && a.userId === id(email))!;

/** 규칙이 이 상태 · 코드로 던지고, DB는 하나도 바뀌지 않았는지 확인한다. */
function expectRejected(fn: () => unknown, status: number, code: ErrorCode) {
  const before = structuredClone(db);
  expect(fn).toThrow(expect.objectContaining({ status, code }));
  expect(db).toEqual(before);
}

describe('MockApiError', () => {
  it('메시지를 주지 않으면 에러 코드의 한국어 문구를 쓴다', () => {
    const error = new MockApiError(409, 'TOUR_CLOSED');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      status: 409,
      code: 'TOUR_CLOSED',
      message: ERROR_MESSAGES.TOUR_CLOSED,
    });
    expect(error.details).toBeUndefined();
  });

  it('메시지와 부가 값을 그대로 담는다', () => {
    const error = new MockApiError(409, 'COUPON_ALREADY_USED', '이미 사용', { usedAt: NOW_ISO });
    expect(error.message).toBe('이미 사용');
    expect(error.details).toEqual({ usedAt: NOW_ISO });
  });
});

describe('remainingSeats · activeApplication', () => {
  it('남은 자리는 정원 − 승인 수(대기는 세지 않는다)', () => {
    expect(remainingSeats(db, 1)).toBe(3); // 정원 5, 승인 2, 대기 1
    expect(remainingSeats(db, 2)).toBe(0); // 정원 3, 승인 3
    expect(remainingSeats(db, 6)).toBe(5);
  });

  it('없는 탐방은 NOT_FOUND', () =>
    expectRejected(() => remainingSeats(db, 999), 404, 'NOT_FOUND'));

  it('유효 신청은 같은 탐방의 대기 · 승인 신청', () => {
    expect(activeApplication(db, id('seojun@demo.kr'), 1)?.status).toBe('APPROVED');
    expect(activeApplication(db, id('yujin@demo.kr'), 1)?.status).toBe('PENDING');
    expect(activeApplication(db, id('student@demo.kr'), 1)).toBeUndefined();
    expect(activeApplication(db, id('seojun@demo.kr'), 6)).toBeUndefined();
  });
});

describe('applyToTour', () => {
  it('정상 신청은 PENDING', () => {
    const studentId = id('student@demo.kr');
    const app = applyToTour(db, studentId, 1, '밥집이 궁금해요', now);
    expect(app).toMatchObject({
      tourId: 1,
      userId: studentId,
      motivation: '밥집이 궁금해요',
      status: 'PENDING',
      activeUserId: studentId,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(db.nextId).toBe(app.id + 1); // 시드 이후 ID 카운터를 쓴다
    expect(db.applications).toContain(app);
    expect(activeApplication(db, studentId, 1)).toBe(app);
    expect(remainingSeats(db, 1)).toBe(3); // 대기는 자리를 차지하지 않는다
  });

  it('동기는 앞뒤 공백을 지우고 저장한다', () =>
    expect(applyToTour(db, id('student@demo.kr'), 1, '  수업이 궁금해요\n', now).motivation).toBe(
      '수업이 궁금해요',
    ));

  it('탐방이 없으면 NOT_FOUND', () =>
    expectRejected(
      () => applyToTour(db, id('student@demo.kr'), 999, '궁금해요', now),
      404,
      'NOT_FOUND',
    ));

  it('고교생이 아니면 FORBIDDEN', () =>
    expectRejected(() => applyToTour(db, guideId(), 1, '궁금해요', now), 403, 'FORBIDDEN'));

  it('인증 전이면 NOT_VERIFIED', () => {
    expectRejected(
      () => applyToTour(db, id('newbie@demo.kr'), 1, '궁금해요', now),
      403,
      'NOT_VERIFIED',
    );
    // 심사 대기(PENDING)도 마찬가지
    expectRejected(
      () => applyToTour(db, id('pending@demo.kr'), 1, '궁금해요', now),
      403,
      'NOT_VERIFIED',
    );
  });

  it('보호자 동의 전이면 GUARDIAN_NOT_AGREED', () => {
    const studentId = id('student@demo.kr');
    db.guardianConsents.find((g) => g.id === studentId)!.status = 'PENDING';
    expectRejected(
      () => applyToTour(db, studentId, 1, '궁금해요', now),
      403,
      'GUARDIAN_NOT_AGREED',
    );
    db.guardianConsents = db.guardianConsents.filter((g) => g.id !== studentId); // 동의 요청 전
    expectRejected(
      () => applyToTour(db, studentId, 1, '궁금해요', now),
      403,
      'GUARDIAN_NOT_AGREED',
    );
  });

  it('중복 신청 차단, 취소 후엔 허용, 거절 후엔 차단', () => {
    const studentId = id('student@demo.kr');
    const first = applyToTour(db, studentId, 1, '밥집이 궁금해요', now);
    expectRejected(
      () => applyToTour(db, studentId, 1, '또 신청해요', now),
      409,
      'DUPLICATE_APPLICATION',
    );

    cancelApplication(db, studentId, first.id, now);
    const second = applyToTour(db, studentId, 1, '다시 신청해요', now);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('PENDING');

    rejectApplication(db, guideId(), second.id);
    expectRejected(
      () => applyToTour(db, studentId, 1, '한 번 더 신청해요', now),
      409,
      'REAPPLY_AFTER_REJECT',
    );
  });

  it('승인된 신청이 있어도 DUPLICATE_APPLICATION', () =>
    expectRejected(
      () => applyToTour(db, id('seojun@demo.kr'), 1, '또 신청해요', now),
      409,
      'DUPLICATE_APPLICATION',
    ));

  it('완료 · 취소된 탐방은 TOUR_NOT_RECRUITING', () => {
    const studentId = id('student@demo.kr');
    expectRejected(
      () => applyToTour(db, studentId, 7, '궁금해요', now),
      409,
      'TOUR_NOT_RECRUITING',
    );
    tour(6).status = 'CANCELED';
    expectRejected(
      () => applyToTour(db, studentId, 6, '궁금해요', now),
      409,
      'TOUR_NOT_RECRUITING',
    );
  });

  it('마감됐거나 남은 자리가 없으면 TOUR_CLOSED', () => {
    const studentId = id('student@demo.kr');
    expectRejected(() => applyToTour(db, studentId, 2, '궁금해요', now), 409, 'TOUR_CLOSED');
    tour(1).capacity = 2; // 모집 중이지만 승인 2명으로 자리가 없다
    expectRejected(() => applyToTour(db, studentId, 1, '궁금해요', now), 409, 'TOUR_CLOSED');
  });

  it('동기가 비어 있으면 VALIDATION', () => {
    const studentId = id('student@demo.kr');
    expectRejected(() => applyToTour(db, studentId, 1, '', now), 400, 'VALIDATION');
    expectRejected(() => applyToTour(db, studentId, 1, ' \n\t ', now), 400, 'VALIDATION');
    // HTTP 본문에 동기가 없을 때
    expectRejected(
      () => applyToTour(db, studentId, 1, undefined as unknown as string, now),
      400,
      'VALIDATION',
    );
  });
});

describe('approveApplication', () => {
  it('대기 신청을 승인하면 APPROVED', () => {
    const app = approveApplication(db, guideId(), seedApp('yujin@demo.kr').id, now);
    expect(app).toMatchObject({
      status: 'APPROVED',
      activeUserId: id('yujin@demo.kr'),
      updatedAt: NOW_ISO,
    });
    expect(remainingSeats(db, 1)).toBe(2);
    expect(tour(1).status).toBe('RECRUITING');
  });

  it('신청이 없으면 NOT_FOUND', () =>
    expectRejected(() => approveApplication(db, guideId(), 999, now), 404, 'NOT_FOUND'));

  it('남의 탐방 신청은 FORBIDDEN', () =>
    expectRejected(
      () => approveApplication(db, id('guide-dku@demo.kr'), seedApp('yujin@demo.kr').id, now),
      403,
      'FORBIDDEN',
    ));

  it('대기 중이 아니면 ALREADY_PROCESSED', () => {
    expectRejected(
      () => approveApplication(db, guideId(), seedApp('seojun@demo.kr').id, now),
      409,
      'ALREADY_PROCESSED',
    );
    const yujin = seedApp('yujin@demo.kr');
    rejectApplication(db, guideId(), yujin.id);
    expectRejected(
      () => approveApplication(db, guideId(), yujin.id, now),
      409,
      'ALREADY_PROCESSED',
    );
  });

  it('정원이 차면 자동 마감, 승인 취소하면 다시 모집', () => {
    // 정원 5, 승인 2(박서준 · 이하은), 대기 1(최유진) + 3명이 더 신청한다
    const [minji, woojin, soyoung] = ['student@demo.kr', 'past1@demo.kr', 'past2@demo.kr'].map(
      (email) => applyToTour(db, id(email), 1, '수업이 궁금해요', now),
    );
    approveApplication(db, guideId(), seedApp('yujin@demo.kr').id, now); // 3
    approveApplication(db, guideId(), minji.id, now); // 4
    expect(tour(1).status).toBe('RECRUITING');
    approveApplication(db, guideId(), woojin.id, now); // 5 = 정원
    expect(tour(1)).toMatchObject({ status: 'CLOSED', updatedAt: NOW_ISO });
    expect(remainingSeats(db, 1)).toBe(0);

    expectRejected(
      () => approveApplication(db, guideId(), soyoung.id, now),
      409,
      'CAPACITY_EXCEEDED',
    );

    cancelApplication(db, id('student@demo.kr'), minji.id, now); // 승인자 1명 취소
    expect(tour(1).status).toBe('RECRUITING');
    expect(remainingSeats(db, 1)).toBe(1);

    approveApplication(db, guideId(), soyoung.id, now);
    expect(tour(1).status).toBe('CLOSED');
  });

  it('모집 중이 아닌 탐방의 상태는 승인으로 덮어쓰지 않는다', () => {
    tour(1).capacity = 3;
    tour(1).status = 'COMPLETED';
    approveApplication(db, guideId(), seedApp('yujin@demo.kr').id, now); // 승인 3 = 정원
    expect(tour(1).status).toBe('COMPLETED');
  });
});

describe('rejectApplication', () => {
  it('대기 신청을 거절하면 REJECTED이고 유효 신청에서 빠진다', () => {
    setMockNow(now);
    const app = rejectApplication(db, guideId(), seedApp('yujin@demo.kr').id);
    expect(app).toMatchObject({ status: 'REJECTED', activeUserId: null, updatedAt: NOW_ISO });
    expect(activeApplication(db, id('yujin@demo.kr'), 1)).toBeUndefined();
    expect(remainingSeats(db, 1)).toBe(3);
  });

  it('신청이 없으면 NOT_FOUND', () =>
    expectRejected(() => rejectApplication(db, guideId(), 999), 404, 'NOT_FOUND'));

  it('남의 탐방 신청은 FORBIDDEN', () =>
    expectRejected(
      () => rejectApplication(db, id('guide-dku@demo.kr'), seedApp('yujin@demo.kr').id),
      403,
      'FORBIDDEN',
    ));

  it('대기 중이 아니면 ALREADY_PROCESSED', () =>
    expectRejected(
      () => rejectApplication(db, guideId(), seedApp('seojun@demo.kr').id),
      409,
      'ALREADY_PROCESSED',
    ));
});

describe('cancelApplication', () => {
  it('대기 신청을 취소하면 CANCELED이고 유효 신청에서 빠진다', () => {
    const app = cancelApplication(db, id('yujin@demo.kr'), seedApp('yujin@demo.kr').id, now);
    expect(app).toMatchObject({ status: 'CANCELED', activeUserId: null, updatedAt: NOW_ISO });
    expect(activeApplication(db, id('yujin@demo.kr'), 1)).toBeUndefined();
  });

  it('승인된 신청을 취소하면 자리가 돌아온다', () => {
    cancelApplication(db, id('seojun@demo.kr'), seedApp('seojun@demo.kr').id, now);
    expect(remainingSeats(db, 1)).toBe(4);
  });

  it('대기 신청을 취소해도 마감은 그대로', () => {
    tour(1).capacity = 2; // 승인 2명으로 가득 차 마감된 탐방
    tour(1).status = 'CLOSED';
    cancelApplication(db, id('yujin@demo.kr'), seedApp('yujin@demo.kr').id, now);
    expect(tour(1).status).toBe('CLOSED');
  });

  it('신청이 없으면 NOT_FOUND', () =>
    expectRejected(() => cancelApplication(db, id('yujin@demo.kr'), 999, now), 404, 'NOT_FOUND'));

  it('남의 신청은 FORBIDDEN', () =>
    expectRejected(
      () => cancelApplication(db, id('student@demo.kr'), seedApp('yujin@demo.kr').id, now),
      403,
      'FORBIDDEN',
    ));

  it('이미 취소 · 거절된 신청은 ALREADY_PROCESSED', () => {
    const yujinId = id('yujin@demo.kr');
    const canceled = cancelApplication(db, yujinId, seedApp('yujin@demo.kr').id, now);
    expectRejected(
      () => cancelApplication(db, yujinId, canceled.id, now),
      409,
      'ALREADY_PROCESSED',
    );

    const studentId = id('student@demo.kr');
    const rejected = applyToTour(db, studentId, 1, '궁금해요', now);
    rejectApplication(db, guideId(), rejected.id);
    expectRejected(
      () => cancelApplication(db, studentId, rejected.id, now),
      409,
      'ALREADY_PROCESSED',
    );
  });

  it('탐방 당일 취소는 CANCEL_AFTER_TOUR_DATE', () => {
    expectRejected(
      () =>
        cancelApplication(
          db,
          id('seojun@demo.kr'),
          seedApp('seojun@demo.kr').id,
          new Date('2026-11-15T10:00:00+09:00'),
        ),
      409,
      'CANCEL_AFTER_TOUR_DATE',
    );
    // 탐방 날짜가 지난 뒤도 마찬가지
    expectRejected(
      () =>
        cancelApplication(
          db,
          id('yujin@demo.kr'),
          seedApp('yujin@demo.kr').id,
          new Date('2026-11-16T09:00:00+09:00'),
        ),
      409,
      'CANCEL_AFTER_TOUR_DATE',
    );
  });

  it('서울 날짜로 자른다: 전날 23:59:59까지 되고 당일 00:00부터 막힌다', () => {
    const yujinId = id('yujin@demo.kr');
    const appId = seedApp('yujin@demo.kr').id;
    expectRejected(
      () => cancelApplication(db, yujinId, appId, new Date('2026-11-15T00:00:00+09:00')),
      409,
      'CANCEL_AFTER_TOUR_DATE',
    );
    expect(
      cancelApplication(db, yujinId, appId, new Date('2026-11-14T23:59:59+09:00')).status,
    ).toBe('CANCELED');
  });
});

describe('isCancellable', () => {
  it('대기 · 승인 신청은 탐방 전날까지 취소할 수 있다', () => {
    expect(isCancellable(db, seedApp('yujin@demo.kr'), now)).toBe(true);
    const seojun = seedApp('seojun@demo.kr');
    expect(isCancellable(db, seojun, new Date('2026-11-14T23:59:59+09:00'))).toBe(true);
    expect(isCancellable(db, seojun, new Date('2026-11-15T00:00:00+09:00'))).toBe(false);
  });

  it('거절 · 취소된 신청은 취소할 수 없다', () => {
    const yujin = seedApp('yujin@demo.kr');
    rejectApplication(db, guideId(), yujin.id);
    expect(isCancellable(db, yujin, now)).toBe(false);
    const seojun = seedApp('seojun@demo.kr');
    cancelApplication(db, id('seojun@demo.kr'), seojun.id, now);
    expect(isCancellable(db, seojun, now)).toBe(false);
  });

  it('지난 탐방의 승인 신청은 취소할 수 없다', () =>
    expect(isCancellable(db, seedApp('seojun@demo.kr', 7), now)).toBe(false));
});
