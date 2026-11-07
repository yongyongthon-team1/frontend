import { slotTimes } from '@/features/courses/model';
import type { WireCourse, WireSpot } from '@/features/courses/wire';
import type { CourseStopRow, DB } from '@/mocks/db/schema';
import { partnershipOn } from '@/mocks/rules/courses';
import { MockApiError } from '@/mocks/rules/errors';
import { seoulDateKey } from '@/shared/lib/date';
import { averageRating, latestReviewSummary } from './reviews';

// 코스 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toCourse` · `toCourseStop`의 자리(2C-R26).
// 확장(2C-R8): 스팟의 `spotId` · `discountText`(제휴만) · `reviewAverage` · `reviewCount`(상점만), 코스의 `couponCount`.

/** 리뷰 평균은 소수 첫째 자리(리뷰가 없으면 null), 요약은 가장 최근 것(없으면 null). 판정은 `mocks/wire/reviews` 하나다(errata PM1). */
function reviewOf(db: DB, storeId: number) {
  const ratings = db.reviews.filter((r) => r.storeId === storeId).map((r) => r.rating);
  return {
    average: averageRating(ratings),
    count: ratings.length,
    summary: latestReviewSummary(db, storeId)?.summary ?? null,
  };
}

function toWireSpot(db: DB, stop: CourseStopRow, tourDay: string, slot: string): WireSpot {
  const common = {
    order: stop.stopOrder,
    stopType: stop.stopType,
    startTime: stop.visitTime ?? slot,
    reason: stop.recommendationReason,
    comment: stop.description,
    spotId: stop.id,
  };
  if (stop.stopType === 'CAMPUS') {
    const place = db.campusPlaces.find((p) => p.campusBuildingId === stop.campusBuildingId)!;
    return {
      ...common,
      storeId: null,
      campusBuildingId: place.campusBuildingId,
      name: place.name,
      category: null,
      address: null,
      lat: place.latitude,
      lng: place.longitude,
      isPartner: false,
      reviewSummary: null,
    };
  }
  const store = db.stores.find((s) => s.id === stop.storeId)!;
  const partnership = partnershipOn(db, store.id, tourDay);
  const review = reviewOf(db, store.id);
  return {
    ...common,
    storeId: store.id,
    campusBuildingId: null,
    name: store.name,
    category: store.category,
    address: store.address,
    lat: store.latitude,
    lng: store.longitude,
    isPartner: partnership !== undefined,
    reviewSummary: review.summary,
    ...(partnership ? { discountText: partnership.discountDescription } : {}),
    reviewAverage: review.average,
    reviewCount: review.count,
  };
}

/**
 * 탐방의 코스(C-01~04 공통 모양). 탐방 · 코스가 없으면 404 NOT_FOUND. 확장 `couponCount`는 이 탐방 신청들의 쿠폰 중
 * 이 코스 지점 상점의 쿠폰 수다 — 확정 때 발급한 수에, 확정 뒤 승인으로 더 발급한 수가 더해진다.
 */
export function toWireCourse(db: DB, tourId: number): WireCourse {
  const tour = db.tours.find((t) => t.id === tourId);
  const course = db.courses.find((c) => c.tourId === tourId);
  if (!tour || !course) throw new MockApiError(404, 'NOT_FOUND');
  const tourDay = seoulDateKey(tour.startsAt);
  const rows = db.courseStops
    .filter((s) => s.tourId === tourId)
    .sort((a, b) => a.stopOrder - b.stopOrder);
  const slots = slotTimes(tour.startsAt, rows.length);
  const applicationIds = new Set(
    db.applications.filter((a) => a.tourId === tourId).map((a) => a.id),
  );
  const storeIds = new Set(rows.map((s) => s.storeId).filter((id): id is number => id !== null));
  return {
    tourId,
    status: course.status,
    spots: rows.map((s, i) => toWireSpot(db, s, tourDay, slots[i])),
    couponCount: db.coupons.filter(
      (c) => applicationIds.has(c.applicationId) && storeIds.has(c.storeId),
    ).length,
  };
}
