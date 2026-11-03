import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { readDemoOverride } from './demo/demoStore';
import { env, resolveApiMode } from './shared/config/env';
import { configureHttp } from './shared/lib/http';
import './styles/globals.css';

// 부트스트랩: API 모드 결정(URL ?mode= > 시연 패널 저장값 > env) → 목업이면 워커를 켜고 기다림 → HTTP 설정 → 렌더.
// 목업 워커는 첫 API 요청 전에 켜져 있어야 한다(새로고침 · 딥링크). 동적 import는 실서버 모드 번들에서 목업을 뺀다.
async function bootstrap() {
  const mode = resolveApiMode(env.apiMode, readDemoOverride(), window.location.search);
  if (mode === 'mock') {
    try {
      await (await import('./mocks/browser')).startMockWorker(env.mockDomains);
    } catch (error) {
      // 워커를 못 켜도(서비스 워커 미지원 등) 빈 화면 대신 앱을 그려 오류 상태를 보여 준다.
      console.error('[mock] 목업 워커를 시작하지 못했어요.', error);
    }
  }
  configureHttp({ baseUrl: env.apiBaseUrl });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
