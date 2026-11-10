import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refetchMe, useLogin, useSignup } from '@/features/auth/queries';
import { useSession } from '@/features/auth/session';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { env } from '@/shared/config/env';
import { errorMessage } from '@/shared/lib/errors';
import { DEMO_EMAILS, DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { findApplicationId, renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';
import { useBootStatus } from './bootStatus';
import { useDemoStore } from './demoStore';
import { connectDemoSession, quickLogin } from './quickLogin';

const STUDENT = DEMO_EMAILS.student;
const ROLE_BUTTONS = ['고교생', '가이드', '사장님', '운영자'];

beforeEach(() => {
  // setup.ts는 목업 DB와 localStorage만 비운다 — zustand의 메모리 상태는 직접 되돌린다.
  useDemoStore.setState({
    enabled: false,
    apiModeOverride: null,
    presentMode: false,
    aiSpeed: 'normal',
    mapMode: 'auto',
    lastCoupon: null,
    resetKey: null,
    resetMissing: false,
    activeDemoEmail: null,
    activeDemoToken: null,
  });
  useBootStatus.setState({ apiMode: 'mock', mockWorkerFailed: false });
});

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** `/api/auth/login` 요청 수를 센다. */
function countLogins(): { count: number } {
  const counter = { count: 0 };
  server.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/api/auth/login')) counter.count += 1;
  });
  return counter;
}

function panel() {
  return screen.getByRole('region', { name: '시연 패널' });
}

