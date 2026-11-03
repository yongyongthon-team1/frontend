import { setupWorker } from 'msw/browser';
import type { MockDomain } from '@/shared/config/env';
import { selectHandlers } from './registry';

// main.tsx는 목업을 동적 import 한 번으로만 불러온다(실서버 번들에서 목업을 뺀다) — 시연 패널의 AI 속도 연결도 여기로 받는다.
export { setAiSpeedSource } from './latency';

/**
 * 브라우저 목업 워커를 켠다. `main.tsx`가 첫 API 요청 전에(렌더 전에) 기다린다. 고르지 않은 도메인의 요청은
 * 그대로 네트워크(`/api` 프록시 → 실서버)로 보낸다.
 */
export async function startMockWorker(domains: MockDomain[] | 'all'): Promise<void> {
  const worker = setupWorker(...selectHandlers(domains));
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  });
}
