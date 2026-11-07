import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mutate, resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import { MY_STORE } from '@/test/fixtures/backend/stores';
import { loginAs } from '@/test/loginAs';
import { wireFail, wireOk } from '@/test/wire';
import { getMyStore } from './api';

afterEach(() => configureHttp({ getToken: () => null, onUnauthorized: () => {} }));

describe('내 가게 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });

  it('연결된 가게가 있으면 MyStore', async () => {
    loginAs(DEMO_EMAILS.owner);
    expect(await getMyStore()).toMatchObject({
      id: 1,
      name: '서천 밥상',
      partnership: { state: 'ACTIVE' },
    });
  });

  it('가게 연결이 없는 사장님(owner-nostore)은 오류가 아니라 null', async () => {
    loginAs(DEMO_EMAILS.ownerNoStore);
    expect(await getMyStore()).toBeNull();
  });

  it('404 E404도 오류가 아니라 null(연결을 끊은 경우)', async () => {
    mutate((db) => {
      db.stores.find((s) => s.id === 1)!.ownerId = null;
    });
    loginAs(DEMO_EMAILS.owner);
    expect(await getMyStore()).toBeNull();
  });

  it('봉투 없는 404(아직 없는 경로 등)도 null, 5xx는 그대로 던진다', async () => {
    server.use(http.get('/api/users/me/store', () => new Response('Not Found', { status: 404 })));
    expect(await getMyStore()).toBeNull();
    server.use(http.get('/api/users/me/store', () => new Response('Bad Gateway', { status: 502 })));
    await expect(getMyStore()).rejects.toMatchObject({ status: 502 });
    server.use(http.get('/api/users/me/store', () => wireFail('E500')));
    await expect(getMyStore()).rejects.toMatchObject({ status: 500 });
  });

  it('다른 오류(403)는 그대로 던진다', async () => {
    loginAs(DEMO_EMAILS.student);
    await expect(getMyStore()).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      backendCode: 'E403',
    });
  });
});

describe('내 가게 API (명세 예시 응답)', () => {
  it('확장 없는 명세 응답을 읽는다', async () => {
    server.use(http.get('/api/users/me/store', () => wireOk(MY_STORE.data)));
    expect(await getMyStore()).toMatchObject({
      id: 201,
      name: '용인 분식',
      partnership: { id: 0, condition: null, discount: '음료 1,000원 할인' },
    });
  });

  it('E404 봉투는 STORE_NOT_LINKED로 읽어 null', async () => {
    server.use(http.get('/api/users/me/store', () => wireFail('E404')));
    expect(await getMyStore()).toBeNull();
  });

  it('토큰 인자를 주면 그 토큰으로 부르고 세션 토큰은 쓰지 않으며 401이어도 세션을 끊지 않는다', async () => {
    const seen: (string | null)[] = [];
    const onUnauthorized = vi.fn();
    configureHttp({ getToken: () => 'session-token', onUnauthorized });
    server.use(
      http.get('/api/users/me/store', ({ request }) => {
        seen.push(request.headers.get('Authorization'));
        return wireFail('E401');
      }),
    );
    await expect(getMyStore('login-token')).rejects.toMatchObject({ status: 401 });
    expect(seen).toEqual(['Bearer login-token']);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('토큰 인자를 주면 200 응답도 MyStore로 읽는다', async () => {
    server.use(http.get('/api/users/me/store', () => wireOk(MY_STORE.data)));
    expect(await getMyStore('login-token')).toMatchObject({
      id: 201,
      name: '용인 분식',
      partnership: { id: 0, condition: null, discount: '음료 1,000원 할인' },
    });
  });

  it('토큰 인자를 줘도 E404 봉투는 null', async () => {
    server.use(http.get('/api/users/me/store', () => wireFail('E404')));
    expect(await getMyStore('login-token')).toBeNull();
  });

  it('토큰 인자가 없으면 세션 토큰을 보낸다', async () => {
    const seen: (string | null)[] = [];
    configureHttp({ getToken: () => 'session-token' });
    server.use(
      http.get('/api/users/me/store', ({ request }) => {
        seen.push(request.headers.get('Authorization'));
        return wireOk(MY_STORE.data);
      }),
    );
    await getMyStore();
    expect(seen).toEqual(['Bearer session-token']);
  });
});