describe('시연 패널', () => {
  it('시연 도구가 꺼져 있으면 패널이 없다', async () => {
    await renderApp('/', { as: 'student' });
    await screen.findByRole('link', { name: '탐색' });
    expect(screen.queryByRole('region', { name: '시연 패널' })).toBeNull();
  });

  it('역할 전환은 캐시를 비우고 새 역할 첫 화면으로 (Review Focus 4)', async () => {
    const { user, router, queryClient } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'APPLIED',
    });
    act(() => useDemoStore.setState({ enabled: true }));
    await screen.findByText('신청 접수 완료 · 가이드 승인 대기 중');
    const keysBefore = queryClient.getQueryCache().getAll().length;
    expect(keysBefore).toBeGreaterThan(0);
    const clear = vi.spyOn(queryClient, 'clear');
    await user.click(screen.getByRole('button', { name: '가이드' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
    expect(clear).toHaveBeenCalled();
    expect(screen.queryByText('신청 접수 완료 · 가이드 승인 대기 중')).toBeNull();
    // 판정 G2: 이전 역할의 데이터가 캐시에 남지 않는다.
    expect(queryClient.getQueryData(qk.myApplications)).toBeUndefined();
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: DEMO_EMAILS.guide });
    expect(useDemoStore.getState().activeDemoEmail).toBe(DEMO_EMAILS.guide);
  });

  describe('로그인 먼저, 교체는 한 번에 (판정 31)', () => {
    let disconnect: () => void = () => {};
    beforeEach(() => {
      disconnect = connectDemoSession(); // main.tsx처럼 401 복구 · 빠른 로그인 기록 구독을 건다
    });
    afterEach(() => disconnect());

    it('역할 전환은 로그인 화면을 거치지 않고, 주소가 바뀔 때 이미 새 신원이다', async () => {
      const { user, router, queryClient } = await renderApp('/my-tours', {
        as: 'student',
        checkpoint: 'APPLIED',
      });
      act(() => useDemoStore.setState({ enabled: true, activeDemoEmail: STUDENT }));
      await screen.findByText('신청 접수 완료 · 가이드 승인 대기 중');
      const studentToken = useSession.getState().token;
      const clear = vi.spyOn(queryClient, 'clear');

      // 전환 중 라우터가 지난 주소와 그때의 토큰, 세션 토큰 · 빠른 로그인 기록의 모든 값을 기록한다.
      const visits: Array<{ path: string; token: string | null }> = [];
      const stopRouter = router.subscribe((state) =>
        visits.push({ path: state.location.pathname, token: useSession.getState().token }),
      );
      const tokens: Array<string | null> = [];
      const stopTokens = useSession.subscribe((s) => tokens.push(s.token));
      const demoEmails: Array<string | null> = [];
      const stopEmails = useDemoStore.subscribe((s) => demoEmails.push(s.activeDemoEmail));

      await user.click(screen.getByRole('button', { name: '가이드' }));
      // 가이드 홈(G01)이 그려졌다: 제목과 맨 아래 링크.
      await screen.findByRole('heading', { level: 1, name: /이번 주, .+ 탐방을/ });
      expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toBeInTheDocument();
      stopRouter();
      stopTokens();
      stopEmails();

      expect(visits.map((v) => v.path)).toEqual(['/guide']); // /login을 거치지 않는다
      expect(visits[0]!.token).not.toBe(studentToken);
      expect(visits[0]!.token).not.toBeNull();
      expect(tokens).not.toContain(null);
      expect(demoEmails).not.toContain(null);
      expect(useDemoStore.getState().activeDemoEmail).toBe(DEMO_EMAILS.guide);
      expect(clear).toHaveBeenCalled();
      expect(queryClient.getQueryData(qk.myApplications)).toBeUndefined();
    });

    it('전환 로그인이 실패하면 지금 사용자 · 화면 · 토큰을 그대로 두고 토스트로 알린다', async () => {
      const { user, router, queryClient } = await renderApp('/my-tours', {
        as: 'student',
        checkpoint: 'APPLIED',
      });
      act(() => useDemoStore.setState({ enabled: true, activeDemoEmail: STUDENT }));
      await screen.findByText('신청 접수 완료 · 가이드 승인 대기 중');
      const token = useSession.getState().token;
      const clear = vi.spyOn(queryClient, 'clear');
      // 로그인 실패 401은 세션 만료가 아니다 — 지금 세션의 복구 · 로그아웃을 부르면 안 된다.
      server.use(http.post('/api/auth/login', () => wireFail('E401_INVALID_CREDENTIALS')));

      await user.click(screen.getByRole('button', { name: '가이드' }));
      expect(await screen.findByText('이메일 또는 비밀번호가 맞지 않아요.')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/my-tours');
      expect(useSession.getState().token).toBe(token);
      expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: STUDENT });
      expect(useDemoStore.getState().activeDemoEmail).toBe(STUDENT);
      expect(screen.getByText('신청 접수 완료 · 가이드 승인 대기 중')).toBeInTheDocument();
      expect(clear).not.toHaveBeenCalled();
    });

    it('전환 중에 다른 역할을 눌러도 무시한다(로그인 요청 1번)', async () => {
      const { user, router } = await renderApp('/my-tours', { as: 'student' });
      act(() => useDemoStore.setState({ enabled: true }));
      await screen.findByRole('heading', { name: '내 탐방' });
      setMockLatency({ base: 150, ai: 0 }); // 첫 전환의 로그인이 진행 중일 때 두 번째 클릭이 들어오게
      const logins = countLogins();

      await user.click(screen.getByRole('button', { name: '가이드' }));
      await user.click(screen.getByRole('button', { name: '사장님' }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
      expect(logins.count).toBe(1);
      // 늦춘 요청이 다음 테스트까지 남지 않게 새 화면(G01)의 데이터를 받을 때까지 기다린다(다음 테스트는 목업 DB · 세션을 새로 만든다).
      expect(
        await screen.findByRole('heading', { name: /이번 주, .+ 탐방을/ }),
      ).toBeInTheDocument();
    });
  });

  it('쿠폰 가게 사장님으로 전환하면 코드가 채워진다', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    act(() => useDemoStore.setState({ enabled: true }));
    expect(screen.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' })).toBeDisabled();
    expect(screen.getByText('학생 쿠폰 화면을 먼저 열어 주세요.')).toBeInTheDocument();

    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}/coupons`);
    const items = await screen.findAllByRole('link', { name: /할인/ });
    await user.click(items[0]!);
    const code = (await screen.findByTestId('coupon-code')).textContent!.replace(/\s/g, '');
    expect(within(panel()).getByText(`최근 쿠폰 ${code}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/coupons/redeem'));
    expect(await screen.findByLabelText('6자리 쿠폰 코드')).toHaveValue(code);
    // 그 쿠폰을 발급한 가게의 사장님이라 "다른 가게 쿠폰" 오류 없이 사용 가능한 쿠폰 카드가 보인다.
    expect(await screen.findByText('사용 가능')).toBeInTheDocument();
    expect(screen.getByText('렌토')).toBeInTheDocument();
    expect(screen.queryByText('만료되었거나 다른 가게 쿠폰')).toBeNull();
  });

  it.each([
    ['6자리 숫자가 아닌 코드', { code: 'abc', storeId: 1 }],
    ['시연 가게가 아닌 storeId', { code: '123456', storeId: 99 }],
  ])('저장된 최근 쿠폰이 이상하면(%s) 없는 것으로 본다', async (_, lastCoupon) => {
    useDemoStore.setState({ enabled: true, lastCoupon });
    await renderApp('/', { as: 'student' });
    expect(screen.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' })).toBeDisabled();
    expect(screen.getByText('학생 쿠폰 화면을 먼저 열어 주세요.')).toBeInTheDocument();
    expect(within(panel()).queryByText(/최근 쿠폰/)).toBeNull();
  });

  it('시연 데이터 초기화(체크포인트)', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });
    act(() =>
      useDemoStore.setState({
        enabled: true,
        lastCoupon: { code: '123456', storeId: 1 },
        aiSpeed: 'slow',
        mapMode: 'schematic',
      }),
    );
    await user.selectOptions(screen.getByRole('combobox', { name: '체크포인트' }), '코스 확정');
    await user.click(screen.getByRole('button', { name: '시연 데이터 초기화' }));
    // 초기화는 세션도 비운다 — 발표자는 역할 버튼으로 다시 들어간다(지난 데이터의 주소를 next로 남기지 않는다).
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(useSession.getState().token).toBeNull();
    // 지난 데이터의 최근 쿠폰은 지운다(판정 32). 패널 버튼은 데이터만 — 패널에 보이는 설정은 그대로다(판정 33).
    expect(within(panel()).queryByText(/최근 쿠폰/)).toBeNull();
    expect(useDemoStore.getState()).toMatchObject({
      lastCoupon: null,
      aiSpeed: 'slow',
      mapMode: 'schematic',
    });

    await user.click(screen.getByRole('button', { name: '고교생' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}/coupons`);
    expect(await screen.findAllByRole('link', { name: /할인/ })).toHaveLength(2);
  });

  it('지도 · AI 속도 · 발표 모드 토글은 시연 설정에 저장된다', async () => {
    useDemoStore.setState({ enabled: true });
    const { user } = await renderApp('/', { as: 'student' });
    await user.click(screen.getByRole('button', { name: '도식' }));
    await user.click(screen.getByRole('button', { name: '느리게' }));
    expect(useDemoStore.getState()).toMatchObject({ mapMode: 'schematic', aiSpeed: 'slow' });
    expect(screen.getByRole('button', { name: '도식' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '발표 모드' }));
    expect(useDemoStore.getState().presentMode).toBe(true);
  });

  it('API 모드를 보여 준다(백엔드 연결 배지는 11/10에 지웠다)', async () => {
    useDemoStore.setState({ enabled: true });
    await renderApp('/', { as: 'student' });
    expect(screen.getByRole('button', { name: '목업' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '실서버' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(panel()).queryByText('백엔드')).toBeNull();
  });

  // 11/9: 실서버 모드가 말없이 목업으로 돌아가 목업 데이터를 실서버 데이터로 착각했다 — 실서버일 때는 패널 맨 위와
  // 좁은 화면의 패널 버튼에 늘 보이게 한다.
  it('실서버 모드면 패널 맨 위와 패널 버튼에 실서버 연결을 보인다', async () => {
    useDemoStore.setState({ enabled: true });
    await renderApp('/', { as: 'student' });
    expect(within(panel()).queryByText('실서버에 연결돼 있어요')).toBeNull();
    const toggle = within(panel()).getByRole('button', { name: '시연 패널' });
    expect(toggle).not.toHaveTextContent('실서버');

    act(() => useBootStatus.setState({ apiMode: 'real' }));
    expect(within(panel()).getByText('실서버에 연결돼 있어요')).toBeInTheDocument();
    expect(toggle).toHaveTextContent('실서버');
  });

  it('백엔드가 없는 배포(VITE_REAL_API=off)에서는 실서버 버튼이 잠기고 사유가 보인다', async () => {
    const before = env.realApi;
    env.realApi = false;
    try {
      useDemoStore.setState({ enabled: true });
      await renderApp('/', { as: 'student' });
      const real = within(panel()).getByRole('button', { name: '실서버' });
      expect(real).toBeDisabled();
      expect(real).toHaveAccessibleDescription('이 배포에는 백엔드가 연결되지 않았어요.');
      expect(within(panel()).getByRole('button', { name: '목업' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } finally {
      env.realApi = before;
    }
  });

  // 11/10: 라이브 배포에 목업 모드가 보이면 안 된다 — 목업을 뺀 빌드는 모드 전환 · 목업 AI 속도 · 실서버 표시가 없다.
  it('목업을 뺀 빌드(라이브 배포)면 API 모드 · AI 속도 · 실서버 표시가 없다', async () => {
    const before = env.mockApi;
    env.mockApi = false;
    try {
      useBootStatus.setState({ apiMode: 'real' });
      useDemoStore.setState({ enabled: true });
      await renderApp('/', { as: 'student' });
      const p = within(panel());
      expect(p.queryByRole('button', { name: '목업' })).toBeNull();
      expect(p.queryByText('API 모드')).toBeNull();
      expect(p.queryByText('AI 속도')).toBeNull();
      expect(p.queryByText('실서버에 연결돼 있어요')).toBeNull();
      expect(p.getByRole('button', { name: '시연 패널' })).not.toHaveTextContent('실서버');
      expect(p.getByText('지도')).toBeInTheDocument();

      // 실서버뿐이라 빠른 로그인이 없고, 저장된 발표 모드 · AI 속도가 있어도 막대 · 설정 표시가 나오지 않는다.
      act(() => useDemoStore.setState({ presentMode: true, aiSpeed: 'slow' }));
      expect(p.queryByRole('list', { name: '시연 설정' })).toBeNull();
      expect(p.queryByText('AI 느리게')).toBeNull();
      expect(p.queryByText('목업')).toBeNull();
    } finally {
      env.mockApi = before;
    }
  });

  // 11/10: 실서버 계정은 비밀번호가 제각각이고 번들에 넣으면 노출된다 — 빠른 로그인은 목업(스텁)에서만.
  it('실서버 모드면 역할 전환 · 발표 모드 없이 직접 로그인 안내만 보이고, 역할 배지도 없다', async () => {
    useBootStatus.setState({ apiMode: 'real' });
    useDemoStore.setState({ enabled: true, presentMode: true });
    await renderApp('/', { as: 'student' });
    const p = within(panel());
    expect(
      p.getByText('실서버에서는 빠른 로그인을 쓰지 않아요. 로그인 화면에서 직접 로그인해 주세요.'),
    ).toBeInTheDocument();
    for (const name of ['고교생', '가이드', '사장님', '운영자', '이 계정으로 전환', '발표 모드']) {
      expect(p.queryByRole('button', { name })).toBeNull();
    }
    expect(p.queryByRole('button', { name: '쿠폰 가게 사장님으로 전환' })).toBeNull();
    expect(screen.queryByText('고교생 화면')).toBeNull();
  });

  it('목업이 로그인을 받지 않으면(목업 워커 실패) 빠른 로그인을 하지 않는다', async () => {
    useDemoStore.setState({ enabled: true });
    await renderApp('/', { as: 'student' });
    act(() => useBootStatus.setState({ mockWorkerFailed: true }));
    expect(within(panel()).queryByRole('button', { name: '가이드' })).toBeNull();
    await expect(
      quickLogin('guide', { queryClient: new QueryClient(), navigate: () => {} }),
    ).rejects.toThrow('실서버에서는 시연 계정 자동 로그인을 하지 않아요.');
  });

  it('초기화가 404면 버튼을 잠그고 사유를 보인다', async () => {
    const reason = '실서버에는 시연 초기화가 없어요.';
    let resetCalls = 0;
    server.use(
      http.post('/api/demo/reset', () => {
        resetCalls += 1;
        return wireFail('E404');
      }),
    );
    useDemoStore.setState({ enabled: true });
    const { user } = await renderApp('/', { as: 'student' });
    await user.click(screen.getByRole('button', { name: '시연 데이터 초기화' }));

    const title = await screen.findByText('시연 데이터를 초기화하지 못했어요.');
    expect(
      within(title.closest('[data-sonner-toast]') as HTMLElement).getByText(reason),
    ).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '시연 데이터 초기화' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
    // 실패한 초기화는 아무것도 비우지 않는다(세션 유지).
    expect(useSession.getState().token).not.toBeNull();
    expect(useDemoStore.getState().resetMissing).toBe(true);
    expect(resetCalls).toBe(1);
  });

  it('초기화를 연타해도 요청은 1번이다', async () => {
    useDemoStore.setState({ enabled: true });
    const { user, router } = await renderApp('/', { as: 'student' });
    setMockLatency({ base: 100, ai: 0 }); // 첫 초기화가 진행 중일 때 두 번째 클릭이 들어오게
    let resetCalls = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/api/demo/reset')) resetCalls += 1;
    });
    const button = screen.getByRole('button', { name: '시연 데이터 초기화' });
    await user.dblClick(button);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(resetCalls).toBe(1);
  });

  it('초기화 잠금은 패널을 접었다 펴도 세션 동안 유지된다', async () => {
    useDemoStore.setState({ enabled: true, resetMissing: true });
    const { user } = await renderApp('/', { as: 'student' });
    const toggle = screen.getByRole('button', { name: '시연 패널' });
    await user.click(toggle); // 연다
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle); // 접는다
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle); // 다시 편다
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const button = screen.getByRole('button', { name: '시연 데이터 초기화' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('실서버에는 시연 초기화가 없어요.');
  });

  it('초기화가 404 말고 다른 오류면 잠그지 않는다', async () => {
    server.use(http.post('/api/demo/reset', () => wireFail('E403')));
    useDemoStore.setState({ enabled: true });
    const { user } = await renderApp('/', { as: 'student' });
    await user.click(screen.getByRole('button', { name: '시연 데이터 초기화' }));
    const title = await screen.findByText('시연 데이터를 초기화하지 못했어요.');
    // 403은 `X-Demo-Key` 설정 오류일 수 있다 — 코드 표 문구를 보이고 잠그지 않는다.
    expect(
      within(title.closest('[data-sonner-toast]') as HTMLElement).getByText(
        errorMessage('FORBIDDEN'),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시연 데이터 초기화' })).toBeEnabled();
    expect(useDemoStore.getState().resetMissing).toBe(false);
  });

  it('목업 워커를 못 켰으면 패널 맨 위에 알린다', async () => {
    useDemoStore.setState({ enabled: true });
    useBootStatus.setState({ mockWorkerFailed: true });
    await renderApp('/login');
    expect(within(panel()).getByRole('alert')).toHaveTextContent('목업 워커를 켜지 못했어요');
  });
});

describe('발표 모드', () => {
  it('역할 버튼 4개만 남은 세로 막대와 역할 배지 — 최근 쿠폰이 없으면 사장님은 owner1', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    const { user, router, queryClient } = await renderApp('/', { as: 'student' });
    expect(await screen.findByText('고교생 화면')).toBeInTheDocument();
    for (const name of ROLE_BUTTONS) {
      expect(within(panel()).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: '쿠폰 가게 사장님으로 전환' })).toBeNull();
    expect(screen.queryByRole('button', { name: '시연 데이터 초기화' })).toBeNull();

    await user.click(within(panel()).getByRole('button', { name: '사장님' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: DEMO_EMAILS.owner });
    // 도착지 `/owner/store`가 자리 화면이 아니라 O01(내 가게)을 그린다.
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /학생들이 가게를\s*더 쉽게 찾고 있어요\./,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('사장님 화면')).toBeInTheDocument();
    expect(screen.queryByText('고교생 화면')).toBeNull();
  });

  it('학생이 본 쿠폰이 있으면 사장님은 그 쿠폰 가게의 사장님이 되어 코드를 채운다 (판정 32)', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    const { user, router, queryClient } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    // 무대 대본(둘째 지점을 아래로)처럼 상점 2의 쿠폰을 본다 — owner1(상점 1)로 들어가면 "다른 가게 쿠폰"이 된다.
    const coupon = getDb().coupons.find(
      (c) => c.applicationId === findApplicationId(STUDENT, 1) && c.storeId === 2,
    )!;
    await router.navigate(`/coupons/${coupon.id}`);
    await screen.findByTestId('coupon-code');

    await user.click(within(panel()).getByRole('button', { name: '사장님' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/coupons/redeem'));
    expect(router.state.location.search).toBe(`?code=${coupon.code}`);
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: DEMO_STORE_OWNERS[2] });
    expect(await screen.findByLabelText('6자리 쿠폰 코드')).toHaveValue(coupon.code);
    expect(await screen.findByText('사용 가능')).toBeInTheDocument();
    expect(screen.getByText('타임리스커피')).toBeInTheDocument();
    expect(screen.getByText('사장님 화면')).toBeInTheDocument();
  });

  it('막대에 API 모드를 늘 보이고, AI 느리게 · 지도 도식은 켜져 있을 때만 보인다 (판정 33)', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    await renderApp('/', { as: 'student' });
    expect(within(panel()).getByText('목업')).toBeInTheDocument();
    expect(within(panel()).queryByText('실서버')).toBeNull();
    expect(within(panel()).queryByText('AI 느리게')).toBeNull();
    expect(within(panel()).queryByText('지도 도식')).toBeNull();

    act(() => useDemoStore.setState({ aiSpeed: 'slow', mapMode: 'schematic' }));
    expect(within(panel()).getByText('AI 느리게')).toBeInTheDocument();
    expect(within(panel()).getByText('지도 도식')).toBeInTheDocument();

    // 발표 모드(역할 막대)는 빠른 로그인이 되는 목업에서만 있다(11/10) — 실서버면 전체 패널로 돌아간다.
    act(() => useBootStatus.setState({ apiMode: 'real' }));
    expect(within(panel()).queryByRole('list', { name: '시연 설정' })).toBeNull();
    expect(within(panel()).getByText('실서버에 연결돼 있어요')).toBeInTheDocument();
  });

  it('역할 배지는 발표 모드에서만', async () => {
    useDemoStore.setState({ enabled: true });
    await renderApp('/guide/tours', { as: 'guide' });
    await screen.findByRole('link', { name: '코스 편집' });
    expect(screen.queryByText('가이드 화면')).toBeNull();
  });

  it('공개 화면(/signup · /consent/…)에서는 발표 모드여도 역할 배지를 그리지 않는다', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    const { router } = await renderApp('/', { as: 'student' });
    expect(await screen.findByText('고교생 화면')).toBeInTheDocument();
    await act(() => router.navigate('/signup'));
    await waitFor(() => expect(screen.queryByText('고교생 화면')).toBeNull());
    await act(() => router.navigate('/consent/x'));
    expect(screen.queryByText('고교생 화면')).toBeNull();
    await act(() => router.navigate('/me'));
    expect(await screen.findByText('고교생 화면')).toBeInTheDocument();
  });

  it('로그아웃하면 역할 배지가 사라진다', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    const { user, router } = await renderApp('/me', { as: 'student' });
    expect(await screen.findByText('고교생 화면')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /^로그아웃/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.queryByText('고교생 화면')).toBeNull();
  });
});

describe('P1 계정 전환', () => {
  it('전체 패널에서 P1 계정을 골라 전환하면 그 계정의 첫 화면으로 간다', async () => {
    useDemoStore.setState({ enabled: true });
    const { user, router, queryClient } = await renderApp('/', { as: 'student' });
    await screen.findByRole('link', { name: '탐색' });
    await user.selectOptions(
      within(panel()).getByRole('combobox', { name: 'P1 계정' }),
      'guide-new@demo.kr',
    );
    await user.click(within(panel()).getByRole('button', { name: '이 계정으로 전환' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/verify'));
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: 'guide-new@demo.kr' });
    expect(useDemoStore.getState().activeDemoEmail).toBe('guide-new@demo.kr');
  });

  it('발표 모드 막대에는 P1 계정 선택이 없다', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    await renderApp('/', { as: 'student' });
    await screen.findByRole('link', { name: '탐색' });
    expect(within(panel()).queryByRole('combobox', { name: 'P1 계정' })).toBeNull();
    expect(within(panel()).queryByRole('button', { name: '이 계정으로 전환' })).toBeNull();
  });
});

describe('시연 계정 자동 재로그인', () => {
  let disconnect: () => void = () => {};

  beforeEach(() => {
    disconnect = connectDemoSession();
  });
  afterEach(() => disconnect());

  /** 백엔드가 다시 켜져 세션을 잃은 상황: 목업 DB의 세션을 모두 지운다. */
  function dropServerSessions() {
    mutate((db) => {
      db.sessions = [];
    });
  }

  it('시연 계정의 요청이 401이면 한 번 다시 로그인하고, 같은 페이지 세션의 두 번째 401은 로그아웃', async () => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student' });
    act(() => useDemoStore.setState({ activeDemoEmail: STUDENT }));
    await screen.findByRole('heading', { name: '내 탐방' });
    const logins = countLogins();

    dropServerSessions();
    await act(() => queryClient.invalidateQueries({ queryKey: qk.me }));
    // 로그인 요청은 401 복구로만 나간다 — 한 번 다시 로그인했고 내 정보를 다시 받았다.
    await waitFor(() => expect(logins.count).toBe(1));
    await waitFor(() => expect(queryClient.getQueryState(qk.me)?.status).toBe('success'));
    // 다시 로그인해 받은 토큰에 서버 세션이 있다(목업 토큰 이름은 같을 수 있어 값 비교 대신 세션을 본다).
    const token = useSession.getState().token;
    expect(getDb().sessions.some((s) => s.token === token)).toBe(true);
    expect(useDemoStore.getState().activeDemoEmail).toBe(STUDENT);
    expect(useDemoStore.getState().activeDemoToken).toBe(token); // 복구가 받은 토큰을 시연 토큰으로 기록한다
    expect(router.state.location.pathname).toBe('/my-tours');

    dropServerSessions();
    await act(() => queryClient.invalidateQueries({ queryKey: qk.me }));
    await waitFor(() => expect(useSession.getState().token).toBeNull());
    expect(logins.count).toBe(1);
    expect(useDemoStore.getState().activeDemoEmail).toBeNull();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('실서버면 시연 계정 기록이 남아 있어도 다시 로그인하지 않고 로그아웃 (11/10)', async () => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student' });
    act(() => useDemoStore.setState({ activeDemoEmail: STUDENT }));
    await screen.findByRole('heading', { name: '내 탐방' });
    act(() => useBootStatus.setState({ apiMode: 'real' }));
    const logins = countLogins();
    dropServerSessions();
    await act(() => queryClient.invalidateQueries({ queryKey: qk.me }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useSession.getState().token).toBeNull();
    expect(logins.count).toBe(0);
  });

  it('시연 계정이 아니면 다시 로그인하지 않고 바로 로그아웃', async () => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student' });
    await screen.findByRole('heading', { name: '내 탐방' });
    const logins = countLogins();
    dropServerSessions();
    await act(() => queryClient.invalidateQueries({ queryKey: qk.me }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useSession.getState().token).toBeNull();
    expect(logins.count).toBe(0);
  });

  it('토큰이 비면(로그아웃) 시연 계정 기록도 지운다', async () => {
    const { user, router } = await renderApp('/me', { as: 'student' });
    act(() => useDemoStore.setState({ activeDemoEmail: STUDENT }));
    await user.click(await screen.findByRole('button', { name: /^로그아웃/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useDemoStore.getState().activeDemoEmail).toBeNull();
  });

  describe('시연 밖에서 토큰이 바뀌면 시연 계정 기록을 비운다 (가입 · 수동 로그인)', () => {
    const noNavigate = { navigate: () => {} };

    /** 빠른 로그인으로 시연 계정에 들어간 상태. */
    async function enterAsDemoAccount(beforeLogin?: () => void) {
      const app = await renderApp('/login');
      beforeLogin?.();
      await quickLogin({ email: STUDENT }, { queryClient: app.queryClient, ...noNavigate });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={app.queryClient}>{children}</QueryClientProvider>
      );
      return { ...app, wrapper };
    }

    it('빠른 로그인은 새 토큰을 시연 토큰으로 기록하고, 구독이 기록을 지우지 않는다', async () => {
      const emails: Array<string | null> = [];
      let stop = () => {};
      // 다른 시연 계정에서 전환하는 중이었다 — 전환 도중 기록이 비는 순간이 없어야 한다.
      await enterAsDemoAccount(() => {
        useDemoStore.setState({ activeDemoEmail: DEMO_EMAILS.guide, activeDemoToken: 'old-token' });
        stop = useDemoStore.subscribe((s) => emails.push(s.activeDemoEmail));
      });
      stop();
      expect(useDemoStore.getState().activeDemoToken).toBe(useSession.getState().token);
      expect(useDemoStore.getState().activeDemoEmail).toBe(STUDENT);
      expect(emails).not.toContain(null);
    });

    it('시연 계정으로 들어간 뒤 가입하면 시연 계정 기록이 비워지고, 401에서 시연 계정으로 되돌려 로그인하지 않는다', async () => {
      const { queryClient, wrapper } = await enterAsDemoAccount();
      const { result } = renderHook(() => useSignup(), { wrapper });
      await act(() =>
        result.current.mutateAsync({
          email: 'fresh@demo.kr',
          password: 'demo1234',
          name: '한새봄',
          role: 'HIGH_SCHOOL',
        }),
      );
      expect(useDemoStore.getState()).toMatchObject({
        activeDemoEmail: null,
        activeDemoToken: null,
      });
      expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: 'fresh@demo.kr' });

      // 가입한 사람의 세션이 끊겨도 시연 계정(student@demo.kr)으로 몰래 다시 로그인하지 않는다.
      const logins = countLogins();
      mutate((db) => {
        db.sessions = [];
      });
      await act(() => refetchMe(queryClient).catch(() => undefined)); // 401
      await waitFor(() => expect(useSession.getState().token).toBeNull());
      expect(logins.count).toBe(0);
    });

    it('수동 로그인으로 다른 계정이 되어도 시연 계정 기록을 비운다', async () => {
      const { wrapper } = await enterAsDemoAccount();
      const { result } = renderHook(() => useLogin(), { wrapper });
      await act(() => result.current.mutateAsync({ email: 'guide@demo.kr', password: 'demo1234' }));
      expect(useDemoStore.getState()).toMatchObject({
        activeDemoEmail: null,
        activeDemoToken: null,
      });
    });

    it('옛 저장본(activeDemoToken 없음)은 부팅 때 시연 계정 기록이 지워진다 — 패널의 강조만 사라지고 다음 전환 때 다시 기록된다', async () => {
      disconnect();
      await renderApp('/me', { as: 'student' });
      useDemoStore.setState({ activeDemoEmail: STUDENT, activeDemoToken: null });
      disconnect = connectDemoSession(); // 부팅
      expect(useDemoStore.getState().activeDemoEmail).toBeNull();
    });
  });
});
