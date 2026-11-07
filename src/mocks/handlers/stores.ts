import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { ownerStoreOf, storeReport } from '@/mocks/rules/stores';
import { ok, withWire } from '@/mocks/wire/envelope';
import { toWireMyStore } from '@/mocks/wire/stores';
import { api, requireUser } from './util';

// 사장님의 내 가게(S-01 보완)와 방문 · 리뷰 리포트(S-07). 지금은 조회뿐이다.

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
];
