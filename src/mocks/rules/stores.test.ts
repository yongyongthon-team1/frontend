import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { myStoreOf } from './stores';

const now = new Date('2026-11-15T05:00:00Z'); // 시연일 KST 14:00

let db: DB;
beforeEach(() => {
  db = createSeed(new Date('2026-11-15T01:00:00Z'));
});

const owner = (n: number) => db.users.find((u) => u.email === `owner${n}@demo.kr`)!.id;

describe('내 가게 조회 (GET /users/me/store)', () => {
  it('owner1 → 가게 1과 지금 운영 중인 제휴(ACTIVE)', () => {
    expect(myStoreOf(db, owner(1), now)).toEqual({
      id: 1,
      name: '서천 밥상',
      address: '경기도 용인시 기흥구 서천동 서천로 21',
      category: '한식',
      // 2C-R26: `fromWireMyStore(toWireMyStore(…))` 합성이라 명세에 없는 제휴 id · 조건은 0 · null이다.
      partnership: {
        id: 0,
        discount: '식사 금액 10% 할인',
        condition: null,
        startDate: expect.stringMatching(/^\d{4}-\d\d-\d\d$/),
        endDate: expect.stringMatching(/^\d{4}-\d\d-\d\d$/),
        state: 'ACTIVE',
      },
    });
  });

  it('연결된 가게가 없으면 404 STORE_NOT_LINKED', () => {
    db.stores.find((s) => s.ownerId === owner(1))!.ownerId = null;
    expect(() => myStoreOf(db, owner(1), now)).toThrow(
      expect.objectContaining({ status: 404, code: 'STORE_NOT_LINKED' }),
    );
  });

  it('제휴가 없으면 partnership은 null', () => {
    db.partnerships = db.partnerships.filter((p) => p.storeId !== 1);
    expect(myStoreOf(db, owner(1), now).partnership).toBeNull();
  });

  it('제휴 상태는 오늘(서울)과 기간으로 계산한다 — 예정 · 종료, 그리고 여러 건이면 쓰는 것 우선', () => {
    const p = db.partnerships.find((x) => x.storeId === 1)!;
    p.startDate = '2026-11-16';
    p.endDate = '2026-12-31';
    expect(myStoreOf(db, owner(1), now).partnership?.state).toBe('SCHEDULED');
    p.startDate = '2026-10-01';
    p.endDate = '2026-11-14';
    expect(myStoreOf(db, owner(1), now).partnership?.state).toBe('ENDED');
    // 종료일 당일은 아직 운영 중이다(서울 날짜 기준).
    p.endDate = '2026-11-15';
    expect(myStoreOf(db, owner(1), now).partnership?.state).toBe('ACTIVE');
    // 지난 제휴 뒤에 새 제휴가 있으면 지금 쓰는 것(ACTIVE)을 준다.
    p.endDate = '2026-11-14';
    db.partnerships.push({
      ...p,
      id: 99,
      discountDescription: '새 혜택',
      startDate: '2026-11-15',
      endDate: '2026-12-31',
    });
    // 제휴 id는 와이어에 없어 0이므로, 어느 제휴를 골랐는지는 혜택 · 기간으로 가른다.
    expect(myStoreOf(db, owner(1), now).partnership).toMatchObject({
      discount: '새 혜택',
      startDate: '2026-11-15',
      endDate: '2026-12-31',
      state: 'ACTIVE',
    });
  });

  it('날짜 경계는 UTC가 아니라 서울 기준 — UTC 11-14 16:00 = 서울 11-15 01:00이면 11-15에 시작하는 제휴는 운영 중', () => {
    const rollover = new Date('2026-11-14T16:00:00Z');
    const p = db.partnerships.find((x) => x.storeId === 1)!;
    p.startDate = '2026-11-15';
    p.endDate = '2026-12-31';
    expect(myStoreOf(db, owner(1), rollover).partnership?.state).toBe('ACTIVE');
    // 한 시간 전(서울 11-14 23:59)에는 아직 예정이다.
    expect(myStoreOf(db, owner(1), new Date('2026-11-14T14:59:00Z')).partnership?.state).toBe(
      'SCHEDULED',
    );
    // 종료일이 서울 어제(11-14)면 UTC로는 아직 11-14여도 종료다.
    p.startDate = '2026-10-01';
    p.endDate = '2026-11-14';
    expect(myStoreOf(db, owner(1), rollover).partnership?.state).toBe('ENDED');
  });
});
