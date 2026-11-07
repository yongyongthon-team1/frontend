import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { decideVerification, findVerification, listVerifications } from '@/mocks/rules/admin';
import { MockApiError } from '@/mocks/rules/errors';
import { toWireAdminDetail, toWireAdminItem } from '@/mocks/wire/admin';
import { ok, okPage, withWire } from '@/mocks/wire/envelope';
import { api, readBody, requireUser } from './util';

// 운영자 인증 심사(U-08): 목록 · 상세 · 승인/반려. 셋 모두 운영자만 부른다.

/** 경로의 `verificationId`. 숫자가 아니면 없는 요청(404)이다. */
function idOf(params: Record<string, string | readonly string[] | undefined>): number {
  const raw = String(params.verificationId ?? '');
  if (!/^[1-9]\d*$/.test(raw)) throw new MockApiError(404, 'NOT_FOUND');
  return Number(raw);
}

export const adminHandlers = [
  http.get(
    api('/admin/verifications'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      requireUser(request, db, 'ADMIN');
      const search = new URL(request.url).searchParams;
      const rows = listVerifications(db, search.get('status'));
      return okPage(
        rows.map((row) => toWireAdminItem(db, row)),
        search,
      );
    }),
  ),

  http.get(
    api('/admin/verifications/:verificationId'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      requireUser(request, db, 'ADMIN');
      return ok(toWireAdminDetail(db, findVerification(db, idOf(params))));
    }),
  ),

  http.patch(
    api('/admin/verifications/:verificationId'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const row = mutate((db) => {
        const admin = requireUser(request, db, 'ADMIN');
        return decideVerification(db, admin.id, idOf(params), body, now);
      });
      return ok({ verificationId: row.id, status: row.status, reviewedAt: row.reviewedAt });
    }),
  ),
];
