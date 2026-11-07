import type {
  Applicant,
  ApplicantsBoard,
  GuideTourSummary,
  MyApplication,
} from '@/features/applications/model';
import type { Me } from '@/features/auth/model';
import { fromWireMe } from '@/features/auth/wire';
import { computeCouponState, type Coupon } from '@/features/coupons/model';
import { mockNow } from '@/mocks/clock';
import type { ApplicationRow, CouponRow, DB, TourRow } from '@/mocks/db/schema';
import { toWireMe } from '@/mocks/wire/auth';
import { isCancellable, remainingSeats } from './applications';
import { MockApiError } from './errors';
import { buildTourSummary } from './summaries';

// 행 → 응답 DTO(핸들러 전용). DB는 고치지 않는다. 계약(`docs/api/frontend-needs.md` 4절)의 "서버가 계산해서 주는 값"
// (남은 자리 · 취소 가능 · 쿠폰 상태 · 오픈채팅 공개 · 리뷰 요약 · 제휴 …)을 여기서 만든다. 탐방 요약은 모두 `buildTourSummary`다.

function findTour(db: DB, tourId: number): TourRow {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  return tour;
}

const courseOf = (db: DB, tourId: number) => db.courses.find((c) => c.tourId === tourId);

/** 최근 신청이 앞(신청 시각 내림차순, 같으면 id 내림차순). */
export function newestFirst(a: ApplicationRow, b: ApplicationRow): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
}

/**
 * 로그인한 사용자. 프로필은 역할에 맞는 것만 준다(고교생 → 학생 프로필, 대학생 → 가이드 프로필).
 * 같은 값의 출처가 둘이 되지 않게 와이어 뷰(`toWireMe`)를 어댑터(`fromWireMe`)로 읽는다(2C-R26). 내 가게 id는 가게 행의 소유자다.
 */
export function toMe(db: DB, userId: number, now: Date = mockNow()): Me {
  return fromWireMe(
    toWireMe(db, userId, now),
    db.stores.find((s) => s.ownerId === userId)?.id ?? null,
  );
}

export function toMyApplication(db: DB, app: ApplicationRow, now: Date): MyApplication {
  const tour = findTour(db, app.tourId);
  return {
    id: app.id,
    status: app.status,
    motivation: app.motivation,
    createdAt: app.createdAt,
    tour: buildTourSummary(db, tour),
    courseStatus: courseOf(db, tour.id)?.status ?? null,
    openChatUrl: app.status === 'APPROVED' ? tour.openChatUrl : null,
    couponCount: db.coupons.filter((c) => c.applicationId === app.id).length,
    cancellable: isCancellable(db, app, now),
  };
}

/** 탐방의 취소되지 않은 신청(신청 id 순서). 신청자 보드와 가이드 탐방 집계가 같이 쓴다. */
function liveApplications(db: DB, tourId: number): ApplicationRow[] {
  return db.applications
    .filter((a) => a.tourId === tourId && a.status !== 'CANCELED')
    .sort((a, b) => a.id - b.id);
}

const countStatus = (apps: ApplicationRow[], status: ApplicationRow['status']) =>
  apps.filter((a) => a.status === status).length;

function toApplicant(db: DB, app: ApplicationRow): Applicant {
  return {
    id: app.id,
    userName: db.users.find((u) => u.id === app.userId)?.name ?? '',
    grade: db.studentProfiles.find((p) => p.id === app.userId)?.grade ?? null,
    motivation: app.motivation,
    status: app.status,
    verified: db.verifications.find((v) => v.id === app.userId)?.status === 'APPROVED',
  };
}

/** 신청자 관리 보드. 취소한 신청은 빼고 거절한 신청은 남긴다. 남은 자리는 정원 − 승인 수. */
export function toApplicantsBoard(db: DB, tourId: number): ApplicantsBoard {
  const tour = findTour(db, tourId);
  const apps = liveApplications(db, tourId);
  const course = courseOf(db, tourId);
  return {
    tour: buildTourSummary(db, tour),
    counts: {
      pending: countStatus(apps, 'PENDING'),
      approved: countStatus(apps, 'APPROVED'),
      remaining: remainingSeats(db, tourId),
    },
    applicants: apps.map((a) => toApplicant(db, a)),
    course: course ? { status: course.status } : null,
  };
}

export function toGuideTourSummary(db: DB, tour: TourRow): GuideTourSummary {
  const apps = liveApplications(db, tour.id);
  return {
    ...buildTourSummary(db, tour),
    counts: {
      total: apps.length,
      pending: countStatus(apps, 'PENDING'),
      approved: countStatus(apps, 'APPROVED'),
    },
    courseStatus: courseOf(db, tour.id)?.status ?? null,
  };
}

/** 쿠폰. `state`는 발급 상태와 지금 시각으로 서버가 판정하고, `reviewWritten`은 이 쿠폰으로 쓴 리뷰가 있는지다. */
export function toCoupon(db: DB, coupon: CouponRow, now: Date): Coupon {
  const app = db.applications.find((a) => a.id === coupon.applicationId)!;
  const tour = findTour(db, app.tourId);
  const store = db.stores.find((s) => s.id === coupon.storeId)!;
  return {
    id: coupon.id,
    code: coupon.code,
    status: coupon.status,
    state: computeCouponState(
      { status: coupon.status, tourStartsAt: tour.startsAt, expiresAt: coupon.expiresAt },
      now,
    ),
    discount: coupon.discountSnapshot,
    storeId: store.id,
    storeName: store.name,
    storeCategory: store.category,
    applicationId: app.id,
    tourId: tour.id,
    tourTitle: buildTourSummary(db, tour).title,
    tourStartsAt: tour.startsAt,
    expiresAt: coupon.expiresAt,
    usedAt: coupon.usedAt,
    reviewWritten: db.reviews.some((r) => r.couponId === coupon.id),
  };
}
