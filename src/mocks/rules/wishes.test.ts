import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import type { ErrorCode } from '@/shared/lib/errors';
import { createWish, myWishes, updateWish, wishesForGuide } from './wishes';

const now = new Date('2026-11-14T03:00:00Z'); // KST 12:00
/** 시드에 들어 있는 희망 사항 수(이하은 · 정우진 · 박서준 · 최유진). */
const SEED_WISHES = 4;

let db: DB;
beforeEach(() => {
  db = createSeed(new Date('2026-11-15T01:00:00Z'));
});

const id = (email: string) => db.users.find((u) => u.email === email)!.id;
const student = () => id('student@demo.kr');
const input = { campusId: 2, major: '산업디자인', wish: '작업실을 구경하고 싶어요.', date: null };

/** 규칙이 이 상태 · 코드(· 칸 오류)로 던지고, DB는 하나도 바뀌지 않았는지 확인한다. */
function expectRejected(
  fn: () => unknown,
  status: number,
  code: ErrorCode,
  fieldErrors?: Record<string, string>,
) {
  const before = structuredClone(db);
  expect(fn).toThrow(
    expect.objectContaining({ status, code, ...(fieldErrors ? { fieldErrors } : {}) }),
  );
  expect(db).toEqual(before);
}

describe('createWish (T-01 희망 사항 등록)', () => {
  it('고교생: 앞뒤 공백만 뺀 값을 행에 저장한다(안쪽 줄바꿈은 그대로)', () => {
    const row = createWish(
      db,
      student(),
      { campusId: 2, major: ' 산업디자인 ', wish: '  첫 줄\n둘째 줄  ', date: '2027-01-15' },
      now,
    );
    expect(row).toMatchObject({
      userId: student(),
      universityId: 2,
      major: '산업디자인',
      content: '첫 줄\n둘째 줄',
      preferredDate: '2027-01-15',
      createdAt: '2026-11-14T12:00:00+09:00',
      updatedAt: '2026-11-14T12:00:00+09:00',
    });
    expect(db.tourWishes.at(-1)).toEqual(row);
    expect(db.tourWishes).toHaveLength(SEED_WISHES + 1);
  });

  it('날짜가 없으면 null로 저장하고, 한 사람이 여러 개 등록할 수 있다', () => {
    const a = createWish(db, student(), input, now);
    const b = createWish(db, student(), { ...input, date: undefined }, now);
    expect(a.preferredDate).toBeNull();
    expect(b.preferredDate).toBeNull();
    expect(a.id).not.toBe(b.id);
    expect(db.tourWishes).toHaveLength(SEED_WISHES + 2);
  });

  it('고교생이 아니면 FORBIDDEN', () => {
    for (const email of ['guide@demo.kr', 'owner1@demo.kr', 'admin@demo.kr']) {
      expectRejected(() => createWish(db, id(email), input, now), 403, 'FORBIDDEN');
    }
  });

  it('없는 캠퍼스는 campusId 칸 `학교를 골라 주세요.`', () => {
    for (const campusId of [999, null, '2']) {
      expectRejected(
        () => createWish(db, student(), { ...input, campusId }, now),
        400,
        'VALIDATION',
        { campusId: '학교를 골라 주세요.' },
      );
    }
  });

  it('학과는 앞뒤 공백을 뺀 1~30자', () => {
    for (const major of ['  ', '가'.repeat(31), 3]) {
      expectRejected(() => createWish(db, student(), { ...input, major }, now), 400, 'VALIDATION', {
        major: '학과는 1~30자로 적어 주세요.',
      });
    }
    expect(createWish(db, student(), { ...input, major: ` ${'가'.repeat(30)} ` }, now).major).toBe(
      '가'.repeat(30),
    );
  });

  it('희망 사항은 앞뒤 공백을 뺀 1~100자', () => {
    for (const wish of [' \n ', '가'.repeat(101), undefined]) {
      expectRejected(() => createWish(db, student(), { ...input, wish }, now), 400, 'VALIDATION', {
        wish: '희망 사항은 1~100자로 적어 주세요.',
      });
    }
    expect(createWish(db, student(), { ...input, wish: '가'.repeat(100) }, now).content).toBe(
      '가'.repeat(100),
    );
  });

  it('날짜는 null 또는 YYYY-MM-DD', () => {
    for (const date of ['2027/01/15', '', 20270115]) {
      expectRejected(() => createWish(db, student(), { ...input, date }, now), 400, 'VALIDATION', {
        date: '날짜를 다시 골라 주세요.',
      });
    }
  });
});

