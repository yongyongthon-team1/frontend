import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { patchMe } from '@/features/auth/api';
import type { GuardianStatus, Me } from '@/features/auth/model';
import { meQueryOptions, refetchMe } from '@/features/auth/queries';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import {
  getConsent,
  getDemoConsentToken,
  patchConsent,
  postEnrollment,
  postGuardianConsent,
} from './api';
import type { ConsentDecision, ConsentView, EnrollmentSubmit, GuardianConsentInput } from './model';

/** 이미 처리돼 화면이 낡았다는 신호(심사 중 · 승인 후 재제출, 대기 · 동의 후 재요청, 처리된 링크). 내 정보를 다시 읽게 한다. */
function invalidateMeIfStale(queryClient: QueryClient, error: ApiError): void {
  if (error.code === 'ALREADY_PROCESSED') {
    void queryClient.invalidateQueries({ queryKey: qk.me });
  }
}

/**
 * 재학 인증 제출(2B′-R8). 고교생: `POST /verifications/enrollment` → 성공하면 `PATCH /users/me`로 학년(과 방금 낸 학교 이름)을
 * 저장해 새 `Me`. 대학생: enrollment → `refetchMe`. 첫 쓰기가 실패하면 둘째를 부르지 않는다. 둘째 쓰기가 실패하면(제출은 이미 PENDING)
 * 내 정보를 다시 읽은 뒤 그 오류를 그대로 낸다. 이동은 화면이 정한다.
 */
export function useSubmitEnrollment(): UseMutationResult<Me, ApiError, EnrollmentSubmit> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnrollmentSubmit): Promise<Me> => {
      if (input.role === 'UNIVERSITY') {
        await postEnrollment(input);
        return refetchMe(queryClient);
      }
      // 이름 · 관심 학과는 지금 값 그대로, 학교는 방금 제출한 이름(PATCH가 되돌리지 않게), 학년은 새 값.
      const me = await queryClient.ensureQueryData(meQueryOptions());
      await postEnrollment(input);
      try {
        return await patchMe({
          name: me.name,
          highSchoolName: input.schoolName.trim(),
          grade: input.grade,
          interestedMajor: me.studentProfile?.interestedMajor ?? null,
        });
      } catch (error) {
        await refetchMe(queryClient).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me, me);
    },
    onError: (error) => invalidateMeIfStale(queryClient, error),
  });
}

/** 보호자 동의 요청. 성공하면 새 `Me`(동의 대기)를 받고 시연 토큰을 다시 읽게 한다. */
export function useRequestGuardianConsent(): UseMutationResult<Me, ApiError, GuardianConsentInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardianConsentInput): Promise<Me> => {
      await postGuardianConsent(input);
      return refetchMe(queryClient);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.demoConsentToken });
    },
    onError: (error) => invalidateMeIfStale(queryClient, error),
  });
}

/** 보호자가 보는 안내(공개). 토큰마다 한 항목이다. */
export function useConsent(token: string): UseQueryResult<ConsentView, ApiError> {
  return useQuery({ queryKey: qk.consent(token), queryFn: () => getConsent(token) });
}

/**
 * 보호자의 동의 · 거부. 성공하면 안내 · 학생의 내 정보 · 시연 토큰을 다시 읽게 하고(같은 탭에서 `/verify`로 가면 새로고침 없이 반영),
 * 실패하면 안내만 다시 읽는다(이미 처리됨 · 만료 · 잘못된 링크의 결과 카드).
 */
export function useDecideConsent(
  token: string,
): UseMutationResult<GuardianStatus, ApiError, ConsentDecision> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: ConsentDecision) => patchConsent(token, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.consent(token) });
      void queryClient.invalidateQueries({ queryKey: qk.me });
      void queryClient.invalidateQueries({ queryKey: qk.demoConsentToken });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.consent(token) });
    },
  });
}

/** 시연 도구용 보호자 링크 토큰(목업 확장). `enabled`일 때만 읽고, 확장이 없는 실서버에서는 null이다. */
export function useDemoConsentToken(enabled: boolean): UseQueryResult<string | null, ApiError> {
  return useQuery({
    queryKey: qk.demoConsentToken,
    queryFn: () => getDemoConsentToken(),
    enabled,
  });
}
