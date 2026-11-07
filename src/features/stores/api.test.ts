import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMe } from '@/features/auth/api';
import { getDb, mutate, resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { DEMO_BUSINESS, DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import {
  BUSINESS_INVALID,
  BUSINESS_OK,
  MY_STORE,
  PARTNERSHIP_SAVED,
  STORE_REGISTERED,
  STORE_SEARCH,
  STORE_UNAVAILABLE,
} from '@/test/fixtures/backend/stores';
import { loginAs } from '@/test/loginAs';
import { errorMessage as errorMessageOf } from '@/shared/lib/errors';
import { wireFail, wireOk } from '@/test/wire';
import {
  getMyStore,
  getStoreSearch,
  patchMyStore,
  postBusinessVerification,
  postStore,
  putPartnership,
} from './api';

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

/** 이 콜백을 도는 동안 나간 `/api` 요청의 본문(JSON)을 모은다. */
async function bodiesDuring(
  run: () => Promise<unknown>,
  method: string,
  path: string,
): Promise<unknown[]> {
  const pending: Promise<string>[] = [];
  const listener = ({ request }: { request: Request }) => {
    if (request.method === method && new URL(request.url).pathname === `/api${path}`) {
      pending.push(request.clone().text());
    }
  };
  server.events.on('request:start', listener);
  try {
    await run();
  } finally {
    server.events.removeListener('request:start', listener);
  }
  return (await Promise.all(pending)).map((text) => JSON.parse(text) as unknown);
}

describe('사업자 인증 API (U-07, MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    loginAs(DEMO_EMAILS.ownerUnverified);
  });

  const match = {
    businessNumber: DEMO_BUSINESS.match.businessNumber,
    representativeName: DEMO_BUSINESS.match.representativeName,
    openedAt: DEMO_BUSINESS.match.openingDate,
  };

  it('등록 정보와 맞으면 인증된다 — 본문은 숫자만 · 공백 뗀 대표자명 · YYYY-MM-DD', async () => {
    expect((await fetchMe()).businessVerified).toBe(false);
    const bodies = await bodiesDuring(
      () => postBusinessVerification({ ...match, representativeName: ' 정해린 ' }),
      'POST',
      '/verifications/business',
    );
    expect(bodies).toEqual([
      { business_number: '1234567890', representative_name: '정해린', opened_at: '2021-03-02' },
    ]);
    expect((await fetchMe()).businessVerified).toBe(true);
  });

  it('폐업 번호는 BIZ_CLOSED, 정보가 다르면 BIZ_MISMATCH(둘 다 E422_BUSINESS_INVALID)', async () => {
    await expect(
      postBusinessVerification({ ...match, businessNumber: DEMO_BUSINESS.closed.businessNumber }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'BIZ_CLOSED',
      backendCode: 'E422_BUSINESS_INVALID',
      fieldErrors: { businessNumber: errorMessageOf('BIZ_CLOSED') },
      fieldReasons: { businessNumber: 'CLOSED' },
    });
    await expect(
      postBusinessVerification({
        businessNumber: DEMO_BUSINESS.mismatch.businessNumber,
        representativeName: DEMO_BUSINESS.match.representativeName,
        openedAt: DEMO_BUSINESS.match.openingDate,
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'BIZ_MISMATCH',
      backendCode: 'E422_BUSINESS_INVALID',
      fieldErrors: { businessNumber: errorMessageOf('BIZ_MISMATCH') },
      fieldReasons: { businessNumber: 'MISMATCH' },
    });
    expect((await fetchMe()).businessVerified).toBe(false);
  });

  it('9자리 번호는 서버의 칸 오류 문구를 그대로', async () => {
    await expect(
      postBusinessVerification({ ...match, businessNumber: '123-45-6789' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { businessNumber: '사업자등록번호 10자리를 입력해 주세요.' },
    });
  });

  it('명세 예시 응답: 성공은 값 없이, 422 MISMATCH 예시는 BIZ_MISMATCH', async () => {
    server.use(http.post('/api/verifications/business', () => wireOk(BUSINESS_OK.data)));
    await expect(postBusinessVerification(match)).resolves.toBeUndefined();
    server.use(
      http.post('/api/verifications/business', () =>
        wireFail(BUSINESS_INVALID.code, { errors: BUSINESS_INVALID.errors }),
      ),
    );
    await expect(postBusinessVerification(match)).rejects.toMatchObject({
      status: 422,
      code: 'BIZ_MISMATCH',
    });
    // 기계값이 CLOSED도 MISMATCH도 아니면 불일치로 읽는다.
    server.use(
      http.post('/api/verifications/business', () =>
        wireFail('E422_BUSINESS_INVALID', { errors: [{ field: 'business_number', reason: 'X' }] }),
      ),
    );
    await expect(postBusinessVerification(match)).rejects.toMatchObject({ code: 'BIZ_MISMATCH' });
  });

  it('422가 아닌 오류는 그대로(학생은 FORBIDDEN)', async () => {
    loginAs(DEMO_EMAILS.student);
    await expect(postBusinessVerification(match)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

describe('상점 검색 · 가게 연결 · 등록 API (S-01, MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    loginAs(DEMO_EMAILS.ownerNoStore);
  });

  it('getStoreSearch: 카페 → 이름순, 연결 여부(registered)를 함께', async () => {
    const items = await getStoreSearch('카페');
    expect(items.map((i) => [i.name, i.registered])).toEqual([
      ['보드게임 카페 다이스', true],
      ['카페 단풍', false],
      ['카페 모래시계', true],
    ]);
    expect(items[1]).toMatchObject({ storeId: expect.any(Number), category: '카페' });
  });

  it('getStoreSearch: 쿼리는 keyword(공백 뺌) · page 1 · size 20 한 쪽, 한 글자는 VALIDATION', async () => {
    const urls: string[] = [];
    const listener = ({ request }: { request: Request }) => urls.push(request.url);
    server.events.on('request:start', listener);
    try {
      await getStoreSearch(' 카페 ');
    } finally {
      server.events.removeListener('request:start', listener);
    }
    const search = urls.map((u) => new URL(u)).filter((u) => u.pathname === '/api/stores/search');
    expect(search).toHaveLength(1);
    expect(Object.fromEntries(search[0].searchParams)).toEqual({
      keyword: '카페',
      page: '1',
      size: '20',
    });
    await expect(getStoreSearch('카')).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { keyword: '검색어를 2자 이상 입력해 주세요.' },
    });
  });

  it('getStoreSearch: 명세 예시 응답을 StoreSearchItem으로', async () => {
    server.use(http.get('/api/stores/search', () => wireOk(STORE_SEARCH.data)));
    expect(await getStoreSearch('분식')).toEqual([
      {
        storeId: 201,
        name: '용인 분식',
        address: '경기 용인시 처인구 ...',
        category: '식당',
        registered: false,
      },
    ]);
  });

  it('다른 사장님이 연결한 상점(상점 1)은 STORE_ALREADY_LINKED', async () => {
    await expect(postStore({ storeId: 1 })).rejects.toMatchObject({
      status: 409,
      code: 'STORE_ALREADY_LINKED',
      backendCode: 'E409_STORE_UNAVAILABLE',
    });
    expect(await getMyStore()).toBeNull();
  });

  it('검색에서 고르면 연결되어 MyStore를 돌려주고, 다시 연결하면 STORE_LIMIT', async () => {
    const dangpung = (await getStoreSearch('단풍'))[0];
    const bodies = await bodiesDuring(
      async () => {
        expect(await postStore({ storeId: dangpung.storeId })).toMatchObject({
          id: dangpung.storeId,
          name: '카페 단풍',
          partnership: null,
        });
      },
      'POST',
      '/users/me/store',
    );
    expect(bodies).toEqual([{ store_id: dangpung.storeId }]);
    expect(await getMyStore()).toMatchObject({ name: '카페 단풍' });
    await expect(postStore({ storeId: dangpung.storeId })).rejects.toMatchObject({
      status: 409,
      code: 'STORE_LIMIT',
      backendCode: 'E409_STORE_UNAVAILABLE',
    });
  });

  it('미인증 사장님(owner-new)의 연결은 BIZ_NOT_VERIFIED(E403_VERIFICATION_REQUIRED)', async () => {
    loginAs(DEMO_EMAILS.ownerUnverified);
    await expect(postStore({ storeId: 1 })).rejects.toMatchObject({
      status: 403,
      code: 'BIZ_NOT_VERIFIED',
      backendCode: 'E403_VERIFICATION_REQUIRED',
    });
  });

  it('직접 등록은 별도 계정 상태로: 새 상점이 그 좌표 · 그 사장님으로 생긴다', async () => {
    const input = {
      name: '새 가게',
      address: '경기도 용인시 기흥구 덕영대로 1',
      category: '카페',
      latitude: 37.2397,
      longitude: 127.0833,
    };
    const bodies = await bodiesDuring(
      async () => {
        expect(await postStore(input)).toMatchObject({ name: '새 가게', category: '카페' });
      },
      'POST',
      '/users/me/store',
    );
    expect(bodies).toEqual([input]);
    const db = getDb();
    const ownerId = db.users.find((u) => u.email === DEMO_EMAILS.ownerNoStore)!.id;
    expect(db.stores.find((st) => st.name === '새 가게')).toMatchObject({
      ownerId,
      latitude: 37.2397,
      longitude: 127.0833,
    });
  });

  it('직접 등록의 칸 오류(상호명 빈 값)는 fieldErrors', async () => {
    await expect(
      postStore({ name: ' ', address: 'a', category: '카페', latitude: 1, longitude: 2 }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { name: '상호명을 입력해 주세요.' },
    });
  });

  it('명세 예시: 201 응답 뒤 내 가게를 다시 읽고, 가게가 안 읽히면 STORE_NOT_LINKED', async () => {
    server.use(
      http.post('/api/users/me/store', () => wireOk(STORE_REGISTERED.data, { status: 201 })),
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
    );
    expect(await postStore({ storeId: 201 })).toMatchObject({ id: 201, name: '용인 분식' });
    server.use(http.get('/api/users/me/store', () => wireFail('E404')));
    await expect(postStore({ storeId: 201 })).rejects.toMatchObject({
      status: 404,
      code: 'STORE_NOT_LINKED',
    });
  });

  it('명세 409 예시: 가게가 이미 있으면 STORE_LIMIT, 없으면 STORE_ALREADY_LINKED', async () => {
    server.use(
      http.post('/api/users/me/store', () =>
        wireFail(STORE_UNAVAILABLE.code, { message: STORE_UNAVAILABLE.message }),
      ),
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
    );
    await expect(postStore({ storeId: 201 })).rejects.toMatchObject({ code: 'STORE_LIMIT' });
    server.use(http.get('/api/users/me/store', () => wireFail('E404')));
    await expect(postStore({ storeId: 201 })).rejects.toMatchObject({
      code: 'STORE_ALREADY_LINKED',
    });
  });
});

describe('가게 수정 · 제휴 설정 API (S-01 · S-03, MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    loginAs(DEMO_EMAILS.owner);
  });

  it('patchMyStore: 바뀐 칸만 보내고 고친 가게를 돌려준다', async () => {
    const bodies = await bodiesDuring(
      async () => {
        expect(await patchMyStore({ address: '새 주소' })).toMatchObject({
          id: 1,
          name: '서천 밥상',
          address: '새 주소',
          partnership: { state: 'ACTIVE' },
        });
      },
      'PATCH',
      '/users/me/store',
    );
    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0] as object)).toEqual(['address']);
    expect((await getMyStore())?.address).toBe('새 주소');
  });

  it('patchMyStore: 빈 칸은 fieldErrors, 가게가 없으면 STORE_NOT_LINKED', async () => {
    await expect(patchMyStore({ name: '' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { name: '상호명을 입력해 주세요.' },
    });
    loginAs(DEMO_EMAILS.ownerNoStore);
    await expect(patchMyStore({ name: '새 이름' })).rejects.toMatchObject({
      status: 404,
      code: 'STORE_NOT_LINKED',
    });
  });

  it('putPartnership: 본문은 discount_text · start_date · end_date, 저장한 제휴를 다시 읽어 돌려준다', async () => {
    const input = { discount: '음료 500원 할인', startDate: '2027-01-01', endDate: '2027-02-28' };
    const before = getDb().partnerships.filter((p) => p.storeId === 1);
    const bodies = await bodiesDuring(
      async () => {
        const store = await putPartnership({ ...input, discount: ' 음료 500원 할인 ' });
        expect(store.partnership).toMatchObject({
          discount: '음료 500원 할인',
          startDate: '2027-01-01',
          endDate: '2027-02-28',
        });
      },
      'PUT',
      '/users/me/store/partnership',
    );
    expect(bodies).toEqual([
      { discount_text: '음료 500원 할인', start_date: '2027-01-01', end_date: '2027-02-28' },
    ]);
    // 제휴 id는 와이어에 없어 api 값(0)으로는 알 수 없다 — 저장소(DB)에서 같은 행을 고친 것을 본다.
    const after = getDb().partnerships.filter((p) => p.storeId === 1);
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].discountDescription).toBe('음료 500원 할인');
    expect(after[0].condition).toBeNull();
  });

  it('putPartnership: 종료 < 시작이면 fieldErrors.endDate, 50자 넘으면 fieldErrors.discount', async () => {
    await expect(
      putPartnership({ discount: '할인', startDate: '2027-02-01', endDate: '2027-01-01' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { endDate: '종료 날짜는 시작 날짜와 같거나 뒤여야 해요.' },
    });
    await expect(
      putPartnership({ discount: 'a'.repeat(51), startDate: '2027-01-01', endDate: '2027-02-01' }),
    ).rejects.toMatchObject({ fieldErrors: { discount: '50자 이내로 적어 주세요.' } });
  });

  it('putPartnership: 가게가 없으면 STORE_NOT_LINKED, 명세 예시 응답 뒤 내 가게를 읽는다', async () => {
    loginAs(DEMO_EMAILS.ownerNoStore);
    await expect(
      putPartnership({ discount: '할인', startDate: '2027-01-01', endDate: '2027-02-01' }),
    ).rejects.toMatchObject({ status: 404, code: 'STORE_NOT_LINKED' });
    server.use(
      http.put('/api/users/me/store/partnership', () => wireOk(PARTNERSHIP_SAVED.data)),
      http.get('/api/users/me/store', () => wireOk(MY_STORE.data)),
    );
    expect(
      (
        await putPartnership({
          discount: '음료 1,000원 할인',
          startDate: '2027-01-01',
          endDate: '2027-02-28',
        })
      ).partnership,
    ).toMatchObject({ discount: '음료 1,000원 할인' });
  });
});
