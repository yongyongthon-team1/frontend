import {
  queryOptions,
  useQuery,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { getInsight, listCampuses } from './api';
import type { Insight, University } from './model';

/** 5개교 목록. 바뀔 일이 없어 한 번만 불러온다. */
export function campusesQueryOptions() {
  return queryOptions({
    queryKey: qk.universities,
    queryFn: () => listCampuses(),
    staleTime: Infinity,
  });
}

export function useUniversities(): UseQueryResult<University[]> {
  return useQuery(campusesQueryOptions());
}

/** 어댑터가 캠퍼스 조인(2C-R9)에 쓰려고 목록을 한 번만 불러 캐시에서 나눠 쓴다. */
export function loadCampuses(queryClient: QueryClient): Promise<University[]> {
  return queryClient.ensureQueryData(campusesQueryOptions());
}

export function useInsight(universityId: number | undefined): UseQueryResult<Insight> {
  return useQuery({
    queryKey: qk.insight(universityId ?? 0),
    queryFn: () => getInsight(universityId as number),
    enabled: universityId !== undefined,
  });
}
