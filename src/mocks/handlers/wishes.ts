import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { createWish, myWishes, updateWish, wishesForGuide } from '@/mocks/rules/wishes';
import { ok, okPage, withWire } from '@/mocks/wire/envelope';
import { toWireCreatedWish, toWireUpdatedWish, toWireWishItem } from '@/mocks/wire/wishes';
import { api, readBody, requireUser } from './util';

// T-01 탐방 희망 사항. 등록은 저장만 하고(AI 없음), 맞는 탐방은 `GET /tours`로 찾는다. 역할 검사는 규칙이 한다.
// 내 목록 · 수정(T-07)은 고교생, 학교 · 학과별 목록(T-08)은 인증을 마친 대학생이 쓴다.

/** 쿼리의 양의 정수(없거나 아니면 undefined). */
function intParam(search: URLSearchParams, name: string): number | undefined {
  const raw = search.get(name);
  const n = Number(raw);
  return raw !== null && Number.isInteger(n) && n >= 1 ? n : undefined;
}

export const wishHandlers = [
  http.post(
    api('/tour-wishes'),
    withWire(async ({ request }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const created = mutate((db) => {
        const user = requireUser(request, db);
        return toWireCreatedWish(
          createWish(
            db,
            user.id,
            { campusId: body.campusId, major: body.major, wish: body.wish, date: body.date },
            now,
          ),
        );
      });
      return ok(created, 201);
    }),
  ),

  // T-07 내 희망 사항(최신순).
  http.get(
    api('/users/me/tour-wishes'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'HIGH_SCHOOL');
      return okPage(
        myWishes(db, user.id).map((row) => toWireWishItem(db, row)),
        new URL(request.url).searchParams,
      );
    }),
  ),

  // T-07 수정: 보낸 칸만 고친다. 남의 글은 403, 없는 글은 404(규칙).
  http.patch(
    api('/users/me/tour-wishes/:wishId'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const body = await readBody(request);
      const now = mockNow();
      const updated = mutate((db) => {
        const user = requireUser(request, db, 'HIGH_SCHOOL');
        const patch = Object.fromEntries(
          ['campusId', 'major', 'wish', 'date']
            .filter((key) => Object.hasOwn(body, key))
            .map((key) => [key, body[key]]),
        );
        return toWireUpdatedWish(db, updateWish(db, user.id, Number(params.wishId), patch, now));
      });
      return ok(updated);
    }),
  ),

  // T-08 대학생이 보는 고교생 희망 사항(최신순). 이름 같은 개인정보는 싣지 않는다. 대학생 · 인증은 규칙이 가린다.
  http.get(
    api('/tour-wishes'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const search = new URL(request.url).searchParams;
      const rows = wishesForGuide(db, user.id, {
        campusId: intParam(search, 'campus_id'),
        major: search.get('major') ?? undefined,
      });
      return okPage(
        rows.map((row) => toWireWishItem(db, row)),
        search,
      );
    }),
  ),
];
