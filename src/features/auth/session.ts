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
 * 401 복구 시도. 다시 로그인했으면 true, 못 했으면 false로 끝나는 Promise이고, 시도할 수 없으면(시연 계정 아님) null.
 * 복구는 새 토큰을 직접 넣는다.
 */
export type UnauthorizedRecovery = () => Promise<boolean> | null;

let recovery: UnauthorizedRecovery | null = null;
/** 이번 페이지 세션에서 복구를 이미 시도했는지(한 번만 한다). */
let recoveryUsed = false;
/** 복구가 진행 중인지. 그동안 겹쳐 온 401은 복구 결과를 따른다(먼저 로그아웃하지 않는다). */
let recovering = false;

/**
 * 401 복구 수단을 등록한다. 시연 계층이 `main.tsx`에서 시연 계정 자동 재로그인을 건다(설계 5.4 — features는
 * demo를 import하지 않는다, 판정 29). 등록하면 "이번 페이지 세션에서 시도함" 기록도 새로 시작한다.
 */
export function setUnauthorizedRecovery(fn: UnauthorizedRecovery | null): void {
  recovery = fn;
  recoveryUsed = false;
  recovering = false;
}

function clearSession(): void {
  useSession.getState().setToken(null);
  queryClient?.clear();
}

/**
 * HTTP 401일 때 부른다(`configureHttp({ onUnauthorized })`). 토큰과 쿼리 캐시를 비우면 `RequireAuth`가 `/login?next=`로 보낸다.
 * 토큰이 없으면 아무것도 하지 않는다(판정 G6 — 로그인 실패 401에서 로그아웃 · 재로그인 루프 방지).
 * 등록된 복구가 있으면 비우기 전에 페이지 세션당 한 번 시도하고, 성공하면 쿼리를 모두 다시 불러온다.
 */
export function handleUnauthorized(): void {
  if (useSession.getState().token === null) return;
  if (recovering) return;
  const attempt = recovery === null || recoveryUsed ? null : recovery();
  if (attempt === null) {
    clearSession();
    return;
  }
  recoveryUsed = true;
  recovering = true;
  void attempt
    .catch(() => false)
    .then((ok) => {
      recovering = false;
      if (ok) void queryClient?.invalidateQueries();
      else clearSession();
    });
}
