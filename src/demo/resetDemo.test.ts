import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleUnauthorized, registerQueryClient, useSession } from '@/features/auth/session';
import { server } from '@/mocks/node';
import { configureHttp } from '@/shared/lib/http';
import { useDemoStore } from './demoStore';
import { resetDemoData } from './resetDemo';

beforeEach(() => {
  // setup.ts는 목업 DB와 localStorage만 비운다 — zustand의 메모리 상태는 직접 되돌린다.
  useDemoStore.setState({ resetKey: null, lastCoupon: null, activeDemoEmail: null });
  useSession.setState({ token: null });
  configureHttp({
    baseUrl: '/api',
    getToken: () => useSession.getState().token,
    onUnauthorized: handleUnauthorized,
  });
});

afterEach(() => {
  server.events.removeAllListeners('request:start');
});

function queryClient(): QueryClient {
  const client = new QueryClient();
  registerQueryClient(client);
  return client;
}

describe('시연 데이터 초기화 요청 (결정 0007)', () => {
  it('세션 토큰은 붙이지 않고 초기화 키만 헤더로 보낸다', async () => {
    useSession.setState({ token: 'expired-token' });
    useDemoStore.setState({ resetKey: 'secret' });
    const sent: Array<{ authorization: string | null; demoKey: string | null }> = [];
    server.events.on('request:start', ({ request }) => {
      if (!request.url.endsWith('/api/demo/reset')) return;
      sent.push({
        authorization: request.headers.get('Authorization'),
        demoKey: request.headers.get('X-Demo-Key'),
      });
    });

    await resetDemoData({ checkpoint: 'CONFIRMED' }, { queryClient: queryClient() });
    expect(sent).toEqual([{ authorization: null, demoKey: 'secret' }]);
  });

  it('초기화가 401이어도 세션 만료로 처리하지 않는다(지금 세션이 남는다)', async () => {
    useSession.setState({ token: 'live-token' });
    server.use(
      http.post('/api/demo/reset', () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'x' }, { status: 401 }),
      ),
    );
    await expect(resetDemoData({}, { queryClient: queryClient() })).rejects.toMatchObject({
      status: 401,
    });
    expect(useSession.getState().token).toBe('live-token');
  });

  it('성공하면 세션 · 빠른 로그인 기록 · 최근 쿠폰 · 쿼리 캐시를 비운다', async () => {
    useSession.setState({ token: 'live-token' });
    useDemoStore.setState({
      activeDemoEmail: 'student@demo.kr',
      lastCoupon: { code: '123456', storeId: 1 },
    });
    const client = queryClient();
    client.setQueryData(['me'], { id: 1 });

    await resetDemoData({}, { queryClient: client });
    expect(useSession.getState().token).toBeNull();
    expect(useDemoStore.getState()).toMatchObject({ activeDemoEmail: null, lastCoupon: null });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('실패하면 아무것도 비우지 않는다', async () => {
    useSession.setState({ token: 'live-token' });
    useDemoStore.setState({ lastCoupon: { code: '123456', storeId: 1 } });
    server.use(
      http.post('/api/demo/reset', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    await expect(resetDemoData({}, { queryClient: queryClient() })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(useSession.getState().token).toBe('live-token');
    expect(useDemoStore.getState().lastCoupon).toEqual({ code: '123456', storeId: 1 });
  });
});
