import type { Role } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import { useSession } from '@/features/auth/session';
import type { Tone } from '@/shared/lib/types';
import { Badge } from '@/shared/ui/Badge';
import { useDemoStore } from './demoStore';

const ROLE_BADGE: Record<Role, { label: string; tone: Tone }> = {
  HIGH_SCHOOL: { label: '고교생 화면', tone: 'info' },
  UNIVERSITY: { label: '가이드 화면', tone: 'success' },
  OWNER: { label: '사장님 화면', tone: 'warning' },
  ADMIN: { label: '운영자 화면', tone: 'neutral' },
};

/**
 * 발표 모드의 역할 배지(설계 5.8 — 관객에게 "지금 가이드 화면"임을 보여 준다). TopBar가 아니라 앱 계층이
 * 프레임 오른쪽 위에 겹쳐 그린다(판정 Task 21 — shared가 demo를 모르게). 위치는 globals.css `.role-badge`.
 */
export function RoleBadge() {
  const presentMode = useDemoStore((s) => s.presentMode) === true;
  return presentMode ? <CurrentRoleBadge /> : null;
}

/**
 * 토큰이 있고 내 정보를 받았을 때만 그린다. 이 배지는 역할 전환 · 로그아웃에도 마운트된 채 남으므로, 캐시를 비운
 * 뒤 이전 사용자의 역할을 보여 주면 안 된다(판정 27 · Review Focus 4).
 */
function CurrentRoleBadge() {
  const token = useSession((s) => s.token);
  const { data: me } = useMe();
  const badge = me ? (ROLE_BADGE[me.role] as (typeof ROLE_BADGE)[Role] | undefined) : undefined;
  if (token === null || badge === undefined) return null;
  return (
    <div className="role-badge rounded-full bg-bg shadow-md">
      <Badge tone={badge.tone} className="px-3 py-1.5 text-sm">
        {badge.label}
      </Badge>
    </div>
  );
}
