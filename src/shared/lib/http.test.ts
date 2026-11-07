import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/node';
import { wireFail, wireOk, wirePage } from '@/test/wire';
import { errorMessage, type ErrorCode } from './errors';
import {
  ApiError,
  configureHttp,
  listAll,
  recode,
  request,
  UPLOAD_TIMEOUT_MS,
  upload,
  withQuery,
} from './http';

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

  it('auth: false면 토큰을 붙이지 않고, 401이어도 onUnauthorized를 부르지 않는다(로그인 요청)', async () => {
    const spy = vi.fn();
    configureHttp({ getToken: () => 't1', onUnauthorized: spy });
    const seenAuth: (string | null)[] = [];
    server.use(
      http.post('/api/auth/login', ({ request: req }) => {
        seenAuth.push(req.headers.get('Authorization'));
        return HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'x' }, { status: 401 });
      }),
    );
    await expect(
      request('/auth/login', { method: 'POST', body: {}, auth: false }),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: errorMessage('INVALID_CREDENTIALS'),
    });
    expect(seenAuth).toEqual([null]);
    expect(spy).not.toHaveBeenCalled();
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
  afterEach(() => vi.restoreAllMocks());

  it('JSON code가 없는 413(본문 없음 · 프록시의 HTML 오류)은 FILE_TOO_LARGE(문구는 표의 것)', async () => {
    server.use(http.post('/api/files', () => new HttpResponse(null, { status: 413 })));
    await expect(upload('/files', new FormData())).rejects.toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
      message: '10MB 이하 이미지만 올릴 수 있어요.',
    });
  });

  it('HTML 본문 413도 FILE_TOO_LARGE', async () => {
    server.use(
      http.post(
        '/api/files',
        () =>
          new HttpResponse('<html><body>413 Request Entity Too Large</body></html>', {
            status: 413,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );
    await expect(upload('/files', new FormData())).rejects.toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
    });
  });

  it('다른 상태의 빈 본문은 지금처럼 UNKNOWN', async () => {
    server.use(http.post('/api/files', () => new HttpResponse(null, { status: 502 })));
    await expect(upload('/files', new FormData())).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN',
    });
  });

  it('업로드 제한 시간은 60초이고 upload의 기본값이다', async () => {
    expect(UPLOAD_TIMEOUT_MS).toBe(60_000);
    server.use(http.post('/api/files', () => HttpResponse.json({})));
    const timers = vi.spyOn(globalThis, 'setTimeout');
    await upload('/files', new FormData());
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 60_000);
  });

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

