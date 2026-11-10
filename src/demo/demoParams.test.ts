import { QueryClient } from '@tanstack/react-query';
import { http } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUnauthorized, registerQueryClient, useSession } from '@/features/auth/session';
import { getDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { wireFail } from '@/test/wire';
import {
  applyDemoParamsBeforeRender,
  demoCleanUrl,
  parseDemoParams,
  runDemoParams,
} from './demoParams';
import { useBootStatus } from './bootStatus';
import { useDemoStore } from './demoStore';

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
  useSession.setState({ token: null });
});

describe('원클릭 시연 링크 파싱', () => {
  it('원클릭 링크 파싱', () =>
    expect(
      parseDemoParams('?demo=1&mode=real&reset=1&as=guide&present=1&key=k&checkpoint=CONFIRMED'),
    ).toEqual({
      demo: true,
      mode: 'real',
      reset: true,
      as: 'guide',
      present: true,
      key: 'k',
      checkpoint: 'CONFIRMED',
    }));

  it('알 수 없는 값은 무시', () => expect(parseDemoParams('?as=boss&mode=x').as).toBeNull());

  it('파라미터가 없으면 아무것도 바꾸지 않는 값', () =>
    expect(parseDemoParams('')).toEqual({
      demo: false,
      mode: null,
      reset: false,
      as: null,
      present: null,
      key: null,
      checkpoint: null,
    }));

  it('present=0은 발표 모드 끄기, 모르는 모드 · 체크포인트 · 빈 키는 없는 것으로', () =>
    expect(parseDemoParams('?present=0&mode=staging&checkpoint=DONE&key=')).toMatchObject({
      present: false,
      mode: null,
      checkpoint: null,
      key: null,
    }));
});

describe('렌더 전 적용', () => {
  it('demo → 시연 도구 켬, mode → API 모드 덮어쓰기, present → 발표 모드, key → 초기화 키', () => {
    applyDemoParamsBeforeRender(parseDemoParams('?demo=1&mode=real&present=1&key=secret'));
    expect(useDemoStore.getState()).toMatchObject({
      enabled: true,
      apiModeOverride: 'real',
      presentMode: true,
      resetKey: 'secret',
    });
  });

  it('없는 파라미터는 저장값을 건드리지 않는다', () => {
    useDemoStore.setState({
      enabled: true,
      apiModeOverride: 'mock',
      presentMode: true,
      aiSpeed: 'slow',
      mapMode: 'schematic',
    });
    applyDemoParamsBeforeRender(parseDemoParams('?as=student'));
    expect(useDemoStore.getState()).toMatchObject({
      enabled: true,
      apiModeOverride: 'mock',
      presentMode: true,
      aiSpeed: 'slow',
      mapMode: 'schematic',
    });
  });

  it('mode는 시연 패널이 보일 때만 저장한다(패널 없는 방문자가 실서버 모드에 갇히지 않게, 판정 33)', () => {
    applyDemoParamsBeforeRender(parseDemoParams('?mode=real'));
    expect(useDemoStore.getState().apiModeOverride).toBeNull();
    applyDemoParamsBeforeRender(parseDemoParams('?demo=1&mode=real'));
    expect(useDemoStore.getState().apiModeOverride).toBe('real');
  });

  // 11/9: 시연 도구가 켜진 배포에서 `?mode=real`이 첫 부팅에만 쓰이고 주소에서 지워져, 새로고침 · 오류 화면의
  // "다시 시도" 뒤 말없이 목업으로 돌아갔다. 패널이 보이는 곳이면 저장한다 — 패널에서 언제든 되돌릴 수 있다.
  it('시연 도구가 켜진 빌드(VITE_DEMO_TOOLS)나 이미 켠 시연 도구에서는 mode만으로도 저장한다', () => {
    applyDemoParamsBeforeRender(parseDemoParams('?mode=real'), true);
    expect(useDemoStore.getState().apiModeOverride).toBe('real');

    useDemoStore.setState({ apiModeOverride: null, enabled: true });
    applyDemoParamsBeforeRender(parseDemoParams('?mode=real'));
    expect(useDemoStore.getState().apiModeOverride).toBe('real');
    applyDemoParamsBeforeRender(parseDemoParams('?mode=mock'));
    expect(useDemoStore.getState().apiModeOverride).toBe('mock');
  });

  it('reset=1은 지난 리허설의 AI 속도 · 지도 모드도 기본값(보통 · 자동)으로 되돌린다 (판정 33)', () => {
    useDemoStore.setState({ aiSpeed: 'slow', mapMode: 'schematic' });
    applyDemoParamsBeforeRender(parseDemoParams('?demo=1&reset=1&as=student&present=1'));
    expect(useDemoStore.getState()).toMatchObject({ aiSpeed: 'normal', mapMode: 'auto' });
  });
});

