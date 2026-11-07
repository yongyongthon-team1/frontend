import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { createSession, getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { saveGuideProfile, signUp, updateStudentProfile } from '@/mocks/rules/auth';
import { MockApiError } from '@/mocks/rules/errors';
import { toWireLogin, toWireMe, toWireSignupResult } from '@/mocks/wire/auth';
import { ok, withWire } from '@/mocks/wire/envelope';
import { api, bearerToken, readBody, requireUser } from './util';

// 사용자 · 인증(U-01~U-04). 응답은 백엔드 봉투(`ok`)이고 본문은 snake_case다(`readBody`가 camel로 되돌려 규칙에 준다).

export const authHandlers = [
  // 로그인(U-02). 토큰과 작은 `user`만 준다 — 내 정보는 `GET /users/me`가 준다.
  http.post(
    api('/auth/login'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const data = mutate((db) => {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const user = db.users.find((u) => u.email === email);
        if (!user || user.password !== body.password) {
          throw new MockApiError(401, 'INVALID_CREDENTIALS');
        }
        return toWireLogin(db, user.id, createSession(db, user.id));
      });
      return ok(data);
    }),
  ),

  // 가입(U-01). 로그인 없이 부르고(`requireUser` 없음) 201과 만들어진 사용자만 준다(토큰 없음 — 이어서 로그인한다).
  http.post(
    api('/auth/signup'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const user = mutate((db) => signUp(db, body, mockNow()));
      return ok(toWireSignupResult(user), 201);
    }),
  ),

  // 세션이 없어도 200이다(이미 로그아웃된 상태와 같다).
  http.post(
    api('/auth/logout'),
    withWire(async ({ request }) => {
      await delayBase();
      const token = bearerToken(request);
      if (token !== null) {
        mutate((db) => {
          db.sessions = db.sessions.filter((s) => s.token !== token);
        });
      }
      return ok(null);
    }),
  ),

  http.get(
    api('/users/me'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      return ok(toWireMe(db, requireUser(request, db).id, mockNow()));
    }),
  ),

  // 응답: 명세 본문은 "GET /users/me와 같은 형태"라 하면서 예시는 다섯 칸뿐이다. 목업은 전체 `WireMe`를 주고, 클라이언트(`patchMe`)는 본문을 쓰지 않고 `fetchMe()`로 다시 읽는다.
  // 내 정보 수정(U-03). 아무 역할이나 부르고, 고교생이 아니면서 학교 · 학년 · 관심 학과를 보내면 규칙이 403을 던진다.
  http.patch(
    api('/users/me'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const data = mutate((db) => {
        const user = requireUser(request, db);
        updateStudentProfile(db, user.id, body, mockNow());
        return toWireMe(db, user.id, mockNow());
      });
      return ok(data);
    }),
  ),

  // 가이드 프로필 저장(U-04). `{ major, intro }`를 돌려준다.
  http.put(
    api('/users/me/guide-profile'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const data = mutate((db) => {
        const user = requireUser(request, db, 'UNIVERSITY');
        const row = saveGuideProfile(db, user.id, body, mockNow());
        return { major: row.major, intro: row.introduction };
      });
      return ok(data);
    }),
  ),
];
