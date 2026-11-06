import { http, HttpResponse } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { myStoreOf } from '@/mocks/rules/stores';
import { api, requireUser, withErrors } from './util';

// 사장님의 내 가게(P1). 지금은 조회(#26)뿐이다.

export const storeHandlers = [
  http.get(
    api('/owner/store'),
    withErrors(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'OWNER');
      return HttpResponse.json(myStoreOf(db, user.id, mockNow()));
    }),
  ),
];
