import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { loadCampuses } from '@/features/campuses/queries';
import { qk } from '@/shared/api/queryKeys';
import { getTour, listTours, recommend } from './api';
import type {
  RecommendationQuery,
  RecommendationResult,
  TourDetail,
  TourFilter,
  TourSummary,
} from './model';

const NO_QUERY: RecommendationQuery = { q: '' };

/**
 * AI 추천. 같은 조건은 다시 부르지 않고(`staleTime: Infinity`), 실패해도 자동으로 다시 부르지 않는다 —
 * AI 호출은 최대 30초라 다시 시도는 화면의 버튼으로만 한다.
 */
export function useRecommendations(
  q: RecommendationQuery | null,
): UseQueryResult<RecommendationResult> {
  const query = q ?? NO_QUERY;
  return useQuery({
    queryKey: qk.recommendations(query),
    queryFn: () => recommend(query),
    enabled: q !== null,
    staleTime: Infinity,
    retry: false,
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
