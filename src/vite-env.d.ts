/// <reference types="vite/client" />

/**
 * 목업을 번들에 넣은 빌드인지(`vite.config.ts`의 `define`). false인 빌드(Vercel 프로덕션 · `VITE_MOCK_API=off`)는
 * 목업 코드 · MSW 워커가 빠지고 늘 실서버다.
 */
declare const __MOCK_API__: boolean;
