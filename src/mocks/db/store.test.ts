import { beforeEach, describe, expect, it } from 'vitest';
import { mockNow, setMockNow } from '@/mocks/clock';
import { createSeed } from './seed';
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
  it('손상된 JSON이면 시드로 복구하고 저장소도 유효한 DB로 덮어쓴다', () => {
    localStorage.setItem(MOCK_DB_KEY, '{oops');
    expect(getDb().universities).toHaveLength(5);
    expect(JSON.parse(localStorage.getItem(MOCK_DB_KEY)!).version).toBe(MOCK_DB_VERSION);
  });

  it('옛 버전이면(모양이 온전해도) 시드로 복구하고 저장소도 덮어쓴다', () => {
    const old = { ...createSeed(mockNow()), version: MOCK_DB_VERSION - 1 };
    old.users[0].name = '옛-마커';
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(old));
    clearDbCache();
    const db = getDb();
    expect(db.version).toBe(MOCK_DB_VERSION);
    expect(db.users[0].name).not.toBe('옛-마커');
    const stored = JSON.parse(localStorage.getItem(MOCK_DB_KEY)!);
    expect(stored.version).toBe(MOCK_DB_VERSION);
    expect(stored.users[0].name).not.toBe('옛-마커');
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

  it('seedDay가 오늘이 아닌 저장 DB는 버리고 오늘 기준으로 다시 시드한다', () => {
    expect(getDb().seedDay).toBe('2026-11-15');
    const tomorrow = new Date('2026-11-16T01:00:00Z');
    setMockNow(tomorrow);
    clearDbCache();
    expect(getDb().seedDay).toBe('2026-11-16');
    expect(getDb().tours[0].startsAt).toBe('2026-11-16T14:00:00+09:00');
    setMockNow(null);
  });

  it('메모리 캐시도 날짜가 바뀌면 다시 시드한다', () => {
    expect(getDb().seedDay).toBe('2026-11-15');
    setMockNow(new Date('2026-11-17T01:00:00Z'));
    expect(getDb().seedDay).toBe('2026-11-17');
    setMockNow(null);
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

  it('fn이 던지면 변경을 되돌리고 저장하지 않고 다시 던진다', () => {
    const original = getDb().users[0].name;
    const before = localStorage.getItem(MOCK_DB_KEY);
    const db = getDb();
    expect(() =>
      mutate((d) => {
        d.users[0].name = '반쯤-바뀜';
        d.users.push({ ...d.users[0], id: 999 });
        throw new Error('규칙 위반');
      }),
    ).toThrow('규칙 위반');
    expect(getDb().users[0].name).toBe(original);
    expect(getDb().users.some((u) => u.id === 999)).toBe(false);
    expect(getDb()).toBe(db);
    expect(localStorage.getItem(MOCK_DB_KEY)).toBe(before);
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
    expect(db.seedDay).toBe('2026-12-01');
    expect(JSON.parse(localStorage.getItem(MOCK_DB_KEY)!).seedDay).toBe('2026-12-01');
  });

  it('today가 없으면 mockNow를 쓴다', () => {
    expect(resetDb().seedDay).toBe('2026-11-15');
  });

  it('체크포인트를 적용한 시드로 캐시와 저장소를 덮어쓴다', () => {
    const db = resetDb({ checkpoint: 'CONFIRMED' });
    expect(getDb()).toBe(db);
    expect(db.courses.map((c) => [c.tourId, c.status])).toEqual([[1, 'CONFIRMED']]);
    const minji = db.users.find((u) => u.email === 'student@demo.kr')!.id;
    const app = db.applications.find((a) => a.tourId === 1 && a.userId === minji)!;
    expect(db.coupons.filter((c) => c.applicationId === app.id)).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(MOCK_DB_KEY)!)).toEqual(db);

    expect(
      resetDb({ checkpoint: 'APPLIED' }).applications.find((a) => a.id === app.id)!.status,
    ).toBe('PENDING');
    expect(resetDb({ checkpoint: 'START' }).applications.some((a) => a.userId === minji)).toBe(
      false,
    );
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
