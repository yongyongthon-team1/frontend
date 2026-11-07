import type { QueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/session';
import type { SeedCheckpoint } from '@/shared/config/demoAccounts';
import { errorMessage } from '@/shared/lib/errors';
import { ApiError, request } from '@/shared/lib/http';
import { useDemoStore } from './demoStore';

/** 실서버에는 초기화 엔드포인트가 없을 때(404)의 사유(2C-R28). 토스트 설명과 잠긴 버튼의 사유로 쓴다. */
export const RESET_MISSING_REASON = '실서버에는 시연 초기화가 없어요.';

/** 초기화 실패 토스트 제목(패널 버튼과 `reset=1` 링크가 같이 쓴다). */
export const RESET_FAILED = '시연 데이터를 초기화하지 못했어요.';

/**
 * 초기화 실패 토스트의 설명. 404면 실서버에 초기화가 없다는 사유, 그 밖의 `ApiError`는 코드 표 문구
 * (403은 `X-Demo-Key` 설정 오류일 수 있어 잠그지 않고 옛 문구 그대로), 아니면 없음.
 */
export function resetFailureDescription(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.status === 404 ? RESET_MISSING_REASON : errorMessage(error.code);
}

/**
 * 시연 데이터 초기화(결정 0007). 목업은 오늘 기준 시드(체크포인트를 주면 그 단계까지 진행한 시드)로 되돌리고,
 * 실서버는 백엔드 리셋 수단을 부른다(초기화 키가 있으면 헤더 `X-Demo-Key`). 세션 토큰은 붙이지 않는다 — 리셋은 키만으로
 * 동작하고, 지난 리허설의 만료된 토큰이 리셋을 401 복구 · 로그아웃으로 바꾸지 않게 한다. 성공하면 세션 토큰 · 빠른
 * 로그인 기록 · 최근 쿠폰(판정 32) · 쿼리 캐시를 비운다(판정 Task 21) — 발표자는 역할 버튼(또는 `?as=`)으로 다시
 * 들어간다. 실패하면 아무것도 비우지 않고 던진다. 404면 실서버에 초기화가 없는 것이므로 `resetMissing`을 켜서
 * 패널 버튼을 이 세션 동안 잠근다(2C-R28 — 시험 호출이 곧 초기화라 미리 알 수 없다).
 */
export async function resetDemoData(
  opts: { checkpoint?: SeedCheckpoint },
  deps: { queryClient: QueryClient },
): Promise<void> {
  const resetKey = useDemoStore.getState().resetKey;
  try {
    await request<unknown>('/demo/reset', {
      method: 'POST',
      body: { checkpoint: opts.checkpoint },
      headers: resetKey ? { 'X-Demo-Key': resetKey } : {},
      auth: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      useDemoStore.getState().setResetMissing(true);
    }
    throw error;
  }
  useSession.getState().setToken(null);
  useDemoStore.getState().setActiveDemoEmail(null);
  useDemoStore.getState().setActiveDemoToken(null);
  useDemoStore.getState().setLastCoupon(null);
  deps.queryClient.clear();
}
