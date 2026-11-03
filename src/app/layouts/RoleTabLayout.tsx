import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useMe } from '@/features/auth/queries';
import { BottomTabBar } from '@/shared/ui/BottomTabBar';
import { TABS } from '../tabs';

/**
 * 로그인 화면들의 레이아웃: 세로 flex — 스크롤 영역(화면) + 내 역할의 하단 탭(탭이 없는 운영자는 생략).
 * `RequireAuth` 안에서만 쓴다(내 정보가 이미 있다).
 */
export function RoleTabLayout() {
  const { data: me } = useMe();
  const tabs = me ? TABS[me.role] : [];
  const scrollRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // 탭 · 화면을 옮기면 스크롤 영역을 맨 위로.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {tabs.length > 0 ? <BottomTabBar tabs={tabs} /> : null}
    </div>
  );
}
