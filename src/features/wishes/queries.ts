import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { loadCampuses } from '@/features/campuses/queries';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import { listGuideWishes, listMyWishes, patchTourWish, postTourWish } from './api';
import type { GuideWishFilter, TourWish, TourWishInput } from './model';

/** T-01 희망 사항 등록. 성공하면 내 희망 사항 목록(T-07)을 다시 불러온다. 캠퍼스는 약속째 넘긴다(errata G8 · G13). */
export function useCreateTourWish(): UseMutationResult<TourWish, ApiError, TourWishInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TourWishInput) => postTourWish(input, loadCampuses(queryClient)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myWishes });
    },
  });
}

/** T-07 내 희망 사항 목록(최신순). 수정 화면도 이 캐시의 항목을 쓴다. */
export function useMyWishes(): UseQueryResult<TourWish[], ApiError> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.myWishes,
    queryFn: () => listMyWishes(loadCampuses(queryClient)),
  });
}

/** T-07 희망 사항 수정(바뀐 칸만). 성공하면 내 희망 사항 목록을 다시 불러온다. */
export function useUpdateTourWish(
  id: number,
): UseMutationResult<TourWish, ApiError, Partial<TourWishInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<TourWishInput>) =>
      patchTourWish(id, patch, loadCampuses(queryClient)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myWishes });
    },
  });
}

/** T-08 가이드의 고교생 희망 사항. `filter`가 null이면 요청하지 않는다(인증 전). */
export function useGuideWishes(
  filter: GuideWishFilter | null,
): UseQueryResult<TourWish[], ApiError> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.guideWishes(filter ?? {}),
    queryFn: () => listGuideWishes(filter ?? {}, loadCampuses(queryClient)),
    enabled: filter !== null,
  });
}
