import { beforeEach, describe, expect, it } from 'vitest';
import { setMockNow } from '@/mocks/clock';
import {
  clearDbCache,
  createSession,
  getDb,
  MOCK_DB_KEY,
  MOCK_DB_VERSION,
  mutate,
  nextId,
  resetDb,
  userIdFromToken,
} from './store';

beforeEach(() => {
  clearDbCache();
  setMockNow(new Date('2026-11-15T01:00:00Z'));
  return () => setMockNow(null);
});

describe('getDb', () => {
  it('손상된 JSON이면 시드로 복구', () => {
    localStorage.setItem(MOCK_DB_KEY, '{oops');
    expect(getDb().universities).toHaveLength(5);
  });

  it('옛 버전이면 시드로 복구', () => {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify({ version: 0 }));
    expect(getDb().version).toBe(MOCK_DB_VERSION);
  });

  it('버전만 맞고 모양이 틀려도 시드로 복구', () => {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify({ version: MOCK_DB_VERSION }));
    expect(getDb().universities).toHaveLength(5);
  });

  it('저장된 DB가 있으면 그걸 읽는다', () => {
    mutate((db) => {
      db.users[0].name = '저장됨';
    });
    clearDbCache();
    expect(getDb().users[0].name).toBe('저장됨');
  });

  it('처음 만든 시드는 mockNow 기준이다', () => {
    expect(getDb().seedDay).toBe('2026-11-15');
  });
});

describe('mutate', () => {
  it('mutate는 저장한다', () => {
    mutate((db) => {
      db.users[0].name = '바뀜';
    });
    expect(JSON.parse(localStorage.getItem(MOCK_DB_KEY)!).users[0].name).toBe('바뀜');
  });

  it('반환값을 그대로 돌려준다', () => {
    expect(mutate((db) => db.users.length)).toBeGreaterThan(0);
  });
});

describe('resetDb', () => {
  it('캐시와 저장소를 시드로 덮어쓴다', () => {
    mutate((db) => {
      db.users[0].name = '바뀜';
    });
    const db = resetDb({ today: new Date('2026-12-01T03:00:00Z') });
    expect(db.users[0].name).toBe('김민지');
    expect(getDb().seedDay).toBe('2026-12-01');
    expect(JSON.parse(localStorage.getItem(MOCK_DB_KEY)!).seedDay).toBe('2026-12-01');
  });

  it('today가 없으면 mockNow를 쓴다', () => {
    expect(resetDb().seedDay).toBe('2026-11-15');
  });

  it('START 외의 체크포인트는 아직 지원하지 않는다', () => {
    expect(() => resetDb({ checkpoint: 'APPLIED' })).toThrow('checkpoint는 Task 8에서 지원');
    expect(() => resetDb({ checkpoint: 'START' })).not.toThrow();
  });
});

describe('세션', () => {
  it('세션 토큰으로 사용자 찾기', () => {
    const db = resetDb();
    const t = createSession(db, 3);
    expect(t).toBe('mock-3-1');
    expect(userIdFromToken(db, t)).toBe(3);
    expect(userIdFromToken(db, 'x')).toBeNull();
    expect(userIdFromToken(db, null)).toBeNull();
  });

  it('같은 사용자가 다시 로그인해도 토큰이 겹치지 않는다', () => {
    const db = resetDb();
    const a = createSession(db, 3);
    const b = createSession(db, 3);
    expect(a).not.toBe(b);
  });
});

describe('nextId', () => {
  it('반환하고 증가한다', () => {
    const db = resetDb();
    const first = nextId(db);
    expect(nextId(db)).toBe(first + 1);
    expect(db.nextId).toBe(first + 2);
  });
});
