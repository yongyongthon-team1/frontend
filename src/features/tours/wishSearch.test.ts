import { describe, expect, it } from 'vitest';
import { fromWishSearch, toWishSearch, type WishSearch } from './wishSearch';

const base: WishSearch = {
  universityId: 2,
  major: '산업디자인',
  wish: '작업실을 구경하고 싶어요.',
  date: null,
};

describe('탐방 찾기 검색 ↔ 주소', () => {
  it('키 순서는 school · major · wish, 날짜가 있으면 date', () => {
    expect([...new URLSearchParams(toWishSearch(base)).keys()]).toEqual([
      'school',
      'major',
      'wish',
    ]);
    expect([...new URLSearchParams(toWishSearch({ ...base, date: '2027-01-15' })).keys()]).toEqual([
      'school',
      'major',
      'wish',
      'date',
    ]);
  });

  it('왕복하면 같은 값(앞의 `?`도 된다)', () => {
    expect(fromWishSearch(toWishSearch(base))).toEqual(base);
    const dated = { ...base, date: '2027-01-15' };
    expect(fromWishSearch(`?${toWishSearch(dated)}`)).toEqual(dated);
  });

  it('희망 사항은 받은 그대로 — 줄바꿈 · 끝 공백 · 기호도 지킨다', () => {
    const wish = '첫 줄\n둘째 줄 + 100% & 끝 ';
    expect(fromWishSearch(toWishSearch({ ...base, wish }))?.wish).toBe(wish);
    expect(fromWishSearch('school=2&major=a&wish=%EC%B2%AB%0A%EB%91%98%20')?.wish).toBe('첫\n둘 ');
  });

  it('빠진 칸이 있으면 null', () => {
    expect(fromWishSearch('')).toBeNull();
    expect(fromWishSearch('major=a&wish=b')).toBeNull();
    expect(fromWishSearch('school=2&wish=b')).toBeNull();
    expect(fromWishSearch('school=2&major=a')).toBeNull();
    expect(fromWishSearch('school=2&major=a&wish=')).toBeNull();
    expect(fromWishSearch('school=2&major=%20&wish=b')).toBeNull();
    expect(fromWishSearch('school=2&major=a&wish=%20%0A')).toBeNull();
  });

  it('school이 1 이상의 정수가 아니면 null', () => {
    for (const school of ['x', '0', '01', '-1', '2.5', '']) {
      expect(fromWishSearch(`school=${school}&major=a&wish=b`)).toBeNull();
    }
  });

  it('옛 추천 검색(q=)은 읽지 않는다', () => {
    expect(fromWishSearch('q=%EB%B0%A5')).toBeNull();
  });

  it('날짜가 YYYY-MM-DD가 아니면 날짜만 null', () => {
    expect(fromWishSearch('school=2&major=a&wish=b&date=2027%2F01%2F15')).toEqual({
      universityId: 2,
      major: 'a',
      wish: 'b',
      date: null,
    });
    expect(fromWishSearch('school=2&major=a&wish=b&date=')?.date).toBeNull();
  });
});
