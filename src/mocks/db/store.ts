import { mockNow } from '@/mocks/clock';
import { seoulDateKey } from '@/shared/lib/date';
import { MOCK_DB_VERSION, type DB } from './schema';
import { createSeed, type SeedCheckpoint } from './seed';

export { MOCK_DB_VERSION };
export { nextId } from './ids';
export const MOCK_DB_KEY = 'ytt.mockdb';

let cache: DB | null = null;

function save(db: DB): void {
  try {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
  } catch {
    // 저장소를 쓸 수 없어도(비공개 창 · 용량 초과) 메모리 캐시로 계속 동작한다.
  }
}

function isUsable(value: unknown): value is DB {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<DB>;
  return (
    v.version === MOCK_DB_VERSION &&
    typeof v.nextId === 'number' &&
    Array.isArray(v.users) &&
    Array.isArray(v.universities) &&
    Array.isArray(v.tours) &&
    Array.isArray(v.sessions)
  );
}

function load(): DB | null {
  try {
    const raw = localStorage.getItem(MOCK_DB_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUsable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 메모리 캐시 → localStorage(버전 확인) → 오늘 기준 시드 순으로 DB를 얻는다.
 * 시드를 만든 날(`seedDay`)이 오늘이 아니면 어제 리허설의 DB이므로 버리고 다시 시드한다
 * (시연 탐방이 "오늘 14:00"이 아니라 지난 탐방이 되는 것을 막는다).
 */
export function getDb(): DB {
  const today = seoulDateKey(mockNow());
  if (cache && cache.seedDay === today) return cache;
  const stored = load();
  const db = stored && stored.seedDay === today ? stored : createSeed(mockNow());
  cache = db;
  save(db);
  return db;
}

/**
 * DB를 고치고 곧바로 저장한다. 트랜잭션처럼 동작한다: `fn`이 던지면 호출 전 상태로 되돌리고
 * (저장하지 않고) 다시 던진다. 규칙이 중간에 MockApiError를 던져도 반쯤 바뀐 DB가 남지 않는다.
 */
export function mutate<T>(fn: (db: DB) => T): T {
  const db = getDb();
  const snapshot = structuredClone(db);
  try {
    const result = fn(db);
    save(db);
    return result;
  } catch (error) {
    // 호출자가 쥔 db 참조도 유효하도록 같은 객체를 제자리에서 되돌린다.
    for (const key of Object.keys(db)) delete (db as unknown as Record<string, unknown>)[key];
    Object.assign(db, snapshot);
    throw error;
  }
}

/** 캐시와 localStorage를 시드로 덮어쓴다. 체크포인트(기본 START)를 주면 그 단계까지 진행한 시드다. */
export function resetDb(opts: { today?: Date; checkpoint?: SeedCheckpoint } = {}): DB {
  const db = createSeed(opts.today ?? mockNow(), opts.checkpoint);
  cache = db;
  save(db);
  return db;
}

/** 테스트 전용. 메모리 캐시만 비워 다음 `getDb()`가 localStorage를 다시 읽게 한다. */
export function clearDbCache(): void {
  cache = null;
}

export function createSession(db: DB, userId: number): string {
  let n = db.sessions.length + 1;
  while (db.sessions.some((s) => s.token === `mock-${userId}-${n}`)) n += 1;
  const token = `mock-${userId}-${n}`;
  db.sessions.push({ token, userId });
  return token;
}

export function userIdFromToken(db: DB, token: string | null): number | null {
  if (token === null) return null;
  return db.sessions.find((s) => s.token === token)?.userId ?? null;
}
