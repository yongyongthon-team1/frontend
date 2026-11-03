import type { ApplicationStatus } from '@/features/applications/model';
import { mockNow } from '@/mocks/clock';
import type { ApplicationRow, DB, TourRow } from '@/mocks/db/schema';
import { nextId } from '@/mocks/db/store';
import { seoulDateKey, toSeoulIso } from '@/shared/lib/date';
import { expireCouponsForApplication, issueCouponsForApplication } from './coupons';
import { MockApiError } from './errors';

// 신청 · 승인 · 거절 · 취소 규칙(A-01~03, T-05 자동 마감). 모두 `db`를 직접 고치고 행을 돌려준다
// (저장은 핸들러의 `mutate`). 위에서부터 차례로 검사해 처음 걸린 오류를 던지고, 검사를 모두 마친 뒤에만
// 행을 바꾼다 — 규칙에 걸리면 DB는 그대로다.

function findTour(db: DB, tourId: number): TourRow {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  return tour;
}

function findApplication(db: DB, applicationId: number): ApplicationRow {
  const app = db.applications.find((a) => a.id === applicationId);
  if (!app) throw new MockApiError(404, 'NOT_FOUND');
  return app;
}

const isActive = (app: ApplicationRow) => app.status === 'PENDING' || app.status === 'APPROVED';

/** 상태를 바꾸면서 `activeUserId`(PENDING · APPROVED일 때만 userId)와 수정 시각을 함께 맞춘다. */
function setStatus(app: ApplicationRow, status: ApplicationStatus, at: string): void {
  app.status = status;
  app.activeUserId = isActive(app) ? app.userId : null;
  app.updatedAt = at;
}

function approvedCount(db: DB, tourId: number): number {
  return db.applications.filter((a) => a.tourId === tourId && a.status === 'APPROVED').length;
}

/** 남은 자리 = 정원 − 승인 수(0 아래로 내려가지 않는다). 대기 신청은 자리를 차지하지 않는다. */
export function remainingSeats(db: DB, tourId: number): number {
  const tour = findTour(db, tourId);
  return Math.max(0, tour.capacity - approvedCount(db, tourId));
}

/** 이 사용자의 같은 탐방 대기 · 승인 신청(ERD `active_user_id`가 채워진 신청). 없으면 `undefined`. */
export function activeApplication(
  db: DB,
  userId: number,
  tourId: number,
): ApplicationRow | undefined {
  return db.applications.find((a) => a.tourId === tourId && a.userId === userId && isActive(a));
}

/** 탐방 신청. 취소 이력은 재신청을 막지 않고, 거절 이력은 막는다. 동기는 앞뒤 공백을 지워 저장한다. */
export function applyToTour(
  db: DB,
  userId: number,
  tourId: number,
  motivation: string,
  now: Date,
): ApplicationRow {
  const tour = findTour(db, tourId);
  if (db.users.find((u) => u.id === userId)?.role !== 'HIGH_SCHOOL') {
    throw new MockApiError(403, 'FORBIDDEN');
  }
  if (db.verifications.find((v) => v.id === userId)?.status !== 'APPROVED') {
    throw new MockApiError(403, 'NOT_VERIFIED');
  }
  if (db.guardianConsents.find((g) => g.id === userId)?.status !== 'AGREED') {
    throw new MockApiError(403, 'GUARDIAN_NOT_AGREED');
  }
  if (activeApplication(db, userId, tourId)) throw new MockApiError(409, 'DUPLICATE_APPLICATION');
  if (
    db.applications.some(
      (a) => a.tourId === tourId && a.userId === userId && a.status === 'REJECTED',
    )
  ) {
    throw new MockApiError(409, 'REAPPLY_AFTER_REJECT');
  }
  if (tour.status === 'CANCELED' || tour.status === 'COMPLETED') {
    throw new MockApiError(409, 'TOUR_NOT_RECRUITING');
  }
  if (tour.status === 'CLOSED' || remainingSeats(db, tourId) === 0) {
    throw new MockApiError(409, 'TOUR_CLOSED');
  }
  // HTTP 본문에서 바로 넘어오면 문자열이 아닐 수도 있다.
  const text = typeof motivation === 'string' ? motivation.trim() : '';
  if (text === '') throw new MockApiError(400, 'VALIDATION');

  const at = toSeoulIso(now);
  const app: ApplicationRow = {
    id: nextId(db),
    tourId,
    userId,
    motivation: text,
    status: 'PENDING',
    activeUserId: userId,
    createdAt: at,
    updatedAt: at,
  };
  db.applications.push(app);
  return app;
}

