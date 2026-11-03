import { createBrowserRouter } from 'react-router';
import { routes } from './routes';

export type AppRouter = ReturnType<typeof createBrowserRouter>;

/** 앱 라우터. `main.tsx`가 한 번 만들어 `App`에 넘긴다(시연 도구가 같은 인스턴스로 이동한다). */
export function createAppRouter(): AppRouter {
  return createBrowserRouter(routes);
}
