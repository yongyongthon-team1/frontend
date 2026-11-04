import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { clearDbCache, resetDb } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';

beforeAll(() => {
  setMockLatency({ base: 0, ai: 0 });
  server.listen({ onUnhandledRequest: 'error' });
});
// 매 테스트는 오늘 기준 기본 시드(START)에서 시작한다.
beforeEach(() => {
  resetDb({ today: new Date() });
});
afterEach(() => {
  cleanup();
  // sonner는 아직 닫히지 않은 토스트를 모듈 상태에 들고 있다가 다음 테스트의 Toaster에 다시 띄운다 — 모두 닫는다.
  toast.dismiss();
  server.resetHandlers();
  localStorage.clear();
  clearDbCache();
});
afterAll(() => server.close());
