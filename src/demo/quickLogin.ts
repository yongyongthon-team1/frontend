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
  /**
   * 새 계정의 첫 화면으로 이동. 화면이 떠 있으면 `flushSync`로 이동해야 한다 — 그래야 바로 앞에서 바꾼 신원과 새 주소가
   * 한 번의 렌더로 그려진다(판정 31). 첫 렌더 전(원클릭 링크)에는 갈 곳만 기록한다.
   */
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
 * 시연 계정 빠른 로그인(역할 전환 · 원클릭 링크 `?as=`). 판정 31: 로그인하는 동안은 지금 세션과 화면을 그대로 두고,
 * 성공하면 한 동기 구간에서 한 번에 바꾼다 — 쿼리 캐시 비움(Review Focus 4) → 새 토큰 → 내 정보(`['me']`, 가드가
 * 다시 부르지 않게) → 빠른 로그인 기록 → 이동. 이동이 flushSync로 그리므로 로그인 화면도, 새 신원으로 그린 이전 화면도
 * 나오지 않는다. 토큰은 null을 거치지 않는다(빠른 로그인 기록 구독이 지우지 않는다).
 * 실패하면 아무것도 바꾸지 않고 던진다 — 로그인 요청은 세션 토큰을 붙이지 않고 그 401은 세션 만료로 처리되지 않는다.
 */
export async function quickLogin(
  target: DemoRole | { email: string },
  deps: QuickLoginDeps,
): Promise<void> {
  const email = typeof target === 'string' ? DEMO_EMAILS[target] : target.email;
  const { token, me } = await login({ email, password: demoPassword() });
  deps.queryClient.clear();
  // 시연 토큰을 먼저 기록한다 — 토큰이 바뀔 때 도는 구독(`connectDemoSession`)이 시연 밖의 변경으로 오해하지 않게.
  useDemoStore.getState().setActiveDemoToken(token);
  useSession.getState().setToken(token);
  deps.queryClient.setQueryData(qk.me, me);
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
      if (useSession.getState().token === failedToken) {
        useDemoStore.getState().setActiveDemoToken(token); // setToken 앞 — 구독이 기록을 지우지 않게
        useSession.getState().setToken(token);
      }
      return true;
    },
    () => false,
  );
}

/**
 * 시연 계층을 세션에 연결한다(`main.tsx`가 한 번 부른다): 401 자동 재로그인을 등록하고, 세션 토큰이 비거나(로그아웃 ·
 * 초기화 · 복구 실패) 시연이 넣은 토큰(`activeDemoToken`)과 달라지면(가입 · 수동 로그인) 빠른 로그인 기록
 * (`activeDemoEmail` · `activeDemoToken`)도 비운다. 옛 저장본은 `activeDemoToken`이 없어 부팅 때 기록이 지워진다(받아들임). features가 demo를 import하지 않게 하는 연결점이다
 * (판정 29). 해제 함수를 돌려준다(테스트).
 */
export function connectDemoSession(): () => void {
  const forgetDemoAccount = (token: string | null) => {
    const demo = useDemoStore.getState();
    if (demo.activeDemoEmail !== null && (token === null || token !== demo.activeDemoToken)) {
      demo.setActiveDemoEmail(null);
      demo.setActiveDemoToken(null);
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
