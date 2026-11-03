import type { DB } from './schema';

// 규칙(`mocks/rules`)은 저장소가 아니라 여기서 ID를 받는다. 시드가 체크포인트를 만들 때 규칙을 부르므로,
// 규칙이 `store.ts`(→ `seed.ts`)를 import하면 순환 import가 생긴다.

/** 시드 이후 규칙이 만드는 새 행의 ID. 모든 테이블이 하나의 카운터를 쓴다. */
export function nextId(db: DB): number {
  const id = db.nextId;
  db.nextId += 1;
  return id;
}
