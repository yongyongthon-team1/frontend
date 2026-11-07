import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { addDaysKey, seoulDateKey } from '@/shared/lib/date';
import { COURSE_RADIUS_M } from '@/mocks/ai/course';
import { distanceMeters } from '@/shared/lib/geo';
import { DEMO_BUSINESS } from '@/shared/config/demoAccounts';
import {
  linkStore,
  myStoreOf,
  nearbyStores,
  savePartnership,
  searchStores,
  storeReport,
  updateStore,
  verifyBusiness,
} from './stores';

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

describe('방문 · 리뷰 리포트 (GET /users/me/store/report)', () => {
  const today = seoulDateKey(now);
  const noQuery = { from: null, to: null };

  it('owner1 기본 기간(오늘 −30일 ~ 오늘, 양 끝 포함) → 방문 5 · 리뷰 5 · 평균 4.6', () => {
    expect(storeReport(db, owner(1), noQuery, now)).toEqual({
      from: addDaysKey(today, -30),
      to: today,
      visitCount: 5,
      reviewCount: 5,
      averageRating: 4.6,
    });
  });

  it('기간을 좁히면 방문과 리뷰를 날짜(서울)로 따로 센다', () => {
    const r = storeReport(db, owner(1), { from: addDaysKey(today, -29), to: null }, now);
    expect(r).toMatchObject({
      from: addDaysKey(today, -29),
      to: today,
      visitCount: 0,
      reviewCount: 5,
    });
  });

  it('owner3(상점 3)은 쿠폰 사용 · 리뷰가 없어 0 · 0 · null', () => {
    expect(storeReport(db, owner(3), noQuery, now)).toMatchObject({
      visitCount: 0,
      reviewCount: 0,
      averageRating: null,
    });
  });

  it('연결된 가게가 없으면 404 STORE_NOT_LINKED', () => {
    const nostore = db.users.find((u) => u.email === 'owner-nostore@demo.kr')!.id;
    expect(() => storeReport(db, nostore, noQuery, now)).toThrow(
      expect.objectContaining({ status: 404, code: 'STORE_NOT_LINKED' }),
    );
  });

  it('from > to면 to 칸 오류', () => {
    expect(() =>
      storeReport(db, owner(1), { from: today, to: addDaysKey(today, -1) }, now),
    ).toThrow(
      expect.objectContaining({
        status: 400,
        fieldErrors: { to: '기간을 다시 확인해 주세요.' },
      }),
    );
  });

  it.each([
    ['from', { from: '2026/11/01', to: null }],
    ['to', { from: null, to: '내일' }],
    ['from', { from: '2026-13-01', to: null }],
  ])('YYYY-MM-DD가 아닌 %s는 칸 오류', (field, query) => {
    expect(() => storeReport(db, owner(1), query, now)).toThrow(
      expect.objectContaining({
        status: 400,
        fieldErrors: { [field]: '날짜를 다시 확인해 주세요.' },
      }),
    );
  });

  it('USED가 아닌 쿠폰과 기간 밖 사용은 세지 않는다', () => {
    const used = db.coupons.filter((c) => c.storeId === 1 && c.status === 'USED');
    expect(used.length).toBeGreaterThan(0);
    used[0].usedAt = '2000-01-01T10:00:00+09:00';
    expect(storeReport(db, owner(1), noQuery, now).visitCount).toBe(used.length - 1);
    used[1].status = 'EXPIRED';
    expect(storeReport(db, owner(1), noQuery, now).visitCount).toBe(used.length - 2);
  });
});

