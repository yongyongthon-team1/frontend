import { beforeEach, describe, expect, it } from 'vitest';
import { tourResultsPath, useLastQuery } from './lastQuery';

describe('마지막 투어 찾기 검색', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('저장된 검색이 없으면 홈', () => {
    expect(tourResultsPath()).toBe('/');
  });

  it('옛 추천 검색(q=)은 결과 화면으로 읽히지 않아 홈', () => {
    useLastQuery.getState().setSearch('q=%EB%B0%A5');
    expect(tourResultsPath()).toBe('/');
  });

  it('희망 사항 검색이면 그 결과 화면', () => {
    useLastQuery.getState().setSearch('school=2&major=a&wish=b');
    expect(tourResultsPath()).toBe('/tours?school=2&major=a&wish=b');
  });

  it('localStorage에 ytt.lastQuery로 남는다', () => {
    useLastQuery.getState().setSearch('school=2&major=a&wish=b');
    expect(JSON.parse(localStorage.getItem('ytt.lastQuery') ?? '{}').state.search).toBe(
      'school=2&major=a&wish=b',
    );
  });
});
