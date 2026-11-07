import { http } from 'msw';
import { getDb } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { MockApiError } from '@/mocks/rules/errors';
import { toWireCampus, toWireInsight } from '@/mocks/wire/campuses';
import { ok, okItems, withWire } from '@/mocks/wire/envelope';
import { api } from './util';

export const campusHandlers = [
  // D-01. 로그인 없이 부른다.
  http.get(
    api('/campuses'),
    withWire(async () => {
      await delayBase();
      const db = getDb();
      const list = [...db.universities].sort((a, b) => a.id - b.id);
      return okItems(list.map((u) => toWireCampus(db, u)));
    }),
  ),

  // 목업 전용 확장(2C-R8). 코스 편집의 방학 상권 인사이트 카드.
  http.get(
    api('/campuses/:campusId/insight'),
    withWire(async ({ params }) => {
      await delayBase();
      const university = getDb().universities.find((u) => u.id === Number(params.campusId));
      if (!university) throw new MockApiError(404, 'NOT_FOUND');
      return ok(toWireInsight(university));
    }),
  ),
];
