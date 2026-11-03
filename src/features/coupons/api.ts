import { request } from '@/shared/lib/http';
import type { Coupon, CouponLookup, RedeemResult } from './model';

// 학생의 내 쿠폰과 사장님의 코드 조회 · 사용 처리(S-06). 쿠폰 상태(`state`)는 서버가 계산해서 준다.

/** 내 쿠폰(id 오름차순). `applicationId`를 주면 그 신청으로 발급된 쿠폰만. */
export function getMyCoupons(applicationId?: number): Promise<Coupon[]> {
  return request<Coupon[]>(
    applicationId === undefined ? '/me/coupons' : `/me/coupons?applicationId=${applicationId}`,
  );
}

export function getMyCoupon(id: number): Promise<Coupon> {
  return request<Coupon>(`/me/coupons/${id}`);
}

export function getCouponLookup(code: string): Promise<CouponLookup> {
  return request<CouponLookup>(`/owner/coupons/${encodeURIComponent(code)}`);
}

export function postRedeem(code: string): Promise<RedeemResult> {
  return request<RedeemResult>(`/owner/coupons/${encodeURIComponent(code)}/redeem`, {
    method: 'POST',
  });
}
