import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import { mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { createWish } from '@/mocks/rules/wishes';
import { ok, withWire } from '@/mocks/wire/envelope';
import { toWireCreatedWish } from '@/mocks/wire/wishes';
import { api, readBody, requireUser } from './util';

// T-01 탐방 희망 사항. 등록은 저장만 하고(AI 없음), 맞는 탐방은 `GET /tours`로 찾는다. 역할 검사는 규칙이 한다.

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
];