describe('updateWish (T-07 희망 사항 수정)', () => {
  const mine = () => createWish(db, student(), input, now);
  const later = new Date('2026-11-14T05:00:00Z'); // KST 14:00

  it('준 칸만 고치고 나머지와 createdAt은 그대로, updatedAt은 지금', () => {
    const row = mine();
    const done = updateWish(db, student(), row.id, { wish: '  학식도 먹고 싶어요.  ' }, later);
    expect(done).toMatchObject({
      id: row.id,
      universityId: 2,
      major: '산업디자인',
      content: '학식도 먹고 싶어요.',
      preferredDate: null,
      createdAt: '2026-11-14T12:00:00+09:00',
      updatedAt: '2026-11-14T14:00:00+09:00',
    });
    expect(db.tourWishes.find((w) => w.id === row.id)).toBe(done);
  });

  it('여러 칸 · 날짜 지우기(null)도 된다', () => {
    const row = createWish(db, student(), { ...input, date: '2027-01-15' }, now);
    const done = updateWish(
      db,
      student(),
      row.id,
      { campusId: 3, major: ' 통번역 ', date: null },
      later,
    );
    expect(done).toMatchObject({ universityId: 3, major: '통번역', preferredDate: null });
  });

  it('없는 id는 NOT_FOUND, 남의 것은 FORBIDDEN, 고교생이 아니면 FORBIDDEN', () => {
    const row = mine();
    expectRejected(() => updateWish(db, student(), 99999, { wish: '가' }, later), 404, 'NOT_FOUND');
    expectRejected(
      () => updateWish(db, id('seojun@demo.kr'), row.id, { wish: '가' }, later),
      403,
      'FORBIDDEN',
    );
    expectRejected(
      () => updateWish(db, id('guide@demo.kr'), row.id, { wish: '가' }, later),
      403,
      'FORBIDDEN',
    );
  });

  it('준 칸은 등록과 같은 검사를 받고, 걸리면 DB는 그대로다', () => {
    const row = mine();
    expectRejected(
      () => updateWish(db, student(), row.id, { wish: '가'.repeat(101) }, later),
      400,
      'VALIDATION',
      { wish: '희망 사항은 1~100자로 적어 주세요.' },
    );
    expectRejected(
      () => updateWish(db, student(), row.id, { major: '  ' }, later),
      400,
      'VALIDATION',
      { major: '학과는 1~30자로 적어 주세요.' },
    );
    expectRejected(
      () => updateWish(db, student(), row.id, { campusId: 999 }, later),
      400,
      'VALIDATION',
      { campusId: '학교를 골라 주세요.' },
    );
    expectRejected(
      () => updateWish(db, student(), row.id, { date: '2027/01/15' }, later),
      400,
      'VALIDATION',
      { date: '날짜를 다시 골라 주세요.' },
    );
    // 한 칸이 걸리면 앞선 칸도 저장하지 않는다.
    expectRejected(
      () => updateWish(db, student(), row.id, { major: '통번역', wish: ' ' }, later),
      400,
      'VALIDATION',
    );
  });

  it('보내지 않은 칸은 검사하지 않는다(빈 patch도 통과)', () => {
    const row = mine();
    expect(updateWish(db, student(), row.id, {}, later)).toMatchObject({ content: input.wish });
  });
});

describe('myWishes', () => {
  it('내 것만, 최신순(같으면 id 큰 것 먼저)', () => {
    const a = createWish(db, student(), input, now);
    const b = createWish(db, student(), { ...input, wish: '둘째' }, now);
    const older = createWish(
      db,
      student(),
      { ...input, wish: '첫째' },
      new Date('2026-11-13T03:00:00Z'),
    );
    expect(myWishes(db, student()).map((w) => w.id)).toEqual([b.id, a.id, older.id]);
    // 시드: 이하은 한 개
    expect(myWishes(db, id('haeun@demo.kr')).map((w) => w.major)).toEqual(['시각디자인']);
    expect(myWishes(db, id('guide@demo.kr'))).toEqual([]);
  });
});

describe('wishesForGuide (T-08)', () => {
  const guide = () => id('guide@demo.kr'); // 정다은 · 경희대(2)

  it('캠퍼스를 생략하면 내 인증 학교, 최신순', () => {
    const rows = wishesForGuide(db, guide(), {});
    expect(rows.map((w) => w.major)).toEqual(['시각디자인', '산업디자인']);
    expect(rows.every((w) => w.universityId === 2)).toBe(true);
  });

  it('학과는 부분 일치, 캠퍼스를 주면 그 학교', () => {
    expect(wishesForGuide(db, guide(), { major: '산업' }).map((w) => w.major)).toEqual([
      '산업디자인',
    ]);
    expect(wishesForGuide(db, guide(), { campusId: 5 }).map((w) => w.major)).toEqual(['통번역']);
    expect(wishesForGuide(db, guide(), { major: '없는학과' })).toEqual([]);
  });

  it('대학생이 아니면 FORBIDDEN, 인증이 승인이 아니면 NOT_VERIFIED', () => {
    expectRejected(() => wishesForGuide(db, student(), {}), 403, 'FORBIDDEN');
    expectRejected(() => wishesForGuide(db, id('guide-new@demo.kr'), {}), 403, 'NOT_VERIFIED');
    expectRejected(() => wishesForGuide(db, id('guide-pending@demo.kr'), {}), 403, 'NOT_VERIFIED');
  });
});
