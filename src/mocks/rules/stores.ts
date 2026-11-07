import { fromWireMyStore } from '@/features/stores/wire';
import type { MyStore } from '@/features/stores/model';
import type { DB, StoreRow } from '@/mocks/db/schema';
import type { WireStoreReport } from '@/features/stores/wire';
import { averageRating } from '@/mocks/wire/reviews';
import { toWireMyStore } from '@/mocks/wire/stores';
import { addDaysKey, seoulDateKey } from '@/shared/lib/date';
import { fieldError, MockApiError } from './errors';

// 사장님의 가게 조회 · 리포트 규칙(조회만 — 연결 · 등록 · 제휴 설정은 MVP 2B′). DB는 고치지 않는다.

/** 이 사장님의 가게(계정당 1개). 연결된 가게가 없으면 404 STORE_NOT_LINKED. */
export function ownerStoreOf(db: DB, ownerId: number): StoreRow {
  const store = db.stores.find((s) => s.ownerId === ownerId);
  if (!store) throw new MockApiError(404, 'STORE_NOT_LINKED');
  return store;
}

/**
 * 이 사장님의 가게와 지금 쓰는 제휴(도메인 객체). 와이어 객체를 도메인으로 읽는 합성이라(2C-R26) 명세에 없는
 * 제휴 id · 조건은 0 · null이다.
 */
export function myStoreOf(db: DB, ownerId: number, now: Date): MyStore {
  return fromWireMyStore(toWireMyStore(db, ownerStoreOf(db, ownerId), now), now);
}

/** 리포트 기본 기간 일수: 오늘 −30일 ~ 오늘, 양 끝 포함(2B′-R19 — 명세는 "기본 최근 30일"만 말한다, 9절 44번). */
const REPORT_DEFAULT_DAYS = 30;

/** 실제로 있는 날의 `YYYY-MM-DD`인가(`2026-13-01`은 아니다). */
function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDaysKey(value, 0) === value;
}

/**
 * S-07 방문 · 리뷰 리포트. 순서: 가게 없음 404 → `from` · `to` 형식 → `from > to`. 기간은 `YYYY-MM-DD` 양 끝 포함(서울 날짜):
 * `visitCount` = 이 가게의 `USED` 쿠폰 중 `usedAt`이 기간 안인 수, 리뷰 수 · 평균은 `createdAt`이 기간 안인 리뷰(평균은 리뷰가 없으면 null).
 */
export function storeReport(
  db: DB,
  ownerId: number,
  query: { from: string | null; to: string | null },
  now: Date,
): WireStoreReport {
  const store = ownerStoreOf(db, ownerId);
  const today = seoulDateKey(now);
  const from = query.from ?? addDaysKey(today, -REPORT_DEFAULT_DAYS);
  const to = query.to ?? today;
  if (!isDateKey(from)) throw fieldError('from', '날짜를 다시 확인해 주세요.');
  if (!isDateKey(to)) throw fieldError('to', '날짜를 다시 확인해 주세요.');
  if (from > to) throw fieldError('to', '기간을 다시 확인해 주세요.');
  const inRange = (iso: string) => {
    const day = seoulDateKey(iso);
    return from <= day && day <= to;
  };
  const visitCount = db.coupons.filter(
    (c) => c.storeId === store.id && c.status === 'USED' && c.usedAt !== null && inRange(c.usedAt),
  ).length;
  const ratings = db.reviews
    .filter((r) => r.storeId === store.id && inRange(r.createdAt))
    .map((r) => r.rating);
  return {
    from,
    to,
    visitCount,
    reviewCount: ratings.length,
    averageRating: averageRating(ratings),
  };
}