describe('봉투와 키 변환', () => {
  it('봉투(S200)면 data만 돌려주고 키를 camelCase로', async () => {
    server.use(
      http.get('/api/x', () =>
        wireOk({ access_token: 't', user: { verification_status: 'NONE' } }),
      ),
    );
    expect(await request('/x')).toEqual({
      accessToken: 't',
      user: { verificationStatus: 'NONE' },
    });
  });

  it('성공 봉투는 명세 예시 그대로의 모양이다(S200 · errors null · timestamp)', async () => {
    const res = wireOk({ a_b: 1 });
    expect(await res.json()).toEqual({
      code: 'S200',
      message: '성공',
      data: { a_b: 1 },
      errors: null,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/) as string,
    });
    expect(wireOk({}, { status: 201 }).status).toBe(201);
  });

  it('봉투가 아닌 성공 본문(옛 모양)도 camelCase로 그대로', async () => {
    server.use(http.get('/api/old', () => HttpResponse.json({ some_key: { inner_key: 1 } })));
    expect(await request('/old')).toEqual({ someKey: { innerKey: 1 } });
  });

  it('배열 성공 본문도 원소의 키를 camelCase로', async () => {
    server.use(http.get('/api/arr', () => HttpResponse.json([{ tour_id: 1 }, { tour_id: 2 }])));
    expect(await request('/arr')).toEqual([{ tourId: 1 }, { tourId: 2 }]);
  });

  it('data: null 봉투는 null, 빈 204는 undefined', async () => {
    server.use(
      http.get('/api/nul', () => wireOk(null)),
      http.delete('/api/none', () => new HttpResponse(null, { status: 204 })),
    );
    expect(await request('/nul')).toBeNull();
    expect(await request('/none', { method: 'DELETE' })).toBeUndefined();
  });

  it('code가 S/E 세 자리가 아니면 봉투가 아니다', async () => {
    server.use(http.get('/api/c', () => HttpResponse.json({ code: '483920', state: 'USABLE' })));
    expect(await request('/c')).toEqual({ code: '483920', state: 'USABLE' });
  });

  it('요청 본문은 snake_case', async () => {
    let received: unknown;
    server.use(
      http.post('/api/b', async ({ request: req }) => {
        received = await req.json();
        return wireOk({});
      }),
    );
    await request('/b', {
      method: 'POST',
      body: { campusId: 1, interestMajor: 'a', spots: [{ stopType: 'STORE', storeId: 2 }] },
    });
    expect(received).toEqual({
      campus_id: 1,
      interest_major: 'a',
      spots: [{ stop_type: 'STORE', store_id: 2 }],
    });
  });

  it('upload 본문(FormData)의 필드 이름은 그대로', async () => {
    let names: string[] = [];
    server.use(
      http.post('/api/up', async ({ request: req }) => {
        names = [...(await req.formData()).keys()];
        return wireOk({});
      }),
    );
    const form = new FormData();
    form.append('studentCard', 'x');
    await upload('/up', form);
    expect(names).toEqual(['studentCard']);
  });

  it('withQuery: undefined · null · 빈 문자열은 빼고 snake 이름 그대로 붙인다', async () => {
    let url: URL | undefined;
    server.use(
      http.get('/api/tours', ({ request: req }) => {
        url = new URL(req.url);
        return wirePage([]);
      }),
    );
    await request(
      withQuery('/tours', {
        campus_id: 2,
        major: '산업디자인',
        date_from: undefined,
        q: null,
        empty: '',
        open: false,
      }),
    );
    expect(url?.searchParams.get('campus_id')).toBe('2');
    expect(url?.searchParams.get('major')).toBe('산업디자인');
    expect(url?.searchParams.get('open')).toBe('false');
    expect(url?.searchParams.has('date_from')).toBe(false);
    expect(url?.searchParams.has('q')).toBe(false);
    expect(url?.searchParams.has('empty')).toBe(false);
  });

  it('withQuery: 붙일 것이 없으면 경로 그대로, 경로에 ?가 있으면 &로 잇는다', () => {
    expect(withQuery('/tours', { a: undefined })).toBe('/tours');
    expect(withQuery('/tours?status=OPEN', { page: 2 })).toBe('/tours?status=OPEN&page=2');
  });
});

