import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import { getStoreReviews, postReview } from './api';
import {
  REVIEW_SUMMARY_REFETCH_MS,
  type CreatedReview,
  type CreateReviewInput,
  type StoreReviews,
} from './model';

/** 상점 시트의 AI 요약 · 평균 · 최근 리뷰. `storeId`가 null(캠퍼스 지점 등)이면 부르지 않는다. */
export function useStoreReviews(storeId: number | null): UseQueryResult<StoreReviews, ApiError> {
  return useQuery({
    queryKey: qk.storeReviews(storeId ?? 0),
    // 선택 인자(size)가 있는 함수라 감싼다(errata G8).
    queryFn: storeId === null ? skipToken : () => getStoreReviews(storeId),
  });
}

const STALE_COUPON_ERRORS: readonly string[] = [
  'REVIEW_NOT_ALLOWED',
  'REVIEW_DUPLICATE',
  'NOT_FOUND',
];

function invalidateReviewViews(queryClient: QueryClient, storeId: number): void {
  void queryClient.invalidateQueries({ queryKey: qk.storeReviews(storeId) });
  void queryClient.invalidateQueries({ queryKey: qk.allCourses });
}

/**
 * 리뷰 쓰기. 성공하면 상점 리뷰 · 코스(지점 요약 · 평균 · 수) · 내 쿠폰(`reviewWritten`)을 다시 불러오고, 실서버는 AI 요약 갱신이
 * 응답과 별개라 `REVIEW_SUMMARY_REFETCH_MS` 뒤에 상점 리뷰 · 코스를 한 번 더 다시 불러온다(2B′-R17). 쿠폰 상태가 낡아 거절된 실패
 * (쓸 수 없음 · 이미 씀 · 쿠폰 없음)는 내 쿠폰을 다시 불러온다.
 */
export function useCreateReview(): UseMutationResult<CreatedReview, ApiError, CreateReviewInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => postReview(input),
    onSuccess: (_created, input) => {
      invalidateReviewViews(queryClient, input.storeId);
      void queryClient.invalidateQueries({ queryKey: qk.allMyCoupons });
      setTimeout(
        () => invalidateReviewViews(queryClient, input.storeId),
        REVIEW_SUMMARY_REFETCH_MS,
      );
    },
    onError: (error) => {
      if (STALE_COUPON_ERRORS.includes(error.code)) {
        void queryClient.invalidateQueries({ queryKey: qk.allMyCoupons });
      }
    },
  });
}
