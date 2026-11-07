import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import type { ErrorCode } from '@/shared/lib/errors';
import { createWish } from './wishes';

const now = new Date('2026-11-14T03:00:00Z'); // KST 12:00

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
    expect(db.tourWishes).toEqual([row]);
  });

  it('날짜가 없으면 null로 저장하고, 한 사람이 여러 개 등록할 수 있다', () => {
    const a = createWish(db, student(), input, now);
    const b = createWish(db, student(), { ...input, date: undefined }, now);
    expect(a.preferredDate).toBeNull();
    expect(b.preferredDate).toBeNull();
    expect(a.id).not.toBe(b.id);
    expect(db.tourWishes).toHaveLength(2);
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
