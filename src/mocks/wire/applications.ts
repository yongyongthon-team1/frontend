import type {
  WireApplicant,
  WireApplyResult,
  WireGuideTourRow,
  WireMyTourRow,
} from '@/features/applications/wire';
import type { ApplicationRow, DB, TourRow } from '@/mocks/db/schema';
import { MockApiError } from '@/mocks/rules/errors';
import { seoulDateKey } from '@/shared/lib/date';
import { toWireTourItem } from './tours';

// 신청 행 · 탐방 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toMyApplication` · `toApplicantsBoard` ·
// `toGuideTourSummary`의 자리(2C-R26) — 탐방 요약 · 남은 자리 · 취소 가능 여부는 어댑터가 `GET /tours/{tourId}`로 합성한다.

function findTour(db: DB, tourId: number): TourRow {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  return tour;
}

const courseConfirmed = (db: DB, tourId: number) =>
  db.courses.some((c) => c.tourId === tourId && c.status === 'CONFIRMED');

/** T-04 고교생 항목. `wish` · `createdAt` · `couponCount`(이 신청으로 발급된 쿠폰 수)는 목업 전용 확장(2C-R8)이다. */
export function toWireMyTourRow(db: DB, app: ApplicationRow): WireMyTourRow {
  const tour = findTour(db, app.tourId);
  const item = toWireTourItem(db, tour);
  return {
    tourId: tour.id,
    campusName: item.campusName,
    date: item.date,
    tourStatus: tour.status,
    applicationId: app.id,
    applicationStatus: app.status,
    courseConfirmed: courseConfirmed(db, tour.id),
    wish: app.motivation,
    createdAt: app.createdAt,
    couponCount: db.coupons.filter((c) => c.applicationId === app.id).length,
  };
}

/** T-04 대학생 항목(내가 개설한 탐방). 승인 · 대기 수는 그 탐방의 신청 상태별 개수다. */
export function toWireGuideTourRow(db: DB, tour: TourRow): WireGuideTourRow {
  const count = (status: ApplicationRow['status']) =>
    db.applications.filter((a) => a.tourId === tour.id && a.status === status).length;
  return {
    tourId: tour.id,
    date: seoulDateKey(tour.startsAt),
    tourStatus: tour.status,
    capacity: tour.capacity,
    approvedCount: count('APPROVED'),
    pendingCount: count('PENDING'),
    courseConfirmed: courseConfirmed(db, tour.id),
  };
}

/** A-04 신청자 목록 항목. 학년은 학생 프로필의 값(없으면 null), `wish`는 신청할 때 적은 글이다. */
export function toWireApplicant(db: DB, app: ApplicationRow): WireApplicant {
  return {
    applicationId: app.id,
    name: db.users.find((u) => u.id === app.userId)?.name ?? '',
    grade: db.studentProfiles.find((p) => p.id === app.userId)?.grade ?? null,
    wish: app.motivation,
    status: app.status,
    createdAt: app.createdAt,
  };
}

/** A-01 신청 응답(201). */
export function toWireApplyResult(app: ApplicationRow): WireApplyResult {
  return {
    applicationId: app.id,
    tourId: app.tourId,
    status: app.status,
    createdAt: app.createdAt,
  };
}
