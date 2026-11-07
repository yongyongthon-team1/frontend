import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { createReview } from '@/mocks/rules/reviews';
import { ok, withWire } from '@/mocks/wire/envelope';
import { toWireCreatedReview, toWireStoreReviews } from '@/mocks/wire/reviews';
import { api, readBody, requireUser } from './util';

// 상점 리뷰 · 요약 조회(R-02, 로그인한 누구나)와 리뷰 작성(R-01, 고교생). 요약은 저장할 때 목업이 바로 다시 만든다(2B′-R18).

const storeIdOf = (params: Record<string, string | readonly string[] | undefined>) =>
  Number(params.storeId);

export const reviewHandlers = [
  http.get(
    api('/stores/:storeId/reviews'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      requireUser(request, db);
      return ok(toWireStoreReviews(db, storeIdOf(params), new URL(request.url).searchParams));
    }),
  ),

  http.post(
    api('/stores/:storeId/reviews'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const row = mutate((db) => {
        const user = requireUser(request, db, 'HIGH_SCHOOL');
        return createReview(db, user.id, storeIdOf(params), body, now);
      });
      return ok(toWireCreatedReview(row), 201);
    }),
  ),
];
