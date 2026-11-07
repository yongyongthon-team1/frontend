import type { Me } from '@/features/auth/model';
import { fromWireMe } from '@/features/auth/wire';
import { mockNow } from '@/mocks/clock';
import type { ApplicationRow, DB } from '@/mocks/db/schema';
import { toWireMe } from '@/mocks/wire/auth';

// 행 → 응답 DTO(핸들러 전용). DB는 고치지 않는다. 계약(`docs/api/frontend-needs.md` 4절)의 "서버가 계산해서 주는 값"
// (쿠폰 상태 …)을 여기서 만든다. 백엔드 와이어로 옮긴 도메인은 `mocks/wire/<도메인>.ts`의 `toWire*`가 대신한다(2C-R26 —
// 신청 · 내 탐방은 `mocks/wire/applications.ts`).

/** 최근 신청이 앞(신청 시각 내림차순, 같으면 id 내림차순). */
export function newestFirst(a: ApplicationRow, b: ApplicationRow): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
}

/**
 * 로그인한 사용자. 프로필은 역할에 맞는 것만 준다(고교생 → 학생 프로필, 대학생 → 가이드 프로필).
 * 같은 값의 출처가 둘이 되지 않게 와이어 뷰(`toWireMe`)를 어댑터(`fromWireMe`)로 읽는다(2C-R26). 내 가게 id는 가게 행의 소유자다.
 */
export function toMe(db: DB, userId: number, now: Date = mockNow()): Me {
  return fromWireMe(
    toWireMe(db, userId, now),
    db.stores.find((s) => s.ownerId === userId)?.id ?? null,
  );
}
