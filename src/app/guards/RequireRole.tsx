import { Navigate, Outlet } from 'react-router';
import { getLandingPath } from '@/features/auth/landing';
import type { Role } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';

/** 역할 일치(가드 ②). `RequireAuth` 안에서만 쓴다(내 정보가 이미 있다). 다른 역할이면 내 첫 화면으로. */
export function RequireRole({ role }: { role: Role }) {
  const { data: me } = useMe();
  if (!me) return null;
  if (me.role !== role) return <Navigate to={getLandingPath(me)} replace />;
  return <Outlet />;
}
