import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/lib/http';
import { createQueryClient } from './providers';

describe('createQueryClient', () => {
  const queries = createQueryClient().getDefaultOptions().queries!;
  const retry = queries.retry as (failureCount: number, error: unknown) => boolean;

  it('4xx ApiError는 다시 시도하지 않는다(오류 화면이 늦어지지 않게)', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(retry(0, new ApiError(status, 'X', 'x'))).toBe(false);
    }
  });

  it('네트워크 · 시간 초과 · 5xx는 한 번만 다시 시도한다', () => {
    expect(retry(0, new ApiError(0, 'NETWORK', 'x'))).toBe(true);
    expect(retry(0, new ApiError(500, 'UNKNOWN', 'x'))).toBe(true);
    expect(retry(0, new Error('boom'))).toBe(true);
    expect(retry(1, new ApiError(500, 'UNKNOWN', 'x'))).toBe(false);
  });

  it('staleTime 30초 · 창 포커스 때 다시 불러온다', () => {
    expect(queries.staleTime).toBe(30_000);
    expect(queries.refetchOnWindowFocus).toBe(true);
  });
});