describe('오류 봉투', () => {
  it.each([
    ['E409_TOUR_FULL', 409, 'TOUR_CLOSED'],
    ['E401_INVALID_CREDENTIALS', 401, 'INVALID_CREDENTIALS'],
    ['E422_PARTNER_REQUIRED', 422, 'COURSE_PARTNER_REQUIRED'],
    ['E502_AI_FAILED', 502, 'AI_FAILED'],
    ['E410_EXPIRED', 410, 'COUPON_EXPIRED'],
    ['E409_COUPON_NOT_YET', 409, 'COUPON_NOT_YET'],
    ['E418_TEAPOT', 418, 'UNKNOWN'],
    ['E404', 404, 'NOT_FOUND'],
  ] as const)('%s -> %s, backendCode와 우리 문구', async (backendCode, status, code) => {
    server.use(http.get('/api/e', () => wireFail(backendCode, { message: 'x' })));
    const error = await request('/e', { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, backendCode, message: errorMessage(code) });
  });

  it('data 키가 없는 오류 본문도 code만으로 봉투다', async () => {
    server.use(
      http.get('/api/nodata', () =>
        HttpResponse.json({ code: 'E409_TOUR_FULL', message: 'x' }, { status: 409 }),
      ),
    );
    await expect(request('/nodata')).rejects.toMatchObject({
      code: 'TOUR_CLOSED',
      backendCode: 'E409_TOUR_FULL',
    });
  });

  it('2xx인데 E 봉투면 ApiError로 던진다', async () => {
    server.use(http.get('/api/odd', () => wireFail('E409_TOUR_FULL', { status: 200 })));
    const error = await request('/odd').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 200,
      code: 'TOUR_CLOSED',
      backendCode: 'E409_TOUR_FULL',
    });
  });

  it('명세 400 예시(재학 인증 파일 오류) 그대로: errors[] -> fieldErrors', async () => {
    // docs/api/backend-spec.md POST /verifications body(형식·용량 오류)
    server.use(
      http.post('/api/verifications', () =>
        HttpResponse.json(
          {
            code: 'E400',
            message: '요청 값이 유효하지 않습니다',
            data: null,
            errors: [
              { field: 'document', reason: 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요' },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    await expect(request('/verifications', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      backendCode: 'E400',
      fieldErrors: { document: 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요' },
    });
  });

  it('명세 422 예시(사업자 불일치) 그대로: 기계값 reason은 우리 문구', async () => {
    // docs/api/backend-spec.md POST /verifications/business body(불일치 · 휴폐업)
    server.use(
      http.post('/api/biz', () =>
        HttpResponse.json(
          {
            code: 'E422_BUSINESS_INVALID',
            message: '사업자 정보를 확인할 수 없습니다',
            data: null,
            errors: [{ field: 'business_number', reason: 'MISMATCH' }],
          },
          { status: 422 },
        ),
      ),
    );
    await expect(request('/biz', { method: 'POST' })).rejects.toMatchObject({
      status: 422,
      code: 'BIZ_MISMATCH',
      backendCode: 'E422_BUSINESS_INVALID',
      fieldErrors: { businessNumber: errorMessage('BIZ_MISMATCH') },
    });
  });

  it('호출별 errorMap이 기본 표보다 앞선다', async () => {
    server.use(http.get('/api/e', () => wireFail('E409_TOUR_FULL')));
    await expect(
      request('/e', { errorMap: { E409_TOUR_FULL: 'CAPACITY_EXCEEDED' } }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED', backendCode: 'E409_TOUR_FULL' });
  });

  it('errors[] -> fieldErrors(camelCase 또는 fieldMap, 첫 항목, 대문자 기계값은 코드 문구)', async () => {
    server.use(
      http.post('/api/f', () =>
        wireFail('E400', {
          errors: [
            { field: 'school_name', reason: '50자 이내' },
            { field: 'school_name', reason: '둘째' },
            { field: 'business_number', reason: 'MISMATCH' },
          ],
        }),
      ),
    );
    await expect(
      request('/f', { method: 'POST', body: {}, fieldMap: { school_name: 'highSchoolName' } }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { highSchoolName: '50자 이내', businessNumber: '입력값을 다시 확인해 주세요.' },
    });
  });

  it('오류 봉투의 data 객체는 details(camelCase)로', async () => {
    server.use(
      http.post('/api/d', () =>
        wireFail('E409_ALREADY_USED', { data: { used_at: '2027-01-15T13:40:00+09:00' } }),
      ),
    );
    await expect(request('/d', { method: 'POST' })).rejects.toMatchObject({
      code: 'COUPON_ALREADY_USED',
      details: { usedAt: '2027-01-15T13:40:00+09:00' },
    });
  });

  it('전환 기간: 옛 오류 모양도 받는다', async () => {
    server.use(
      http.get('/api/legacy', () =>
        HttpResponse.json(
          { code: 'TOUR_CLOSED', message: 'x', fieldErrors: { a: 'b' } },
          { status: 409 },
        ),
      ),
    );
    const error = await request('/legacy').catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: 'TOUR_CLOSED',
      fieldErrors: { a: 'b' },
      backendCode: null,
    });
  });

  it('봉투 401은 onUnauthorized를 한 번 부르고, auth:false의 401은 부르지 않는다', async () => {
    const spy = vi.fn();
    configureHttp({ onUnauthorized: spy });
    server.use(
      http.get('/api/me', () => wireFail('E401')),
      http.post('/api/auth/login', () => wireFail('E401_INVALID_CREDENTIALS')),
    );
    await expect(request('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(request('/auth/login', { method: 'POST', auth: false })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('봉투 아닌 오류: 본문 없는 413은 FILE_TOO_LARGE, HTML 502는 상태 502의 UNKNOWN(backendCode null)', async () => {
    server.use(
      http.post('/api/big', () => new HttpResponse(null, { status: 413 })),
      http.get('/api/gw', () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 })),
    );
    await expect(request('/big', { method: 'POST' })).rejects.toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
      backendCode: null,
    });
    await expect(request('/gw')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN',
      backendCode: null,
    });
  });

  it('클라이언트 오류(TIMEOUT · NETWORK)의 backendCode는 null', async () => {
    server.use(http.get('/api/down', () => HttpResponse.error()));
    await expect(request('/down')).rejects.toMatchObject({ code: 'NETWORK', backendCode: null });
  });
});

