import { mockNow } from '@/mocks/clock';
import { MOCK_DB_VERSION, type DB } from './schema';
import { createSeed, type SeedCheckpoint } from './seed';

export { MOCK_DB_VERSION };
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

/** 메모리 캐시 → localStorage(버전 확인) → 오늘 기준 시드 순으로 DB를 얻는다. */
export function getDb(): DB {
  if (cache) return cache;
  const db = load() ?? createSeed(mockNow());
  cache = db;
  save(db);
  return db;
}

/** DB를 고치고 곧바로 저장한다. */
export function mutate<T>(fn: (db: DB) => T): T {
  const db = getDb();
  const result = fn(db);
  save(db);
  return result;
}

/** 캐시와 localStorage를 시드로 덮어쓴다. 체크포인트는 Task 8에서 지원한다. */
export function resetDb(opts: { today?: Date; checkpoint?: SeedCheckpoint } = {}): DB {
  if (opts.checkpoint !== undefined && opts.checkpoint !== 'START') {
    throw new Error('checkpoint는 Task 8에서 지원');
  }
  const db = createSeed(opts.today ?? mockNow());
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

/** 시드 이후 규칙이 만드는 새 행의 ID. 모든 테이블이 하나의 카운터를 쓴다. */
export function nextId(db: DB): number {
  const id = db.nextId;
  db.nextId += 1;
  return id;
}
