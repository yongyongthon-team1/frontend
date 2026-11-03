import { http, HttpResponse } from 'msw';
import { mockNow } from '@/mocks/clock';
import type { CouponRow, DB } from '@/mocks/db/schema';
import { getDb, mutate } from '@/mocks/db/store';
import { delayBase } from '@/mocks/latency';
import { lookupCoupon, redeemCoupon } from '@/mocks/rules/coupons';
import { MockApiError } from '@/mocks/rules/errors';
import { toCoupon } from '@/mocks/rules/views';
import { api, requireUser, withErrors } from './util';

// 학생의 내 쿠폰(목록은 쿠폰 id 오름차순)과 사장님의 코드 조회 · 사용 처리(S-06).

/** 이 사용자의 신청으로 발급된 쿠폰(id 오름차순). */
function couponsOf(db: DB, userId: number): CouponRow[] {
  const mine = new Set(db.applications.filter((a) => a.userId === userId).map((a) => a.id));
  return db.coupons.filter((c) => mine.has(c.applicationId)).sort((a, b) => a.id - b.id);
}

export const couponHandlers = [
  // `?applicationId=`가 있으면 그 신청의 쿠폰만(남의 신청이면 빈 목록).
  http.get(
    api('/me/coupons'),
    withErrors(async ({ request }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const applicationId = new URL(request.url).searchParams.get('applicationId') || null;
      const now = mockNow();
      const coupons = couponsOf(db, user.id).filter(
        (c) => applicationId === null || c.applicationId === Number(applicationId),
      );
      return HttpResponse.json(coupons.map((c) => toCoupon(db, c, now)));
    }),
  ),

  http.get(
    api('/me/coupons/:id'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db);
      const coupon = couponsOf(db, user.id).find((c) => c.id === Number(params.id));
      if (!coupon) throw new MockApiError(404, 'NOT_FOUND');
      return HttpResponse.json(toCoupon(db, coupon, mockNow()));
    }),
  ),

  http.get(
    api('/owner/coupons/:code'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const db = getDb();
      const user = requireUser(request, db, 'OWNER');
      return HttpResponse.json(lookupCoupon(db, user.id, String(params.code), mockNow()));
    }),
  ),

  http.post(
    api('/owner/coupons/:code/redeem'),
    withErrors(async ({ request, params }) => {
      await delayBase();
      const now = mockNow();
      const result = mutate((db) => {
        const user = requireUser(request, db, 'OWNER');
        return redeemCoupon(db, user.id, String(params.code), now);
      });
      return HttpResponse.json(result);
    }),
  ),
];
