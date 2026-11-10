import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const LOCAL_URL = `http://localhost:${PORT}`;
// 실서버 스모크(`E2E_REAL=1`)는 실서버에 닿는 배포를 `E2E_BASE_URL`로 가리킨다 — 그때는 목업 빌드를 띄우지 않는다.
const BASE_URL = process.env.E2E_BASE_URL || LOCAL_URL;

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
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          VITE_API_BASE_URL: '/api',
          VITE_API_MODE: 'mock',
          VITE_MOCK_DOMAINS: 'all',
          VITE_DEMO_TOOLS: 'true',
          VITE_KAKAO_MAP_KEY: '',
        },
      },
});
