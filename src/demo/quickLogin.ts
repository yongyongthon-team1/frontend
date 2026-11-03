import type { QueryClient } from '@tanstack/react-query';
import { login } from '@/features/auth/api';
import { getLandingPath } from '@/features/auth/landing';
import { setUnauthorizedRecovery, useSession } from '@/features/auth/session';
import { qk } from '@/shared/api/queryKeys';
import {
  DEMO_EMAILS,
  DEMO_SEED_PASSWORD,
  DEMO_STORE_OWNERS,
  type DemoRole,
} from '@/shared/config/demoAccounts';
import { env } from '@/shared/config/env';
import { useBootStatus } from './bootStatus';
import { useDemoStore, validLastCoupon } from './demoStore';

export interface QuickLoginDeps {
  queryClient: QueryClient;
  navigate(to: string): void;
  /** 로그인 뒤 갈 곳. 없으면 그 계정의 첫 화면(`getLandingPath`). */
  next?: string;
}

/**
 * 시연 계정 비밀번호(판정 10). 로그인 요청을 목업이 받으면 시드 비밀번호, 실서버가 받으면 env `VITE_DEMO_PASSWORD`
 * (실서버 시연 계정의 비밀번호가 달라도 목업 빠른 로그인이 깨지지 않게).
 */
function demoPassword(): string {
  const { apiMode, mockWorkerFailed } = useBootStatus.getState();
  const authMocked =
    apiMode === 'mock' &&
    !mockWorkerFailed &&
    (env.mockDomains === 'all' || env.mockDomains.includes('auth'));
  return authMocked ? DEMO_SEED_PASSWORD : env.demoPassword;
}

/**
 * 시연 계정 빠른 로그인(역할 전환 · 원클릭 링크 `?as=`). 이전 역할의 데이터가 한 프레임도 보이지 않게 쿼리 캐시부터
 * 비우고(Review Focus 4), 토큰을 비운 뒤 로그인한다 — 로그인 실패 401이 자동 재로그인 · 로그아웃을 부르지 않는다(G6).
 * 받은 내 정보는 `['me']`에 넣어 가드가 다시 불러오지 않게 한다. 실패하면 로그아웃 상태로 남기고 던진다.
 */
export async function quickLogin(
  target: DemoRole | { email: string },
  deps: QuickLoginDeps,
): Promise<void> {
  const email = typeof target === 'string' ? DEMO_EMAILS[target] : target.email;
  deps.queryClient.clear();
  useSession.getState().setToken(null);
  const { token, me } = await login({ email, password: demoPassword() });
  deps.queryClient.setQueryData(qk.me, me);
  useSession.getState().setToken(token);
  useDemoStore.getState().setActiveDemoEmail(email);
  deps.navigate(deps.next ?? getLandingPath(me));
}

/**
 * 학생이 마지막으로 본 쿠폰(`lastCoupon`)을 발급한 가게의 사장님으로 전환하고, 쿠폰 사용 처리 화면에 그 코드를 채운다.
 * 저장된 쿠폰이 쓸 수 없는 값이면 던진다(패널은 그때 버튼을 비활성으로 둔다).
 */
export async function switchToCouponOwner(deps: Omit<QuickLoginDeps, 'next'>): Promise<void> {
  const coupon = validLastCoupon(useDemoStore.getState().lastCoupon);
  if (coupon === null) throw new Error('최근 쿠폰이 없어요.');
  await quickLogin(
    { email: DEMO_STORE_OWNERS[coupon.storeId] },
    { ...deps, next: `/owner/coupons/redeem?code=${coupon.code}` },
  );
}

/**
 * 세션이 끊긴(401) 시연 계정으로 조용히 다시 로그인한다(설계 5.4). 빠른 로그인한 계정이 아니면 시도하지 않는다(null).
 * 그사이 다른 로그인(역할 전환)으로 토큰이 바뀌었으면 그 토큰을 덮어쓰지 않는다.
 */
function recoverDemoSession(): Promise<boolean> | null {
  const email = useDemoStore.getState().activeDemoEmail;
  if (email === null) return null;
  const failedToken = useSession.getState().token;
  return login({ email, password: demoPassword() }).then(
    ({ token }) => {
      if (useSession.getState().token === failedToken) useSession.getState().setToken(token);
      return true;
    },
    () => false,
  );
}

/**
 * 시연 계층을 세션에 연결한다(`main.tsx`가 한 번 부른다): 401 자동 재로그인을 등록하고, 세션 토큰이 비면(로그아웃 ·
 * 초기화 · 복구 실패) 빠른 로그인 기록(`activeDemoEmail`)도 비운다. features가 demo를 import하지 않게 하는 연결점이다
 * (판정 29). 해제 함수를 돌려준다(테스트).
 */
export function connectDemoSession(): () => void {
  const forgetDemoAccount = (token: string | null) => {
    if (token === null && useDemoStore.getState().activeDemoEmail !== null) {
      useDemoStore.getState().setActiveDemoEmail(null);
    }
  };
  forgetDemoAccount(useSession.getState().token);
  const unsubscribe = useSession.subscribe((state) => forgetDemoAccount(state.token));
  setUnauthorizedRecovery(recoverDemoSession);
  return () => {
    unsubscribe();
    setUnauthorizedRecovery(null);
  };
}
