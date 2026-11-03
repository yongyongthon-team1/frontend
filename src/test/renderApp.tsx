import type { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { userEvent, type UserEvent } from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { App } from '@/app/App';
import { createQueryClient } from '@/app/providers';
import { routes } from '@/app/routes';
import { meQueryOptions } from '@/features/auth/queries';
import { handleUnauthorized, registerQueryClient, useSession } from '@/features/auth/session';
import type { DB } from '@/mocks/db/schema';
import { DEMO_TOUR_ID, type SeedCheckpoint } from '@/mocks/db/seed';
import { createSession, getDb, mutate, resetDb } from '@/mocks/db/store';
import { DEMO_EMAILS, type DemoRole } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';

// 화면 테스트 하네스. 실제 앱과 같은 라우트 · 프로바이더 · HTTP 클라이언트를 메모리 라우터로 그린다(API는 MSW 목업).

export interface RenderAppOptions {
  /** 이 계정으로 로그인한 상태로 시작한다. 시연 역할(`'student'` 등) 또는 이메일. */
  as?: DemoRole | (string & {});
  /** 목업 DB를 이 체크포인트까지 진행한 시드로 시작한다(기본 START). */
  checkpoint?: SeedCheckpoint;
}

export interface RenderAppResult {
  user: UserEvent;
  router: ReturnType<typeof createMemoryRouter>;
  queryClient: QueryClient;
}

function emailOf(as: string): string {
  return Object.hasOwn(DEMO_EMAILS, as) ? DEMO_EMAILS[as as keyof typeof DEMO_EMAILS] : as;
}

function userIdOf(db: DB, email: string): number {
  const user = db.users.find((u) => u.email === email);
  if (!user) throw new Error(`renderApp: 목업 DB에 ${email} 사용자가 없어요.`);
  return user.id;
}

/**
 * `path`에서 앱을 그린다. `as`를 주면 목업 세션을 만들어 토큰을 넣고, 내 정보(`['me']`) 쿼리가 성공한 뒤에 그린다 —
 * 가드의 로딩 단계를 기다리지 않게 하고, 공개 화면(`/login`, 404)처럼 `useMe`가 없는 주소에서도 멈추지 않는다.
 * `as`가 없으면 로그아웃 상태(토큰 null)다.
 */
export async function renderApp(
  path: string,
  opts: RenderAppOptions = {},
): Promise<RenderAppResult> {
  resetDb({ today: new Date(), checkpoint: opts.checkpoint });
  configureHttp({
    baseUrl: '/api',
    getToken: () => useSession.getState().token,
    onUnauthorized: handleUnauthorized,
  });
  const queryClient = createQueryClient();
  registerQueryClient(queryClient);

  if (opts.as === undefined) {
    useSession.setState({ token: null });
  } else {
    const email = emailOf(opts.as);
    const token = mutate((db) => createSession(db, userIdOf(db, email)));
    useSession.setState({ token });
    await queryClient.fetchQuery(meQueryOptions());
  }

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(<App router={router} queryClient={queryClient} />);
  return { user, router, queryClient };
}

/** 목업 DB에서 그 학생의 그 탐방 신청 id(여러 번 신청했으면 마지막). 테스트가 `router.navigate('/my-tours/' + id)`로 쓴다. */
export function findApplicationId(email: string, tourId: number): number {
  const db = getDb();
  const userId = userIdOf(db, email);
  const app = db.applications.findLast((a) => a.userId === userId && a.tourId === tourId);
  if (!app) throw new Error(`findApplicationId: ${email}의 탐방 ${tourId} 신청이 없어요.`);
  return app.id;
}

/** 김민지(시연 학생)의 탐방 1 신청에 발급된, 그 상점의 ISSUED 쿠폰 코드(체크포인트 CONFIRMED 이후). */
export function demoCouponCode(storeId: number): string {
  const applicationId = findApplicationId(DEMO_EMAILS.student, DEMO_TOUR_ID);
  const coupon = getDb().coupons.find(
    (c) => c.applicationId === applicationId && c.storeId === storeId && c.status === 'ISSUED',
  );
  if (!coupon) throw new Error(`demoCouponCode: 상점 ${storeId}의 ISSUED 쿠폰이 없어요.`);
  return coupon.code;
}
