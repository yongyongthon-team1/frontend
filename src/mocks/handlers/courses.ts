import { http, HttpResponse } from 'msw';
import { mockNow } from '@/mocks/clock';
import type { DB } from '@/mocks/db/schema';
import { getDb, mutate } from '@/mocks/db/store';
import { delayAi, delayBase } from '@/mocks/latency';
import {
  canViewCourse,
  confirmCourse,
  createDraft,
  deleteStop,
  isCourseAudience,
  reorderStops,
  updateStopDescription,
} from '@/mocks/rules/courses';
import { MockApiError } from '@/mocks/rules/errors';
import { toCourse } from '@/mocks/rules/views';
import { api, readBody, requireOwnTour, requireUser, withErrors } from './util';

// 가이드의 코스 초안 · 편집 · 확정과 학생의 확정 코스 조회(C-04). 코스를 바꾸는 API는 모두 바뀐 뒤의 전체
// `Course`를 돌려준다. 초안 생성은 AI 흉내라 AI 지연을 쓴다.

/** 가이드(UNIVERSITY) 본인 탐방의 코스를 규칙으로 고치고 바뀐 코스를 돌려준다. */
function editCourse(
  request: Request,
  tourParam: unknown,
  edit: (db: DB, guideId: number, tourId: number) => void,
) {
  const tourId = Number(tourParam);
  return mutate((db) => {
    const user = requireUser(request, db, 'UNIVERSITY');
    edit(db, user.id, tourId);
    return toCourse(db, tourId);
  });
}

export const courseHandlers = [
  // 코스가 아직 없으면 `toCourse`가 404 NOT_FOUND를 던진다(화면은 "코스 없음"으로 그린다).
  http.get(
    api('/guide/tours/:id/course'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'UNIVERSITY');
      const tour = requireOwnTour(db, user.id, Number(params.id));
      return HttpResponse.json(toCourse(db, tour.id));
    }),
  ),

  http.post(
    api('/guide/tours/:id/course/draft'),
    withErrors(async ({ request, params }) => {
      await delayAi();
      const now = mockNow();
      return HttpResponse.json(
        editCourse(request, params.id, (db, guideId, tourId) => {
          createDraft(db, guideId, tourId, now);
        }),
      );
    }),
  ),

  http.put(
    api('/guide/tours/:id/course/order'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      return HttpResponse.json(
        editCourse(request, params.id, (db, guideId, tourId) =>
          // 배열 · 숫자 검사(400 VALIDATION)는 규칙이 한다.
          reorderStops(db, guideId, tourId, body.stopIds as number[]),
        ),
      );
    }),
  ),

  http.patch(
    api('/guide/tours/:id/course/stops/:stopId'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      return HttpResponse.json(
        editCourse(request, params.id, (db, guideId, tourId) =>
          updateStopDescription(
            db,
            guideId,
            tourId,
            Number(params.stopId),
            body.description as string,
          ),
        ),
      );
    }),
  ),

  http.delete(
    api('/guide/tours/:id/course/stops/:stopId'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      return HttpResponse.json(
        editCourse(request, params.id, (db, guideId, tourId) =>
          deleteStop(db, guideId, tourId, Number(params.stopId)),
        ),
      );
    }),
  ),

  http.post(
    api('/guide/tours/:id/course/confirm'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      return HttpResponse.json(
        editCourse(request, params.id, (db, guideId, tourId) => {
          confirmCourse(db, guideId, tourId, now);
        }),
      );
    }),
  ),

  // 판정 순서: 승인된 신청자 · 그 가이드가 아니면 403 FORBIDDEN → 코스가 없거나 초안이면 404 COURSE_NOT_READY → 200.
  http.get(
    api('/tours/:id/course'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const tourId = Number(params.id);
      if (!isCourseAudience(db, user.id, tourId)) throw new MockApiError(403, 'FORBIDDEN');
      if (!canViewCourse(db, user.id, tourId)) throw new MockApiError(404, 'COURSE_NOT_READY');
      return HttpResponse.json(toCourse(db, tourId));
    }),
  ),
];
