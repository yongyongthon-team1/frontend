import {
  skipToken,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { loadCampuses } from '@/features/campuses/queries';
import { qk } from '@/shared/api/queryKeys';
import { errorMessage } from '@/shared/lib/errors';
import { ApiError } from '@/shared/lib/http';
import {
  getCampusPlaces,
  getCourse,
  getGuideCourse,
  getNearbyStores,
  postConfirmCourse,
  postCourseDraft,
  putCourseSpots,
} from './api';
import type { CampusPlace, Course, NearbyStore, PlaceRef } from './model';
import { buildSpots, type SpotEdit } from './spots';

// 훅은 캠퍼스 목록을 기다리지 않고 `loadCampuses`의 약속째 넘긴다 — 캠퍼스 요청과 코스 요청이 동시에 나간다(errata G13).

/** 학생이 보는 확정 코스. `tourId`를 아직 모르면(신청을 불러오는 중) 부르지 않는다. */
export function useCourse(tourId: number | undefined): UseQueryResult<Course> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.course(tourId ?? -1),
    queryFn: tourId === undefined ? skipToken : () => getCourse(tourId, loadCampuses(queryClient)),
  });
}

/** 가이드의 코스. data가 null이면 아직 코스가 없다. */
export function useGuideCourse(tourId: number): UseQueryResult<Course | null> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.guideCourse(tourId),
    queryFn: () => getGuideCourse(tourId, loadCampuses(queryClient)),
  });
}

/**
 * 지점 편집(순서 · 한줄평 · 빼기). 백엔드는 전체 스팟 PUT뿐이라(2C-R13) 캐시의 가이드 코스(없으면 다시 받아)에 편집을
 * 적용한 전체 `spots`를 보낸다. 응답이 바뀐 뒤의 전체 코스라 다시 부르지 않고 그 응답을 가이드 코스 캐시에 넣는다.
 */
function useSpotEdit<TVariables>(
  tourId: number,
  toEdit: (variables: TVariables) => SpotEdit,
): UseMutationResult<Course, ApiError, TVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const current =
        queryClient.getQueryData<Course | null>(qk.guideCourse(tourId)) ??
        (await getGuideCourse(tourId, loadCampuses(queryClient)));
      if (current === null) throw new ApiError(404, 'NOT_FOUND', errorMessage('NOT_FOUND'));
      const spots = buildSpots(current, toEdit(variables));
      return putCourseSpots(tourId, spots, loadCampuses(queryClient));
    },
    onSuccess: (course) => {
      queryClient.setQueryData(qk.guideCourse(tourId), course);
    },
    // 쓰기는 됐는데 탐방을 다시 읽다 실패해도 서버 코스는 이미 바뀌었다 — 캐시를 낡은 채로 두지 않고 다시 받는다.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.guideCourse(tourId) });
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
    mutationFn: () => postCourseDraft(tourId, loadCampuses(queryClient)),
    onSuccess: (course) => {
      queryClient.setQueryData(qk.guideCourse(tourId), course);
      void queryClient.invalidateQueries({ queryKey: qk.applicants(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
    },
    // 탐방을 함께 읽다 먼저 실패해도 AI 생성은 서버에서 이어져 코스가 생겼을 수 있다 — 낡은 '코스 없음'을 두지 않고 다시 받는다.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.guideCourse(tourId) });
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
  return useSpotEdit(tourId, (stopIds: number[]) => ({ kind: 'reorder', stopIds }));
}

/** 지점 한줄평. 앞뒤 공백을 떼고, 비우면 한줄평이 없어진다. */
export function useUpdateStop(
  tourId: number,
): UseMutationResult<Course, ApiError, { stopId: number; description: string }> {
  return useSpotEdit(
    tourId,
    ({ stopId, description }: { stopId: number; description: string }) => ({
      kind: 'note',
      stopId,
      description,
    }),
  );
}

export function useDeleteStop(tourId: number): UseMutationResult<Course, ApiError, number> {
  return useSpotEdit(tourId, (stopId: number) => ({ kind: 'remove', stopId }));
}

/** 맨 끝에 장소 하나를 더한다. 5곳 상한 · 같은 장소 중복은 화면이 먼저 막는다(2B′-R14). */
export function useAddStop(tourId: number): UseMutationResult<Course, ApiError, PlaceRef> {
  return useSpotEdit(tourId, (place: PlaceRef) => ({ kind: 'add', place }));
}

/** 지점 하나를 다른 장소로 바꾼다(같은 자리 · 한줄평은 비운다). */
export function useReplaceStop(
  tourId: number,
): UseMutationResult<Course, ApiError, { stopId: number; place: PlaceRef }> {
  return useSpotEdit(tourId, ({ stopId, place }: { stopId: number; place: PlaceRef }) => ({
    kind: 'replace',
    stopId,
    place,
  }));
}

/** 이 학교 주변 상점 후보(가까운 순). `universityId`가 null이면(탐방 학교를 모름, 2B′-R15) 부르지 않는다. */
export function useNearbyStores(universityId: number | null): UseQueryResult<NearbyStore[]> {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.nearbyStores(universityId ?? -1),
    queryFn:
      universityId === null
        ? skipToken
        : () => getNearbyStores(universityId, loadCampuses(queryClient)),
  });
}

/** 이 학교 캠퍼스 장소 후보. `universityId`가 null이면 부르지 않는다. */
export function useCampusPlaces(universityId: number | null): UseQueryResult<CampusPlace[]> {
  return useQuery({
    queryKey: qk.campusPlaces(universityId ?? -1),
    queryFn: universityId === null ? skipToken : () => getCampusPlaces(universityId),
  });
}

/** 확정하면 쿠폰이 발급되고 코스 상태가 바뀌므로 신청자 보드와 가이드 탐방 목록도 다시 불러온다. */
export function useConfirmCourse(tourId: number): UseMutationResult<Course, ApiError, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postConfirmCourse(tourId, loadCampuses(queryClient)),
    onSuccess: (course) => {
      queryClient.setQueryData(qk.guideCourse(tourId), course);
      void queryClient.invalidateQueries({ queryKey: qk.applicants(tourId) });
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
    },
    // 확정은 됐는데 코스를 다시 읽다 실패했을 수 있다 — 낡은 캐시로 다시 확정하면 409이므로 가이드 코스를 다시 받는다.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.guideCourse(tourId) });
    },
  });
}