/**
 * 가이드가 자기 탐방의 대기 신청을 승인한다. 승인 수가 정원에 닿으면 모집 중인 탐방을 마감(CLOSED)하고,
 * 코스가 이미 확정돼 있으면 이 신청자에게도 쿠폰을 발급한다.
 */
export function approveApplication(
  db: DB,
  guideId: number,
  applicationId: number,
  now: Date,
): ApplicationRow {
  const app = findApplication(db, applicationId);
  const tour = findTour(db, app.tourId);
  if (tour.guideId !== guideId) throw new MockApiError(403, 'FORBIDDEN');
  if (app.status !== 'PENDING') throw new MockApiError(409, 'ALREADY_PROCESSED');
  if (remainingSeats(db, tour.id) === 0) throw new MockApiError(409, 'CAPACITY_EXCEEDED');

  const at = toSeoulIso(now);
  setStatus(app, 'APPROVED', at);
  if (tour.status === 'RECRUITING' && approvedCount(db, tour.id) >= tour.capacity) {
    tour.status = 'CLOSED';
    tour.updatedAt = at;
  }
  if (db.courses.some((c) => c.tourId === tour.id && c.status === 'CONFIRMED')) {
    issueCouponsForApplication(db, app.id, now);
  }
  return app;
}

/** 가이드가 자기 탐방의 대기 신청을 거절한다. 거절된 학생은 이 탐방에 다시 신청할 수 없다. */
export function rejectApplication(db: DB, guideId: number, applicationId: number): ApplicationRow {
  const app = findApplication(db, applicationId);
  const tour = findTour(db, app.tourId);
  if (tour.guideId !== guideId) throw new MockApiError(403, 'FORBIDDEN');
  if (app.status !== 'PENDING') throw new MockApiError(409, 'ALREADY_PROCESSED');

  // 판단에 시각이 필요 없어 시그니처에 now가 없다. 수정 시각만 목업 시계로 남긴다.
  setStatus(app, 'REJECTED', toSeoulIso(mockNow()));
  return app;
}

/**
 * 학생이 자기 대기 · 승인 신청을 취소한다. 탐방 날짜(서울) 전날까지만 된다. 발급된 쿠폰은 만료되고,
 * 승인 신청을 취소하면 자리가 돌아와 마감(CLOSED)된 탐방이 다시 모집 중(RECRUITING)이 된다.
 */
export function cancelApplication(
  db: DB,
  userId: number,
  applicationId: number,
  now: Date,
): ApplicationRow {
  const app = findApplication(db, applicationId);
  if (app.userId !== userId) throw new MockApiError(403, 'FORBIDDEN');
  if (!isActive(app)) throw new MockApiError(409, 'ALREADY_PROCESSED');
  const tour = findTour(db, app.tourId);
  if (seoulDateKey(now) >= seoulDateKey(tour.startsAt)) {
    throw new MockApiError(409, 'CANCEL_AFTER_TOUR_DATE');
  }

  const at = toSeoulIso(now);
  const wasApproved = app.status === 'APPROVED';
  setStatus(app, 'CANCELED', at);
  expireCouponsForApplication(db, app.id);
  if (wasApproved && tour.status === 'CLOSED') {
    tour.status = 'RECRUITING';
    tour.updatedAt = at;
  }
  return app;
}

/** `MyApplication.cancellable`: 대기 · 승인 상태이고 지금(서울 날짜)이 탐방 날짜 전이면 직접 취소할 수 있다. */
export function isCancellable(db: DB, app: ApplicationRow, now: Date): boolean {
  if (!isActive(app)) return false;
  const tour = db.tours.find((t) => t.id === app.tourId);
  return tour !== undefined && seoulDateKey(now) < seoulDateKey(tour.startsAt);
}
