import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createQueryClient } from './app/providers';
import { createAppRouter } from './app/router';
import { useBootStatus } from './demo/bootStatus';
import {
  applyDemoParamsBeforeRender,
  demoCleanUrl,
  parseDemoParams,
  runDemoParams,
} from './demo/demoParams';
import { readDemoOverride, useDemoStore } from './demo/demoStore';
import { connectDemoSession } from './demo/quickLogin';
import { handleUnauthorized, registerQueryClient, useSession } from './features/auth/session';
import { env, resolveApiMode } from './shared/config/env';
import { configureHttp } from './shared/lib/http';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import './styles/globals.css';

// 부트스트랩: 원클릭 시연 링크 설정 저장 → API 모드 결정(URL ?mode= > 시연 패널 저장값 > env) → 목업이면 워커를 켜고
// 기다림 → HTTP · 쿼리 → 링크의 초기화 · 빠른 로그인 → 주소 정리 → 라우터 → 렌더.
// 목업 워커는 첫 API 요청 전에 켜져 있어야 한다(새로고침 · 딥링크). 목업은 동적 import라 실서버 모드에서는 받지 않고,
// 목업을 뺀 빌드(`__MOCK_API__` false — 라이브 배포)에서는 이 분기가 통째로 지워져 목업 코드가 번들에 들어가지 않는다.
async function bootstrap() {
  const demoParams = parseDemoParams(window.location.search);
  applyDemoParamsBeforeRender(demoParams);

  const mode = resolveApiMode(
    env.apiMode,
    readDemoOverride(),
    window.location.search,
    env.realApi,
    env.mockApi,
  );
  useBootStatus.setState({ apiMode: mode });
  if (!__MOCK_API__) forgetMockWorker();
  if (__MOCK_API__ && mode === 'mock') {
    try {
      const mocks = await import('./mocks/browser');
      await mocks.startMockWorker(env.mockDomains);
      // 시연 패널의 AI 속도(보통 · 느리게)를 목업 AI 지연에 연결한다.
      mocks.setAiSpeedSource(() => useDemoStore.getState().aiSpeed);
    } catch (error) {
      // 워커를 못 켜도(서비스 워커 미지원 등) 빈 화면 대신 앱을 그려 오류 상태를 보여 준다. 시연 패널이 알린다.
      console.error('[mock] 목업 워커를 시작하지 못했어요.', error);
      useBootStatus.setState({ mockWorkerFailed: true });
    }
  }

  // 쿼리 클라이언트와 라우터는 한 번만 만든다(시연 도구가 같은 인스턴스로 빠른 로그인 · 이동을 한다).
  const queryClient = createQueryClient();
  registerQueryClient(queryClient);
  configureHttp({
    baseUrl: env.apiBaseUrl,
    getToken: () => useSession.getState().token,
    onUnauthorized: handleUnauthorized,
  });
  // 401 시연 계정 자동 재로그인 등록 + 토큰이 비면 빠른 로그인 기록도 비움(features가 demo를 모르게 여기서 잇는다).
  connectDemoSession();

  // 링크의 초기화(`reset`)와 빠른 로그인(`as`)은 첫 렌더 전에 끝낸다 — 로그인 화면이 깜빡이지 않고, 가드가 내 정보를
  // 다시 부르지 않는다. 실패하면 토스트만 남기고 그린다(Toaster가 마운트되면 보인다).
  const landing = await runDemoParams(demoParams, {
    queryClient,
    path: window.location.pathname,
  });
  // 처리한 파라미터는 주소에서 지운다(present는 남긴다). 라우터는 정리된 주소(빠른 로그인이면 그 첫 화면)에서 시작한다.
  const cleanUrl = demoCleanUrl(window.location, landing);
  const currentUrl = window.location.pathname + window.location.search + window.location.hash;
  if (cleanUrl !== currentUrl) window.history.replaceState(window.history.state, '', cleanUrl);
  const router = createAppRouter();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App router={router} queryClient={queryClient} />
    </StrictMode>,
  );
}

/**
 * 예전 목업 배포를 열었던 브라우저에 남은 MSW 서비스 워커를 지운다(목업을 뺀 빌드만). 워커 파일은 이제 배포에 없다.
 * 실패해도 앱에는 영향이 없다.
 */
function forgetMockWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        if (worker?.scriptURL.endsWith('/mockServiceWorker.js')) void registration.unregister();
      }
    })
    .catch(() => undefined);
}

void bootstrap();
