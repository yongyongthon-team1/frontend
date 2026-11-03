import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
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
  server.resetHandlers();
  localStorage.clear();
  clearDbCache();
});
afterAll(() => server.close());
