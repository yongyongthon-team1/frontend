import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { loadCampuses } from '@/features/campuses/queries';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import { postTourWish } from './api';
import type { TourWish, TourWishInput } from './model';

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
