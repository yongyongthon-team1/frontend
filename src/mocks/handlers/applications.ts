import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import type { ApplicationRow } from '@/mocks/db/schema';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import {
  applyToTour,
  approveApplication,
  cancelApplication,
  rejectApplication,
} from '@/mocks/rules/applications';
import { fieldError, MockApiError } from '@/mocks/rules/errors';
import { newestFirst } from '@/mocks/rules/views';
import {
  toWireApplicant,
  toWireApplyResult,
  toWireGuideTourRow,
  toWireMyTourRow,
} from '@/mocks/wire/applications';
import { ok, okItems, okPage, withWire } from '@/mocks/wire/envelope';
import { api, byStartsAt, readBody, requireOwnTour, requireUser } from './util';

// 내 탐방(T-04)과 신청 · 승인/거절 · 취소 · 신청자 목록(A-01~04). 응답은 명세 모양 그대로이고, 탐방 요약 · 신청자 보드는
// 어댑터가 합성한다(2C-R7).

/** 신청 시각이 빠른 순(같으면 id 순). 신청자 목록의 순서다(명세 A-04). */
function oldestFirst(a: ApplicationRow, b: ApplicationRow): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
}

export const applicationHandlers = [
  // T-04. 역할마다 모양이 다르다: 고교생은 내 신청(최근 신청 먼저 · 확장 wish · created_at · coupon_count), 대학생은 내가
  // 개설한 탐방(시작 순). 그 밖의 역할은 403. `status`는 탐방 상태로 거른다.
  http.get(
    api('/users/me/tours'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const search = new URL(request.url).searchParams;
      const status = search.get('status');
      const tourStatusOk = (tourId: number) =>
        !status || db.tours.find((t) => t.id === tourId)?.status === status;
      if (user.role === 'HIGH_SCHOOL') {
        const apps = db.applications
          .filter((a) => a.userId === user.id && tourStatusOk(a.tourId))
          .sort(newestFirst);
        return okPage(
          apps.map((a) => toWireMyTourRow(db, a)),
          search,
        );
      }
      if (user.role === 'UNIVERSITY') {
        const tours = db.tours
          .filter((t) => t.guideId === user.id && tourStatusOk(t.id))
          .sort(byStartsAt);
        return okPage(
          tours.map((t) => toWireGuideTourRow(db, t)),
          search,
        );
      }
      throw new MockApiError(403, 'FORBIDDEN');
    }),
  ),

  // A-01. 동기 문자열 검사(빈 값 · 100자, 400)는 규칙이 한다.
  http.post(
    api('/tours/:tourId/applications'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const created = mutate((db) => {
        const user = requireUser(request, db, 'HIGH_SCHOOL');
        const app = applyToTour(db, user.id, Number(params.tourId), body.wish as string, now);
        return toWireApplyResult(app);
      });
      return ok(created, 201);
    }),
  ),

  // A-03. 본인 신청만(규칙이 403 · 409를 가린다).
  http.post(
    api('/applications/:applicationId/cancel'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const canceled = mutate((db) => {
        const user = requireUser(request, db);
        const app = cancelApplication(db, user.id, Number(params.applicationId), now);
        return { applicationId: app.id, status: app.status };
      });
      return ok(canceled);
    }),
  ),

  // A-04. 가이드 본인 탐방의 신청 전부(취소 포함)를 신청 시각 순으로. `status`는 신청 상태로 거른다.
  http.get(
    api('/tours/:tourId/applications'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'UNIVERSITY');
      const tour = requireOwnTour(db, user.id, Number(params.tourId));
      const status = new URL(request.url).searchParams.get('status');
      const apps = db.applications
        .filter((a) => a.tourId === tour.id && (!status || a.status === status))
        .sort(oldestFirst);
      return okItems(apps.map((a) => toWireApplicant(db, a)));
    }),
  ),

  // A-02. 승인 수가 정원에 닿으면 탐방이 CLOSED가 되므로 바뀐 탐방 상태를 함께 준다.
  http.patch(
    api('/applications/:applicationId/decision'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const decided = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        const id = Number(params.applicationId);
        let app: ApplicationRow;
        if (body.decision === 'APPROVED') app = approveApplication(db, user.id, id, now);
        else if (body.decision === 'REJECTED') app = rejectApplication(db, user.id, id);
        else throw fieldError('decision', '승인 또는 거절을 골라 주세요.');
        const tour = db.tours.find((t) => t.id === app.tourId)!;
        return { applicationId: app.id, status: app.status, tourStatus: tour.status };
      });
      return ok(decided);
    }),
  ),
];
