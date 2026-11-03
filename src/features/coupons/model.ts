import { formatTime, seoulDateKey } from '@/shared/lib/date';

export type CouponStatus = 'ISSUED' | 'USED' | 'EXPIRED';
/** 서버가 계산해서 준다. */
export type CouponState = 'BEFORE_DAY' | 'USABLE' | 'EXPIRED' | 'USED';

export interface Coupon {
  id: number;
  code: string;
  status: CouponStatus;
  state: CouponState;
  discount: string;
  storeId: number;
  storeName: string;
  storeCategory: string;
  applicationId: number;
  tourId: number;
  tourTitle: string;
  tourStartsAt: string;
  expiresAt: string;
  usedAt: string | null;
  reviewWritten: boolean;
}

export interface CouponLookup {
  code: string;
  state: CouponState;
  discount: string;
  storeName: string;
  tourTitle: string;
  tourStartsAt: string;
  studentName: string;
  usedAt: string | null;
}

export interface RedeemResult {
  coupon: CouponLookup;
  tourVisitorCount: number;
  totalVisitorCount: number;
}

/**
 * 목업 서버 · API 어댑터 전용. 컴포넌트는 서버가 준 `Coupon.state`를 그린다.
 * 사용 완료 → 만료(상태 또는 기한 경과) → 탐방 당일 전 → 사용 가능 순으로 검사한다.
 */
export function computeCouponState(
  c: { status: CouponStatus; tourStartsAt: string; expiresAt: string },
  now: Date,
): CouponState {
  if (c.status === 'USED') return 'USED';
  if (c.status === 'EXPIRED' || now.getTime() > Date.parse(c.expiresAt)) return 'EXPIRED';
  if (seoulDateKey(now) < seoulDateKey(c.tourStartsAt)) return 'BEFORE_DAY';
  return 'USABLE';
}

export function couponStateLabel(state: CouponState, usedAt: string | null): string {
  switch (state) {
    case 'BEFORE_DAY':
      return '탐방 당일 사용 가능';
    case 'USABLE':
      return '사용 가능';
    case 'EXPIRED':
      return '만료';
    case 'USED':
      return usedAt ? `사용 완료 · ${formatTime(usedAt)}` : '사용 완료';
  }
}
