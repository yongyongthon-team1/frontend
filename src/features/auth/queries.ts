import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { qk } from '@/shared/api/queryKeys';
import { fetchMe, login, logout } from './api';
import type { Me } from './model';
import { useSession } from './session';

/** `['me']` 쿼리 정의. `useMe`와 테스트 하네스(`renderApp`)가 같이 쓴다. */
export function meQueryOptions() {
  return queryOptions({ queryKey: qk.me, queryFn: fetchMe });
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
