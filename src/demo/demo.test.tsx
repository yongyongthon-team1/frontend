import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '@/features/auth/session';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { findApplicationId, renderApp } from '@/test/renderApp';
import { useBootStatus } from './bootStatus';
import { useDemoStore } from './demoStore';
import { connectDemoSession } from './quickLogin';

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
    activeDemoEmail: null,
  });
  useBootStatus.setState({ apiMode: 'mock', mockWorkerFailed: false });
});

afterEach(() => {
  server.events.removeAllListeners('request:start');
});

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
    await screen.findByText('신청 · 가이드 승인 대기');
    const keysBefore = queryClient.getQueryCache().getAll().length;
    expect(keysBefore).toBeGreaterThan(0);
    const clear = vi.spyOn(queryClient, 'clear');
    await user.click(screen.getByRole('button', { name: '가이드' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
    expect(clear).toHaveBeenCalled();
    expect(screen.queryByText('신청 · 가이드 승인 대기')).toBeNull();
    // 판정 G2: 이전 역할의 데이터가 캐시에 남지 않는다.
    expect(queryClient.getQueryData(qk.myApplications)).toBeUndefined();
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: DEMO_EMAILS.guide });
    expect(useDemoStore.getState().activeDemoEmail).toBe(DEMO_EMAILS.guide);
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
    // 그 쿠폰을 발급한 가게의 사장님이라 조회 결과가 "내 가게 쿠폰"이다.
    expect(await screen.findByText('쿠폰 확인 결과')).toBeInTheDocument();
    expect(screen.getByText('내 가게 쿠폰')).toBeInTheDocument();
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
    act(() => useDemoStore.setState({ enabled: true }));
    await user.selectOptions(screen.getByRole('combobox', { name: '체크포인트' }), '코스 확정');
    await user.click(screen.getByRole('button', { name: '시연 데이터 초기화' }));
    // 초기화는 세션도 비운다 — 발표자는 역할 버튼으로 다시 들어간다(지난 데이터의 주소를 next로 남기지 않는다).
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(useSession.getState().token).toBeNull();

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

  it('API 모드와 백엔드 상태를 보여 준다', async () => {
    useDemoStore.setState({ enabled: true });
    await renderApp('/', { as: 'student' });
    expect(screen.getByRole('button', { name: '목업' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '실서버' })).toHaveAttribute('aria-pressed', 'false');
    expect(await within(panel()).findByText('정상')).toBeInTheDocument();
  });

  it('헬스 체크가 실패하면 응답 없음', async () => {
    server.use(http.get('/api/health', () => HttpResponse.error()));
    useDemoStore.setState({ enabled: true });
    await renderApp('/', { as: 'student' });
    expect(await within(panel()).findByText('응답 없음')).toBeInTheDocument();
  });

  it('목업 워커를 못 켰으면 패널 맨 위에 알린다', async () => {
    useDemoStore.setState({ enabled: true });
    useBootStatus.setState({ mockWorkerFailed: true });
    await renderApp('/login');
    expect(within(panel()).getByRole('alert')).toHaveTextContent('목업 워커를 켜지 못했어요');
  });
});

describe('발표 모드', () => {
  it('역할 버튼 4개만 남은 세로 막대와 역할 배지', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    const { user, router } = await renderApp('/', { as: 'student' });
    expect(await screen.findByText('고교생 화면')).toBeInTheDocument();
    for (const name of ROLE_BUTTONS) {
      expect(within(panel()).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: '쿠폰 가게 사장님으로 전환' })).toBeNull();
    expect(screen.queryByRole('button', { name: '시연 데이터 초기화' })).toBeNull();

    await user.click(within(panel()).getByRole('button', { name: '사장님' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
    expect(await screen.findByText('사장님 화면')).toBeInTheDocument();
    expect(screen.queryByText('고교생 화면')).toBeNull();
  });

  it('역할 배지는 발표 모드에서만', async () => {
    useDemoStore.setState({ enabled: true });
    await renderApp('/guide/tours', { as: 'guide' });
    await screen.findByRole('link', { name: '운영' });
    expect(screen.queryByText('가이드 화면')).toBeNull();
  });

  it('로그아웃하면 역할 배지가 사라진다', async () => {
    useDemoStore.setState({ enabled: true, presentMode: true });
    const { user, router } = await renderApp('/me', { as: 'student' });
    expect(await screen.findByText('고교생 화면')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.queryByText('고교생 화면')).toBeNull();
  });
});

describe('시연 계정 자동 재로그인', () => {
  let disconnect: () => void = () => {};

  beforeEach(() => {
    disconnect = connectDemoSession();
  });
  afterEach(() => disconnect());

  function countLogins(): { count: number } {
    const counter = { count: 0 };
    server.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/api/auth/login')) counter.count += 1;
    });
    return counter;
  }

  /** 백엔드가 다시 켜져 세션을 잃은 상황: 목업 DB의 세션을 모두 지운다. */
  function dropServerSessions() {
    mutate((db) => {
      db.sessions = [];
    });
  }

  it('시연 계정의 요청이 401이면 한 번 다시 로그인하고, 같은 페이지 세션의 두 번째 401은 로그아웃', async () => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student' });
    act(() => useDemoStore.setState({ activeDemoEmail: STUDENT }));
    await screen.findByRole('heading', { name: '내 탐방 · 신청 상태' });
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
    expect(router.state.location.pathname).toBe('/my-tours');

    dropServerSessions();
    await act(() => queryClient.invalidateQueries({ queryKey: qk.me }));
    await waitFor(() => expect(useSession.getState().token).toBeNull());
    expect(logins.count).toBe(1);
    expect(useDemoStore.getState().activeDemoEmail).toBeNull();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('시연 계정이 아니면 다시 로그인하지 않고 바로 로그아웃', async () => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student' });
    await screen.findByRole('heading', { name: '내 탐방 · 신청 상태' });
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
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useDemoStore.getState().activeDemoEmail).toBeNull();
  });
});
