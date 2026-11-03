import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleUnauthorized,
  registerQueryClient,
  SESSION_KEY,
  setUnauthorizedRecovery,
  useSession,
} from './session';

afterEach(() => {
  useSession.setState({ token: null });
  setUnauthorizedRecovery(null);
});

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

describe('401 복구(시연 계정 자동 재로그인 등록 지점)', () => {
  /** 끝을 테스트가 정하는 복구 시도. */
  function deferredRecovery() {
    let finish: (ok: boolean) => void = () => {};
    const recover = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    return { recover, finish: (ok: boolean) => finish(ok) };
  }

  it('복구가 성공하면 토큰을 지우지 않고 쿼리를 다시 불러온다', async () => {
    const qc = clientWithData();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { recover, finish } = deferredRecovery();
    setUnauthorizedRecovery(recover);
    useSession.setState({ token: 'stale' });

    handleUnauthorized();
    handleUnauthorized(); // 복구 중에 겹쳐 온 401은 복구 결과를 따른다
    expect(recover).toHaveBeenCalledTimes(1);
    expect(useSession.getState().token).toBe('stale');

    useSession.setState({ token: 'fresh' }); // 복구가 다시 로그인했다
    finish(true);
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(useSession.getState().token).toBe('fresh');
    expect(qc.getQueryData(['me'])).toEqual({ id: 1 });
  });

  it('복구는 페이지 세션당 한 번 — 두 번째 401은 토큰과 캐시를 비운다', async () => {
    const qc = clientWithData();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { recover, finish } = deferredRecovery();
    setUnauthorizedRecovery(recover);
    useSession.setState({ token: 'stale' });
    handleUnauthorized();
    finish(true);
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());

    handleUnauthorized();
    expect(recover).toHaveBeenCalledTimes(1);
    expect(useSession.getState().token).toBeNull();
    expect(qc.getQueryData(['me'])).toBeUndefined();
  });

  it('복구가 실패하면 토큰과 캐시를 비운다', async () => {
    const qc = clientWithData();
    const { recover, finish } = deferredRecovery();
    setUnauthorizedRecovery(recover);
    useSession.setState({ token: 'stale' });
    handleUnauthorized();
    finish(false);
    await vi.waitFor(() => expect(useSession.getState().token).toBeNull());
    expect(qc.getQueryData(['me'])).toBeUndefined();
  });

  it('복구할 게 없으면(null) 바로 비우고, 다음 401에서 다시 물어본다', () => {
    const qc = clientWithData();
    const recover = vi.fn(() => null);
    setUnauthorizedRecovery(recover);
    useSession.setState({ token: 'stale' });
    handleUnauthorized();
    expect(useSession.getState().token).toBeNull();
    expect(qc.getQueryData(['me'])).toBeUndefined();

    useSession.setState({ token: 'again' });
    handleUnauthorized();
    expect(recover).toHaveBeenCalledTimes(2);
  });

  it('토큰이 없으면 복구도 부르지 않는다 (G6)', () => {
    const recover = vi.fn(() => Promise.resolve(true));
    setUnauthorizedRecovery(recover);
    handleUnauthorized();
    expect(recover).not.toHaveBeenCalled();
  });
});
