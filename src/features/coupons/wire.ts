import type { CouponStatus } from './model';

// 백엔드 S-05 `GET /users/me/coupons` 항목의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).
// 어댑터(`fromWire*`)는 Task 10이 더한다 — 지금은 신청 합성(2C-R8)이 `tourId`로 세기만 한다.

export interface WireCoupon {
  couponId: number;
  code: string;
  tourId: number;
  /** `category`는 목업 전용 확장(2C-R8)이다. */
  store: { storeId: number; name: string; category?: string };
  discountText: string;
  status: CouponStatus;
  validUntil: string;
  usedAt: string | null;
  reviewed: boolean;
}
