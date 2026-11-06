import type { MyStore } from '@/features/stores/model';
import type { DB } from '@/mocks/db/schema';
import { MockApiError } from './errors';
import { toMyStore } from './views';

// 사장님의 가게 조회 규칙(조회만 — 연결 · 등록 · 제휴 설정은 MVP 2B). DB는 고치지 않는다.

/** 이 사장님의 가게(계정당 1개)와 지금 쓰는 제휴. 연결된 가게가 없으면 404 STORE_NOT_LINKED. */
export function myStoreOf(db: DB, ownerId: number, now: Date): MyStore {
  const store = db.stores.find((s) => s.ownerId === ownerId);
  if (!store) throw new MockApiError(404, 'STORE_NOT_LINKED');
  return toMyStore(db, store, now);
}
