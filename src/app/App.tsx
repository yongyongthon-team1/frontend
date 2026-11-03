import type { QueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import { RouterProvider } from 'react-router';
import { AppProviders } from './providers';
import type { AppRouter } from './router';

// 이동 옵션 `flushSync`(로그아웃이 쓴다)를 위해 react-dom의 flushSync를 직접 넘긴다. `react-router/dom`의
// RouterProvider와 같은 일이지만, Vitest(Node 22)에서 그 진입점은 CJS가 `require('react-router')`로 ESM 빌드를
// 따로 불러 라우터 컨텍스트가 둘이 된다(훅이 "data router 밖" 오류). 그래서 코어 진입점 하나만 쓴다.
function flushRouterUpdate(fn: () => unknown): undefined {
  flushSync(fn);
  return undefined;
}

export function App({ router, queryClient }: { router: AppRouter; queryClient: QueryClient }) {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} flushSync={flushRouterUpdate} />
    </AppProviders>
  );
}
