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
import { getTour, listTours, recommend } from './api';
import type { TourFilter } from './model';

describe('탐방 · 캠퍼스 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    configureHttp({ baseUrl: '/api', getToken: () => null, onUnauthorized: () => {} });
  });

  afterEach(() => configureHttp({ getToken: () => null }));

  it('recommend: 추천 결과', async () => {
    const r = await recommend({ q: '산업디자인을 공부하고 싶어요.' });
    expect(r.headline).toBe('디자인 분야에 관심이 많군요!');
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('listTours: 기본은 모집 중 5개(탐방 1 · 3 · 4 · 5 · 6)이고 시작 순이다', async () => {
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
      title: '경희대 국제캠퍼스 산업디자인학과 탐방',
      universityId: 2,
      endsAt: expect.stringMatching(/T16:30:00\+09:00$/),
    });
  });

  it('getTour: 승인 학생과 그 탐방의 가이드는 오픈채팅이 있고 대기 학생은 없다', async () => {
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

  it('getTour: 없는 탐방은 NOT_FOUND(404)', async () => {
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
