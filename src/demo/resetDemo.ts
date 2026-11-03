import type { QueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import type { SeedCheckpoint } from '@/shared/config/demoAccounts';
import { request } from '@/shared/lib/http';
import { useDemoStore } from './demoStore';

/**
 * 시연 데이터 초기화(결정 0007). 목업은 오늘 기준 시드(체크포인트를 주면 그 단계까지 진행한 시드)로 되돌리고,
 * 실서버는 백엔드 리셋 수단을 부른다(초기화 키가 있으면 헤더 `X-Demo-Key`). 성공하면 세션 토큰 · 빠른 로그인 기록 ·
 * 쿼리 캐시를 비운다(판정 Task 21) — 발표자는 역할 버튼(또는 `?as=`)으로 다시 들어간다. 실패하면 아무것도 비우지 않고 던진다.
 */
export async function resetDemoData(
  opts: { checkpoint?: SeedCheckpoint },
  deps: { queryClient: QueryClient },
): Promise<void> {
  const resetKey = useDemoStore.getState().resetKey;
  await request<unknown>('/demo/reset', {
    method: 'POST',
    body: { checkpoint: opts.checkpoint },
    headers: resetKey ? { 'X-Demo-Key': resetKey } : {},
  });
  useSession.getState().setToken(null);
  useDemoStore.getState().setActiveDemoEmail(null);
  deps.queryClient.clear();
}
