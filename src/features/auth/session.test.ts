import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { handleUnauthorized, registerQueryClient, SESSION_KEY, useSession } from './session';

afterEach(() => useSession.setState({ token: null }));

function clientWithData(): QueryClient {
  const qc = new QueryClient();
  qc.setQueryData(['me'], { id: 1 });
  registerQueryClient(qc);
  return qc;
}

describe('세션', () => {
  it(`토큰은 localStorage '${SESSION_KEY}'에 남는다`, () => {
    useSession.getState().setToken('abc');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).state).toEqual({ token: 'abc' });
  });

  it('저장값이 손상돼 있으면 로그아웃 상태로 시작한다(지난 리허설의 localStorage)', async () => {
    localStorage.setItem(SESSION_KEY, '{broken');
    await useSession.persist.rehydrate();
    expect(useSession.getState().token).toBeNull();
  });

  it('handleUnauthorized: 토큰이 없으면 아무것도 하지 않는다 (G6)', () => {
    const qc = clientWithData();
    handleUnauthorized();
    expect(useSession.getState().token).toBeNull();
    expect(qc.getQueryData(['me'])).toEqual({ id: 1 });
  });

  it('handleUnauthorized: 토큰과 등록된 쿼리 캐시를 비운다', () => {
    const qc = clientWithData();
    useSession.setState({ token: 'stale' });
    handleUnauthorized();
    expect(useSession.getState().token).toBeNull();
    expect(qc.getQueryData(['me'])).toBeUndefined();
  });
});
