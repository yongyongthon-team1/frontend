import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Me } from '@/features/auth/model';
import { refetchMe } from '@/features/auth/queries';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import {
  getMyStore,
  getStoreReportView,
  getStoreSearch,
  patchMyStore,
  postBusinessVerification,
  postStore,
  putPartnership,
} from './api';
import {
  STORE_SEARCH_MIN,
  type BusinessVerificationInput,
  type MyStore,
  type PartnershipInput,
  type StoreEditInput,
  type StoreRegistrationInput,
  type StoreReportView,
  type StoreSearchItem,
} from './model';

/** 내 가게. 데이터가 `null`이면 연결된 가게가 없다(O01-E). */
export function useMyStore(): UseQueryResult<MyStore | null, ApiError> {
  return useQuery({ queryKey: qk.myStore, queryFn: () => getMyStore() });
}

/** 사장님 방문 · 리뷰 리포트(S-07). 데이터가 `null`이면 연결된 가게가 없다. */
export function useStoreReportView(): UseQueryResult<StoreReportView | null, ApiError> {
  return useQuery({ queryKey: qk.storeReport, queryFn: () => getStoreReportView() });
}

/** 내 정보와 내 가게가 낡았다는 신호(가게가 없다 · 이미 있다 · 인증 전). 둘 다 다시 읽게 한다. */
function invalidateMeAndStore(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: qk.me });
  void queryClient.invalidateQueries({ queryKey: qk.myStore });
}

/** 사업자 인증(U-07). 성공하면 내 정보를 다시 읽어 `businessVerified`를 새 값으로 돌려준다(이동은 화면이 정한다). */
export function useVerifyBusiness(): UseMutationResult<Me, ApiError, BusinessVerificationInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BusinessVerificationInput): Promise<Me> => {
      await postBusinessVerification(input);
      return refetchMe(queryClient);
    },
  });
}

/** 상점 검색(S-01). 공백 뺀 `STORE_SEARCH_MIN`자 이상일 때만 부르고, 새 검색어를 기다리는 동안 이전 결과를 보인다. */
export function useStoreSearch(keyword: string): UseQueryResult<StoreSearchItem[], ApiError> {
  const trimmed = keyword.trim();
  return useQuery({
    queryKey: qk.storeSearch(trimmed),
    queryFn: () => getStoreSearch(trimmed),
    enabled: trimmed.length >= STORE_SEARCH_MIN,
    placeholderData: keepPreviousData,
  });
}

/**
 * 가게 연결 · 등록(S-01). 성공하면 내 가게를 캐시에 넣고 내 정보를 다시 읽는다. 이미 다른 사장님이 연결한 상점이면 검색 결과를,
 * 이미 가게가 있거나 인증 전이면 내 정보 · 내 가게를 다시 읽게 한다.
 */
export function useLinkStore(): UseMutationResult<MyStore, ApiError, StoreRegistrationInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StoreRegistrationInput): Promise<MyStore> => {
      const store = await postStore(input);
      await refetchMe(queryClient);
      return store;
    },
    onSuccess: (store) => {
      queryClient.setQueryData(qk.myStore, store);
      // 연결 전에 받아 둔 리포트("연결된 가게가 없어요")가 남지 않게 한다.
      void queryClient.invalidateQueries({ queryKey: qk.storeReport });
    },
    onError: (error) => {
      if (error.code === 'STORE_ALREADY_LINKED') {
        void queryClient.invalidateQueries({ queryKey: qk.allStoreSearch });
      } else if (error.code === 'STORE_LIMIT' || error.code === 'BIZ_NOT_VERIFIED') {
        invalidateMeAndStore(queryClient);
      }
    },
  });
}

/** 가게 정보 수정(S-01). 성공하면 내 가게를 캐시에 넣는다. 가게가 없다는 오류면 내 정보 · 내 가게를 다시 읽게 한다. */
export function useUpdateMyStore(): UseMutationResult<MyStore, ApiError, StoreEditInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: StoreEditInput) => patchMyStore(patch),
    onSuccess: (store) => {
      queryClient.setQueryData(qk.myStore, store);
    },
    onError: (error) => {
      if (error.code === 'STORE_NOT_LINKED') invalidateMeAndStore(queryClient);
    },
  });
}

/** 제휴 할인 설정(S-03). 성공하면 내 가게를 캐시에 넣는다. 가게가 없다는 오류면 내 정보 · 내 가게를 다시 읽게 한다. */
export function useSavePartnership(): UseMutationResult<MyStore, ApiError, PartnershipInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PartnershipInput) => putPartnership(input),
    onSuccess: (store) => {
      queryClient.setQueryData(qk.myStore, store);
    },
    onError: (error) => {
      if (error.code === 'STORE_NOT_LINKED') invalidateMeAndStore(queryClient);
    },
  });
}
