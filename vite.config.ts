import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
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
