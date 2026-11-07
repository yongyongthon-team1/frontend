import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { qk } from '@/shared/api/queryKeys';
import { fetchMe, login, logout, patchMe, postSignup, putGuideProfile } from './api';
import type { Me } from './model';
import { useSession } from './session';

/** `['me']` 쿼리 정의. `useMe`와 테스트 하네스(`renderApp`)가 같이 쓴다. */
export function meQueryOptions() {
  // `fetchMe`를 그대로 넣지 않는다 — TanStack이 컨텍스트 객체를 첫 인자(`token`)로 넘긴다.
  return queryOptions({ queryKey: qk.me, queryFn: () => fetchMe() });
}

/**
 * 내 정보를 캐시를 건너뛰고 다시 받아 `['me']`에 넣는다(`staleTime: 0`). `Me`를 돌려주지 않는 변경(인증 제출 · 사업자 인증 ·
 * 가게 연결 등) 뒤 이동하기 전에 await해서, 도착한 화면이 옛 상태를 그리지 않게 한다.
 */
export function refetchMe(queryClient: QueryClient): Promise<Me> {
  return queryClient.fetchQuery({ ...meQueryOptions(), staleTime: 0 });
}

/** 로그인한 사용자. 토큰이 있을 때만 불러오고, 창 포커스 때 다시 불러온다(운영자 승인 · 보호자 동의 반영). */
export function useMe(): UseQueryResult<Me> {
  const token = useSession((s) => s.token);
  return useQuery({ ...meQueryOptions(), enabled: token !== null, refetchOnWindowFocus: true });
}

/** 성공하면 이전 사용자의 캐시를 비우고 토큰 · 내 정보를 넣는다. 이동은 화면이 정한다(`next` 또는 첫 화면). */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: ({ token, me }) => {
      queryClient.clear();
      useSession.getState().setToken(token);
      queryClient.setQueryData(qk.me, me);
    },
  });
}

/** 가입. 성공하면 `useLogin`과 같은 순서로 이전 캐시를 비우고 토큰 · 내 정보를 넣는다. 이동은 화면이 정한다. */
export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSignup,
    onSuccess: ({ token, me }) => {
      queryClient.clear();
      useSession.getState().setToken(token);
      queryClient.setQueryData(qk.me, me);
    },
  });
}

/** 고교생 프로필(이름 포함) 저장. 응답의 새 `Me`를 캐시에 넣는다. */
export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchMe,
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me, me);
    },
  });
}

/**
 * 가이드 프로필 저장. 새 `Me`를 캐시에 넣고, 학과가 생기면 달라지는 가이드 화면의 조회(탐방 목록 · 신청자 · 코스)와
 * 학생이 보는 탐방(가이드 학과 표시)을 다시 받게 한다.
 */
export function useSaveGuideProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putGuideProfile,
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me, me);
      void queryClient.invalidateQueries({ queryKey: qk.guideTours });
      void queryClient.invalidateQueries({ queryKey: qk.allApplicants });
      void queryClient.invalidateQueries({ queryKey: qk.allGuideCourses });
      void queryClient.invalidateQueries({ queryKey: qk.allTours });
    },
  });
}

/**
 * 서버 로그아웃(실패는 무시) → 토큰 비움 → `/login`으로 이동 → 쿼리 캐시 비움(판정 Task 11 순서).
 * 캐시는 보호 화면이 사라진 뒤에 비워서 남은 쿼리가 다시 불러오지 않게 한다. 이동은 `flushSync`로 토큰 변경과 같은
 * 렌더에 반영해, `RequireAuth`가 지금 주소로 `/login?next=`를 만들지 않게 한다.
 */
export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await logout();
    } catch {
      // 서버 세션이 이미 없거나 네트워크가 끊겨도 이 기기에서는 로그아웃한다.
    }
    useSession.getState().setToken(null);
    await navigate('/login', { replace: true, flushSync: true });
    queryClient.clear();
  }, [queryClient, navigate]);
}
