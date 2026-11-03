import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '@/features/auth/queries';
import { useSession } from '@/features/auth/session';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Skeleton } from '@/shared/ui/Skeleton';

/** 로그인 필요(가드 ①). 토큰만 본다 — 없으면 지금 주소를 `next`로 붙여 로그인으로 보낸다. */
export function RequireAuth() {
  const token = useSession((s) => s.token);
  const { pathname, search } = useLocation();
  if (token === null) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <MeGate />;
}

/**
 * 토큰이 있을 때만 그려져 내 정보(`['me']`)를 불러온다. 불러오는 동안 Skeleton, 받으면 하위 라우트.
 * 401은 `handleUnauthorized`가 토큰을 비워 위의 `RequireAuth`가 로그인으로 보낸다. 그 밖의 오류는 다시 시도.
 */
function MeGate() {
  const me = useMe();
  if (me.data) return <Outlet />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className="flex flex-col gap-4 px-[var(--gutter)] pt-6"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
