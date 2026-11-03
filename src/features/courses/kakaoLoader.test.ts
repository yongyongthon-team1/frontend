import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadKakaoMaps, useKakaoMaps } from './kakaoLoader';

// loadKakaoMaps는 SDK 로딩 결과(실패 포함)를 모듈에 기억한다. 스크립트를 넣는 테스트는 그 기억이 다른 테스트로
// 새지 않게 모듈을 새로 불러온다. env 모듈도 새 인스턴스라 키를 바꿔도 다른 테스트에 영향이 없다.
async function freshLoader(kakaoMapKey: string | null = null) {
  vi.resetModules();
  (await import('@/shared/config/env')).env.kakaoMapKey = kakaoMapKey;
  return import('./kakaoLoader');
}

function sdkScripts() {
  return document.head.querySelectorAll<HTMLScriptElement>('script[src*="dapi.kakao.com"]');
}

/** jsdom은 외부 스크립트를 실제로 불러오지 않는다. SDK가 뜬 것처럼 `kakao.maps`를 두고 load를 보낸다. */
function fakeSdkLoaded() {
  vi.stubGlobal('kakao', { maps: { load: (callback: () => void) => callback() } });
  sdkScripts()[0].dispatchEvent(new Event('load'));
}

afterEach(() => {
  sdkScripts().forEach((script) => script.remove());
  vi.unstubAllGlobals();
});

describe('loadKakaoMaps', () => {
  it('키가 없으면 NO_KEY', async () => await expect(loadKakaoMaps(null)).rejects.toThrow('NO_KEY'));

  it('두 번 불러도 스크립트는 하나만 넣는다', async () => {
    const loader = await freshLoader();
    const first = loader.loadKakaoMaps('test-key', 20);
    const second = loader.loadKakaoMaps('test-key', 20);
    expect(second).toBe(first);
    expect(sdkScripts()).toHaveLength(1);
    expect(sdkScripts()[0].getAttribute('src')).toBe(
      '//dapi.kakao.com/v2/maps/sdk.js?appkey=test-key&autoload=false&libraries=services',
    );
    await expect(first).rejects.toThrow('TIMEOUT');
  });

  it('제한 시간 안에 로드되지 않으면 TIMEOUT', async () => {
    const loader = await freshLoader();
    await expect(loader.loadKakaoMaps('test-key', 10)).rejects.toThrow('TIMEOUT');
  });

  it('스크립트가 로드되고 kakao.maps.load 콜백이 오면 성공', async () => {
    const loader = await freshLoader();
    const loading = loader.loadKakaoMaps('test-key');
    fakeSdkLoaded();
    await expect(loading).resolves.toBeUndefined();
  });

  it('스크립트 로드 오류는 LOAD_ERROR', async () => {
    const loader = await freshLoader();
    const loading = loader.loadKakaoMaps('test-key');
    sdkScripts()[0].dispatchEvent(new Event('error'));
    await expect(loading).rejects.toThrow('LOAD_ERROR');
  });

  it('로드됐는데 kakao.maps가 없으면 LOAD_ERROR', async () => {
    const loader = await freshLoader();
    const loading = loader.loadKakaoMaps('test-key');
    sdkScripts()[0].dispatchEvent(new Event('load'));
    await expect(loading).rejects.toThrow('LOAD_ERROR');
  });

  it('실패도 기억해 같은 세션에서는 다시 시도하지 않는다', async () => {
    const loader = await freshLoader();
    const loading = loader.loadKakaoMaps('test-key');
    sdkScripts()[0].dispatchEvent(new Event('error'));
    await expect(loading).rejects.toThrow('LOAD_ERROR');
    await expect(loader.loadKakaoMaps('test-key')).rejects.toThrow('LOAD_ERROR');
    expect(sdkScripts()).toHaveLength(1);
  });
});

/** 훅이 그린 상태를 렌더마다 모은다(첫 렌더 값을 보려고). */
function renderStatuses(useStatus: () => string) {
  const statuses: string[] = [];
  const view = renderHook(() => {
    const status = useStatus();
    statuses.push(status);
    return status;
  });
  return { ...view, statuses };
}

describe('useKakaoMaps', () => {
  it('키가 없으면 첫 렌더부터 fallback이고 스크립트를 넣지 않는다', () => {
    const { statuses } = renderStatuses(() => useKakaoMaps(false));
    expect(statuses[0]).toBe('fallback');
    expect(new Set(statuses)).toEqual(new Set(['fallback']));
    expect(sdkScripts()).toHaveLength(0);
  });

  it('키가 있어도 도식 지도를 강제하면 첫 렌더부터 fallback', async () => {
    const loader = await freshLoader('test-key');
    const { statuses } = renderStatuses(() => loader.useKakaoMaps(true));
    expect(statuses[0]).toBe('fallback');
    expect(new Set(statuses)).toEqual(new Set(['fallback']));
    expect(sdkScripts()).toHaveLength(0);
  });

  it('키가 있으면 loading → SDK가 뜨면 ready', async () => {
    const loader = await freshLoader('test-key');
    const { result } = renderHook(() => loader.useKakaoMaps(false));
    expect(result.current).toBe('loading');
    await act(async () => fakeSdkLoaded());
    expect(result.current).toBe('ready');
  });

  it('키가 있어도 로딩에 실패하면 fallback', async () => {
    const loader = await freshLoader('test-key');
    const { result } = renderHook(() => loader.useKakaoMaps(false));
    expect(result.current).toBe('loading');
    await act(async () => {
      sdkScripts()[0].dispatchEvent(new Event('error'));
    });
    expect(result.current).toBe('fallback');
  });
});
