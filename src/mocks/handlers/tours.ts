import { http, HttpResponse } from 'msw';
import type { RecommendationQuery } from '@/features/tours/model';
import { recommendTours } from '@/mocks/ai/recommend';
import { mockNow } from '@/mocks/clock';
import { getDb } from '@/mocks/db/store';
import { delayAi, delayBase } from '@/mocks/latency';
import { MockApiError } from '@/mocks/rules/errors';
import { toTourDetail, toTourSummary } from '@/mocks/rules/views';
import { api, byStartsAt, currentUser, readBody, withErrors } from './util';

// 추천 · 탐방 목록 · 탐방 상세는 로그인 없이도 된다. 상세는 로그인했으면 그 사람의 신청 상태와
// (승인됐으면) 오픈채팅 링크를 함께 준다.

export const tourHandlers = [
  http.post(
    api('/recommendations'),
    withErrors(async ({ request }) => {
      await delayAi();
      const query = (await readBody(request)) as unknown as RecommendationQuery;
      return HttpResponse.json(recommendTours(getDb(), query, mockNow()));
    }),
  ),

  // `?status=` · `?universityId=`는 값이 있을 때만 거른다.
  http.get(
    api('/tours'),
    withErrors(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const search = new URL(request.url).searchParams;
      const status = search.get('status') || null;
      const universityId = search.get('universityId') || null;
      const tours = db.tours
        .filter(
          (t) =>
            (status === null || t.status === status) &&
            (universityId === null || t.universityId === Number(universityId)),
        )
        .sort(byStartsAt);
      return HttpResponse.json(tours.map((t) => toTourSummary(db, t)));
    }),
  ),

  http.get(
    api('/tours/:id'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const tour = db.tours.find((t) => t.id === Number(params.id));
      if (!tour) throw new MockApiError(404, 'NOT_FOUND');
      return HttpResponse.json(toTourDetail(db, tour, currentUser(request, db)?.id ?? null));
    }),
  ),
];
