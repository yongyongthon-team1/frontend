import { http, HttpResponse } from 'msw';
import type { RecommendationQuery } from '@/features/tours/model';
import { recommendTours } from '@/mocks/ai/recommend';
import { mockNow } from '@/mocks/clock';
import type { TourRow } from '@/mocks/db/schema';
import { getDb } from '@/mocks/db/store';
import { delayAi, delayBase } from '@/mocks/latency';
import { MockApiError } from '@/mocks/rules/errors';
import { ok, okPage, withWire } from '@/mocks/wire/envelope';
import { toWireTourDetail, toWireTourItem } from '@/mocks/wire/tours';
import { seoulDateKey } from '@/shared/lib/date';
import { api, byStartsAt, currentUser, readBody, withErrors } from './util';

// 추천 · 탐방 목록 · 탐방 상세는 로그인 없이도 된다(2C-R10, 토큰은 있으면 쓴다).

export const tourHandlers = [
  http.post(
    api('/recommendations'),
    withErrors(async ({ request }) => {
      await delayAi();
      const query = (await readBody(request)) as unknown as RecommendationQuery;
      return HttpResponse.json(recommendTours(getDb(), query, mockNow()));
    }),
  ),

  // T-01 보완. 기본은 모집 중이고 시작 순이다. `major`는 가이드 프로필 학과의 부분 일치, 날짜는 서울 날짜다.
  http.get(
    api('/tours'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const search = new URL(request.url).searchParams;
      const status = search.get('status') || 'RECRUITING';
      const campusId = search.get('campus_id');
      const major = search.get('major');
      const dateFrom = search.get('date_from');
      const dateTo = search.get('date_to');
      const majorOf = (t: TourRow) => db.guideProfiles.find((g) => g.id === t.guideId)?.major ?? '';
      const tours = db.tours
        .filter((t) => {
          const day = seoulDateKey(t.startsAt);
          return (
            t.status === status &&
            (!campusId || t.universityId === Number(campusId)) &&
            (!major || majorOf(t).includes(major)) &&
            (!dateFrom || day >= dateFrom) &&
            (!dateTo || day <= dateTo)
          );
        })
        .sort(byStartsAt);
      return okPage(
        tours.map((t) => toWireTourItem(db, t)),
        search,
      );
    }),
  ),

  // T-02. 로그인했으면 그 사람의 신청 상태와 (승인된 신청자 · 그 탐방의 가이드에게) 오픈채팅 링크를 함께 준다.
  http.get(
    api('/tours/:tourId'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const tour = db.tours.find((t) => t.id === Number(params.tourId));
      if (!tour) throw new MockApiError(404, 'NOT_FOUND');
      return ok(toWireTourDetail(db, tour, currentUser(request, db)?.id ?? null));
    }),
  ),
];
