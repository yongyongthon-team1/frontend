import { http, HttpResponse } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import {
  applyToTour,
  approveApplication,
  cancelApplication,
  rejectApplication,
} from '@/mocks/rules/applications';
import { MockApiError } from '@/mocks/rules/errors';
import {
  newestFirst,
  toApplicantsBoard,
  toGuideTourSummary,
  toMyApplication,
} from '@/mocks/rules/views';
import { api, byStartsAt, readBody, requireOwnTour, requireUser, withErrors } from './util';

// 신청(고교생)과 신청자 관리(가이드). 승인 · 거절은 바뀐 뒤의 신청자 보드 전체를 돌려준다.

export const applicationHandlers = [
  http.post(
    api('/tours/:id/applications'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const dto = mutate((db) => {
        const user = requireUser(request, db, 'HIGH_SCHOOL');
        // 동기 문자열 검사(400 VALIDATION)는 규칙이 한다.
        const app = applyToTour(db, user.id, Number(params.id), body.motivation as string, now);
        return toMyApplication(db, app, now);
      });
      return HttpResponse.json(dto, { status: 201 });
    }),
  ),

  http.get(
    api('/me/applications'),
    withErrors(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const now = mockNow();
      const apps = db.applications.filter((a) => a.userId === user.id).sort(newestFirst);
      return HttpResponse.json(apps.map((a) => toMyApplication(db, a, now)));
    }),
  ),

  // 남의 신청은 내 신청 목록에 없는 것과 같다(404).
  http.get(
    api('/me/applications/:id'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const app = db.applications.find((a) => a.id === Number(params.id) && a.userId === user.id);
      if (!app) throw new MockApiError(404, 'NOT_FOUND');
      return HttpResponse.json(toMyApplication(db, app, mockNow()));
    }),
  ),

  http.post(
    api('/me/applications/:id/cancel'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const dto = mutate((db) => {
        const user = requireUser(request, db);
        const app = cancelApplication(db, user.id, Number(params.id), now);
        return toMyApplication(db, app, now);
      });
      return HttpResponse.json(dto);
    }),
  ),

  http.get(
    api('/guide/tours'),
    withErrors(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'UNIVERSITY');
      const tours = db.tours.filter((t) => t.guideId === user.id).sort(byStartsAt);
      return HttpResponse.json(tours.map((t) => toGuideTourSummary(db, t)));
    }),
  ),

  http.get(
    api('/guide/tours/:id/applicants'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'UNIVERSITY');
      const tour = requireOwnTour(db, user.id, Number(params.id));
      return HttpResponse.json(toApplicantsBoard(db, tour.id));
    }),
  ),

  http.post(
    api('/guide/applications/:id/approve'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const board = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        const app = approveApplication(db, user.id, Number(params.id), now);
        return toApplicantsBoard(db, app.tourId);
      });
      return HttpResponse.json(board);
    }),
  ),

  http.post(
    api('/guide/applications/:id/reject'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const board = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        const app = rejectApplication(db, user.id, Number(params.id));
        return toApplicantsBoard(db, app.tourId);
      });
      return HttpResponse.json(board);
    }),
  ),
];
