import { Outlet } from 'react-router';
import { DemoPanel } from '@/demo/DemoPanel';
import { useDemoToolsOn } from '@/demo/demoStore';
import { RoleBadge } from '@/demo/RoleBadge';
import { env } from '@/shared/config/env';
import { MobileFrame } from './MobileFrame';

/**
 * 루트 레이아웃: 모든 화면을 폰 프레임 안에 그린다. 시연 도구가 켜져 있으면 프레임 옆에 시연 패널을, 발표 모드면
 * 프레임 오른쪽 위에 역할 배지를 둔다(둘 다 역할 전환에도 마운트된 채 남는다).
 * 목업을 뺀 빌드(라이브 배포)에는 시연 패널을 두지 않는다(11/14) — 실서버에서는 역할 전환이 안내 문구뿐이고 초기화도
 * 없어 무대에서 군더더기다. 화면 안의 시연 도우미(신청 동기 채우기 · 보호자 동의 바로 열기 등)는 그대로 켜진다.
 */
export function AppShell() {
  const demoOn = useDemoToolsOn();
  const panelOn = demoOn && __MOCK_API__ && env.mockApi;
  return (
    <MobileFrame aside={panelOn ? <DemoPanel /> : null} overlay={<RoleBadge />}>
      <Outlet />
    </MobileFrame>
  );
}
