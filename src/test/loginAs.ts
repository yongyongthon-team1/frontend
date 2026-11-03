import { createSession, mutate } from '@/mocks/db/store';
import { configureHttp } from '@/shared/lib/http';

/**
 * API 테스트 하네스: 목업 DB에 이 계정의 세션을 만들고, HTTP 클라이언트가 그 토큰으로 부르게 한다.
 * 화면 테스트는 `renderApp`의 `as`를 쓴다.
 */
export function loginAs(email: string): void {
  const token = mutate((db) => {
    const user = db.users.find((u) => u.email === email);
    if (!user) throw new Error(`loginAs: 목업 DB에 ${email} 사용자가 없어요.`);
    return createSession(db, user.id);
  });
  configureHttp({ baseUrl: '/api', getToken: () => token, onUnauthorized: () => {} });
}
