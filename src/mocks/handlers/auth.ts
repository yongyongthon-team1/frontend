import { http, HttpResponse } from 'msw';
import type { LoginResponse } from '@/features/auth/model';
import { mockNow } from '@/mocks/clock';
import { createSession, getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { saveGuideProfile, signUp, updateStudentProfile } from '@/mocks/rules/auth';
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

  // 가입(#1, P1). 로그인 없이 부르고(`requireUser` 없음) 성공하면 바로 로그인된 응답(토큰 + Me)을 201로 준다.
  http.post(
    api('/auth/signup'),
    withErrors(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const result = mutate((db): LoginResponse => {
        const user = signUp(db, body, mockNow());
        return { token: createSession(db, user.id), me: toMe(db, user.id) };
      });
      return HttpResponse.json(result, { status: 201 });
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

  // 고교생 프로필 저장(#2, P1). 새 Me를 돌려준다.
  http.put(
    api('/me/student-profile'),
    withErrors(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const me = mutate((db) => {
        const user = requireUser(request, db, 'HIGH_SCHOOL');
        updateStudentProfile(db, user.id, body, mockNow());
        return toMe(db, user.id);
      });
      return HttpResponse.json(me);
    }),
  ),

  // 가이드 프로필 저장(#3, P1). 새 Me를 돌려준다.
  http.put(
    api('/me/guide-profile'),
    withErrors(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const me = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        saveGuideProfile(db, user.id, body, mockNow());
        return toMe(db, user.id);
      });
      return HttpResponse.json(me);
    }),
  ),
];
