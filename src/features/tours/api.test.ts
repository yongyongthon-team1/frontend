import { beforeEach, describe, expect, it } from 'vitest';
import { getInsight, listUniversities } from '@/features/campuses/api';
import { ApiError, configureHttp } from '@/shared/lib/http';
import { resetDb } from '@/mocks/db/store';
import { getTour, listTours, recommend } from './api';

describe('탐방 · 캠퍼스 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
    configureHttp({ baseUrl: '/api', getToken: () => null, onUnauthorized: () => {} });
  });

  it('recommend: 추천 결과', async () => {
    const r = await recommend({ q: '산업디자인을 공부하고 싶어요.' });
    expect(r.headline).toBe('디자인 분야에 관심이 많군요!');
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('listTours: 상태 · 학교로 거른다', async () => {
    const all = await listTours({});
    const recruiting = await listTours({ status: 'RECRUITING' });
    expect(recruiting.length).toBeGreaterThan(0);
    expect(recruiting.every((t) => t.status === 'RECRUITING')).toBe(true);
    expect(recruiting.length).toBeLessThanOrEqual(all.length);
    const school = await listTours({ universityId: all[0].universityId });
    expect(school.every((t) => t.universityId === all[0].universityId)).toBe(true);
  });

  it('getTour: 상세, 없으면 404', async () => {
    const [first] = await listTours({});
    expect((await getTour(first.id)).id).toBe(first.id);
    await expect(getTour(99999)).rejects.toMatchObject({ status: 404 });
    await expect(getTour(99999)).rejects.toBeInstanceOf(ApiError);
  });

  it('listUniversities · getInsight', async () => {
    const universities = await listUniversities();
    expect(universities).toHaveLength(5);
    expect((await getInsight(universities[0].id)).universityId).toBe(universities[0].id);
  });
});
