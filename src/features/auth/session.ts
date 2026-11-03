import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 세션 토큰(localStorage 보존 — 새로고침 · 딥링크에도 로그인 유지). 사용자 정보는 토큰이 아니라 `['me']` 쿼리에 둔다(설계 5.4).

export const SESSION_KEY = 'ytt.session';

interface SessionState {
  token: string | null;
  setToken(token: string | null): void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
    }),
    { name: SESSION_KEY, partialize: (s) => ({ token: s.token }) },
  ),
);

let queryClient: QueryClient | null = null;

/** 앱이 쓰는 QueryClient. `handleUnauthorized`와 시연 도구가 같은 인스턴스를 쓴다(`main.tsx` · `renderApp`이 등록). */
export function registerQueryClient(client: QueryClient): void {
  queryClient = client;
}

/**
 * HTTP 401일 때 부른다(`configureHttp({ onUnauthorized })`). 토큰과 쿼리 캐시를 비우면 `RequireAuth`가 `/login?next=`로 보낸다.
 * 토큰이 없으면 아무것도 하지 않는다(판정 G6 — 로그인 실패 401에서 로그아웃 · 재로그인 루프 방지).
 * Task 21이 시연 계정 자동 재로그인을 덧붙인다.
 */
export function handleUnauthorized(): void {
  if (useSession.getState().token === null) return;
  useSession.getState().setToken(null);
  queryClient?.clear();
}
