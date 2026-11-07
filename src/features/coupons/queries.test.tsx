import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { wireFail } from '@/test/wire';
import { useRedeemCoupon } from './queries';

function setup() {
  configureHttp({ getToken: () => null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

const keysOf = (invalidate: ReturnType<typeof setup>['invalidate']) =>
  invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));

describe('useRedeemCoupon', () => {
  it('사용 처리 뒤 다시 확인이 실패해 오류가 돼도 조회 결과와 가게 리포트를 다시 불러오게 한다 (최종 리뷰 Minor 1)', async () => {
    server.use(http.post('/api/coupons/:code/redeem', () => wireFail('E500')));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRedeemCoupon(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('ABC-123').catch(() => undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const keys = keysOf(invalidate);
    expect(keys).toContain(JSON.stringify(qk.couponLookup('ABC-123')));
    expect(keys).toContain(JSON.stringify(qk.storeReport));
  });
});
