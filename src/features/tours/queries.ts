import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { loadCampuses } from '@/features/campuses/queries';
import { qk } from '@/shared/api/queryKeys';
import { findWishTours, getTour, listTours } from './api';
import type { TourDetail, TourFilter, TourSummary, WishToursResult } from './model';
import type { WishSearch } from './wishSearch';

const NO_SEARCH: WishSearch = { universityId: 0, major: '', wish: '', date: null };

/** T-01 탐방 찾기 결과(결과 화면). 검색이 없으면(null) 부르지 않는다. 키는 `qk.allTours` 아래라 탐방 무효화에 함께 걸린다. */
export function useWishTours(search: WishSearch | null): UseQueryResult<WishToursResult> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.wishTours(search ?? NO_SEARCH),
    queryFn: () => findWishTours(search ?? NO_SEARCH, loadCampuses(queryClient)),
    enabled: search !== null,
  });
}

export function useTours(filter: TourFilter): UseQueryResult<TourSummary[]> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.tours(filter),
    queryFn: () => listTours(filter, loadCampuses(queryClient)),
  });
}

export function useTour(id: number): UseQueryResult<TourDetail> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.tour(id),
    queryFn: () => getTour(id, loadCampuses(queryClient)),
  });
}
