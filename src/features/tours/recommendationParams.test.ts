import { describe, expect, it } from 'vitest';
import { fromSearch, toSearch } from './recommendationParams';

describe('추천 검색 파라미터', () => {
  it('검색 파라미터 왕복', () => {
    const q = { q: '밥', major: '산업디자인', universityId: 2, date: '2026-12-28' };
    expect(fromSearch(toSearch(q))).toEqual(q);
    expect(fromSearch('')).toBeNull();
  });

  it('빈 값은 생략하고, 학교는 school 키에 담는다', () => {
    expect(toSearch({ q: '밥', major: '', date: '' })).toBe('q=%EB%B0%A5');
    expect(new URLSearchParams(toSearch({ q: '밥', universityId: 3 })).get('school')).toBe('3');
  });

  it('앞의 ?를 받고, q는 다듬고, 잘못된 school · 빈 major · date는 버린다', () => {
    expect(fromSearch('?q=%20%20')).toBeNull();
    expect(fromSearch('?major=x')).toBeNull();
    expect(fromSearch('?q=%20%EB%B0%A5%20')).toEqual({ q: '밥' });
    expect(fromSearch('q=a&school=abc&major=&date=')).toEqual({ q: 'a' });
    expect(fromSearch('q=a&school=0')).toEqual({ q: 'a' });
    expect(fromSearch('q=a&school=-2')).toEqual({ q: 'a' });
    expect(fromSearch('q=a&school=1.5')).toEqual({ q: 'a' });
  });
});
