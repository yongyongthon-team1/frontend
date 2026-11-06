import { useRef, useState } from 'react';
import { useLogout } from '@/features/auth/queries';
import { Button } from '@/shared/ui/Button';
import type { ButtonSize, ButtonVariant } from '@/shared/ui/buttonStyles';
import { ListRow } from '@/shared/ui/ListRow';

export interface LogoutButtonProps {
  /** `row`면 설정 목록용 `ListRow` 모양(제목 `로그아웃`, 설명이 meta). 기본은 `secondary`. */
  variant?: ButtonVariant | 'row';
  size?: ButtonSize;
  className?: string;
  description?: string;
}

/**
 * 로그아웃 버튼(화면마다 따로 만들지 않는다). 처리 중에는 잠그고 연타해도 로그아웃 요청은 한 번이다.
 * 오른쪽 위처럼 발표 배지를 비켜야 하는 자리는 `className`으로 `--header-action-clear` 오프셋을 준다.
 */
export function LogoutButton({
  variant = 'secondary',
  size,
  className,
  description,
}: LogoutButtonProps) {
  const logout = useLogout();
  const [pending, setPending] = useState(false);
  const runningRef = useRef(false);

  function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    setPending(true);
    void logout().finally(() => {
      runningRef.current = false;
      setPending(false);
    });
  }

  if (variant === 'row') {
    return <ListRow title="로그아웃" meta={description} onClick={run} disabled={pending} />;
  }
  return (
    <Button variant={variant} size={size} className={className} loading={pending} onClick={run}>
      로그아웃
    </Button>
  );
}
