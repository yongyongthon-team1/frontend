import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import { getInsight, listUniversities } from './api';
import type { Insight, University } from './model';

/** 5개교 목록. 바뀔 일이 없어 한 번만 불러온다. */
export function useUniversities(): UseQueryResult<University[]> {
  return useQuery({
    queryKey: qk.universities,
    queryFn: listUniversities,
    staleTime: Infinity,
  });
}

export function useInsight(universityId: number | undefined): UseQueryResult<Insight> {
  return useQuery({
    queryKey: qk.insight(universityId ?? 0),
    queryFn: () => getInsight(universityId as number),
    enabled: universityId !== undefined,
  });
}
