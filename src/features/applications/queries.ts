import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import {
  getApplicantsBoard,
  getGuideTours,
  getMyApplication,
  getMyApplications,
  postApplication,
  postApprove,
  postCancelApplication,
  postReject,
} from './api';
import type { ApplicantsBoard, GuideTourSummary, MyApplication } from './model';

/**
 * 탐방 신청. 성공하면 탐방 상세(내 신청 · 남은 자리)와 내 신청 목록을 다시 불러온다 — 추천은 건드리지 않는다.
 * 실패해도 탐방 상세를 다시 불러와, 방금 정원이 찬 경우처럼 바뀐 신청 가능 상태를 화면에 반영한다.
 */
export function useApplyToTour(tourId: number): UseMutationResult<MyApplication, ApiError, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (motivation: string) => postApplication(tourId, motivation),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tour(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.myApplications });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.tour(tourId) });
    },
  });
}

export function useMyApplications(): UseQueryResult<MyApplication[]> {
  return useQuery({ queryKey: qk.myApplications, queryFn: getMyApplications });
}

export function useMyApplication(id: number): UseQueryResult<MyApplication> {
  return useQuery({ queryKey: qk.myApplication(id), queryFn: () => getMyApplication(id) });
}

/**
 * 취소하면 내 신청(목록 · 상세 모두)과 그 탐방의 남은 자리, 내 쿠폰(취소하면 발급된 쿠폰이 만료된다)을 다시 불러온다.
 * 실패하면 내 신청만 다시 불러온다.
 */
export function useCancelMyApplication(
  id: number,
): UseMutationResult<MyApplication, ApiError, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postCancelApplication(id),
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: qk.myApplications });
      void queryClient.invalidateQueries({ queryKey: qk.tour(app.tour.id) });
      void queryClient.invalidateQueries({ queryKey: qk.allMyCoupons });
    },
    // 실패해도 서버 값(`cancellable` 등)을 다시 받아 화면의 취소 버튼 · 사유를 맞춘다.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.myApplications });
    },
  });
}

export function useGuideTours(): UseQueryResult<GuideTourSummary[]> {
  return useQuery({ queryKey: qk.guideTours, queryFn: getGuideTours });
}

export function useApplicantsBoard(tourId: number): UseQueryResult<ApplicantsBoard> {
  return useQuery({ queryKey: qk.applicants(tourId), queryFn: () => getApplicantsBoard(tourId) });
}

function useBoardMutation(
  tourId: number,
  mutationFn: (applicationId: number) => Promise<ApplicantsBoard>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
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
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.applicants(tourId) });
    },
  });
}

export function useApprove(tourId: number): UseMutationResult<ApplicantsBoard, ApiError, number> {
  return useBoardMutation(tourId, postApprove);
}

export function useReject(tourId: number): UseMutationResult<ApplicantsBoard, ApiError, number> {
  return useBoardMutation(tourId, postReject);
}
