import { describe, expect, it } from 'vitest';
import { backendError, fieldError, MockApiError } from '@/mocks/rules/errors';
import { ERROR_CODES, resolveErrorCode, type ErrorCode } from '@/shared/lib/errors';
import { wireFail, wireOk } from '@/test/wire';
import { LOSSY_CODES, toBackendError } from './errorCodes';
import { fail, ok, okItems, okPage, pageOf, withWire } from './envelope';

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;

describe('ok', () => {
  it('명세 예시 그대로의 성공 봉투를 낸다(S200 · 성공 · snake 키 · errors null · +09:00 timestamp)', async () => {
    const res = ok({ tourId: 1, startsAt: 'x' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      code: 'S200',
      message: '성공',
      data: { tour_id: 1, starts_at: 'x' },
      errors: null,
      timestamp: expect.stringMatching(TIMESTAMP) as string,
    });
  });

  it('data가 undefined여도 data 키를 null로 남긴다(클라이언트 봉투 판별에 필요)', async () => {
    const body = (await ok(undefined).json()) as Record<string, unknown>;
    expect(body).toHaveProperty('data', null);
    expect(body.code).toBe('S200');
  });

  it('201이면 코드 S201', async () => {
    const res = ok({ id: 1 }, 201);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { code: string }).code).toBe('S201');
  });

  it('테스트 도구 wireOk는 같은 봉투를 낸다(timestamp 말고)', async () => {
    const a = (await ok({ tourId: 1 }).json()) as Record<string, unknown>;
    const b = (await wireOk({ tour_id: 1 }).json()) as Record<string, unknown>;
    expect({ ...a, timestamp: 0 }).toEqual({ ...b, timestamp: 0 });
    expect(b.timestamp).toMatch(TIMESTAMP);
  });
});

describe('pageOf', () => {
  it('쪽을 자르고 { items, page, size, total }을 낸다(okPage의 자르기 규칙)', () => {
    expect(pageOf(['a', 'b', 'c'], new URLSearchParams('page=2&size=2'))).toEqual({
      items: ['c'],
      page: 2,
      size: 2,
      total: 3,
    });
  });
});

describe('okPage · okItems', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const dataOf = async (res: Response) => ((await res.json()) as { data: unknown }).data;

  it('page · size로 자르고 { items, page, size, total }을 낸다', async () => {
    expect(await dataOf(okPage(items, new URLSearchParams('page=2&size=2')))).toEqual({
      items: [{ id: 3 }],
      page: 2,
      size: 2,
      total: 3,
    });
  });

  it('size는 최대 50, 매개변수가 없으면 page 1 · size 20', async () => {
    expect(await dataOf(okPage(items, new URLSearchParams('size=999')))).toMatchObject({
      page: 1,
      size: 50,
    });
    expect(await dataOf(okPage(items, new URLSearchParams()))).toEqual({
      items,
      page: 1,
      size: 20,
      total: 3,
    });
  });

  it('알아볼 수 없는 page · size는 기본값으로 읽는다', async () => {
    expect(await dataOf(okPage(items, new URLSearchParams('page=0&size=abc')))).toMatchObject({
      page: 1,
      size: 20,
    });
  });

  it('항목 키도 snake로 바뀐다', async () => {
    const data = (await dataOf(okPage([{ tourId: 1 }], new URLSearchParams()))) as {
      items: unknown[];
    };
    expect(data.items).toEqual([{ tour_id: 1 }]);
  });

  it('okItems는 { items }만 담는다', async () => {
    expect(await dataOf(okItems(items))).toEqual({ items });
  });
});

