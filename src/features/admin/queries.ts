import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import { getAdminVerification, listPendingVerifications, patchAdminVerification } from './api';
import type {
  AdminVerificationDetail,
  AdminVerificationItem,
  VerificationDecisionInput,
} from './model';

/** 심사 대기 목록. */
export function usePendingVerifications(): UseQueryResult<AdminVerificationItem[], ApiError> {
  return useQuery({ queryKey: qk.adminVerifications, queryFn: () => listPendingVerifications() });
}

/** 심사 요청 하나의 상세. */
export function useAdminVerification(
  id: number,
): UseQueryResult<AdminVerificationDetail, ApiError> {
  return useQuery({
    queryKey: qk.adminVerification(id),
    queryFn: () => getAdminVerification(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

/**
 * 승인 · 반려. 성공하면 캐시의 상세를 처리된 모습(사진 없음)으로, 목록에서는 그 건을 빼서 낡은 화면이 잠깐도 보이지 않게 하고
 * 접두사(`qk.adminVerifications`)를 무효화한다. 실패(특히 이미 처리됨)도 접두사를 무효화해 목록 · 상세를 다시 읽게 한다.
 */
export function useDecideVerification(
  id: number,
): UseMutationResult<void, ApiError, VerificationDecisionInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: VerificationDecisionInput) => patchAdminVerification(id, body),
    onSuccess: (_data, body) => {
      queryClient.setQueryData<AdminVerificationDetail>(qk.adminVerification(id), (old) =>
        old ? { ...old, status: body.decision, documentUrl: null } : old,
      );
      queryClient.setQueryData<AdminVerificationItem[]>(qk.adminVerifications, (old) =>
        old?.filter((item) => item.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: qk.adminVerifications });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.adminVerifications });
    },
  });
}
