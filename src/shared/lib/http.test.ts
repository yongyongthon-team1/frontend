import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { ApiError, configureHttp, request, upload } from './http';

afterEach(() => configureHttp({ getToken: () => null, onUnauthorized: () => {} }));

describe('request', () => {
  it('JSON 응답을 돌려준다', async () => {
    server.use(http.get('/api/ping', () => HttpResponse.json({ ok: true })));
    expect(await request('/ping')).toEqual({ ok: true });
  });

  it('토큰이 있으면 Bearer 헤더', async () => {
    configureHttp({ getToken: () => 't1' });
    server.use(
      http.get('/api/echo', ({ request: req }) =>
        HttpResponse.json({ auth: req.headers.get('Authorization') }),
      ),
    );
    expect(await request('/echo')).toEqual({ auth: 'Bearer t1' });
  });

  it('JSON 본문을 보낸다', async () => {
    server.use(
      http.post('/api/items', async ({ request: req }) =>
        HttpResponse.json({
          type: req.headers.get('Content-Type'),
          body: await req.json(),
        }),
      ),
    );
    expect(await request('/items', { method: 'POST', body: { a: 1 } })).toEqual({
      type: 'application/json',
      body: { a: 1 },
    });
  });

  it('에러 봉투를 ApiError로', async () => {
    server.use(
      http.get('/api/err', () =>
        HttpResponse.json(
          { code: 'TOUR_CLOSED', message: 'x', details: { a: 1 } },
          { status: 409 },
        ),
      ),
    );
    const promise = request('/err');
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 409,
      code: 'TOUR_CLOSED',
      details: { a: 1 },
    });
  });

  it('필드 에러를 담는다', async () => {
    server.use(
      http.post('/api/form', () =>
        HttpResponse.json(
          { code: 'VALIDATION', message: 'v', fieldErrors: { email: '형식' } },
          { status: 400 },
        ),
      ),
    );
    await expect(request('/form', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { email: '형식' },
    });
  });

  it('401이면 onUnauthorized 호출', async () => {
    const spy = vi.fn();
    configureHttp({ onUnauthorized: spy });
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'u' }, { status: 401 }),
      ),
    );
    await expect(request('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('시간이 지나면 TIMEOUT', async () => {
    server.use(
      http.get('/api/slow', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    await expect(request('/slow', { timeoutMs: 30 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('네트워크 실패는 NETWORK', async () => {
    server.use(http.get('/api/down', () => HttpResponse.error()));
    await expect(request('/down')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('204는 undefined', async () => {
    server.use(http.delete('/api/none', () => new HttpResponse(null, { status: 204 })));
    expect(await request('/none', { method: 'DELETE' })).toBeUndefined();
  });

  it('JSON이 아닌 500은 UNKNOWN', async () => {
    server.use(http.get('/api/plain', () => new HttpResponse('oops', { status: 500 })));
    await expect(request('/plain')).rejects.toMatchObject({ status: 500, code: 'UNKNOWN' });
  });
});

describe('upload', () => {
  it('FormData를 보내고 Content-Type을 직접 넣지 않는다', async () => {
    server.use(
      http.post('/api/files', async ({ request: req }) => {
        const form = await req.formData();
        return HttpResponse.json({
          name: form.get('name'),
          type: req.headers.get('Content-Type'),
        });
      }),
    );
    const form = new FormData();
    form.append('name', 'a');
    const res = await upload<{ name: string; type: string }>('/files', form);
    expect(res.name).toBe('a');
    expect(res.type).toMatch(/^multipart\/form-data; boundary=/);
  });
});
