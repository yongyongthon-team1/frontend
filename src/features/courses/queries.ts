import {
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { qk } from '@/shared/api/queryKeys';
import type { ApiError } from '@/shared/lib/http';
import {
  deleteCourseStop,
  getCourse,
  getGuideCourse,
  patchStop,
  postConfirmCourse,
  postCourseDraft,
  putStopOrder,
} from './api';
import type { Course } from './model';

/** 학생이 보는 확정 코스. `tourId`를 아직 모르면(신청을 불러오는 중) 부르지 않는다. */
export function useCourse(tourId: number | undefined): UseQueryResult<Course> {
  return useQuery({
    queryKey: qk.course(tourId ?? -1),
    queryFn: tourId === undefined ? skipToken : () => getCourse(tourId),
  });
}

/** 가이드의 코스. data가 null이면 아직 코스가 없다. */
export function useGuideCourse(tourId: number): UseQueryResult<Course | null> {
  return useQuery({ queryKey: qk.guideCourse(tourId), queryFn: () => getGuideCourse(tourId) });
}

/** 코스를 바꾸는 요청은 바뀐 뒤의 전체 코스를 돌려주므로, 다시 부르지 않고 그 응답을 가이드 코스 캐시에 넣는다. */
function useCourseMutation<TVariables>(
  tourId: number,
  mutationFn: (variables: TVariables) => Promise<Course>,
): UseMutationResult<Course, ApiError, TVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (course) => {
      queryClient.setQueryData(qk.guideCourse(tourId), course);
    },
  });
}

/**
 * AI 코스 초안 생성. 뮤테이션 키가 있어 화면을 떠났다 돌아와도 진행 중인 생성을 알아본다(`useIsCreatingDraft`).
 * 코스가 생기면 신청자 관리의 코스 버튼(`코스 이어서 편집`)과 가이드 탐방 목록의 코스 상태도 바뀌므로 다시 불러온다.
 */
export function useCreateDraft(tourId: number): UseMutationResult<Course, ApiError, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: qk.courseDraft(tourId),
    mutationFn: () => postCourseDraft(tourId),
    onSuccess: (course) => {
      queryClient.setQueryData(qk.guideCourse(tourId), course);
      void queryClient.invalidateQueries({ queryKey: qk.applicants(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
    },
  });
}

/** 이 탐방의 AI 초안 생성 요청이 진행 중인지 — 지금 화면이 보낸 것이든, 떠난 화면이 보낸 것이든. */
export function useIsCreatingDraft(tourId: number): boolean {
  return useIsMutating({ mutationKey: qk.courseDraft(tourId) }) > 0;
}

/** 변수는 바뀐 순서의 전체 지점 id. */
export function useReorderStops(tourId: number): UseMutationResult<Course, ApiError, number[]> {
  return useCourseMutation(tourId, (stopIds: number[]) => putStopOrder(tourId, stopIds));
}

/** 지점 한줄평. */
export function useUpdateStop(
  tourId: number,
): UseMutationResult<Course, ApiError, { stopId: number; description: string }> {
  return useCourseMutation(tourId, ({ stopId, description }) =>
    patchStop(tourId, stopId, description),
  );
}

export function useDeleteStop(tourId: number): UseMutationResult<Course, ApiError, number> {
  return useCourseMutation(tourId, (stopId: number) => deleteCourseStop(tourId, stopId));
}

/** 확정하면 쿠폰이 발급되고 코스 상태가 바뀌므로 신청자 보드와 가이드 탐방 목록도 다시 불러온다. */
export function useConfirmCourse(tourId: number): UseMutationResult<Course, ApiError, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postConfirmCourse(tourId),
    onSuccess: (course) => {
      queryClient.setQueryData(qk.guideCourse(tourId), course);
      void queryClient.invalidateQueries({ queryKey: qk.applicants(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
    },
  });
}
