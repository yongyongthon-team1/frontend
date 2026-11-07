import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { cancelTour, completeTour, createTour } from '@/mocks/rules/tours';
import { ok, withWire } from '@/mocks/wire/envelope';
import { api, readBody, requireUser } from './util';

// 탐방 생애: 개설(T-03) · 완료(T-06) · 취소(T-05). 응답은 모두 `{ tour_id, status }`이고 대학생 가이드만 부른다
// (본인 탐방이 아니면 규칙이 403). 가이드 탐방 상세는 어댑터가 `GET /tours/{tourId}` + 코스로 합성한다(2B′-R2).

const statusOf = (tour: { id: number; status: string }) => ({
  tourId: tour.id,
  status: tour.status,
});

export const tourLifecycleHandlers = [
  // T-03. 학교 · 학과는 인증된 학교와 가이드 프로필에서 들어간다. 검사는 규칙이 한다.
  http.post(
    api('/tours'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const created = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        return statusOf(createTour(db, user.id, body, now));
      });
      return ok(created, 201);
    }),
  ),

  // T-06. 탐방 날짜(당일 포함) 이후에만.
  http.post(
    api('/tours/:tourId/complete'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const done = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        return statusOf(completeTour(db, user.id, Number(params.tourId), now));
      });
      return ok(done);
    }),
  ),

  // T-05. 신청자 전원의 신청과 발급된 쿠폰이 함께 정리된다.
  http.post(
    api('/tours/:tourId/cancel'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const canceled = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        return statusOf(cancelTour(db, user.id, Number(params.tourId), now));
      });
      return ok(canceled);
    }),
  ),
];
