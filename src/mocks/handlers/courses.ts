import { http } from 'msw';
import type { SpotInput } from '@/features/courses/wire';
import { mockNow } from '@/mocks/clock';
import type { DB } from '@/mocks/db/schema';
import { getDb, mutate } from '@/mocks/db/store';
import { delayAi, delayBase } from '@/mocks/latency';
import {
  canViewCourse,
  confirmCourse,
  createDraft,
  isCourseAudience,
  replaceSpots,
} from '@/mocks/rules/courses';
import { MockApiError } from '@/mocks/rules/errors';
import { toWireCourse } from '@/mocks/wire/courses';
import { ok, withWire } from '@/mocks/wire/envelope';
import { api, readBody, requireUser } from './util';

// 백엔드 C. 코스(C-01~04). 초안 · 수정 응답은 바뀐 뒤의 전체 코스(`toWireCourse`), 확정 응답은 상태와 발급 쿠폰 수다.
// 초안 생성은 AI 흉내라 AI 지연을 쓴다. 코스를 바꾸는 요청은 가이드(UNIVERSITY) 본인 탐방만 된다(규칙이 검사한다).

/** 가이드 본인 탐방의 코스를 규칙으로 고치고 바뀐 코스의 와이어를 돌려준다. */
function editCourse(
  request: Request,
  tourParam: unknown,
  edit: (db: DB, guideId: number, tourId: number) => void,
) {
  const tourId = Number(tourParam);
  return mutate((db) => {
    const user = requireUser(request, db, 'UNIVERSITY');
    edit(db, user.id, tourId);
    return toWireCourse(db, tourId);
  });
}

export const courseHandlers = [
  // C-04(2C-R14): 그 탐방의 가이드면 초안 · 확정 코스(없으면 404), 승인된 신청자면 확정 코스만(아니면 409
  // COURSE_NOT_READY), 그 밖은 403.
  http.get(
    api('/tours/:tourId/course'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const tour = db.tours.find((t) => t.id === Number(params.tourId));
      if (!tour) throw new MockApiError(404, 'NOT_FOUND');
      if (tour.guideId !== user.id) {
        if (!isCourseAudience(db, user.id, tour.id)) throw new MockApiError(403, 'FORBIDDEN');
        if (!canViewCourse(db, user.id, tour.id)) throw new MockApiError(409, 'COURSE_NOT_READY');
      }
      return ok(toWireCourse(db, tour.id));
    }),
  ),

  // C-01. 이미 초안이 있으면 새 초안으로 바꾼다.
  http.post(
    api('/tours/:tourId/course'),
    withWire(async ({ request, params }) => {
      await delayAi();
      const now = mockNow();
      return ok(
        editCourse(request, params.tourId, (db, guideId, tourId) => {
          createDraft(db, guideId, tourId, now);
        }),
        201,
      );
    }),
  ),

  // C-02. 보낸 `spots` 전체가 새 코스다(검사는 규칙이 한다).
  http.put(
    api('/tours/:tourId/course/spots'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      return ok(
        editCourse(request, params.tourId, (db, guideId, tourId) =>
          replaceSpots(db, guideId, tourId, body.spots as SpotInput[], now),
        ),
      );
    }),
  ),

  // C-03 · S-04. 제휴 지점이 없으면 422.
  http.post(
    api('/tours/:tourId/course/confirm'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const tourId = Number(params.tourId);
      const { issuedCouponCount } = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        return confirmCourse(db, user.id, tourId, now);
      });
      return ok({ tourId, status: 'CONFIRMED', couponCount: issuedCouponCount });
    }),
  ),
];
