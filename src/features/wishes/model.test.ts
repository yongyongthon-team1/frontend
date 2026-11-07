import { describe, expect, it } from 'vitest';
import {
  diffWishPatch,
  toWishInput,
  wishFormSchema,
  type TourWish,
  type WishFormValues,
} from './model';

const valid: WishFormValues = {
  universityId: '2',
  major: '산업디자인',
  wish: '작업실을 구경하고 싶어요.',
  date: '',
};

/** 검사에 걸린 칸 → 문구. */
function errorsOf(values: WishFormValues): Record<string, string> {
  const result = wishFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('wishFormSchema', () => {
  it('맞는 값은 통과한다(날짜는 비어도 · YYYY-MM-DD여도 된다)', () => {
    expect(errorsOf(valid)).toEqual({});
    expect(errorsOf({ ...valid, date: '2027-01-15' })).toEqual({});
  });

  it('학교를 고르지 않으면 `학교를 골라 주세요.`', () => {
    expect(errorsOf({ ...valid, universityId: '' })).toEqual({
      universityId: '학교를 골라 주세요.',
    });
  });

  it('학과: 공백뿐이면 `학과를 적어 주세요.`, 31자면 `학과는 30자 이내로 적어 주세요.`', () => {
    expect(errorsOf({ ...valid, major: '   ' })).toEqual({ major: '학과를 적어 주세요.' });
    expect(errorsOf({ ...valid, major: '가'.repeat(31) })).toEqual({
      major: '학과는 30자 이내로 적어 주세요.',
    });
    expect(errorsOf({ ...valid, major: ` ${'가'.repeat(30)} ` })).toEqual({});
  });

  it('희망 사항: 공백뿐이면 `하고 싶은 것을 한두 문장으로 적어 주세요.`, 101자면 `100자 이내로 적어 주세요.`', () => {
    expect(errorsOf({ ...valid, wish: ' \n ' })).toEqual({
      wish: '하고 싶은 것을 한두 문장으로 적어 주세요.',
    });
    expect(errorsOf({ ...valid, wish: '가'.repeat(101) })).toEqual({
      wish: '100자 이내로 적어 주세요.',
    });
    expect(errorsOf({ ...valid, wish: '가'.repeat(100) })).toEqual({});
  });

  it('날짜가 YYYY-MM-DD가 아니면 오류', () => {
    expect(Object.keys(errorsOf({ ...valid, date: '2027/01/15' }))).toEqual(['date']);
  });
});

describe('toWishInput', () => {
  it('학교는 숫자로, 학과 · 희망 사항은 앞뒤 공백만 빼고(안쪽 줄바꿈은 그대로), 빈 날짜는 null', () => {
    expect(
      toWishInput({ universityId: '2', major: ' 산업디자인 ', wish: '  가\n나  ', date: '' }),
    ).toEqual({ universityId: 2, major: '산업디자인', wish: '가\n나', date: null });
  });

  it('날짜가 있으면 그대로', () => {
    expect(toWishInput({ ...valid, date: '2027-01-15' }).date).toBe('2027-01-15');
  });
});

describe('diffWishPatch', () => {
  const before: TourWish = {
    id: 5,
    universityId: 2,
    campusLabel: '경희대학교 국제캠퍼스',
    major: '산업디자인',
    wish: '작업실을 구경하고 싶어요.',
    date: null,
    createdAt: '2026-11-04T21:00:00+09:00',
  };
  const same = {
    universityId: 2,
    major: '산업디자인',
    wish: '작업실을 구경하고 싶어요.',
    date: null,
  };

  it('그대로면 빈 객체', () => {
    expect(diffWishPatch(before, same)).toEqual({});
  });

  it('값이 다른 칸만 담는다', () => {
    expect(diffWishPatch(before, { ...same, wish: '학식도 먹고 싶어요.' })).toEqual({
      wish: '학식도 먹고 싶어요.',
    });
    expect(diffWishPatch(before, { ...same, universityId: 3, major: '통번역' })).toEqual({
      universityId: 3,
      major: '통번역',
    });
  });

  it('날짜: null끼리는 키가 없고, 날짜를 지우면 date: null, 넣으면 그 날짜', () => {
    expect(diffWishPatch({ ...before, date: null }, same)).not.toHaveProperty('date');
    expect(diffWishPatch({ ...before, date: '2027-01-15' }, same)).toEqual({ date: null });
    expect(diffWishPatch(before, { ...same, date: '2027-01-16' })).toEqual({ date: '2027-01-16' });
    expect(
      diffWishPatch({ ...before, date: '2027-01-15' }, { ...same, date: '2027-01-15' }),
    ).toEqual({});
  });

  it('학교를 모르는 항목(before.universityId null)이면 고른 학교를 늘 담는다', () => {
    expect(diffWishPatch({ ...before, universityId: null }, same)).toEqual({ universityId: 2 });
  });
});
