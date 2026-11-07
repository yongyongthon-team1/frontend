import { listMyTourRows } from '@/features/applications/api';
import type { WireMyTourRow } from '@/features/applications/wire';
import { getMyStore } from '@/features/stores/api';
import { getTour, type CampusesInput } from '@/features/tours/api';
import type { TourSummary } from '@/features/tours/model';
import { summaryOf } from '@/features/tours/wire';
import { errorMessage } from '@/shared/lib/errors';
import { ApiError, listAll, request, withQuery } from '@/shared/lib/http';
import type { Coupon, CouponLookup, RedeemResult } from './model';
import {
  fromWireCoupon,
  fromWireLookup,
  type WireCoupon,
  type WireCouponLookup,
  type WireRedeem,
} from './wire';

// 학생의 내 쿠폰(S-05)과 사장님의 코드 확인 · 사용 처리(S-06). 응답에 쿠폰 상태 · 탐방 요약 · 신청 id가 없어 어댑터가 합성한다
// (2C-R7): 상태는 `computeCouponState`(어댑터의 지금 시각), 탐방 요약은 `GET /tours/{tourId}`, 신청 id는 내 탐방 행(2C-R27).
// 쿠폰 단건 경로가 없어 단건 보기도 목록에서 찾는다. `campuses`는 배열이나 아직 받는 중인 약속을 받는다(errata G13).

const couponNotFound = { E404: 'COUPON_NOT_FOUND' } as const;
const couponPath = (code: string) => `/coupons/${encodeURIComponent(code)}`;

/**
 * S-05 `GET /users/me/coupons`의 와이어 항목 전부(`tour_id` · `store_id`로 좁힌다). 신청 합성이 탐방별 쿠폰 수를 셀 때 쓴다
 * (확장 `coupon_count`가 없는 실서버, 2C-R8).
 */
export function listMyCouponRows(
  query: { tourId?: number; storeId?: number } = {},
): Promise<WireCoupon[]> {
  return listAll<WireCoupon>(
    withQuery('/users/me/coupons', { tour_id: query.tourId, store_id: query.storeId }),
  );
}

/** 쿠폰의 신청 id(2C-R27): 내 탐방 행 중 같은 `tour_id`의 승인된 신청, 없으면 id가 가장 큰 것. 행이 없으면 undefined. */
function applicationIdOf(rows: WireMyTourRow[], tourId: number): number | undefined {
  const sameTour = rows.filter((r) => r.tourId === tourId);
  const approved = sameTour.filter((r) => r.applicationStatus === 'APPROVED');
  const pool = approved.length > 0 ? approved : sameTour;
  return pool.length > 0 ? Math.max(...pool.map((r) => r.applicationId)) : undefined;
}

/**
 * 쿠폰 항목마다 신청 id(내 탐방 행)와 탐방 요약(탐방당 한 번 `getTour`)을 붙여 id 오름차순으로 읽는다. 내 탐방 행이 없는 탐방의
 * 쿠폰은 갈 곳(신청)이 없어 뺀다.
 */
async function composeCoupons(
  coupons: WireCoupon[],
  rows: WireMyTourRow[],
  tourOf: (tourId: number) => Promise<TourSummary>,
): Promise<Coupon[]> {
  const now = new Date();
  const composed = await Promise.all(
    coupons.map(async (w) => {
      const applicationId = applicationIdOf(rows, w.tourId);
      if (applicationId === undefined) return null;
      return fromWireCoupon(w, { applicationId, tour: await tourOf(w.tourId) }, now);
    }),
  );
  return composed.filter((c): c is Coupon => c !== null).sort((a, b) => a.id - b.id);
}

/** 같은 탐방 id를 한 번만 부르는 불러오기. */
function summaryLoader(campuses: CampusesInput) {
  const started = new Map<number, Promise<TourSummary>>();
  return (tourId: number) => {
    let pending = started.get(tourId);
    if (pending === undefined) {
      pending = getTour(tourId, campuses).then(summaryOf);
      started.set(tourId, pending);
    }
    return pending;
  };
}

/**
 * 내 쿠폰(id 오름차순). `applicationId`를 주면 그 신청의 쿠폰만이다 — 내 탐방 행에서 그 신청의 `tourId`를 찾아
 * `tour_id`로 좁혀 부르고(탐방 상세는 쿠폰과 함께), 쿠폰의 신청이 그 신청이 아니거나(같은 탐방의 다른 신청) 없는 신청이면 빈 목록이다.
 */
export async function getMyCoupons(
  applicationId: number | undefined,
  campuses: CampusesInput,
): Promise<Coupon[]> {
  const tourOf = summaryLoader(campuses);
  if (applicationId === undefined) {
    const [coupons, rows] = await Promise.all([listMyCouponRows(), listMyTourRows()]);
    return composeCoupons(coupons, rows, tourOf);
  }
  const rows = await listMyTourRows();
  const row = rows.find((r) => r.applicationId === applicationId);
  if (row === undefined) return [];
  const [coupons] = await Promise.all([
    listMyCouponRows({ tourId: row.tourId }),
    tourOf(row.tourId),
  ]);
  return (await composeCoupons(coupons, rows, tourOf)).filter(
    (c) => c.applicationId === applicationId,
  );
}

/** 내 쿠폰 하나(목록에서 찾는다). 내 쿠폰에 없으면(남의 쿠폰 · 없는 쿠폰) 404 NOT_FOUND. */
export async function getMyCoupon(id: number, campuses: CampusesInput): Promise<Coupon> {
  const coupon = (await getMyCoupons(undefined, campuses)).find((c) => c.id === id);
  if (coupon === undefined) throw new ApiError(404, 'NOT_FOUND', errorMessage('NOT_FOUND'));
  return coupon;
}

/** S-06 코드 확인의 와이어 응답과 내 가게 이름(함께 부른다). 확인 오류가 가게 오류보다 먼저 보인다. */
async function fetchLookup(code: string): Promise<{ wire: WireCouponLookup; storeName: string }> {
  const store = getMyStore();
  store.catch(() => undefined); // 확인이 먼저 실패해도 처리되지 않은 거부가 되지 않게
  const wire = await request<WireCouponLookup>(couponPath(code), { errorMap: couponNotFound });
  return { wire, storeName: (await store)?.name ?? '' };
}

/** 사장님의 코드 확인. 다른 가게 쿠폰은 403 `COUPON_OTHER_STORE`, 없는 코드는 404 `COUPON_NOT_FOUND`. */
export async function getCouponLookup(code: string): Promise<CouponLookup> {
  const { wire, storeName } = await fetchLookup(code);
  return fromWireLookup(wire, storeName, new Date());
}

/**
 * 사용 처리. 응답은 쿠폰 id · 상태 · 사용 시각뿐이라 코드를 다시 확인해 카드 정보를 얻고, 방금 받은 상태 · 사용 시각을 덮는다.
 * 방문 수는 확장이 없으면(실서버) null이다 — 화면이 캡션을 숨긴다(2C-R12 ⑤).
 */
export async function postRedeem(code: string): Promise<RedeemResult> {
  const redeemed = await request<WireRedeem>(`${couponPath(code)}/redeem`, {
    method: 'POST',
    errorMap: couponNotFound,
  });
  const { wire, storeName } = await fetchLookup(code);
  return {
    coupon: fromWireLookup(
      { ...wire, status: redeemed.status, usedAt: redeemed.usedAt },
      storeName,
      new Date(),
    ),
    tourVisitorCount: redeemed.tourVisitorCount ?? null,
    totalVisitorCount: redeemed.totalVisitorCount ?? null,
  };
}
