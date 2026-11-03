import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import { getCouponLookup, getMyCoupon, getMyCoupons, postRedeem } from './api';
import type { Coupon, CouponLookup, RedeemResult } from './model';

const COUPON_POLL_MS = 5000;
const COUPON_CODE = /^\d{6}$/;

export function useMyCoupons(applicationId?: number): UseQueryResult<Coupon[]> {
  return useQuery({
    queryKey: qk.myCoupons(applicationId),
    queryFn: () => getMyCoupons(applicationId),
  });
}

/** 쿠폰 상세. 아직 쓸 수 있는 쿠폰(BEFORE_DAY · USABLE)은 5초마다 다시 불러와 사장님의 사용 처리를 반영한다. */
export function useMyCoupon(id: number): UseQueryResult<Coupon> {
  return useQuery({
    queryKey: qk.coupon(id),
    queryFn: () => getMyCoupon(id),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'BEFORE_DAY' || state === 'USABLE' ? COUPON_POLL_MS : false;
    },
  });
}

/** 사장님의 쿠폰 코드 조회. 6자리 숫자가 다 입력됐을 때만 부른다. */
export function useCouponLookup(code: string): UseQueryResult<CouponLookup> {
  return useQuery({
    queryKey: qk.couponLookup(code),
    queryFn: () => getCouponLookup(code),
    enabled: COUPON_CODE.test(code),
  });
}

/** 사용 처리. 변수는 쿠폰 코드이고, 성공하면 응답의 쿠폰으로 그 코드의 조회 결과를 바로 바꾼다. */
export function useRedeemCoupon(): UseMutationResult<RedeemResult, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => postRedeem(code),
    onSuccess: (result, code) => {
      queryClient.setQueryData(qk.couponLookup(code), result.coupon);
    },
  });
}
