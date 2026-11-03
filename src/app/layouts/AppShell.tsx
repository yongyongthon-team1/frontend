import { Outlet } from 'react-router';
import { MobileFrame } from './MobileFrame';

/** 루트 레이아웃: 모든 화면을 폰 프레임 안에 그린다. */
export function AppShell() {
  return (
    <MobileFrame>
      <Outlet />
    </MobileFrame>
  );
}
