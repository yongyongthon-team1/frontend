import { useLocation } from 'react-router';
import type { Role } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import { useSession } from '@/features/auth/session';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { Badge } from '@/shared/ui/Badge';
import { useDemoStore } from './demoStore';
import { useQuickLoginAvailable } from './quickLogin';

// V2 톤(칩 바탕 -soft + 같은 색 테두리 · 점). 글자는 톤 색이 아니라 본문색(ink)이다 — -soft 바탕 위 대비가
// success 약 2.7:1 · accent-local 약 1.9:1로 낮아 무대에서 읽히지 않는다. 테두리가 있어 콘텐츠 위에 겹쳐도 경계가 보인다(그림자 없음).
const ROLE_BADGE: Record<Role, { label: string; tone: Tone }> = {
  HIGH_SCHOOL: { label: '고교생 화면', tone: 'info' },
  UNIVERSITY: { label: '가이드 화면', tone: 'success' },
  OWNER: { label: '사장님 화면', tone: 'warning' },
  ADMIN: { label: '운영자 화면', tone: 'neutral' },
};

const TONE_BORDER: Record<Tone, string> = {
  neutral: 'border-neutral-300',
  info: 'border-brand',
  success: 'border-success',
  warning: 'border-local',
  danger: 'border-danger',
};

/**
 * 발표 모드의 역할 배지(설계 5.8 — 관객에게 "지금 가이드 화면"임을 크게 보여 준다). TopBar가 아니라 앱 계층이
 * 프레임 오른쪽 위에 겹쳐 그린다(판정 Task 21 — shared가 demo를 모르게). 위치는 globals.css `.role-badge`.
 * 크기는 무대에서 읽히는 16px 굵은 글씨이고, 화면 제목(h1: TopBar 제목 또는 탭 첫 화면의 PageHeading) 글자를 덮지 않는다(e2e/golden-path 발표 모드).
 */
export function RoleBadge() {
  // 발표 모드는 빠른 로그인이 되는 목업에서만 있다(시연 패널과 같은 조건).
  const quickLoginOn = useQuickLoginAvailable();
  const presentMode = useDemoStore((s) => s.presentMode) === true && quickLoginOn;
  const { pathname } = useLocation();
  // 공개 화면(가입 · 보호자 동의)은 로그인한 사람의 화면이 아니다 — 배지가 가입자 · 보호자에게 엉뚱한 역할을 붙이지 않게 숨긴다.
  const isPublicRoute = pathname === '/signup' || pathname.startsWith('/consent/');
  return presentMode && !isPublicRoute ? <CurrentRoleBadge /> : null;
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
    <div className="role-badge rounded-full bg-bg">
      <Badge
        tone={badge.tone}
        className={cn('border-2 px-3 py-1.5 text-base font-bold', TONE_BORDER[badge.tone])}
      >
        {badge.label}
      </Badge>
    </div>
  );
}
