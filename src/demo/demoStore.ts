import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { env, type ApiMode } from '@/shared/config/env';

// 시연 설정. 시연 도구 켜기, API 모드 덮어쓰기, 발표 모드, 목업 AI 속도, 지도 도식 모드, 학생이 마지막으로 본 쿠폰,
// 실서버 초기화 키, 빠른 로그인한 시연 계정을 둔다. localStorage에 남아 새로고침 · 원클릭 링크 뒤에도 유지된다.
// 저장값은 지난 리허설의 것일 수 있으므로 쓰는 쪽이 정해진 값인지 확인한다(`readDemoOverride` · `validLastCoupon`).

export const DEMO_STORE_KEY = 'ytt.demo';

export type AiSpeed = 'normal' | 'slow';
export type MapMode = 'auto' | 'schematic';

export interface LastCoupon {
  code: string;
  storeId: number;
}

interface DemoState {
  /** `?demo=1` 등으로 켠 시연 도구(env `VITE_DEMO_TOOLS`와 별개로 켤 수 있다). */
  enabled: boolean;
  /** 시연 패널 · 원클릭 링크에서 고른 API 모드. 없으면 env 기본값. */
  apiModeOverride: ApiMode | null;
  /** 발표 모드: 시연 패널을 역할 버튼 막대로 줄이고 역할 배지를 보여 준다. */
  presentMode: boolean;
  /** 목업 AI 지연(보통 1.5초 · 느리게 10초). */
  aiSpeed: AiSpeed;
  /** 코스 지도: 자동(카카오맵, 안 되면 도식) · 도식 고정. */
  mapMode: MapMode;
  /** 학생이 마지막으로 본 쿠폰. 시연 도구가 사장님 쪽에서 같은 쿠폰을 바로 열 때 쓴다. */
  lastCoupon: LastCoupon | null;
  /** 실서버 시연 초기화 키(`?key=` → 헤더 `X-Demo-Key`). */
  resetKey: string | null;
  /** 빠른 로그인한 시연 계정. 세션이 끊기면(401) 이 계정으로 한 번 다시 로그인한다. */
  activeDemoEmail: string | null;
  /**
   * 빠른 로그인(또는 복구)이 세션에 넣은 토큰. 세션 토큰이 이 값과 다르면 가입 · 수동 로그인 등 시연 밖에서 바뀐 것이라
   * `activeDemoEmail`을 비운다(`connectDemoSession`). 이 값이 없는 옛 `ytt.demo` 저장본은 부팅 때 `activeDemoEmail`이
   * 지워진다 — 패널의 현재 계정 강조만 사라지고 다음 전환 때 다시 기록되므로 받아들인다.
   */
  activeDemoToken: string | null;
  setEnabled(enabled: boolean): void;
  setApiModeOverride(mode: ApiMode | null): void;
  setPresentMode(presentMode: boolean): void;
  setAiSpeed(aiSpeed: AiSpeed): void;
  setMapMode(mapMode: MapMode): void;
  setLastCoupon(coupon: LastCoupon | null): void;
  setResetKey(resetKey: string | null): void;
  setActiveDemoEmail(email: string | null): void;
  setActiveDemoToken(token: string | null): void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      enabled: false,
      apiModeOverride: null,
      presentMode: false,
      aiSpeed: 'normal',
      mapMode: 'auto',
      lastCoupon: null,
      resetKey: null,
      activeDemoEmail: null,
      activeDemoToken: null,
      setEnabled: (enabled) => set({ enabled }),
      setApiModeOverride: (apiModeOverride) => set({ apiModeOverride }),
      setPresentMode: (presentMode) => set({ presentMode }),
      setAiSpeed: (aiSpeed) => set({ aiSpeed }),
      setMapMode: (mapMode) => set({ mapMode }),
      setLastCoupon: (lastCoupon) => set({ lastCoupon }),
      setResetKey: (resetKey) => set({ resetKey }),
      setActiveDemoEmail: (activeDemoEmail) => set({ activeDemoEmail }),
      setActiveDemoToken: (activeDemoToken) => set({ activeDemoToken }),
    }),
    { name: DEMO_STORE_KEY },
  ),
);

/** 저장된 API 모드 덮어쓰기. 지난 리허설의 저장값이 모르는 값이면 무시한다. */
export function readDemoOverride(): ApiMode | null {
  const mode = useDemoStore.getState().apiModeOverride;
  return mode === 'mock' || mode === 'real' ? mode : null;
}

/**
 * 저장된 최근 쿠폰이 쓸 수 있는 값인지 확인한다(판정 27). 코드가 6자리 숫자이고 가게가 시연 가게일 때만 그 쿠폰,
 * 아니면 없는 것(null)으로 본다.
 */
export function validLastCoupon(value: unknown): LastCoupon | null {
  if (typeof value !== 'object' || value === null) return null;
  const { code, storeId } = value as Record<string, unknown>;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  if (typeof storeId !== 'number' || !Object.hasOwn(DEMO_STORE_OWNERS, storeId)) return null;
  return { code, storeId };
}

/** 시연 도구가 켜졌는지(구독하지 않음 — 이벤트 처리 · 부트스트랩용). */
export function isDemoToolsOn(): boolean {
  return env.demoTools || useDemoStore.getState().enabled;
}

/** 시연 도구가 켜졌는지(구독 훅 — 켜고 끄면 다시 그린다). */
export function useDemoToolsOn(): boolean {
  return useDemoStore((s) => s.enabled) || env.demoTools;
}
