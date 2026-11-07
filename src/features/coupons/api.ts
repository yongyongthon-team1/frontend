import { listAll, request, withQuery } from '@/shared/lib/http';
import type { Coupon, CouponLookup, RedeemResult } from './model';
import type { WireCoupon } from './wire';

// 학생의 내 쿠폰과 사장님의 코드 조회 · 사용 처리(S-06). 쿠폰 상태(`state`)는 서버가 계산해서 준다.

/**
 * S-05 `GET /users/me/coupons`의 와이어 항목 전부(`tour_id` · `store_id`로 좁힌다). 신청 합성이 탐방별 쿠폰 수를 셀 때 쓴다
 * (확장 `coupon_count`가 없는 실서버, 2C-R8).
 */
export function listMyCouponRows(
  query: { tourId?: number; storeId?: number } = {},
): Promise<WireCoupon[]> {
  return listAll<WireCoupon>(
    withQuery('/users/me/coupons', { tour_id: query.tourId, store_id: query.storeId }),
  );
}

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
