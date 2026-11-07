import { QueryClient } from '@tanstack/react-query';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { CAMPUSES_LIST, D01 } from '@/test/fixtures/backend/campuses';
import { wireOk } from '@/test/wire';
import { loadCampuses } from './queries';

describe('loadCampuses', () => {
  it('캠퍼스 목록을 한 번만 불러 캐시를 나눠 쓴다', async () => {
    let calls = 0;
    server.use(
      http.get('/api/campuses', () => {
        calls += 1;
        return wireOk(CAMPUSES_LIST.data);
      }),
    );
    const queryClient = new QueryClient();
    const [first, second] = await Promise.all([
      loadCampuses(queryClient),
      loadCampuses(queryClient),
    ]);
    expect(first).toEqual(D01);
    expect(second).toBe(first);
    expect(await loadCampuses(queryClient)).toBe(first);
    expect(calls).toBe(1);
  });
});
