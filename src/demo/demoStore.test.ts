import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApiMode } from '@/shared/config/env';
import {
  DEMO_STORE_KEY,
  isDemoToolsOn,
  readDemoOverride,
  useDemoStore,
  useDemoToolsOn,
} from './demoStore';

// .env.test는 VITE_DEMO_TOOLS=false다. 시연 도구는 저장소의 enabled로만 켜진다.

afterEach(() => useDemoStore.setState({ enabled: false, apiModeOverride: null }));

describe('demoStore', () => {
  it('처음에는 꺼져 있고 모드 덮어쓰기가 없다', () => {
    expect(useDemoStore.getState()).toMatchObject({ enabled: false, apiModeOverride: null });
    expect(isDemoToolsOn()).toBe(false);
    expect(readDemoOverride()).toBeNull();
  });

  it('바꾼 값은 ytt.demo에 저장되고, 저장된 값으로 다시 읽는다', async () => {
    expect(DEMO_STORE_KEY).toBe('ytt.demo');
    act(() => useDemoStore.getState().setApiModeOverride('real'));
    expect(JSON.parse(localStorage.getItem(DEMO_STORE_KEY)!).state.apiModeOverride).toBe('real');

    useDemoStore.setState({ apiModeOverride: null });
    localStorage.setItem(
      DEMO_STORE_KEY,
      JSON.stringify({ state: { enabled: true, apiModeOverride: 'mock' }, version: 0 }),
    );
    await useDemoStore.persist.rehydrate();
    expect(readDemoOverride()).toBe('mock');
    expect(isDemoToolsOn()).toBe(true);
  });

  it('모르는 모드 값은 덮어쓰기로 쓰지 않는다', () => {
    useDemoStore.setState({ apiModeOverride: 'staging' as ApiMode });
    expect(readDemoOverride()).toBeNull();
  });

  it('useDemoToolsOn은 켜고 끌 때 다시 그린다', () => {
    const { result } = renderHook(() => useDemoToolsOn());
    expect(result.current).toBe(false);
    act(() => useDemoStore.getState().setEnabled(true));
    expect(result.current).toBe(true);
    act(() => useDemoStore.getState().setEnabled(false));
    expect(result.current).toBe(false);
  });
});
