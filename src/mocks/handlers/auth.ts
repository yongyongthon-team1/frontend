import { http, HttpResponse } from 'msw';
import type { LoginResponse } from '@/features/auth/model';
import { createSession, getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { MockApiError } from '@/mocks/rules/errors';
import { toMe } from '@/mocks/rules/views';
import { api, bearerToken, readBody, requireUser, withErrors } from './util';

export const authHandlers = [
  http.post(
    api('/auth/login'),
    withErrors(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const result = mutate((db): LoginResponse => {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const user = db.users.find((u) => u.email === email);
        if (!user || user.password !== body.password) {
          throw new MockApiError(401, 'INVALID_CREDENTIALS');
        }
        return { token: createSession(db, user.id), me: toMe(db, user.id) };
      });
      return HttpResponse.json(result);
    }),
  ),

  // 세션이 없어도 204다(이미 로그아웃된 상태와 같다).
  http.post(
    api('/auth/logout'),
    withErrors(async ({ request }) => {
      await delayBase();
      const token = bearerToken(request);
      if (token !== null) {
        mutate((db) => {
          db.sessions = db.sessions.filter((s) => s.token !== token);
        });
      }
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  http.get(
    api('/me'),
    withErrors(async ({ request }) => {
      await delayBase();
      const db = getDb();
      return HttpResponse.json(toMe(db, requireUser(request, db).id));
    }),
  ),
];
