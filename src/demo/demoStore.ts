import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env, type ApiMode } from '@/shared/config/env';

// 시연 설정(최소판). 시연 도구 켜기와 API 모드 덮어쓰기만 둔다 — Task 17 · 21이 넓힌다.
// localStorage에 남아 새로고침 · 원클릭 링크 뒤에도 유지된다.

export const DEMO_STORE_KEY = 'ytt.demo';

interface DemoState {
  /** `?demo=1` 등으로 켠 시연 도구(env `VITE_DEMO_TOOLS`와 별개로 켤 수 있다). */
  enabled: boolean;
  /** 시연 패널에서 고른 API 모드. 없으면 env 기본값. */
  apiModeOverride: ApiMode | null;
  setEnabled(enabled: boolean): void;
  setApiModeOverride(mode: ApiMode | null): void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      enabled: false,
      apiModeOverride: null,
      setEnabled: (enabled) => set({ enabled }),
      setApiModeOverride: (apiModeOverride) => set({ apiModeOverride }),
    }),
    { name: DEMO_STORE_KEY },
  ),
);

/** 저장된 API 모드 덮어쓰기. 지난 리허설의 저장값이 모르는 값이면 무시한다. */
export function readDemoOverride(): ApiMode | null {
  const mode = useDemoStore.getState().apiModeOverride;
  return mode === 'mock' || mode === 'real' ? mode : null;
}

/** 시연 도구가 켜졌는지(구독하지 않음 — 이벤트 처리 · 부트스트랩용). */
export function isDemoToolsOn(): boolean {
  return env.demoTools || useDemoStore.getState().enabled;
}

/** 시연 도구가 켜졌는지(구독 훅 — 켜고 끄면 다시 그린다). */
export function useDemoToolsOn(): boolean {
  return useDemoStore((s) => s.enabled) || env.demoTools;
}
