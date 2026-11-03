import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  // 목업 AI 지연(1.5초)을 고려해 기본 expect 대기를 10초로 둔다.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 프로덕션 빌드를 `vite preview`로 띄워 검증한다. 개발자의 .env.local이 섞이지 않도록 VITE_*를 전부 명시한다.
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_API_BASE_URL: '/api',
      VITE_API_MODE: 'mock',
      VITE_MOCK_DOMAINS: 'all',
      VITE_DEMO_TOOLS: 'true',
      VITE_KAKAO_MAP_KEY: '',
      VITE_DEMO_PASSWORD: 'demo1234',
    },
  },
});
