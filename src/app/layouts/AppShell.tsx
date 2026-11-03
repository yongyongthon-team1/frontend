import { Outlet } from 'react-router';
import { DemoPanel } from '@/demo/DemoPanel';
import { useDemoToolsOn } from '@/demo/demoStore';
import { RoleBadge } from '@/demo/RoleBadge';
import { MobileFrame } from './MobileFrame';

/**
 * 루트 레이아웃: 모든 화면을 폰 프레임 안에 그린다. 시연 도구가 켜져 있으면 프레임 옆에 시연 패널을, 발표 모드면
 * 프레임 오른쪽 위에 역할 배지를 둔다(둘 다 역할 전환에도 마운트된 채 남는다).
 */
export function AppShell() {
  const demoOn = useDemoToolsOn();
  return (
    <MobileFrame aside={demoOn ? <DemoPanel /> : null} overlay={<RoleBadge />}>
      <Outlet />
    </MobileFrame>
  );
}
