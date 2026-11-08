import { useLocation } from 'react-router';
import { getLandingPath } from '@/features/auth/landing';
import { useMe } from '@/features/auth/queries';
import { LogoutButton } from '@/features/auth/components/LogoutButton';

/**
 * 첫 진입 화면의 로그아웃 링크(판정 A8). 로그인한 사용자가 처음 내려앉는 화면(`getLandingPath`가 이 주소)에서만 그린다 —
 * 하단 탭이 없는 인증 화면에서 갇히지 않게 한다. 다른 곳에서 들어왔으면(MY의 행 · 인증 상태 화면 등) 뒤로 가기로 충분하다.
 */
export function FirstEntryLogout() {
  const { data: me } = useMe();
  const { pathname } = useLocation();
  if (me === undefined || getLandingPath(me) !== pathname) return null;
  return <LogoutButton variant="ghost" size="sm" className="mt-1 w-full" />;
}
