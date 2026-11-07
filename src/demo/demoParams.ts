import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEMO_ROLES,
  SEED_CHECKPOINTS,
  type DemoRole,
  type SeedCheckpoint,
} from '@/shared/config/demoAccounts';
import type { ApiMode } from '@/shared/config/env';
import { errorMessage } from '@/shared/lib/errors';
import { ApiError } from '@/shared/lib/http';
import { useDemoStore } from './demoStore';
import { quickLogin } from './quickLogin';
import { RESET_FAILED, resetDemoData, resetFailureDescription } from './resetDemo';

// 원클릭 시연 링크(설계 5.8): `?demo=1&mode=mock|real&reset=1&checkpoint=CONFIRMED&as=student&present=1&key=…`
// 한 번으로 시연 도구 · API 모드 · 데이터 초기화 · 역할 · 발표 모드를 세팅한다. 모르는 값은 없는 것으로 본다.
// `mode`는 이번 페이지에는 늘 쓰이고(`resolveApiMode`), 저장은 `demo=1`과 함께일 때만 한다.

export interface DemoParams {
  demo: boolean;
  mode: ApiMode | null;
  reset: boolean;
  as: DemoRole | null;
  /** null이면 발표 모드 저장값을 그대로 둔다(`present=0`이면 끈다). */
  present: boolean | null;
  key: string | null;
  checkpoint: SeedCheckpoint | null;
}

/** 처리한 뒤 주소에서 지우는 파라미터. `present`(발표 모드)는 남긴다. */
const PROCESSED_PARAMS = ['demo', 'mode', 'reset', 'as', 'key', 'checkpoint'];

const isOn = (value: string | null) => value === '1' || value === 'true';
const isOff = (value: string | null) => value === '0' || value === 'false';

function oneOf<T extends string>(values: readonly T[], value: string | null): T | null {
  return value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseDemoParams(search: string): DemoParams {
  const q = new URLSearchParams(search);
  const present = q.get('present');
  return {
    demo: isOn(q.get('demo')),
    mode: oneOf<ApiMode>(['mock', 'real'], q.get('mode')),
    reset: isOn(q.get('reset')),
    as: oneOf(DEMO_ROLES, q.get('as')),
    present: isOn(present) ? true : isOff(present) ? false : null,
    key: q.get('key') || null,
    checkpoint: oneOf(SEED_CHECKPOINTS, q.get('checkpoint')),
  };
}

/**
 * 렌더 전에 시연 설정에 저장한다: demo → 시연 도구 켬, mode → API 모드 덮어쓰기(`demo=1`과 함께일 때만 — 시연 패널이
 * 없는 방문자가 실서버 모드에 갇히지 않게), present → 발표 모드, key → 초기화 키. reset은 AI 속도 · 지도 모드도
 * 기본값(보통 · 자동)으로 되돌린다 — 지난 리허설의 설정이 발표 모드(패널 토글이 안 보임)에서 몰래 남지 않게(판정 33).
 */
export function applyDemoParamsBeforeRender(p: DemoParams): void {
  const store = useDemoStore.getState();
  if (p.demo) store.setEnabled(true);
  if (p.demo && p.mode !== null) store.setApiModeOverride(p.mode);
  if (p.present !== null) store.setPresentMode(p.present);
  if (p.key !== null) store.setResetKey(p.key);
  if (p.reset) {
    store.setAiSpeed('normal');
    store.setMapMode('auto');
  }
}

function failureDescription(error: unknown): string | undefined {
  return error instanceof ApiError ? errorMessage(error.code) : undefined;
}

/**
 * 링크의 동작을 첫 렌더 전에 실행한다(판정 29 — 로그인 화면이 깜빡이지 않게): reset → 시연 데이터 초기화,
 * as → 그 역할로 빠른 로그인. 실패하면 토스트만 남기고(Toaster가 마운트되면 보인다) 계속한다.
 * 빠른 로그인했으면 첫 화면 경로를 돌려준다 — `/`가 아닌 주소로 연 링크는 그 주소에 머문다.
 */
export async function runDemoParams(
  p: DemoParams,
  deps: { queryClient: QueryClient; path: string },
): Promise<string | null> {
  if (p.reset) {
    try {
      await resetDemoData({ checkpoint: p.checkpoint ?? undefined }, deps);
    } catch (error) {
      toast.error(RESET_FAILED, { description: resetFailureDescription(error) });
    }
  }
  if (p.as === null) return null;
  let landing: string | null = null;
  try {
    await quickLogin(p.as, {
      queryClient: deps.queryClient,
      navigate: (to) => {
        landing = to;
      },
      next: deps.path === '/' || deps.path === '/login' ? undefined : deps.path,
    });
  } catch (error) {
    toast.error('시연 계정으로 로그인하지 못했어요.', { description: failureDescription(error) });
  }
  return landing;
}

/**
 * 처리한 시연 파라미터를 뺀 주소(`present`와 화면 파라미터 · 해시는 남긴다). `path`를 주면 경로를 그것으로 바꾼다
 * (빠른 로그인의 첫 화면 — 쿼리 없는 경로).
 */
export function demoCleanUrl(
  location: { pathname: string; search: string; hash: string },
  path: string | null = null,
): string {
  const params = new URLSearchParams(location.search);
  for (const name of PROCESSED_PARAMS) params.delete(name);
  const search = params.toString();
  return `${path ?? location.pathname}${search ? `?${search}` : ''}${location.hash}`;
}
