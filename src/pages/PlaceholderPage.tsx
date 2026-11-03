import { useState } from 'react';
import { useLocation } from 'react-router';
import { useLogout } from '@/features/auth/queries';
import type { ActionLink } from '@/shared/lib/types';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Page } from '@/shared/ui/Page';
import { TopBar } from '@/shared/ui/TopBar';

export interface PlaceholderPageProps {
  title: string;
  /** 와이어프레임 코드(예: `hs-a01`). */
  wireframe?: string;
  /** MY 탭 · 운영자 자리: 로그아웃 버튼(막다른 곳 방지). */
  showLogout?: boolean;
  /** 자리 화면에서 이어 갈 화면(예: 사장님 가게 → 쿠폰 사용 처리). */
  action?: ActionLink;
}

/** 아직 만들지 않은 화면의 자리(설계 5.3 라우트를 모두 등록해 막다른 곳을 없앤다). 각 태스크가 실제 화면으로 바꾼다. */
export function PlaceholderPage({
  title,
  wireframe,
  showLogout = false,
  action,
}: PlaceholderPageProps) {
  // 주소로 바로 들어와 이전 화면이 없으면 뒤로 가기가 앱을 떠나지 않게 처음으로 보낸다.
  const { key } = useLocation();
  return (
    <>
      <TopBar title={title} back={key === 'default' ? '/' : true} />
      <Page className="flex flex-col gap-3">
        <EmptyState title={title} description="MVP 2단계에서 열려요." action={action} />
        {wireframe ? (
          <p className="text-center text-sm text-muted">{`와이어프레임: ${wireframe}`}</p>
        ) : null}
        {showLogout ? <LogoutButton /> : null}
      </Page>
    </>
  );
}

function LogoutButton() {
  const logout = useLogout();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      className="mt-6"
      loading={pending}
      onClick={() => {
        setPending(true);
        void logout().finally(() => setPending(false));
      }}
    >
      로그아웃
    </Button>
  );
}
