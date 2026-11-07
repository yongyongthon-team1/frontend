import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { configureHttp } from '@/shared/lib/http';
import { CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import { TOUR_DETAIL, TOURS_LIST } from '@/test/fixtures/backend/tours';
import { wireOk } from '@/test/wire';
import { useTour, useTours } from './queries';

// errata G13: 캠퍼스 요청과 탐방 요청은 서로 기다리지 않고 동시에 나간다(캠퍼스 캐시가 비는 로그인 · 역할 전환 뒤 첫 화면).

/** `/campuses`를 `release()`가 불릴 때까지 붙잡고, 탐방 요청이 그 사이에 왔는지 `toursSeen()`으로 알려 준다. */
function holdCampuses(tourPath: string) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const order: string[] = [];
  server.use(
    http.get('/api/campuses', async () => {
      order.push('campuses:start');
      await gate;
      order.push('campuses:end');
      return wireOk(CAMPUSES_LIST.data);
    }),
    http.get(tourPath, () => {
      order.push('tours:start');
      return wireOk(tourPath.endsWith('/tours') ? TOURS_LIST.data : TOUR_DETAIL.data);
    }),
  );
  return { order, release };
}

function wrapper() {
  configureHttp({ getToken: () => null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('탐방 훅은 캠퍼스와 병렬로 부른다', () => {
  it('useTour: 캠퍼스 응답이 오기 전에 탐방 상세 요청이 나간다', async () => {
    const { order, release } = holdCampuses('/api/tours/:tourId');
    const { result } = renderHook(() => useTour(31), { wrapper: wrapper() });
    await waitFor(() => expect(order).toContain('tours:start'));
    expect(order).toContain('campuses:start');
    expect(order).not.toContain('campuses:end');
    expect(result.current.data).toBeUndefined();
    release();
    await waitFor(() => expect(result.current.data?.id).toBe(31));
  });

  it('useTours: 캠퍼스 응답이 오기 전에 탐방 목록 요청이 나간다', async () => {
    const { order, release } = holdCampuses('/api/tours');
    const { result } = renderHook(() => useTours({ status: 'RECRUITING' }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(order).toContain('tours:start'));
    expect(order).toContain('campuses:start');
    expect(order).not.toContain('campuses:end');
    release();
    await waitFor(() => expect(result.current.data?.map((t) => t.id)).toEqual([31]));
  });
});
