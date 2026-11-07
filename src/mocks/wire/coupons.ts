import type { WireCoupon, WireCouponLookup, WireRedeem } from '@/features/coupons/wire';
import type { CouponRow, DB } from '@/mocks/db/schema';
import { buildTourSummary } from '@/mocks/rules/summaries';
import { seoulDateKey } from '@/shared/lib/date';

// 쿠폰 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toCoupon`의 자리(2C-R26) — 쿠폰 상태 · 탐방 요약 ·
// 신청 id는 응답에 없고 어댑터가 합성한다. 확장 필드는 2C-R8 표의 것뿐이다.

function tourOf(db: DB, coupon: CouponRow) {
  const app = db.applications.find((a) => a.id === coupon.applicationId)!;
  return db.tours.find((t) => t.id === app.tourId)!;
}

/** S-05 항목. `store.category`는 목업 전용 확장이다. */
export function toWireCoupon(db: DB, coupon: CouponRow): WireCoupon {
  const store = db.stores.find((s) => s.id === coupon.storeId)!;
  return {
    couponId: coupon.id,
    code: coupon.code,
    tourId: tourOf(db, coupon).id,
    store: { storeId: store.id, name: store.name, category: store.category },
    discountText: coupon.discountSnapshot,
    status: coupon.status,
    validUntil: coupon.expiresAt,
    usedAt: coupon.usedAt,
    reviewed: db.reviews.some((r) => r.couponId === coupon.id),
  };
}

/** S-06 코드 확인. `usedAt` · `tourTitle` · `studentName`은 목업 전용 확장이다. */
export function toWireCouponLookup(db: DB, coupon: CouponRow): WireCouponLookup {
  const tour = tourOf(db, coupon);
  const app = db.applications.find((a) => a.id === coupon.applicationId)!;
  return {
    couponId: coupon.id,
    code: coupon.code,
    discountText: coupon.discountSnapshot,
    tourDate: seoulDateKey(tour.startsAt),
    status: coupon.status,
    validUntil: coupon.expiresAt,
    usedAt: coupon.usedAt,
    tourTitle: buildTourSummary(db, tour).title,
    studentName: db.users.find((u) => u.id === app.userId)!.name,
  };
}

/** S-06 사용 처리. 방문 수(`tourVisitorCount` · `totalVisitorCount`)는 목업 전용 확장이다. */
export function toWireRedeem(
  coupon: CouponRow,
  counts: { tourVisitorCount: number; totalVisitorCount: number },
): WireRedeem {
  return {
    couponId: coupon.id,
    status: coupon.status,
    usedAt: coupon.usedAt!,
    tourVisitorCount: counts.tourVisitorCount,
    totalVisitorCount: counts.totalVisitorCount,
  };
}
