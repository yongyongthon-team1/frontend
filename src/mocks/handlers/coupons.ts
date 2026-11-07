import { http } from 'msw';
import { mockNow } from '@/mocks/clock';
import type { CouponRow, DB } from '@/mocks/db/schema';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { findOwnCoupon, redeemCoupon } from '@/mocks/rules/coupons';
import { toWireCoupon, toWireCouponLookup, toWireRedeem } from '@/mocks/wire/coupons';
import { ok, okItems, withWire } from '@/mocks/wire/envelope';
import { api, requireUser } from './util';

// 학생의 내 쿠폰(S-05, 쿠폰 id 오름차순)과 사장님의 코드 확인 · 사용 처리(S-06). 응답은 명세 모양 그대로이고 쿠폰 상태 · 탐방 요약 ·
// 신청 id는 어댑터가 합성한다(2C-R7). 같은 날 같은 가게 한 장 규칙(`E409_DAILY_LIMIT`)은 넣지 않는다(2C-R11).

/** 이 사용자의 신청으로 발급된 쿠폰(id 오름차순). */
function couponsOf(db: DB, userId: number): CouponRow[] {
  const mine = new Set(db.applications.filter((a) => a.userId === userId).map((a) => a.id));
  return db.coupons.filter((c) => mine.has(c.applicationId)).sort((a, b) => a.id - b.id);
}

export const couponHandlers = [
  // S-05. `tour_id` · `store_id`로 거른다(숫자가 아니면 아무것도 걸리지 않는다). 쪽 없는 목록 `{ items }`.
  http.get(
    api('/users/me/coupons'),
    withWire(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'HIGH_SCHOOL');
      const search = new URL(request.url).searchParams;
      const tourId = search.get('tour_id');
      const storeId = search.get('store_id');
      const tourIdOf = (c: CouponRow) =>
        db.applications.find((a) => a.id === c.applicationId)?.tourId;
      const coupons = couponsOf(db, user.id).filter(
        (c) =>
          (tourId === null || tourIdOf(c) === Number(tourId)) &&
          (storeId === null || c.storeId === Number(storeId)),
      );
      return okItems(coupons.map((c) => toWireCoupon(db, c)));
    }),
  ),

  // S-06 확인. 내 가게 쿠폰이면 사용 · 만료 상태여도 준다(코드 없음 404 → 다른 가게 403).
  http.get(
    api('/coupons/:couponCode'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'OWNER');
      return ok(toWireCouponLookup(db, findOwnCoupon(db, user.id, String(params.couponCode))));
    }),
  ),

  // S-06 사용 처리. 이미 사용은 409 + 확장 `data.used_at`, 만료는 410, 탐방 당일 전은 목업 확장 코드 `E409_COUPON_NOT_YET`.
  http.post(
    api('/coupons/:couponCode/redeem'),
    withWire(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const redeemed = mutate((db) => {
        const user = requireUser(request, db, 'OWNER');
        const code = String(params.couponCode);
        const { tourVisitorCount, totalVisitorCount } = redeemCoupon(db, user.id, code, now);
        return toWireRedeem(findOwnCoupon(db, user.id, code), {
          tourVisitorCount,
          totalVisitorCount,
        });
      });
      return ok(redeemed);
    }),
  ),
];
