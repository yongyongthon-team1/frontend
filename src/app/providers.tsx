import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/shared/lib/http';

// 화면이 `@/shared/lib/http`를 import하지 않고도 쿼리 · 뮤테이션 오류의 `code` · `details`를 쓰게 한다.
// HTTP 클라이언트(`request`)는 실패를 모두 ApiError로 던진다.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
  }
}

/** 4xx는 다시 시도해도 같은 답이라 바로 오류를 보여 주고, 네트워크 · 시간 초과 · 5xx만 한 번 더 시도한다. */
function retryOnce(failureCount: number, error: unknown): boolean {
  const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !clientError && failureCount < 1;
}

// eslint-disable-next-line react-refresh/only-export-components
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: retryOnce, staleTime: 30_000, refetchOnWindowFocus: true },
    },
  });
}

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
