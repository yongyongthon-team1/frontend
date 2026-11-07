import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { REVIEW_CREATED, STORE_REVIEWS } from '@/test/fixtures/backend/reviews';
import { wireFail, wireOk } from '@/test/wire';
import { REVIEW_SUMMARY_REFETCH_MS, type CreateReviewInput } from './model';
import { useCreateReview, useStoreReviews } from './queries';

const INPUT: CreateReviewInput = {
  storeId: 1,
  couponId: 501,
  rating: 5,
  content: '양도 많고 맛있었어요',
};

function setup() {
  configureHttp({ getToken: () => null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, wrapper };
}

/** 지금까지 `invalidateQueries`가 받은 키를 문자열로. */
const keysOf = (invalidate: ReturnType<typeof setup>['invalidate']) =>
  invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
const count = (invalidate: ReturnType<typeof setup>['invalidate'], key: readonly unknown[]) =>
  keysOf(invalidate).filter((k) => k === JSON.stringify(key)).length;

afterEach(() => {
  vi.useRealTimers();
});

describe('useStoreReviews', () => {
  it('storeId가 null이면 요청하지 않는다', async () => {
    let requests = 0;
    server.use(
      http.get('/api/stores/:storeId/reviews', () => {
        requests += 1;
        return wireOk(STORE_REVIEWS.data);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useStoreReviews(null), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(requests).toBe(0);
  });

  it('storeId가 있으면 최근 3개만 부른다(page=1&size=3)', async () => {
    const urls: string[] = [];
    server.use(
      http.get('/api/stores/:storeId/reviews', ({ request }) => {
        urls.push(new URL(request.url).search);
        return wireOk(STORE_REVIEWS.data);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useStoreReviews(201), { wrapper });
    await waitFor(() => expect(result.current.data?.count).toBe(11));
    expect(urls).toEqual(['?page=1&size=3']);
  });
});

describe('useCreateReview', () => {
  it('성공하면 상점 리뷰 · 코스 · 내 쿠폰을 바로, 3초 뒤 상점 리뷰 · 코스를 한 번 더 무효화한다 (2B′-R17)', async () => {
    server.use(
      http.post('/api/stores/:storeId/reviews', () => wireOk(REVIEW_CREATED.data, { status: 201 })),
    );
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateReview(), { wrapper });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });
    expect(count(invalidate, qk.storeReviews(1))).toBe(1);
    expect(count(invalidate, qk.allCourses)).toBe(1);
    expect(count(invalidate, qk.allMyCoupons)).toBe(1);

    await vi.advanceTimersByTimeAsync(REVIEW_SUMMARY_REFETCH_MS - 1);
    expect(count(invalidate, qk.storeReviews(1))).toBe(1);
    expect(count(invalidate, qk.allCourses)).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(count(invalidate, qk.storeReviews(1))).toBe(2);
    expect(count(invalidate, qk.allCourses)).toBe(2);
    expect(count(invalidate, qk.allMyCoupons)).toBe(1); // 쿠폰은 다시 부르지 않는다

    await vi.advanceTimersByTimeAsync(10_000);
    expect(count(invalidate, qk.storeReviews(1))).toBe(2); // 한 번만 더
  });

  it.each([
    ['E403_COUPON_NOT_USED', 'REVIEW_NOT_ALLOWED'],
    ['E409_ALREADY_REVIEWED', 'REVIEW_DUPLICATE'],
    ['E404', 'NOT_FOUND'],
  ])('%s(%s)로 거절되면 내 쿠폰만 무효화한다(낡은 쿠폰 상태)', async (backendCode, code) => {
    server.use(http.post('/api/stores/:storeId/reviews', () => wireFail(backendCode)));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateReview(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(INPUT)).rejects.toMatchObject({ code });
    });
    expect(keysOf(invalidate)).toEqual([JSON.stringify(qk.allMyCoupons)]);
  });

  it('검증 실패(400) 같은 다른 오류는 아무것도 무효화하지 않는다', async () => {
    server.use(
      http.post('/api/stores/:storeId/reviews', () =>
        wireFail('E400', { errors: [{ field: 'rating', reason: 'x' }] }),
      ),
    );
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateReview(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(INPUT)).rejects.toMatchObject({ code: 'VALIDATION' });
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
