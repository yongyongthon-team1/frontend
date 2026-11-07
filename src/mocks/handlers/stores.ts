import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { fieldError } from '@/mocks/rules/errors';
import { nearbyStores, ownerStoreOf, storeReport } from '@/mocks/rules/stores';
import { ok, okItems, withWire } from '@/mocks/wire/envelope';
import { toWireMyStore, toWireNearbyStore } from '@/mocks/wire/stores';
import { api, requireUser } from './util';

// 사장님의 내 가게(S-01 보완)와 방문 · 리뷰 리포트(S-07), 코스 편집의 주변 상점(S-02). 지금은 조회뿐이다.

export const storeHandlers = [
  http.get(
    api('/users/me/store'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'OWNER');
      return ok(toWireMyStore(db, ownerStoreOf(db, user.id), mockNow()));
    }),
  ),

  http.get(
    api('/users/me/store/report'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'OWNER');
      const search = new URL(request.url).searchParams;
      return ok(
        storeReport(db, user.id, { from: search.get('from'), to: search.get('to') }, mockNow()),
      );
    }),
  ),

  // S-02. 로그인한 누구나(역할 제한 없음). `campus_id`는 양의 정수여야 하고, `category`가 있으면 같은 업종만 돌려준다.
  http.get(
    api('/stores/nearby'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      requireUser(request, db);
      const search = new URL(request.url).searchParams;
      const raw = search.get('campus_id');
      const campusId = Number(raw);
      if (raw === null || !Number.isInteger(campusId) || campusId < 1) {
        throw fieldError('campusId', '캠퍼스를 골라 주세요.');
      }
      const now = mockNow();
      return okItems(
        nearbyStores(db, campusId, search.get('category')).map((s) =>
          toWireNearbyStore(db, s, now),
        ),
      );
    }),
  ),
];
