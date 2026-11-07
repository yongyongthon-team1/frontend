import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { APPLY_OK, MY_TOURS_HIGH_SCHOOL } from '@/test/fixtures/backend/applications';
import { CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import { COURSE_VIEW } from '@/test/fixtures/backend/courses';
import {
  TOUR_CANCELED,
  TOUR_COMPLETED,
  TOUR_CREATED,
  TOUR_DETAIL,
} from '@/test/fixtures/backend/tours';
import { wireFail, wireOk, wirePage } from '@/test/wire';
import {
  useApplyToTour,
  useCancelTour,
  useCompleteTour,
  useCreateTour,
  useGuideTour,
  useMyApplications,
} from './queries';

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

describe('탐방 생애 훅', () => {
  const input = {
    date: '2027-01-15',
    startTime: '13:00',
    endTime: '16:00',
    capacity: 5,
    introduction: '소개',
    openChatUrl: 'https://open.kakao.com/o/x',
  };
  const baseHandlers = () => [
    http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
    http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
    http.get('/api/tours/:tourId/course', () => wireOk(COURSE_VIEW.data)),
  ];
  const spyInvalidations = (queryClient: QueryClient) => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    return () => spy.mock.calls.map(([filters]) => filters);
  };

  it('qk.guideTour는 guideTours와 따로 된 뿌리다', () => {
    expect(qk.guideTour(31)).toEqual(['guideTour', 31]);
    expect(qk.guideTour(31)[0]).not.toBe(qk.guideTours[0]);
  });

  it('useGuideTour: 탐방 상세와 코스 지점 수를 qk.guideTour 아래에 둔다', async () => {
    server.use(...baseHandlers());
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useGuideTour(31), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ tour: { id: 31 }, courseStopCount: 2 });
    expect(queryClient.getQueryState(qk.guideTour(31))?.status).toBe('success');
  });

  it('useCreateTour 성공: guideTours(exact)와 탐방 전체를 무효화하고 내 정보는 건드리지 않는다', async () => {
    server.use(
      ...baseHandlers(),
      http.post('/api/tours', () => wireOk(TOUR_CREATED.data, { status: 201 })),
    );
    const { queryClient, wrapper } = setup();
    const calls = spyInvalidations(queryClient);
    const { result } = renderHook(() => useCreateTour(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).resolves.toBe(31);
    });
    expect(calls()).toEqual([{ queryKey: qk.guideTours, exact: true }, { queryKey: qk.allTours }]);
  });

  it.each([
    ['E403_VERIFICATION_REQUIRED', 'NOT_VERIFIED'],
    ['E409_GUIDE_PROFILE_REQUIRED', 'GUIDE_PROFILE_REQUIRED'],
  ])('useCreateTour 실패 %s(%s)면 내 정보(qk.me)를 다시 받는다', async (backendCode, code) => {
    server.use(
      ...baseHandlers(),
      http.post('/api/tours', () => wireFail(backendCode)),
    );
    const { queryClient, wrapper } = setup();
    const calls = spyInvalidations(queryClient);
    const { result } = renderHook(() => useCreateTour(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ code });
    });
    expect(calls()).toEqual([{ queryKey: qk.me }]);
  });

  it('useCreateTour 검증 실패(400)는 아무것도 무효화하지 않는다', async () => {
    server.use(
      ...baseHandlers(),
      http.post('/api/tours', () => wireFail('E400')),
    );
    const { queryClient, wrapper } = setup();
    const calls = spyInvalidations(queryClient);
    const { result } = renderHook(() => useCreateTour(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toMatchObject({ status: 400 });
    });
    expect(calls()).toEqual([]);
  });

  it.each([
    ['useCompleteTour', useCompleteTour, '/api/tours/:tourId/complete', TOUR_COMPLETED],
    ['useCancelTour', useCancelTour, '/api/tours/:tourId/cancel', TOUR_CANCELED],
  ] as const)(
    '%s 성공: 이 탐방 · 가이드 탐방 · 신청자 · 탐방 전체를 무효화한다',
    async (_name, useHook, path, ok) => {
      server.use(
        ...baseHandlers(),
        http.post(path, () => wireOk(ok.data)),
      );
      const { queryClient, wrapper } = setup();
      const calls = spyInvalidations(queryClient);
      const { result } = renderHook(() => useHook(31), { wrapper });
      await act(async () => {
        await result.current.mutateAsync();
      });
      expect(calls()).toEqual(
        expect.arrayContaining([
          { queryKey: qk.guideTour(31) },
          { queryKey: qk.guideTours },
          { queryKey: qk.applicants(31) },
          { queryKey: qk.allTours },
        ]),
      );
      expect(calls()).toHaveLength(4);
    },
  );

  it.each([
    ['useCompleteTour', useCompleteTour, '/api/tours/:tourId/complete'],
    ['useCancelTour', useCancelTour, '/api/tours/:tourId/cancel'],
  ] as const)('%s 실패: 이 탐방(qk.guideTour)만 다시 받는다', async (_name, useHook, path) => {
    server.use(
      ...baseHandlers(),
      http.post(path, () => wireFail('E409_INVALID_TOUR_STATUS')),
    );
    const { queryClient, wrapper } = setup();
    const calls = spyInvalidations(queryClient);
    const { result } = renderHook(() => useHook(31), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({ status: 409 });
    });
    expect(calls()).toEqual([{ queryKey: qk.guideTour(31) }]);
  });
});
