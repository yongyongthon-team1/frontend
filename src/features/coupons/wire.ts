import type { TourSummary } from '@/features/tours/model';
import { computeCouponState, type Coupon, type CouponLookup, type CouponStatus } from './model';

// 백엔드 S-05 `GET /users/me/coupons` · S-06 `GET /coupons/{couponCode}` · `POST /coupons/{couponCode}/redeem`의 와이어 모양
// (키는 `request`가 camelCase로 바꾼 뒤의 것). 쿠폰 상태(`state`)는 응답에 없어 어댑터가 `computeCouponState`로 계산한다.

/** S-05 항목. `store.category`는 목업 전용 확장(2C-R8)이라 실서버에는 없다. */
export interface WireCoupon {
  couponId: number;
  code: string;
  tourId: number;
  store: { storeId: number; name: string; category?: string };
  discountText: string;
  status: CouponStatus;
  validUntil: string;
  usedAt: string | null;
  reviewed: boolean;
}

/** S-06 코드 확인. `usedAt` · `tourTitle` · `studentName`은 목업 전용 확장(2C-R8)이다. */
export interface WireCouponLookup {
  couponId: number;
  code: string;
  discountText: string;
  tourDate: string;
  status: CouponStatus;
  validUntil: string;
  usedAt?: string | null;
  tourTitle?: string;
  studentName?: string;
}

/** S-06 사용 처리. `tourVisitorCount` · `totalVisitorCount`는 목업 전용 확장(2C-R8)이다. */
export interface WireRedeem {
  couponId: number;
  status: CouponStatus;
  usedAt: string;
  tourVisitorCount?: number;
  totalVisitorCount?: number;
}

/**
 * 내 쿠폰 항목 + 그 탐방의 요약과 신청 id(합성, 2C-R7 · 2C-R27) → 내 쿠폰. 상태는 `now`(어댑터의 지금 시각)로 계산한다.
 * 확장 `store.category`가 없으면 빈 문자열이다.
 */
export function fromWireCoupon(
  w: WireCoupon,
  ctx: { applicationId: number; tour: TourSummary },
  now: Date,
): Coupon {
  return {
    id: w.couponId,
    code: w.code,
    status: w.status,
    state: computeCouponState(
      { status: w.status, tourStartsAt: ctx.tour.startsAt, expiresAt: w.validUntil },
      now,
    ),
    discount: w.discountText,
    storeId: w.store.storeId,
    storeName: w.store.name,
    storeCategory: w.store.category ?? '',
    applicationId: ctx.applicationId,
    tourId: w.tourId,
    tourTitle: ctx.tour.title,
    tourStartsAt: ctx.tour.startsAt,
    expiresAt: w.validUntil,
    usedAt: w.usedAt ?? null,
    reviewWritten: w.reviewed ?? false,
  };
}

/**
 * 코드 확인 응답 + 내 가게 이름 → 사장님의 조회 결과. 응답에는 탐방 날짜만 있어 탐방 시작은 그날 0시(서울)로 둔다.
 * 확장이 없으면 탐방 제목 `탐방` · 학생 이름 빈 문자열 · 사용 시각 null이다.
 */
export function fromWireLookup(w: WireCouponLookup, storeName: string, now: Date): CouponLookup {
  const tourStartsAt = `${w.tourDate}T00:00:00+09:00`;
  return {
    code: w.code,
    state: computeCouponState({ status: w.status, tourStartsAt, expiresAt: w.validUntil }, now),
    discount: w.discountText,
    storeName,
    tourTitle: w.tourTitle ?? '탐방',
    tourStartsAt,
    studentName: w.studentName ?? '',
    usedAt: w.usedAt ?? null,
  };
}
