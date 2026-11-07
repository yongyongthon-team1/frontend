import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { fieldError } from '@/mocks/rules/errors';
import {
  linkStore,
  nearbyStores,
  ownerStoreOf,
  savePartnership,
  searchStores,
  storeReport,
  updateStore,
  verifyBusiness,
} from '@/mocks/rules/stores';
import { ok, okItems, okPage, withWire } from '@/mocks/wire/envelope';
import {
  toWireMyStore,
  toWireNearbyStore,
  toWirePartnershipSaved,
  toWireRegisteredStore,
  toWireStoreSearchItem,
} from '@/mocks/wire/stores';
import { api, readBody, requireUser } from './util';

// 사장님의 사업자 인증(U-07) · 상점 검색 · 가게 연결/등록 · 내 가게 조회 · 수정(S-01) · 제휴 설정(S-03), 방문 · 리뷰 리포트(S-07),
// 코스 편집의 주변 상점(S-02). 사업자 인증 ~ 제휴 설정은 사장님만(그 밖은 403).

export const storeHandlers = [
  http.post(
    api('/verifications/business'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      mutate((db) => {
        const user = requireUser(request, db, 'OWNER');
        verifyBusiness(db, user.id, body, now);
      });
      return ok({ status: 'APPROVED' });
    }),
  ),

  http.get(
    api('/stores/search'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      requireUser(request, db, 'OWNER');
      const search = new URL(request.url).searchParams;
      return okPage(searchStores(db, search.get('keyword')).map(toWireStoreSearchItem), search);
    }),
  ),

  http.post(
    api('/users/me/store'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const store = mutate((db) => {
        const user = requireUser(request, db, 'OWNER');
        return linkStore(db, user.id, body, now);
      });
      return ok(toWireRegisteredStore(store), 201);
    }),
  ),

  http.patch(
    api('/users/me/store'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const wire = mutate((db) => {
        const user = requireUser(request, db, 'OWNER');
        return toWireMyStore(db, updateStore(db, user.id, body, now), now);
      });
      return ok(wire);
    }),
  ),

  http.put(
    api('/users/me/store/partnership'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const row = mutate((db) => {
        const user = requireUser(request, db, 'OWNER');
        return savePartnership(db, user.id, body, now);
      });
      return ok(toWirePartnershipSaved(row));
    }),
  ),

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
