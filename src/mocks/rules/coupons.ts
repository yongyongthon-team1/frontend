import { computeCouponState, type CouponState } from '@/features/coupons/model';
import type { CouponRow, DB, TourRow } from '@/mocks/db/schema';
import { nextId } from '@/mocks/db/ids';
import { endOfSeoulDay, seoulDateKey, toSeoulIso } from '@/shared/lib/date';
import { MockApiError } from './errors';

// 쿠폰 발급 · 만료 · 조회 · 사용 규칙(S-04 · S-06). 모두 `db`를 직접 고친다(저장은 핸들러의 `mutate`).
// 검사를 모두 마친 뒤에만 행을 바꾼다 — 규칙에 걸리면 DB는 그대로다.

/** `String(Math.floor(random() * 1_000_000)).padStart(6, '0')`를 `existing`과 겹치지 않을 때까지 다시 뽑는다. */
export function generateCouponCode(
  existing: Set<string>,
  random: () => number = Math.random,
): string {
  let code: string;
  do {
    code = String(Math.floor(random() * 1_000_000)).padStart(6, '0');
  } while (existing.has(code));
  return code;
}

/**
 * 신청 하나에 쿠폰을 발급하고 새로 발급한 쿠폰만 돌려준다. 확정(CONFIRMED) 코스의 상점(STORE) 지점을
 * `stopOrder` 순서로 돌며, 탐방 날짜(서울)에 유효한 제휴가 있는 상점마다 1장씩 만든다. 같은 (신청, 상점)
 * 쿠폰이 이미 있으면 건너뛴다. 신청이 승인(APPROVED) 상태가 아니거나 코스가 확정 전이면 발급하지 않는다.
 * 코드는 시드 쿠폰을 포함한 모든 쿠폰 코드와 겹치지 않는다. 유효기간은 탐방 당일 23:59:59까지다.
 */
export function issueCouponsForApplication(db: DB, applicationId: number, now: Date): CouponRow[] {
  const app = db.applications.find((a) => a.id === applicationId);
  if (!app) throw new MockApiError(404, 'NOT_FOUND');
  const tour = db.tours.find((t) => t.id === app.tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  const course = db.courses.find((c) => c.tourId === tour.id);
  if (app.status !== 'APPROVED' || course?.status !== 'CONFIRMED') return [];

  const tourDay = seoulDateKey(tour.startsAt);
  const codes = new Set(db.coupons.map((c) => c.code));
  const storeStops = db.courseStops
    .filter((s) => s.tourId === tour.id && s.stopType === 'STORE')
    .sort((a, b) => a.stopOrder - b.stopOrder);
  const issued: CouponRow[] = [];
  for (const { storeId } of storeStops) {
    if (storeId === null) continue;
    if (db.coupons.some((c) => c.applicationId === app.id && c.storeId === storeId)) continue;
    const partnership = db.partnerships.find(
      (p) => p.storeId === storeId && p.startDate <= tourDay && tourDay <= p.endDate,
    );
    if (!partnership) continue;
    const code = generateCouponCode(codes);
    codes.add(code);
    const coupon: CouponRow = {
      id: nextId(db),
      applicationId: app.id,
      storeId,
      partnershipId: partnership.id,
      code,
      status: 'ISSUED',
      discountSnapshot: partnership.discountDescription,
      issuedAt: toSeoulIso(now),
      expiresAt: endOfSeoulDay(tourDay),
      usedAt: null,
    };
    db.coupons.push(coupon);
    issued.push(coupon);
  }
  return issued;
}

/** 신청의 발급(ISSUED) 쿠폰을 모두 만료(EXPIRED)시키고 그 수를 돌려준다. 사용한 쿠폰은 그대로 둔다. */
export function expireCouponsForApplication(db: DB, applicationId: number): number {
  let count = 0;
  for (const coupon of db.coupons) {
    if (coupon.applicationId === applicationId && coupon.status === 'ISSUED') {
      coupon.status = 'EXPIRED';
      count += 1;
    }
  }
  return count;
}

function tourOf(db: DB, coupon: CouponRow): TourRow {
  const app = db.applications.find((a) => a.id === coupon.applicationId)!;
  return db.tours.find((t) => t.id === app.tourId)!;
}

function stateOf(db: DB, coupon: CouponRow, now: Date): CouponState {
  const { status, expiresAt } = coupon;
  return computeCouponState({ status, tourStartsAt: tourOf(db, coupon).startsAt, expiresAt }, now);
}

/** 코드로 쿠폰을 찾고, 요청한 사장님 가게의 쿠폰인지 확인한다(코드 없음 404 → 다른 가게 403). */
export function findOwnCoupon(db: DB, ownerId: number, code: string): CouponRow {
  const coupon = db.coupons.find((c) => c.code === code);
  if (!coupon) throw new MockApiError(404, 'COUPON_NOT_FOUND');
  const store = db.stores.find((s) => s.ownerId === ownerId);
  if (store?.id !== coupon.storeId) throw new MockApiError(403, 'COUPON_OTHER_STORE');
  return coupon;
}

/** 사용 처리 뒤의 방문 수. 응답 모양은 `toWireRedeem`이 만든다(쿠폰 조회 모양의 출처는 `toWireCouponLookup` 하나, 2C-R26). */
interface VisitorCounts {
  tourVisitorCount: number;
  totalVisitorCount: number;
}

/**
 * 쿠폰 사용 처리. 사용 가능(USABLE)할 때만 USED와 사용 시각을 남긴다. 방문 수는 이 상점의 USED 쿠폰 수다 —
 * 이 쿠폰과 같은 탐방 것만(`tourVisitorCount`), 탐방과 상관없이 전부(`totalVisitorCount`).
 */
export function redeemCoupon(db: DB, ownerId: number, code: string, now: Date): VisitorCounts {
  const coupon = findOwnCoupon(db, ownerId, code);
  const state = stateOf(db, coupon, now);
  if (state === 'USED') {
    throw new MockApiError(409, 'COUPON_ALREADY_USED', undefined, { usedAt: coupon.usedAt });
  }
  if (state === 'EXPIRED') throw new MockApiError(409, 'COUPON_EXPIRED');
  if (state === 'BEFORE_DAY') throw new MockApiError(409, 'COUPON_NOT_YET');

  coupon.status = 'USED';
  coupon.usedAt = toSeoulIso(now);
  const tourId = tourOf(db, coupon).id;
  const used = db.coupons.filter((c) => c.storeId === coupon.storeId && c.status === 'USED');
  return {
    tourVisitorCount: used.filter((c) => tourOf(db, c).id === tourId).length,
    totalVisitorCount: used.length,
  };
}
