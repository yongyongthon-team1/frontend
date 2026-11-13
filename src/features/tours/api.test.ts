import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { login } from '@/features/auth/api';
import { getInsight, listCampuses } from '@/features/campuses/api';
import { getDb, resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { toWireTourItem } from '@/mocks/wire/tours';
import { seoulDateKey } from '@/shared/lib/date';
import { ApiError, configureHttp } from '@/shared/lib/http';
import { wirePage } from '@/test/wire';
import { findWishTours, getTour, listTours } from './api';
import type { TourFilter, WishToursResult } from './model';
import type { WishSearch } from './wishSearch';

describe('투어 · 캠퍼스 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    configureHttp({ baseUrl: '/api', getToken: () => null, onUnauthorized: () => {} });
  });

  afterEach(() => configureHttp({ getToken: () => null }));

  describe('findWishTours (T-01 투어 찾기, 2C-R16 · R17)', () => {
    const search = (s: Partial<WishSearch>): WishSearch => ({
      universityId: 2,
      major: '산업디자인',
      wish: '작업실을 구경하고 싶어요.',
      date: null,
      ...s,
    });
    const ids = (r: { tours: { id: number }[] }) => r.tours.map((t) => t.id);
    /** 이 콜백을 도는 동안 나간 `GET /api/tours`의 검색 파라미터(키 순서대로). */
    async function tourQueries(run: () => Promise<unknown>): Promise<Record<string, string>[]> {
      const seen: Record<string, string>[] = [];
      server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/api/tours') {
          seen.push(Object.fromEntries(url.searchParams));
        }
      });
      await run();
      server.events.removeAllListeners('request:start');
      return seen;
    }

    it('학교 · 학과에 맞는 모집 중 투어를 날짜 빠른 순으로(대체 아님)', async () => {
      const campuses = await listCampuses();
      let result: WishToursResult | undefined;
      const queries = await tourQueries(async () => {
        result = await findWishTours(search({}), campuses);
      });
      expect(ids(result!)).toEqual([1, 6]);
      expect(result!.fallback).toBe(false);
      expect(queries).toEqual([
        { status: 'RECRUITING', campus_id: '2', major: '산업디자인', page: '1', size: '50' },
      ]);
    });

    it('학과에 맞는 투어가 없으면 같은 학교 모집 중 투어(대체) — 대체 조회는 학과 · 날짜를 뺀다', async () => {
      const campuses = await listCampuses();
      let result: WishToursResult | undefined;
      const queries = await tourQueries(async () => {
        result = await findWishTours(search({ major: '기계공학', date: '2026-01-01' }), campuses);
      });
      expect(ids(result!)).toEqual([1, 6]);
      expect(result!.fallback).toBe(true);
      expect(queries).toEqual([
        {
          status: 'RECRUITING',
          campus_id: '2',
          major: '기계공학',
          date_from: '2026-01-01',
          page: '1',
          size: '50',
        },
        { status: 'RECRUITING', campus_id: '2', page: '1', size: '50' },
      ]);
    });

    it('희망 날짜가 있으면 그날 이후(date_from)', async () => {
      const campuses = await listCampuses();
      const sixDay = seoulDateKey(getDb().tours.find((t) => t.id === 6)!.startsAt);
      const result = await findWishTours(search({ date: sixDay }), campuses);
      expect(ids(result)).toEqual([6]);
      expect(result.fallback).toBe(false);
    });

    it('같은 학교에도 모집 중 투어가 없으면 빈 목록(대체) — 단국대는 마감 투어뿐', async () => {
      const campuses = await listCampuses();
      expect(await findWishTours(search({ universityId: 3, major: '디자인' }), campuses)).toEqual({
        tours: [],
        fallback: true,
      });
    });
  });

  it('listTours: 기본은 모집 중 5개(투어 1 · 3 · 4 · 5 · 6)이고 시작 순이다', async () => {
    const campuses = await listCampuses();
    const tours = await listTours({}, campuses);
    expect(tours.map((t) => t.id)).toEqual([1, 3, 4, 5, 6]);
    expect(tours.every((t) => t.status === 'RECRUITING')).toBe(true);
    const starts = tours.map((t) => Date.parse(t.startsAt));
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
    expect(tours[0]).toMatchObject({ universityId: 2, universityShortName: '경희대' });
  });

  it('listTours: 상태 · 학교 · 학과 · 날짜로 거른다', async () => {
    const campuses = await listCampuses();
    const ids = async (filter: TourFilter) => (await listTours(filter, campuses)).map((t) => t.id);
    expect(await ids({ status: 'CLOSED' })).toEqual([2]);
    expect(await ids({ universityId: 2, major: '산업디자인' })).toEqual([1, 6]);
    const sixDay = seoulDateKey(getDb().tours.find((t) => t.id === 6)!.startsAt);
    expect(await ids({ universityId: 2, dateFrom: sixDay })).toEqual([6]);
    expect(await ids({ universityId: 2, dateTo: sixDay })).toEqual([1, 6]);
  });

  it('listTours: 한 쪽(50개)을 넘으면 다음 쪽을 이어 받는다', async () => {
    const campuses = await listCampuses();
    const wireItem = toWireTourItem(getDb(), getDb().tours[0]);
    const item = (id: number) => ({ ...wireItem, tourId: id });
    const pages: number[] = [];
    server.use(
      http.get('/api/tours', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        pages.push(page);
        const items = page === 1 ? Array.from({ length: 50 }, (_, i) => item(i + 1)) : [item(51)];
        return wirePage(items, { page, size: 50, total: 51 });
      }),
    );
    const tours = await listTours({}, campuses);
    expect(tours).toHaveLength(51);
    expect(pages).toEqual([1, 2]);
  });

  it('getTour: 상세는 학교 이름을 조인한 제목을 준다', async () => {
    const campuses = await listCampuses();
    expect(await getTour(1, campuses)).toMatchObject({
      id: 1,
      title: '경희대 국제캠퍼스 산업디자인학과 투어',
      universityId: 2,
      endsAt: expect.stringMatching(/T16:30:00\+09:00$/),
    });
  });

  it('getTour: 승인 학생과 그 투어의 가이드는 오픈채팅이 있고 대기 학생은 없다', async () => {
    const campuses = await listCampuses();
    for (const [email, hasChat] of [
      ['seojun@demo.kr', true],
      ['guide@demo.kr', true],
      ['yujin@demo.kr', false],
    ] as const) {
      const { token } = await login({ email, password: 'demo1234' });
      configureHttp({ getToken: () => token });
      const tour = await getTour(1, campuses);
      expect(tour.openChatUrl !== null).toBe(hasChat);
    }
  });

  it('getTour: 없는 투어는 NOT_FOUND(404)', async () => {
    const campuses = await listCampuses();
    await expect(getTour(99999, campuses)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    await expect(getTour(99999, campuses)).rejects.toBeInstanceOf(ApiError);
  });

  it('listCampuses · getInsight', async () => {
    const universities = await listCampuses();
    expect(universities).toHaveLength(5);
    expect((await getInsight(universities[0].id)).universityId).toBe(universities[0].id);
  });
});
