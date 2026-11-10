import { rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 목업을 번들에 넣을지(빌드 상수 `__MOCK_API__`). `VITE_MOCK_API`가 `on` · `true` · `1`이면 넣고 `off` · `false` · `0`이면
 * 뺀다. 값이 없으면 Vercel 프로덕션 빌드(`VERCEL_ENV=production`)만 빼고 로컬 · E2E · 미리보기는 넣는다 — 라이브 링크에는
 * 목업 모드가 들어가지 않게 한다(11/10).
 */
function mockApiInBuild(value: string | undefined, vercelEnv: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (['off', 'false', '0'].includes(v)) return false;
  if (['on', 'true', '1'].includes(v)) return true;
  return vercelEnv !== 'production';
}

/** 목업을 뺀 빌드는 public의 목업 전용 파일(MSW 워커 · 재학 인증 견본 사진)도 배포 폴더에서 지운다. */
function dropMockPublicFiles(): Plugin {
  return {
    name: 'drop-mock-public-files',
    apply: 'build',
    closeBundle() {
      for (const name of ['mockServiceWorker.js', 'mock-docs']) {
        rmSync(fileURLToPath(new URL(`./dist/${name}`, import.meta.url)), {
          recursive: true,
          force: true,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mockApi = mockApiInBuild(env.VITE_MOCK_API, env.VERCEL_ENV ?? process.env.VERCEL_ENV);

  return {
    plugins: [react(), tailwindcss(), ...(mockApi ? [] : [dropMockPublicFiles()])],
    define: { __MOCK_API__: JSON.stringify(mockApi) },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      // 결정 0006(라우트 코드 분할 금지)으로 앱 전체가 한 청크라 기본 한도(500kB)를 넘는다. 목업(msw · 약 330kB)은
      // 동적 import로 따로 나가므로, 이 한도를 넘으면 목업이 본 번들에 섞였는지부터 확인한다.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        onwarn(warning, warn) {
          // zod 4 소스의 설명 주석에 `@__PURE__` 글자가 들어 있어 Rollup이 주석 위치 경고를 낸다(동작 영향 없음).
          if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/node_modules/zod/')) {
            return;
          }
          warn(warning);
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.DEV_API_TARGET ?? 'http://localhost:8080',
          changeOrigin: true,
          // 11/7 백엔드 경로에는 접두사가 없다 — 프록시가 `/api`를 뗀다(2C-R1).
          rewrite: (path: string) => path.replace(/^\/api(?=\/|$)/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