describe('주변 상점 (GET /stores/nearby, 2B′-R15)', () => {
  const center = (campusId: number) => {
    const u = db.universities.find((x) => x.id === campusId)!;
    return { lat: u.latitude, lng: u.longitude };
  };

  it('캠퍼스 중심에서 COURSE_RADIUS_M 안의 상점만, id 순', () => {
    for (const campusId of [1, 2, 3, 4, 5]) {
      const stores = nearbyStores(db, campusId, null);
      expect(stores.map((s) => s.id)).toEqual([...stores.map((s) => s.id)].sort((a, b) => a - b));
      for (const s of stores) {
        expect(
          distanceMeters(center(campusId), { lat: s.latitude, lng: s.longitude }),
        ).toBeLessThanOrEqual(COURSE_RADIUS_M);
      }
      const outside = db.stores.filter((s) => !stores.includes(s));
      for (const s of outside) {
        expect(
          distanceMeters(center(campusId), { lat: s.latitude, lng: s.longitude }),
        ).toBeGreaterThan(COURSE_RADIUS_M);
      }
    }
    expect(nearbyStores(db, 2, null).map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(nearbyStores(db, 3, null).map((s) => s.id)).toEqual([5, 6]);
  });

  it('category가 있으면 같은 업종만(없으면 전부)', () => {
    const all = nearbyStores(db, 2, null);
    const category = all[0].category;
    const same = nearbyStores(db, 2, category);
    expect(same.length).toBeGreaterThan(0);
    expect(same.every((s) => s.category === category)).toBe(true);
    expect(same).toEqual(all.filter((s) => s.category === category));
    expect(nearbyStores(db, 2, '없는업종')).toEqual([]);
  });

  it('없는 캠퍼스는 404 NOT_FOUND', () => {
    expect(() => nearbyStores(db, 99, null)).toThrowError(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
  });
});

const userOf = (email: string) => db.users.find((u) => u.email === email)!.id;
const verifiedOf = (id: number) => db.businessVerifications.find((b) => b.id === id)?.isVerified;
const match = DEMO_BUSINESS.match;
const matchBody = {
  businessNumber: match.businessNumber,
  representativeName: match.representativeName,
  openedAt: match.openingDate,
};

describe('사업자 인증 (POST /verifications/business)', () => {
  it('등록 정보와 맞으면(하이픈 있어도) 인증이 남는다', () => {
    const id = userOf('owner-new@demo.kr');
    expect(verifiedOf(id)).toBeUndefined();
    verifyBusiness(db, id, matchBody, now);
    expect(verifiedOf(id)).toBe(true);
    expect(db.businessVerifications.find((b) => b.id === id)).toMatchObject({
      verifiedAt: expect.any(String),
    });
  });

  it('숫자만 보내도 같다. 이미 인증된 계정이 다시 보내도 행은 하나', () => {
    const id = userOf('owner-nostore@demo.kr');
    verifyBusiness(db, id, { ...matchBody, businessNumber: '1234567890' }, now);
    expect(db.businessVerifications.filter((b) => b.id === id)).toHaveLength(1);
  });

  it('번호가 숫자 10자리가 아니면 businessNumber 칸 오류', () => {
    const id = userOf('owner-new@demo.kr');
    expect(() =>
      verifyBusiness(db, id, { ...matchBody, businessNumber: '123-45-6789' }, now),
    ).toThrow(
      expect.objectContaining({
        status: 400,
        code: 'VALIDATION',
        fieldErrors: { businessNumber: '사업자등록번호 10자리를 입력해 주세요.' },
      }),
    );
    expect(verifiedOf(id)).toBeUndefined();
  });

  it('대표자명이 비면 representativeName, 개업일 형식이 아니면 openedAt 칸 오류(위에서부터 하나)', () => {
    const id = userOf('owner-new@demo.kr');
    expect(() => verifyBusiness(db, id, { ...matchBody, representativeName: '  ' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { representativeName: '대표자명을 입력해 주세요.' } }),
    );
    expect(() => verifyBusiness(db, id, { ...matchBody, openedAt: '2021.03.02' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { openedAt: '개업일자를 입력해 주세요.' } }),
    );
    expect(() =>
      verifyBusiness(db, id, { businessNumber: '1', representativeName: '', openedAt: '' }, now),
    ).toThrow(expect.objectContaining({ fieldErrors: { businessNumber: expect.any(String) } }));
  });

  it('폐업 번호는 대표자명 · 개업일과 관계없이 422 BIZ_CLOSED(reason CLOSED)', () => {
    const id = userOf('owner-new@demo.kr');
    expect(() =>
      verifyBusiness(
        db,
        id,
        { ...matchBody, businessNumber: DEMO_BUSINESS.closed.businessNumber },
        now,
      ),
    ).toThrow(
      expect.objectContaining({
        status: 422,
        code: 'BIZ_CLOSED',
        fieldErrors: { businessNumber: 'CLOSED' },
      }),
    );
    expect(verifiedOf(id)).toBeUndefined();
  });

  it('등록 정보와 다르면 422 BIZ_MISMATCH(reason MISMATCH)', () => {
    const id = userOf('owner-new@demo.kr');
    const bad = { ...matchBody, businessNumber: DEMO_BUSINESS.mismatch.businessNumber };
    expect(() => verifyBusiness(db, id, bad, now)).toThrow(
      expect.objectContaining({
        status: 422,
        code: 'BIZ_MISMATCH',
        fieldErrors: { businessNumber: 'MISMATCH' },
      }),
    );
    expect(() =>
      verifyBusiness(db, id, { ...matchBody, representativeName: '박사장' }, now),
    ).toThrow(expect.objectContaining({ code: 'BIZ_MISMATCH' }));
    expect(() => verifyBusiness(db, id, { ...matchBody, openedAt: '2020-03-02' }, now)).toThrow(
      expect.objectContaining({ code: 'BIZ_MISMATCH' }),
    );
    expect(verifiedOf(id)).toBeUndefined();
  });
});

describe('상점 검색 (GET /stores/search)', () => {
  it('공백 뺀 2자 미만이면 keyword 칸 오류', () => {
    for (const keyword of [null, '', ' ', '카', ' 카 ']) {
      expect(() => searchStores(db, keyword)).toThrow(
        expect.objectContaining({
          status: 400,
          code: 'VALIDATION',
          fieldErrors: { keyword: '검색어를 2자 이상 입력해 주세요.' },
        }),
      );
    }
  });

  it('상호 부분 일치(공백 · 대소문자 무시), 이름(ko) → id 순', () => {
    expect(searchStores(db, '카페').map((s) => s.name)).toEqual([
      '보드게임 카페 다이스',
      '카페 단풍',
      '카페 모래시계',
    ]);
    expect(searchStores(db, '보드게임카페').map((s) => s.name)).toEqual(['보드게임 카페 다이스']);
    expect(searchStores(db, '  단 풍 ').map((s) => s.name)).toEqual(['카페 단풍']);
    expect(searchStores(db, '없는가게')).toEqual([]);
  });
});

describe('가게 연결 · 등록 (POST /users/me/store)', () => {
  const nostore = () => userOf('owner-nostore@demo.kr');
  const direct = {
    name: '새 가게',
    address: '경기도 용인시 기흥구 덕영대로 1',
    category: '카페',
    latitude: 37.2397,
    longitude: 127.0833,
  };
  const dangpung = () => db.stores.find((s) => s.name === '카페 단풍')!;

  it('사업자 미인증이면 403 BIZ_NOT_VERIFIED(가장 먼저)', () => {
    expect(() =>
      linkStore(db, userOf('owner-new@demo.kr'), { storeId: dangpung().id }, now),
    ).toThrow(expect.objectContaining({ status: 403, code: 'BIZ_NOT_VERIFIED' }));
    expect(() => linkStore(db, userOf('owner-new@demo.kr'), {}, now)).toThrow(
      expect.objectContaining({ code: 'BIZ_NOT_VERIFIED' }),
    );
  });

  it('이미 가게가 있으면 409 STORE_LIMIT', () => {
    expect(() => linkStore(db, userOf('owner1@demo.kr'), { storeId: dangpung().id }, now)).toThrow(
      expect.objectContaining({ status: 409, code: 'STORE_LIMIT' }),
    );
  });

  it('없는 상점 404, 다른 사장님의 가게 409 STORE_ALREADY_LINKED', () => {
    expect(() => linkStore(db, nostore(), { storeId: 9999 }, now)).toThrow(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
    expect(() => linkStore(db, nostore(), { storeId: 1 }, now)).toThrow(
      expect.objectContaining({ status: 409, code: 'STORE_ALREADY_LINKED' }),
    );
    expect(db.stores.find((s) => s.id === 1)!.ownerId).toBe(userOf('owner1@demo.kr'));
  });

  it('검색에서 고른 상점은 ownerId만 연결한다', () => {
    const before = db.stores.length;
    const row = linkStore(db, nostore(), { storeId: dangpung().id }, now);
    expect(row).toMatchObject({ id: dangpung().id, name: '카페 단풍', ownerId: nostore() });
    expect(db.stores).toHaveLength(before);
    expect(myStoreOf(db, nostore(), now).name).toBe('카페 단풍');
  });

  it('직접 등록: 새 상점(ownerId · 행정동 null · 받은 좌표)', () => {
    const before = db.stores.length;
    const row = linkStore(db, nostore(), direct, now);
    expect(db.stores).toHaveLength(before + 1);
    expect(row).toMatchObject({
      ownerId: nostore(),
      name: '새 가게',
      category: '카페',
      administrativeDong: null,
      latitude: 37.2397,
      longitude: 127.0833,
    });
    expect(db.stores.find((s) => s.id === row.id)).toBe(row);
  });

  it('직접 등록: 빈 칸은 그 칸 오류, 좌표가 수가 아니면 latitude 오류, DB는 그대로', () => {
    const before = db.stores.length;
    expect(() => linkStore(db, nostore(), { ...direct, name: ' ' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { name: '상호명을 입력해 주세요.' } }),
    );
    expect(() => linkStore(db, nostore(), { ...direct, address: '' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { address: '가게 주소를 입력해 주세요.' } }),
    );
    expect(() => linkStore(db, nostore(), { ...direct, category: '' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { category: '업종을 입력해 주세요.' } }),
    );
    expect(() => linkStore(db, nostore(), { ...direct, latitude: '37' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { latitude: '가게 위치를 골라 주세요.' } }),
    );
    expect(() => linkStore(db, nostore(), { ...direct, longitude: undefined }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { latitude: '가게 위치를 골라 주세요.' } }),
    );
    expect(db.stores).toHaveLength(before);
  });
});

describe('가게 수정 (PATCH /users/me/store)', () => {
  it('준 칸만 고친다(앞뒤 공백은 뗀다)', () => {
    const row = updateStore(db, owner(1), { address: ' 새 주소 ' }, now);
    expect(row).toMatchObject({
      id: 1,
      name: '서천 밥상',
      address: '새 주소',
      category: '한식',
    });
    expect(myStoreOf(db, owner(1), now).address).toBe('새 주소');
  });

  it('준 칸이 빈 문자열이면 그 칸 오류, DB는 그대로', () => {
    expect(() => updateStore(db, owner(1), { name: '  ' }, now)).toThrow(
      expect.objectContaining({ status: 400, fieldErrors: { name: '상호명을 입력해 주세요.' } }),
    );
    expect(() => updateStore(db, owner(1), { address: '' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { address: '가게 주소를 입력해 주세요.' } }),
    );
    expect(() => updateStore(db, owner(1), { category: '' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { category: '업종을 입력해 주세요.' } }),
    );
    expect(db.stores.find((s) => s.id === 1)!.name).toBe('서천 밥상');
  });

  it('가게가 없으면 404 STORE_NOT_LINKED(검증보다 먼저)', () => {
    expect(() => updateStore(db, userOf('owner-nostore@demo.kr'), { name: '' }, now)).toThrow(
      expect.objectContaining({ status: 404, code: 'STORE_NOT_LINKED' }),
    );
  });
});

describe('제휴 설정 (PUT /users/me/store/partnership)', () => {
  const input = { discountText: '음료 500원 할인', startDate: '2027-01-01', endDate: '2027-02-28' };

  it('있는 제휴(가장 큰 id)를 고친다 — id 유지, 조건 null, 행은 늘지 않는다', () => {
    const before = db.partnerships.filter((p) => p.storeId === 1);
    expect(before).toHaveLength(1);
    const row = savePartnership(db, owner(1), input, now);
    expect(row).toMatchObject({
      id: before[0].id,
      storeId: 1,
      discountDescription: '음료 500원 할인',
      condition: null,
      startDate: '2027-01-01',
      endDate: '2027-02-28',
    });
    expect(db.partnerships.filter((p) => p.storeId === 1)).toHaveLength(1);
  });

  it('제휴가 여럿이면 가장 큰 id 행을 고친다', () => {
    db.partnerships.push({ ...db.partnerships.find((p) => p.storeId === 1)!, id: 999 });
    const row = savePartnership(db, owner(1), input, now);
    expect(row.id).toBe(999);
    expect(db.partnerships.filter((p) => p.storeId === 1)).toHaveLength(2);
  });

  it('제휴가 없으면 새로 만든다(조건 null)', () => {
    db.partnerships = db.partnerships.filter((p) => p.storeId !== 1);
    const row = savePartnership(db, owner(1), input, now);
    expect(db.partnerships).toContain(row);
    expect(row).toMatchObject({
      storeId: 1,
      condition: null,
      discountDescription: '음료 500원 할인',
    });
    expect(myStoreOf(db, owner(1), now).partnership).toMatchObject({ discount: '음료 500원 할인' });
  });

  it('가게가 없으면 404, 문구는 공백 뺀 1~50자', () => {
    expect(() => savePartnership(db, userOf('owner-nostore@demo.kr'), input, now)).toThrow(
      expect.objectContaining({ status: 404, code: 'STORE_NOT_LINKED' }),
    );
    for (const discountText of ['', '   ', 'a'.repeat(51), undefined]) {
      expect(() => savePartnership(db, owner(1), { ...input, discountText }, now)).toThrow(
        expect.objectContaining({
          status: 400,
          fieldErrors: { discountText: '50자 이내로 적어 주세요.' },
        }),
      );
    }
    expect(() =>
      savePartnership(db, owner(1), { ...input, discountText: 'a'.repeat(50) }, now),
    ).not.toThrow();
  });

  it('날짜 형식이 아니면 그 칸, 종료 < 시작이면 endDate 오류(같은 날은 된다)', () => {
    expect(() => savePartnership(db, owner(1), { ...input, startDate: '2027/01/01' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { startDate: '날짜를 다시 확인해 주세요.' } }),
    );
    expect(() => savePartnership(db, owner(1), { ...input, endDate: '' }, now)).toThrow(
      expect.objectContaining({ fieldErrors: { endDate: '날짜를 다시 확인해 주세요.' } }),
    );
    expect(() => savePartnership(db, owner(1), { ...input, endDate: '2026-12-31' }, now)).toThrow(
      expect.objectContaining({
        fieldErrors: { endDate: '종료 날짜는 시작 날짜와 같거나 뒤여야 해요.' },
      }),
    );
    expect(() =>
      savePartnership(db, owner(1), { ...input, endDate: input.startDate }, now),
    ).not.toThrow();
  });
});
