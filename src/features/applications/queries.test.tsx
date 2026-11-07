import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { configureHttp } from '@/shared/lib/http';
import { APPLY_OK, MY_TOURS_HIGH_SCHOOL } from '@/test/fixtures/backend/applications';
import { CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import { TOUR_DETAIL } from '@/test/fixtures/backend/tours';
import { wireFail, wireOk, wirePage } from '@/test/wire';
import { useApplyToTour, useMyApplications } from './queries';

function setup() {
  configureHttp({ getToken: () => null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('신청 훅', () => {
  it('useApplyToTour: 신청은 됐는데 내 신청을 다시 읽다 실패해도 내 신청 목록을 다시 받는다', async () => {
    let listGets = 0;
    server.use(
      http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
      http.get('/api/users/me/coupons', () => wirePage([])),
      http.post('/api/tours/:tourId/applications', () => wireOk(APPLY_OK.data, { status: 201 })),
      http.get('/api/users/me/tours', () => {
        listGets += 1;
        // 1: 화면의 첫 조회, 2: 신청 뒤 다시 읽기(실패), 3: 무효화로 인한 다시 받기
        return listGets === 2 ? wireFail('E500') : wirePage(MY_TOURS_HIGH_SCHOOL.data.items);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({ list: useMyApplications(), apply: useApplyToTour(31) }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    await act(async () => {
      await expect(result.current.apply.mutateAsync('수업이 궁금해요')).rejects.toMatchObject({
        status: 500,
      });
    });
    await waitFor(() => expect(listGets).toBe(3));
    await waitFor(() => expect(result.current.list.fetchStatus).toBe('idle'));
    expect(result.current.list.data).toHaveLength(1);
  });
});
