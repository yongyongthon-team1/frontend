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
import { COURSE_SPOTS_OK } from '@/test/fixtures/backend/courses';
import { TOUR_31, TOUR_DETAIL } from '@/test/fixtures/backend/tours';
import { wireFail, wireOk } from '@/test/wire';
import { useGuideCourse, useReorderStops } from './queries';
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
});
