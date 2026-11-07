import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { MY_STORE, STORE_REGISTERED, STORE_SEARCH } from '@/test/fixtures/backend/stores';
import { wireFail, wireOk } from '@/test/wire';
import {
  useLinkStore,
  useSavePartnership,
  useStoreSearch,
  useUpdateMyStore,
  useVerifyBusiness,
} from './queries';

function setup() {
  configureHttp({ getToken: () => null });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, wrapper };
}

const keysOf = (invalidate: ReturnType<typeof setup>['invalidate']) =>
  invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
const has = (invalidate: ReturnType<typeof setup>['invalidate'], key: readonly unknown[]) =>
  keysOf(invalidate).includes(JSON.stringify(key));

const ME_OWNER = {
  id: 9,
  email: 'o@demo.kr',
  name: '정해린',
  role: 'OWNER',
  verification_status: 'APPROVED',
  reject_reason: null,
};

describe('useStoreSearch', () => {
  it('공백 뺀 2자 미만이면 요청하지 않고, 2자부터 검색어(공백 뺌)로 부른다', async () => {
    const urls: string[] = [];
    server.use(
      http.get('/api/stores/search', ({ request }) => {
        urls.push(new URL(request.url).searchParams.get('keyword') ?? '');
        return wireOk(STORE_SEARCH.data);
      }),
    );
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ q }) => useStoreSearch(q), {
      wrapper,
      initialProps: { q: ' 분 ' },
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result.current.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);

    rerender({ q: ' 분식 ' });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(urls).toEqual(['분식']);
    expect(result.current.data?.[0]).toMatchObject({ storeId: 201, registered: false });
  });
});

describe('useVerifyBusiness', () => {
  it('성공하면 내 정보를 다시 읽어 새 Me를 돌려준다', async () => {
    let meReads = 0;
    server.use(
      http.post('/api/verifications/business', () => wireOk({ status: 'APPROVED' })),
      http.get('/api/users/me/store', () => wireFail('E404')),
      http.get('/api/users/me', () => {
        meReads += 1;
        return wireOk(ME_OWNER);
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useVerifyBusiness(), { wrapper });
    let me;
    await act(async () => {
      me = await result.current.mutateAsync({
        businessNumber: '123-45-67890',
        representativeName: '정해린',
        openedAt: '2021-03-02',
      });
    });
    expect(me).toMatchObject({ businessVerified: true });
    expect(meReads).toBe(1);
  });
});

describe('useLinkStore', () => {
  const serveLinked = () =>
    server.use(
      http.post('/api/users/me/store', () => wireOk(STORE_REGISTERED.data, { status: 201 })),
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
      http.get('/api/users/me', () => wireOk(ME_OWNER)),
    );

  it('성공하면 내 가게를 캐시에 넣고 내 정보를 다시 읽는다', async () => {
    serveLinked();
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useLinkStore(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ storeId: 201 });
    });
    expect(queryClient.getQueryData(qk.myStore)).toMatchObject({ id: 201, name: '용인 분식' });
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ businessVerified: true });
  });

  it('STORE_ALREADY_LINKED는 검색 결과를, STORE_LIMIT · BIZ_NOT_VERIFIED는 내 정보 · 내 가게를 다시 읽게 한다', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useLinkStore(), { wrapper });

    server.use(
      http.post('/api/users/me/store', () => wireFail('E409_STORE_UNAVAILABLE')),
      http.get('/api/users/me/store', () => wireFail('E404')),
    );
    await act(async () => {
      await result.current.mutateAsync({ storeId: 1 }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error?.code).toBe('STORE_ALREADY_LINKED'));
    expect(has(invalidate, qk.allStoreSearch)).toBe(true);
    expect(has(invalidate, qk.me)).toBe(false);

    invalidate.mockClear();
    server.use(http.get('/api/users/me/store', () => wireOk(MY_STORE.data)));
    await act(async () => {
      await result.current.mutateAsync({ storeId: 1 }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error?.code).toBe('STORE_LIMIT'));
    expect(has(invalidate, qk.me)).toBe(true);
    expect(has(invalidate, qk.myStore)).toBe(true);
    expect(has(invalidate, qk.allStoreSearch)).toBe(false);

    invalidate.mockClear();
    server.use(http.post('/api/users/me/store', () => wireFail('E403_VERIFICATION_REQUIRED')));
    await act(async () => {
      await result.current.mutateAsync({ storeId: 1 }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error?.code).toBe('BIZ_NOT_VERIFIED'));
    expect(has(invalidate, qk.me)).toBe(true);
    expect(has(invalidate, qk.myStore)).toBe(true);
  });
});

describe('useUpdateMyStore · useSavePartnership', () => {
  it('성공하면 내 가게를 캐시에 넣는다', async () => {
    server.use(
      http.patch('/api/users/me/store', () => wireOk(MY_STORE.data)),
      http.put('/api/users/me/store/partnership', () =>
        wireOk({
          discount_text: '음료 1,000원 할인',
          start_date: '2027-01-01',
          end_date: '2027-02-28',
        }),
      ),
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
    );
    const { queryClient, wrapper } = setup();
    const update = renderHook(() => useUpdateMyStore(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({ address: '새 주소' });
    });
    expect(queryClient.getQueryData(qk.myStore)).toMatchObject({ id: 201 });

    queryClient.removeQueries({ queryKey: qk.myStore });
    const save = renderHook(() => useSavePartnership(), { wrapper });
    await act(async () => {
      await save.result.current.mutateAsync({
        discount: '음료 1,000원 할인',
        startDate: '2027-01-01',
        endDate: '2027-02-28',
      });
    });
    expect(queryClient.getQueryData(qk.myStore)).toMatchObject({
      partnership: { discount: '음료 1,000원 할인' },
    });
  });

  it('STORE_NOT_LINKED면 내 정보 · 내 가게를 다시 읽게 한다', async () => {
    server.use(
      http.patch('/api/users/me/store', () => wireFail('E404')),
      http.put('/api/users/me/store/partnership', () => wireFail('E404')),
    );
    const { invalidate, wrapper } = setup();
    const update = renderHook(() => useUpdateMyStore(), { wrapper });
    await act(async () => {
      await update.result.current.mutateAsync({ name: 'x' }).catch(() => undefined);
    });
    await waitFor(() => expect(update.result.current.error?.code).toBe('STORE_NOT_LINKED'));
    expect(has(invalidate, qk.me) && has(invalidate, qk.myStore)).toBe(true);

    invalidate.mockClear();
    const save = renderHook(() => useSavePartnership(), { wrapper });
    await act(async () => {
      await save.result.current
        .mutateAsync({ discount: 'x', startDate: '2027-01-01', endDate: '2027-01-02' })
        .catch(() => undefined);
    });
    await waitFor(() => expect(save.result.current.error?.code).toBe('STORE_NOT_LINKED'));
    expect(has(invalidate, qk.me) && has(invalidate, qk.myStore)).toBe(true);
  });
});
