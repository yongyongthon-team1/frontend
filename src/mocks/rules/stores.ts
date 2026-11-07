import { fromWireMyStore } from '@/features/stores/wire';
import type { MyStore } from '@/features/stores/model';
import type { DB, StoreRow } from '@/mocks/db/schema';
import { toWireMyStore } from '@/mocks/wire/stores';
import { MockApiError } from './errors';

// 사장님의 가게 조회 규칙(조회만 — 연결 · 등록 · 제휴 설정은 MVP 2B). DB는 고치지 않는다.

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
