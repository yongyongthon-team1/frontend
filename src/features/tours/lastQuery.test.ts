import { beforeEach, describe, expect, it } from 'vitest';
import { recommendationsPath, useLastQuery } from './lastQuery';

describe('마지막 추천 검색', () => {
  beforeEach(() => useLastQuery.setState({ search: null }));

  it('저장된 검색이 없으면 홈, 있으면 추천 목록 주소', () => {
    expect(recommendationsPath()).toBe('/');
    useLastQuery.getState().setSearch('q=%EB%B0%A5');
    expect(recommendationsPath()).toBe('/recommendations?q=%EB%B0%A5');
  });

  it('localStorage에 ytt.lastQuery로 남는다', () => {
    useLastQuery.getState().setSearch('q=a');
    expect(JSON.parse(localStorage.getItem('ytt.lastQuery') ?? '{}').state.search).toBe('q=a');
  });
});