describe('fail', () => {
  const read = async (res: Response) =>
    (await res.json()) as {
      code: string;
      message: string;
      data: unknown;
      errors: unknown;
      timestamp: string;
    };

  it.each([
    [409, 'TOUR_NOT_RECRUITING', 409, 'E409_TOUR_FULL'],
    [404, 'COURSE_NOT_READY', 409, 'E409_COURSE_NOT_READY'],
    [403, 'GUIDE_PROFILE_REQUIRED', 409, 'E409_GUIDE_PROFILE_REQUIRED'],
    [409, 'COUPON_EXPIRED', 410, 'E410_EXPIRED'],
    [409, 'REAPPLY_AFTER_REJECT', 409, 'E409_REAPPLY_AFTER_REJECT'],
  ] as const)('MockApiError(%i, %s) → %i %s', async (status, code, wantStatus, wantCode) => {
    const res = fail(new MockApiError(status, code));
    expect(res.status).toBe(wantStatus);
    const body = await read(res);
    expect(body.code).toBe(wantCode);
    expect(body.data).toBeNull();
    expect(body.errors).toBeNull();
    expect(body.timestamp).toMatch(TIMESTAMP);
  });

  it('backendError는 역표 대신 명세 코드와 상태를 그대로 낸다(2B′-R4)', async () => {
    const error = backendError(409, 'E409_CONSENT_EXISTS', 'ALREADY_PROCESSED');
    expect([error.status, error.code, error.backendCode]).toEqual([
      409,
      'ALREADY_PROCESSED',
      'E409_CONSENT_EXISTS',
    ]);
    const res = fail(error);
    expect(res.status).toBe(409);
    const body = await read(res);
    expect(body.code).toBe('E409_CONSENT_EXISTS');
    expect(body.message).toBe(error.message);
    // 역표만으로는 같은 내부 코드가 `E409_ALREADY_PROCESSED`가 된다.
    expect(fail(new MockApiError(409, 'ALREADY_PROCESSED')).status).toBe(409);
    expect((await read(fail(new MockApiError(409, 'ALREADY_PROCESSED')))).code).toBe(
      'E409_ALREADY_PROCESSED',
    );
  });

  it('backendError의 상태도 error.status를 따른다', () => {
    expect(fail(backendError(422, 'E422_X', 'ALREADY_PROCESSED')).status).toBe(422);
  });

  it('명세 오류 예시 그대로의 본문이다(E409 이메일 중복 · E400 errors[])', async () => {
    // backend-spec.md: { "code": "E409", "message": "이미 가입된 이메일입니다", "data": null }
    expect(
      await fail(new MockApiError(409, 'EMAIL_DUPLICATE', '이미 가입된 이메일입니다')).json(),
    ).toEqual({
      code: 'E409',
      message: '이미 가입된 이메일입니다',
      data: null,
      errors: null,
      timestamp: expect.stringMatching(TIMESTAMP) as string,
    });
    // backend-spec.md: E400 + errors: [{ "field": "document", "reason": "..." }]
    const reason = 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요';
    expect(
      await fail(
        new MockApiError(400, 'VALIDATION', '요청 값이 유효하지 않습니다', undefined, {
          document: reason,
        }),
      ).json(),
    ).toEqual({
      code: 'E400',
      message: '요청 값이 유효하지 않습니다',
      data: null,
      errors: [{ field: 'document', reason }],
      timestamp: expect.stringMatching(TIMESTAMP) as string,
    });
  });

  it('테스트 도구 wireFail도 같은 봉투를 낸다(같은 본문 규칙)', async () => {
    const res = wireFail('E409', { message: '이미 가입된 이메일입니다' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      code: 'E409',
      message: '이미 가입된 이메일입니다',
      data: null,
      errors: null,
      timestamp: expect.stringMatching(TIMESTAMP) as string,
    });
    const withFields = wireFail('E400', { errors: [{ field: 'document', reason: 'x' }] });
    expect(((await withFields.json()) as { errors: unknown }).errors).toEqual([
      { field: 'document', reason: 'x' },
    ]);
  });

  it('message는 우리 오류 문구 표를 따른다', async () => {
    expect((await read(fail(new MockApiError(409, 'TOUR_CLOSED')))).message).toBe(
      '정원이 마감됐어요.',
    );
  });

  it('fieldErrors는 errors[{ field(snake), reason }]로, data는 null', async () => {
    const res = fail(fieldError('schoolName', '50자 이내'));
    expect(res.status).toBe(400);
    expect(await read(res)).toMatchObject({
      code: 'E400',
      data: null,
      errors: [{ field: 'school_name', reason: '50자 이내' }],
    });
  });

  it('details는 data(snake)로, errors는 null', async () => {
    const res = fail(new MockApiError(409, 'COUPON_ALREADY_USED', undefined, { usedAt: 'x' }));
    expect(await read(res)).toMatchObject({
      code: 'E409_ALREADY_USED',
      data: { used_at: 'x' },
      errors: null,
    });
  });
});

