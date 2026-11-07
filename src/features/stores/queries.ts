import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import { getMyStore, getStoreReportView } from './api';
import type { MyStore, StoreReportView } from './model';

/** 내 가게. 데이터가 `null`이면 연결된 가게가 없다(O01-E). */
export function useMyStore(): UseQueryResult<MyStore | null, ApiError> {
  return useQuery({ queryKey: qk.myStore, queryFn: () => getMyStore() });
}

/** 사장님 방문 · 리뷰 리포트(S-07). 데이터가 `null`이면 연결된 가게가 없다. */
export function useStoreReportView(): UseQueryResult<StoreReportView | null, ApiError> {
  return useQuery({ queryKey: qk.storeReport, queryFn: () => getStoreReportView() });
}
