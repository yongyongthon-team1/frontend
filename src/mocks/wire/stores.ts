import type { WireNearbyStore } from '@/features/courses/wire';
import type { WireMyStore } from '@/features/stores/wire';
import { computePartnershipState } from '@/features/stores/model';
import type { DB, StoreRow } from '@/mocks/db/schema';
import { partnershipOn } from '@/mocks/rules/courses';
import { seoulDateKey } from '@/shared/lib/date';
import { latestReviewSummary } from './reviews';

// 가게 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toMyStore`의 자리(2C-R26).

/**
 * S-01 보완 `GET /users/me/store`의 데이터. 가게당 "지금 쓰는 제휴" 1건: 지금 운영 중인 것(ACTIVE)이 먼저, 그다음 예정(SCHEDULED),
 * 끝난 것(ENDED). 같은 상태 안에서는 종료일이 늦은 것이 먼저(예정은 시작일이 이른 것이 먼저), 그래도 같으면 id가 큰
 * 것(나중에 등록한 것)이다. 상태는 오늘(서울)과 기간으로 가른다.
 */
export function toWireMyStore(db: DB, store: StoreRow, now: Date): WireMyStore {
  const rank = { ACTIVE: 0, SCHEDULED: 1, ENDED: 2 } as const;
  const [current] = db.partnerships
    .filter((p) => p.storeId === store.id)
    .map((p) => ({ p, state: computePartnershipState(p, now) }))
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        (a.state === 'SCHEDULED'
          ? a.p.startDate.localeCompare(b.p.startDate)
          : b.p.endDate.localeCompare(a.p.endDate)) ||
        b.p.id - a.p.id,
    );
  return {
    storeId: store.id,
    name: store.name,
    address: store.address,
    category: store.category,
    partnership: current
      ? {
          discountText: current.p.discountDescription,
          startDate: current.p.startDate,
          endDate: current.p.endDate,
        }
      : null,
  };
}

/**
 * S-02 항목. `isPartner`는 오늘(서울) 유효한 제휴가 있는지(9절 38번), `reviewSummary`는 가장 최근 AI 요약(없으면 null)이다.
 * 거리 칸은 명세에 없다.
 */
export function toWireNearbyStore(db: DB, store: StoreRow, now: Date): WireNearbyStore {
  return {
    storeId: store.id,
    name: store.name,
    category: store.category,
    address: store.address,
    lat: store.latitude,
    lng: store.longitude,
    isPartner: partnershipOn(db, store.id, seoulDateKey(now)) !== undefined,
    reviewSummary: latestReviewSummary(db, store.id)?.summary ?? null,
  };
}