describe('recode', () => {
  it('코드와 문구만 바꾸고 상태 · backendCode · details는 그대로', () => {
    const original = new ApiError(409, 'ALREADY_PROCESSED', 'x', {
      backendCode: 'E409',
      details: { a: 1 },
      fieldErrors: { email: '형식' },
    });
    const next = recode(original, 'EMAIL_DUPLICATE', { fieldErrors: { email: '중복' } });
    expect(next).toBeInstanceOf(ApiError);
    expect(next).toMatchObject({
      status: 409,
      code: 'EMAIL_DUPLICATE',
      message: errorMessage('EMAIL_DUPLICATE'),
      backendCode: 'E409',
      details: { a: 1 },
      fieldErrors: { email: '중복' },
    });
    expect(recode(original, 'EMAIL_DUPLICATE').fieldErrors).toEqual({ email: '형식' });
  });
});

describe('listAll', () => {
  const item = (n: number) => ({ tour_id: n });
  const pages = (calls: string[]) => (url: string) => {
    calls.push(new URL(url).search);
  };

  it('total이 한 쪽보다 크면 다음 쪽을 이어 부른다', async () => {
    const calls: string[] = [];
    server.use(
      http.get('/api/tours', ({ request: req }) => {
        pages(calls)(req.url);
        const page = Number(new URL(req.url).searchParams.get('page'));
        return page === 1
          ? wirePage(
              Array.from({ length: 50 }, (_, i) => item(i + 1)),
              { total: 51 },
            )
          : wirePage([item(51)], { page: 2, total: 51 });
      }),
    );
    const all = await listAll<{ tourId: number }>('/tours');
    expect(all).toHaveLength(51);
    expect(all[50]).toEqual({ tourId: 51 });
    expect(calls).toEqual(['?page=1&size=50', '?page=2&size=50']);
  });

  it('items만 오면 한 번', async () => {
    let count = 0;
    server.use(
      http.get('/api/campuses', () => {
        count += 1;
        return wireOk({ items: [item(1), item(2)] });
      }),
    );
    expect(await listAll('/campuses', { auth: false })).toEqual([{ tourId: 1 }, { tourId: 2 }]);
    expect(count).toBe(1);
  });

  it('빈 쪽이 오면 total이 남아도 멈춘다', async () => {
    let count = 0;
    server.use(
      http.get('/api/tours', ({ request: req }) => {
        count += 1;
        return new URL(req.url).searchParams.get('page') === '1'
          ? wirePage([item(1)], { total: 99 })
          : wirePage([], { page: 2, total: 99 });
      }),
    );
    expect(await listAll('/tours')).toEqual([{ tourId: 1 }]);
    expect(count).toBe(2);
  });

  it('total이 없으면 한 쪽으로 끝', async () => {
    let count = 0;
    server.use(
      http.get('/api/tours', () => {
        count += 1;
        return wireOk({ items: [item(1)], page: 1, size: 50 });
      }),
    );
    expect(await listAll('/tours')).toHaveLength(1);
    expect(count).toBe(1);
  });

  it('경로에 쿼리가 있으면 &page=로 잇는다', async () => {
    const calls: string[] = [];
    server.use(
      http.get('/api/tours', ({ request: req }) => {
        pages(calls)(req.url);
        return wirePage([item(1)]);
      }),
    );
    await listAll('/tours?status=RECRUITING');
    expect(calls).toEqual(['?status=RECRUITING&page=1&size=50']);
  });

  it('최대 20쪽에서 멈춘다', async () => {
    let count = 0;
    server.use(
      http.get('/api/tours', () => {
        count += 1;
        return wirePage([item(count)], { total: 10_000 });
      }),
    );
    expect(await listAll('/tours')).toHaveLength(20);
    expect(count).toBe(20);
  });

  it('맨 배열이 뒤쪽 쪽에 오면 앞서 모은 것을 버리지 않는다', async () => {
    server.use(
      http.get('/api/tours', ({ request: req }) =>
        new URL(req.url).searchParams.get('page') === '1'
          ? wirePage([item(1)], { total: 5 })
          : HttpResponse.json([item(2)]),
      ),
    );
    expect(await listAll('/tours')).toEqual([{ tourId: 1 }, { tourId: 2 }]);
  });

  it('오류는 그대로 던진다', async () => {
    server.use(http.get('/api/tours', () => wireFail('E403')));
    const code: ErrorCode = 'FORBIDDEN';
    await expect(listAll('/tours')).rejects.toMatchObject({ code });
  });
});
