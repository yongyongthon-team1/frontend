import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { toCamel } from '@/shared/lib/caseKeys';
import { configureHttp } from '@/shared/lib/http';
import { CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import { COURSE_CONFIRM_OK, COURSE_SPOTS_OK } from '@/test/fixtures/backend/courses';
import { TOUR_31, TOUR_DETAIL } from '@/test/fixtures/backend/tours';
import { wireFail, wireOk } from '@/test/wire';
import { useConfirmCourse, useCreateDraft, useGuideCourse, useReorderStops } from './queries';
import { fromWireCourse, type WireCourse } from './wire';

// 명세 C-02 예시(탐방 31, 13:00 시작): 지점 1 = 상점 201(한줄평), 지점 2 = 캠퍼스 건물 3(한줄평).
const SPOTS_31 = fromWireCourse(toCamel<WireCourse>(COURSE_SPOTS_OK.data), TOUR_31);

function setup(prefill?: unknown) {
  configureHttp({ getToken: () => null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (prefill !== undefined) queryClient.setQueryData(qk.guideCourse(31), prefill);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** 캠퍼스 · 탐방 31 · 코스 조회 · 스팟 PUT을 명세 예시로 답하고, 코스 조회 수와 PUT 본문을 모은다. */
function serveTour31(course: () => Response = () => wireOk(COURSE_SPOTS_OK.data)) {
  const seen = { courseGets: 0, puts: [] as unknown[] };
  server.use(
    http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
    http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
    http.get('/api/tours/:tourId/course', () => {
      seen.courseGets += 1;
      return course();
    }),
    http.put('/api/tours/:tourId/course/spots', async ({ request }) => {
      seen.puts.push(await request.json());
      return wireOk(COURSE_SPOTS_OK.data);
    }),
  );
  return seen;
}

describe('코스 훅', () => {
  it('useGuideCourse: 캠퍼스 응답이 오기 전에 코스 · 탐방 요청이 나간다 (errata G13)', async () => {
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
      http.get('/api/tours/:tourId', () => {
        order.push('tour');
        return wireOk(TOUR_DETAIL.data);
      }),
      http.get('/api/tours/:tourId/course', () => {
        order.push('course');
        return wireOk(COURSE_SPOTS_OK.data);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useGuideCourse(31), { wrapper });
    await waitFor(() => expect(order).toEqual(expect.arrayContaining(['tour', 'course'])));
    expect(order).toContain('campuses:start');
    expect(order).not.toContain('campuses:end');
    release();
    await waitFor(() => expect(result.current.data?.stops).toHaveLength(2));
  });

  it('useReorderStops: 캐시의 가이드 코스로 전체 스팟을 만들어 PUT 한 번(코스를 다시 읽지 않는다)', async () => {
    const seen = serveTour31();
    const { queryClient, wrapper } = setup(SPOTS_31);
    const { result } = renderHook(() => useReorderStops(31), { wrapper });
    await act(() => result.current.mutateAsync([2, 1]));
    expect(seen.courseGets).toBe(0);
    expect(seen.puts).toEqual([
      {
        spots: [
          {
            stop_type: 'CAMPUS',
            campus_building_id: 3,
            start_time: '13:00',
            comment: '시험 기간엔 24시간 열려요',
          },
          {
            stop_type: 'STORE',
            store_id: 201,
            start_time: '14:10',
            comment: '학생들이 즐겨 가는 분식집이에요',
          },
        ],
      },
    ]);
    // 응답 코스를 가이드 코스 캐시에 넣는다.
    expect(queryClient.getQueryData(qk.guideCourse(31))).toEqual(SPOTS_31);
  });

  it('useReorderStops: 캐시에 코스가 없으면 먼저 읽어 온다', async () => {
    const seen = serveTour31();
    const { wrapper } = setup();
    const { result } = renderHook(() => useReorderStops(31), { wrapper });
    await act(() => result.current.mutateAsync([2, 1]));
    expect(seen.courseGets).toBe(1);
    expect(seen.puts).toHaveLength(1);
  });

  it('useReorderStops: 코스가 없으면(404) NOT_FOUND이고 PUT을 보내지 않는다', async () => {
    const seen = serveTour31(() => wireFail('E404'));
    const { wrapper } = setup(null);
    const { result } = renderHook(() => useReorderStops(31), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync([2, 1])).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });
    expect(seen.puts).toEqual([]);
  });

  it('useConfirmCourse: 확정은 됐는데 코스 다시 읽기가 실패하면 뮤테이션은 오류여도 가이드 코스를 다시 받는다', async () => {
    let courseGets = 0;
    server.use(
      http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
      http.get('/api/tours/:tourId/course', () => {
        courseGets += 1;
        // 1: 화면의 첫 조회, 2: 확정 뒤 다시 읽기(실패), 3: 무효화로 인한 다시 받기
        return courseGets === 2 ? wireFail('E500') : wireOk(COURSE_SPOTS_OK.data);
      }),
      http.post('/api/tours/:tourId/course/confirm', () => wireOk(COURSE_CONFIRM_OK.data)),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({ course: useGuideCourse(31), confirm: useConfirmCourse(31) }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.course.data).toBeTruthy());
    await act(async () => {
      await expect(result.current.confirm.mutateAsync()).rejects.toMatchObject({ status: 500 });
    });
    await waitFor(() => expect(courseGets).toBe(3));
    await waitFor(() => expect(result.current.course.fetchStatus).toBe('idle'));
  });

  it('useCreateDraft: 초안 요청이 실패하면 뮤테이션은 오류여도 가이드 코스 · 신청자 · 탐방 목록을 다시 받는다', async () => {
    let courseGets = 0;
    server.use(
      http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
      http.get('/api/tours/:tourId', () => wireOk(TOUR_DETAIL.data)),
      http.get('/api/tours/:tourId/course', () => {
        courseGets += 1;
        return wireOk(COURSE_SPOTS_OK.data);
      }),
      http.post('/api/tours/:tourId/course', () => wireFail('E500')),
    );
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(qk.applicants(31), 'cached');
    queryClient.setQueryData(qk.guideTours, 'cached');
    const { result } = renderHook(
      () => ({ course: useGuideCourse(31), draft: useCreateDraft(31) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.course.data).toBeTruthy());
    expect(courseGets).toBe(1);
    await act(async () => {
      await expect(result.current.draft.mutateAsync()).rejects.toMatchObject({ status: 500 });
    });
    await waitFor(() => expect(courseGets).toBe(2));
    const invalidated = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated ?? false;
    expect(invalidated(qk.applicants(31))).toBe(true);
    expect(invalidated(qk.guideTours)).toBe(true);
  });

  it('useReorderStops: PUT은 됐는데 탐방 다시 읽기가 실패해도 가이드 코스를 다시 받는다', async () => {
    let courseGets = 0;
    let tourGets = 0;
    server.use(
      http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
      http.get('/api/tours/:tourId', () => {
        tourGets += 1;
        // 1: 첫 조회, 2: PUT과 함께 읽는 탐방(실패), 3~: 무효화로 인한 다시 받기
        return tourGets === 2 ? wireFail('E500') : wireOk(TOUR_DETAIL.data);
      }),
      http.get('/api/tours/:tourId/course', () => {
        courseGets += 1;
        return wireOk(COURSE_SPOTS_OK.data);
      }),
      http.put('/api/tours/:tourId/course/spots', () => wireOk(COURSE_SPOTS_OK.data)),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({ course: useGuideCourse(31), reorder: useReorderStops(31) }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.course.data).toBeTruthy());
    await act(async () => {
      await expect(result.current.reorder.mutateAsync([2, 1])).rejects.toMatchObject({
        status: 500,
      });
    });
    await waitFor(() => expect(courseGets).toBe(2));
  });
});
