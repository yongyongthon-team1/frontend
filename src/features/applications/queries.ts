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
import {
  getApplicantsBoard,
  getGuideTours,
  getMyApplication,
  getMyApplications,
  patchDecision,
  postApplication,
  postCancelApplication,
} from './api';
import type { ApplicantsBoard, GuideTourSummary, MyApplication } from './model';

// 훅은 캠퍼스 목록을 기다리지 않고 `loadCampuses`의 약속째 넘긴다 — 캠퍼스 요청과 첫 요청이 동시에 나간다(errata G13).
// api 함수는 마지막 인자로 캠퍼스를 받으므로 `queryFn` · `mutationFn`에 바로 넣지 않고 감싼다(errata G8).

/**
 * 탐방 신청. 성공하면 탐방 상세(내 신청 · 남은 자리)와 내 신청 목록을 다시 불러온다 — 추천은 건드리지 않는다.
 * 실패해도 탐방 상세를 다시 불러와, 방금 정원이 찬 경우처럼 바뀐 신청 가능 상태를 화면에 반영한다. 신청은 됐는데 뒤따르는
 * 다시 읽기가 실패해 오류가 된 경우에도 내 신청 목록 · 상세가 낡지 않게 함께 다시 불러온다.
 */
export function useApplyToTour(tourId: number): UseMutationResult<MyApplication, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (motivation: string) =>
      postApplication(tourId, motivation, loadCampuses(queryClient)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tour(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.myApplications });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tour(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.myApplications }); // 상세 키(`qk.myApplication(id)`)의 접두사
    },
  });
}

export function useMyApplications(): UseQueryResult<MyApplication[]> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.myApplications,
    queryFn: () => getMyApplications(loadCampuses(queryClient)),
  });
}

export function useMyApplication(id: number): UseQueryResult<MyApplication> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.myApplication(id),
    queryFn: () => getMyApplication(id, loadCampuses(queryClient)),
  });
}

/**
 * 취소하면 내 신청(목록 · 상세 모두)과 그 탐방의 남은 자리, 내 쿠폰(취소하면 발급된 쿠폰이 만료된다)을 다시 불러온다.
 * 실패하면(취소는 됐는데 다시 읽기가 실패한 경우 포함) 내 신청(목록 · 상세)과 탐방을 다시 불러온다.
 */
export function useCancelMyApplication(
  id: number,
): UseMutationResult<MyApplication, ApiError, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postCancelApplication(id, loadCampuses(queryClient)),
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: qk.myApplications });
      void queryClient.invalidateQueries({ queryKey: qk.tour(app.tour.id) });
      void queryClient.invalidateQueries({ queryKey: qk.allMyCoupons });
    },
    // 실패해도 서버 값(`cancellable` 등)을 다시 받아 화면의 취소 버튼 · 사유를 맞춘다.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myApplications }); // 상세 키(`qk.myApplication(id)`)의 접두사
      void queryClient.invalidateQueries({ queryKey: qk.allTours }); // 실패에는 탐방 id가 없다
    },
  });
}

/** `freshOnMount`: 화면에 들어올 때마다 다시 불러온다(캐시가 신선해도) — 그 값으로 이동을 정하는 화면용. */
export function useGuideTours(
  opts: { freshOnMount?: boolean } = {},
): UseQueryResult<GuideTourSummary[]> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.guideTours,
    queryFn: () => getGuideTours(loadCampuses(queryClient)),
    refetchOnMount: opts.freshOnMount ? 'always' : true,
  });
}

export function useApplicantsBoard(tourId: number): UseQueryResult<ApplicantsBoard> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.applicants(tourId),
    queryFn: () => getApplicantsBoard(tourId, loadCampuses(queryClient)),
  });
}

/** 승인 · 거절(`PATCH /applications/{applicationId}/decision`). 변수는 신청 id, 결과는 바뀐 뒤의 신청자 보드다. */
function useBoardMutation(
  tourId: number,
  decision: 'APPROVED' | 'REJECTED',
): UseMutationResult<ApplicantsBoard, ApiError, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: number) =>
      patchDecision(tourId, applicationId, decision, loadCampuses(queryClient)),
    // 서버가 돌려준 보드를 바로 그리고, 목록 · 탐방 상세(남은 자리) · 가이드 코스(확정 뒤 승인이면 쿠폰 발급 수)는
    // 다시 불러온다.
    onSuccess: (board) => {
      queryClient.setQueryData(qk.applicants(tourId), board);
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
      void queryClient.invalidateQueries({ queryKey: qk.tour(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.guideCourse(tourId) });
    },
    // 실패하면(409 이미 처리됨 · 정원 초과 등 — 다른 기기에서 먼저 처리했을 수 있다) 보드를 서버 기준으로 다시 불러온다
    // (설계 5.5 — 판정 15 · 18과 같은 원칙).
    // 결정은 됐는데 보드를 다시 읽다 실패했을 때도 같다 — 가이드 탐방 목록의 신청 수도 함께 다시 받는다.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.applicants(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
    },
  });
}

export function useApprove(tourId: number): UseMutationResult<ApplicantsBoard, ApiError, number> {
  return useBoardMutation(tourId, 'APPROVED');
}

export function useReject(tourId: number): UseMutationResult<ApplicantsBoard, ApiError, number> {
  return useBoardMutation(tourId, 'REJECTED');
}