describe('처리한 파라미터 지우기', () => {
  const at = (pathname: string, search: string, hash = '') => ({ pathname, search, hash });

  it('처리한 시연 파라미터는 지우고 present와 화면 파라미터는 남긴다', () => {
    expect(
      demoCleanUrl(
        at('/', '?demo=1&mode=mock&reset=1&as=student&present=1&key=k&checkpoint=START'),
      ),
    ).toBe('/?present=1');
    expect(demoCleanUrl(at('/owner/coupons/redeem', '?code=123456&demo=1', '#top'))).toBe(
      '/owner/coupons/redeem?code=123456#top',
    );
  });

  it('빠른 로그인의 첫 화면으로 경로를 바꾼다', () =>
    expect(demoCleanUrl(at('/', '?demo=1&as=guide&present=1'), '/guide/tours')).toBe(
      '/guide/tours?present=1',
    ));
});

describe('첫 렌더 전 실행(초기화 · 빠른 로그인)', () => {
  function setupClient(): QueryClient {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerQueryClient(queryClient);
    configureHttp({
      baseUrl: '/api',
      getToken: () => useSession.getState().token,
      onUnauthorized: handleUnauthorized,
    });
    return queryClient;
  }

  it('체크포인트로 초기화한 뒤 그 역할로 로그인하고 내 정보를 캐시에 넣는다', async () => {
    const queryClient = setupClient();
    const landing = await runDemoParams(
      parseDemoParams('?demo=1&reset=1&checkpoint=CONFIRMED&as=student'),
      { queryClient, path: '/' },
    );
    expect(landing).toBe('/');
    expect(useSession.getState().token).not.toBeNull();
    expect(useDemoStore.getState().activeDemoEmail).toBe('student@demo.kr');
    expect(useDemoStore.getState().activeDemoToken).toBe(useSession.getState().token);
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: 'student@demo.kr' });
    expect(getDb().coupons.length).toBeGreaterThan(0);
  });

  it('깊은 주소로 연 링크는 그 주소에 머문다', async () => {
    const queryClient = setupClient();
    const landing = await runDemoParams(parseDemoParams('?as=guide'), {
      queryClient,
      path: '/guide/tours/1/applicants',
    });
    expect(landing).toBe('/guide/tours/1/applicants');
  });

  it('as가 없으면 초기화만 하고 로그아웃 상태로 둔다', async () => {
    const queryClient = setupClient();
    useSession.setState({ token: 'old' });
    const landing = await runDemoParams(parseDemoParams('?reset=1'), { queryClient, path: '/' });
    expect(landing).toBeNull();
    expect(useSession.getState().token).toBeNull();
  });

  it('reset=1은 지난 데이터의 최근 쿠폰도 지운다 (판정 32)', async () => {
    const queryClient = setupClient();
    useDemoStore.setState({ lastCoupon: { code: '123456', storeId: 2 } });
    await runDemoParams(parseDemoParams('?demo=1&reset=1&as=student'), { queryClient, path: '/' });
    expect(useDemoStore.getState().lastCoupon).toBeNull();
  });

  it('실서버면 as로 빠른 로그인하지 않고(로그인 요청 없음) 직접 로그인 안내만 남긴다 (11/10)', async () => {
    const queryClient = setupClient();
    useBootStatus.setState({ apiMode: 'real' });
    try {
      const landing = await runDemoParams(parseDemoParams('?demo=1&as=student'), {
        queryClient,
        path: '/',
      });
      expect(landing).toBeNull();
      expect(useSession.getState().token).toBeNull();
      expect(useDemoStore.getState().activeDemoEmail).toBeNull();
    } finally {
      useBootStatus.setState({ apiMode: 'mock' });
    }
  });

  it('reset=1이 404(실서버에 초기화 없음)면 사유를 보이고 패널 버튼을 잠근다 — 로그인은 이어 간다 (2C-R28)', async () => {
    const queryClient = setupClient();
    const error = vi.spyOn(toast, 'error');
    server.use(http.post('/api/demo/reset', () => wireFail('E404')));
    const landing = await runDemoParams(parseDemoParams('?demo=1&reset=1&as=student'), {
      queryClient,
      path: '/',
    });
    expect(error).toHaveBeenCalledWith('시연 데이터를 초기화하지 못했어요.', {
      description: '실서버에는 시연 초기화가 없어요.',
    });
    expect(useDemoStore.getState().resetMissing).toBe(true);
    expect(landing).not.toBeNull();
    error.mockRestore();
  });
});