describe('withWire', () => {
  it('MockApiError는 fail 봉투로, 다른 오류는 그대로 던진다', async () => {
    const args = { request: new Request('http://x/'), params: {} };
    const thrown = withWire(() => {
      throw new MockApiError(409, 'COUPON_EXPIRED');
    });
    const res = (await thrown(args as never)) as Response;
    expect(res.status).toBe(410);
    expect(((await res.json()) as { code: string }).code).toBe('E410_EXPIRED');

    const boom = withWire(() => Promise.reject(new Error('boom')));
    await expect(boom(args as never)).rejects.toThrow('boom');
  });

  it('성공 응답은 그대로 돌려준다', async () => {
    const res = await withWire(() => Promise.resolve(ok({ a: 1 })))({
      request: new Request('http://x/'),
      params: {},
    } as never);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(200);
  });
});

describe('toBackendError', () => {
  it('모든 ErrorCode는 되돌려 읽으면 자기 자신이거나 LOSSY_CODES다', () => {
    for (const c of Object.keys(ERROR_CODES) as ErrorCode[]) {
      const back = resolveErrorCode(toBackendError(c, 400).code);
      expect(back === c || LOSSY_CODES.includes(c), c).toBe(true);
    }
  });

  it('LOSSY_CODES는 정확히 15개', () => {
    expect([...LOSSY_CODES].sort()).toEqual(
      [
        'GUARDIAN_NOT_AGREED',
        'BIZ_NOT_VERIFIED',
        'TOUR_NOT_RECRUITING',
        'CAPACITY_EXCEEDED',
        'COUPON_NOT_FOUND',
        'STORE_NOT_LINKED',
        'CONSENT_LINK_INVALID',
        'EMAIL_DUPLICATE',
        'CANCEL_AFTER_TOUR_DATE',
        'TOUR_ALREADY_COMPLETED',
        'COMPLETE_BEFORE_TOUR_DATE',
        'STORE_LIMIT',
        'REVIEW_DUPLICATE',
        'CONSENT_LINK_EXPIRED',
        'BIZ_CLOSED',
      ].sort(),
    );
  });

  it('손실 없는 코드는 정확히 되돌아온다(LOSSY가 아니면 자기 자신)', () => {
    for (const c of Object.keys(ERROR_CODES) as ErrorCode[]) {
      if (LOSSY_CODES.includes(c)) continue;
      expect(resolveErrorCode(toBackendError(c, 400).code), c).toBe(c);
    }
  });

  // 2C-R6 표를 그대로 옮긴 기대값(코드 구현과 따로 적는다).
  const TABLE: [ErrorCode, string, number][] = [
    ['VALIDATION', 'E400', 400],
    ['UNAUTHORIZED', 'E401', 401],
    ['INVALID_CREDENTIALS', 'E401_INVALID_CREDENTIALS', 401],
    ['FORBIDDEN', 'E403', 403],
    ['NOT_VERIFIED', 'E403_VERIFICATION_REQUIRED', 403],
    ['GUARDIAN_NOT_AGREED', 'E403_VERIFICATION_REQUIRED', 403],
    ['BIZ_NOT_VERIFIED', 'E403_VERIFICATION_REQUIRED', 403],
    ['COUPON_OTHER_STORE', 'E403_OTHER_STORE', 403],
    ['REVIEW_NOT_ALLOWED', 'E403_COUPON_NOT_USED', 403],
    ['NOT_FOUND', 'E404', 404],
    ['COUPON_NOT_FOUND', 'E404', 404],
    ['STORE_NOT_LINKED', 'E404', 404],
    ['CONSENT_LINK_INVALID', 'E404', 404],
    ['EMAIL_DUPLICATE', 'E409', 409],
    ['TOUR_CLOSED', 'E409_TOUR_FULL', 409],
    ['TOUR_NOT_RECRUITING', 'E409_TOUR_FULL', 409],
    ['CAPACITY_EXCEEDED', 'E409_TOUR_FULL', 409],
    ['DUPLICATE_APPLICATION', 'E409_ALREADY_APPLIED', 409],
    ['ALREADY_PROCESSED', 'E409_ALREADY_PROCESSED', 409],
    ['CANCEL_AFTER_TOUR_DATE', 'E409_INVALID_APPLICATION_STATUS', 409],
    ['TOUR_ALREADY_COMPLETED', 'E409_INVALID_TOUR_STATUS', 409],
    ['COMPLETE_BEFORE_TOUR_DATE', 'E409_INVALID_TOUR_STATUS', 409],
    ['GUIDE_PROFILE_REQUIRED', 'E409_GUIDE_PROFILE_REQUIRED', 409],
    ['NO_APPROVED_APPLICANTS', 'E409_NO_APPROVED_APPLICANT', 409],
    ['COURSE_NOT_DRAFT', 'E409_COURSE_CONFIRMED', 409],
    ['COURSE_NOT_READY', 'E409_COURSE_NOT_READY', 409],
    ['COUPON_ALREADY_USED', 'E409_ALREADY_USED', 409],
    ['COUPON_DAILY_LIMIT', 'E409_DAILY_LIMIT', 409],
    ['STORE_ALREADY_LINKED', 'E409_STORE_UNAVAILABLE', 409],
    ['STORE_LIMIT', 'E409_STORE_UNAVAILABLE', 409],
    ['REVIEW_DUPLICATE', 'E409_ALREADY_REVIEWED', 409],
    ['COUPON_EXPIRED', 'E410_EXPIRED', 410],
    ['CONSENT_LINK_EXPIRED', 'E410_EXPIRED', 410],
    ['BIZ_MISMATCH', 'E422_BUSINESS_INVALID', 422],
    ['BIZ_CLOSED', 'E422_BUSINESS_INVALID', 422],
    ['COURSE_PARTNER_REQUIRED', 'E422_PARTNER_REQUIRED', 422],
    ['AI_FAILED', 'E502_AI_FAILED', 502],
    ['UNKNOWN', 'E500', 500],
  ];

  it.each(TABLE)('%s → %s · %i (받은 상태와 무관)', (code, wantCode, wantStatus) => {
    // 받은 상태가 달라도 표의 상태가 이긴다.
    expect(toBackendError(code, 418)).toEqual({ code: wantCode, status: wantStatus });
    expect(toBackendError(code, wantStatus)).toEqual({ code: wantCode, status: wantStatus });
  });

  it('표에 없는 ErrorCode는 모두 확장 코드 E{받은 상태}_{이름}이다', () => {
    const listed = new Set(TABLE.map(([c]) => c));
    for (const c of Object.keys(ERROR_CODES) as ErrorCode[]) {
      if (listed.has(c)) continue;
      expect(toBackendError(c, 422), c).toEqual({ code: `E422_${c}`, status: 422 });
    }
  });

  it('표에 없는 코드는 E{받은 상태}_{ErrorCode} 확장 코드', () => {
    expect(toBackendError('COUPON_NOT_YET', 409)).toEqual({
      code: 'E409_COUPON_NOT_YET',
      status: 409,
    });
    expect(toBackendError('FILE_TYPE', 400)).toEqual({ code: 'E400_FILE_TYPE', status: 400 });
  });

  it('역표가 바꾸는 상태 3가지', () => {
    expect(toBackendError('GUIDE_PROFILE_REQUIRED', 403).status).toBe(409);
    expect(toBackendError('COURSE_NOT_READY', 404).status).toBe(409);
    expect(toBackendError('COUPON_EXPIRED', 409).status).toBe(410);
  });

  it('상태가 정해진 코드들', () => {
    expect(toBackendError('UNAUTHORIZED', 401)).toEqual({ code: 'E401', status: 401 });
    expect(toBackendError('INVALID_CREDENTIALS', 401).code).toBe('E401_INVALID_CREDENTIALS');
    expect(toBackendError('NOT_VERIFIED', 403).code).toBe('E403_VERIFICATION_REQUIRED');
    expect(toBackendError('BIZ_MISMATCH', 422)).toEqual({
      code: 'E422_BUSINESS_INVALID',
      status: 422,
    });
    expect(toBackendError('COURSE_PARTNER_REQUIRED', 422)).toEqual({
      code: 'E422_PARTNER_REQUIRED',
      status: 422,
    });
    expect(toBackendError('AI_FAILED', 502)).toEqual({ code: 'E502_AI_FAILED', status: 502 });
    expect(toBackendError('UNKNOWN', 500)).toEqual({ code: 'E500', status: 500 });
    expect(toBackendError('NOT_FOUND', 404)).toEqual({ code: 'E404', status: 404 });
  });
});
