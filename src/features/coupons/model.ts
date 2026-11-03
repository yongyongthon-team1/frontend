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
