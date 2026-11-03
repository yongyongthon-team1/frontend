import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';

// 카카오맵 JavaScript SDK 로더(결정 0004). 이 앱이 쓰는 유일한 외부 스크립트다. 키가 없거나, 제한 시간 안에 뜨지
// 않거나, 로드 뒤 `kakao.maps`가 없으면 실패이고 화면은 도식 지도로 넘어간다. 결과는 실패까지 모듈에 기억한다 —
// 스크립트는 한 번만 넣고, 같은 세션에서는 다시 시도하지 않는다(시연 중 지도가 떴다 안 떴다 하지 않게).

export const KAKAO_LOAD_TIMEOUT_MS = 4000;

const SDK_URL = '//dapi.kakao.com/v2/maps/sdk.js';

export type KakaoMapsStatus = 'loading' | 'ready' | 'fallback';

/** SDK가 `window.kakao`에 두는 것 중 로더가 쓰는 부분. 스크립트가 뜨기 전에는 없다. */
interface KakaoSdk {
  maps?: { load(callback: () => void): void };
}

let loading: Promise<void> | null = null;

export function loadKakaoMaps(
  appKey: string | null,
  timeoutMs: number = KAKAO_LOAD_TIMEOUT_MS,
): Promise<void> {
  if (!appKey) return Promise.reject(new Error('NO_KEY'));
  loading ??= insertSdkScript(appKey, timeoutMs);
  return loading;
}

function insertSdkScript(appKey: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 결과는 한 번만 정한다. 시간 초과 뒤에 스크립트가 늦게 떠도 이미 실패라 무시한다.
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setTimeout(() => settle(new Error('TIMEOUT')), timeoutMs);
    const script = document.createElement('script');
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
    script.async = true;
    script.onerror = () => settle(new Error('LOAD_ERROR'));
    script.onload = () => {
      // 이미 시간 초과면 kakao.maps.load를 부르지 않는다 — 쓰지 않을 지도 번들을 더 받지 않게.
      if (settled) return;
      const maps = (window as Window & { kakao?: KakaoSdk }).kakao?.maps;
      if (!maps) {
        settle(new Error('LOAD_ERROR'));
        return;
      }
      // autoload=false라 load 콜백이 온 뒤에야 지도 객체를 쓸 수 있다. 콜백이 오지 않으면 시간 초과로 끝난다.
      maps.load(() => settle());
    };
    document.head.append(script);
  });
}

/**
 * 지도 SDK 상태. 키가 없거나 도식 지도를 강제하면 첫 렌더부터 `'fallback'`이고 스크립트를 넣지 않는다.
 * 그 밖에는 `'loading'`으로 시작해 SDK가 뜨면 `'ready'`, 실패하면 `'fallback'`이 된다.
 */
export function useKakaoMaps(forceSchematic: boolean): KakaoMapsStatus {
  const appKey = env.kakaoMapKey;
  const skip = forceSchematic || appKey === null;
  const [status, setStatus] = useState<KakaoMapsStatus>('loading');

  useEffect(() => {
    if (skip) return;
    let active = true;
    void loadKakaoMaps(appKey).then(
      () => {
        if (active) setStatus('ready');
      },
      () => {
        if (active) setStatus('fallback');
      },
    );
    return () => {
      active = false;
    };
  }, [skip, appKey]);

  return skip ? 'fallback' : status;
}
