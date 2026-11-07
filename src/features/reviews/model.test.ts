import { describe, expect, it } from 'vitest';
import { mergeStoreReview } from './model';

describe('mergeStoreReview (2B′-R16)', () => {
  it('받아 온 리뷰가 있으면 지점 값 대신 그 요약 · 평균 · 수를 쓴다', () => {
    expect(
      mergeStoreReview(
        { average: null, count: 0, summary: 'x' },
        { summary: 'y', average: 4.6, count: 5, items: [] },
      ),
    ).toEqual({ summary: 'y', average: 4.6, count: 5 });
  });

  it('받아 온 리뷰가 없으면(오기 전 · 실패) 지점 값 그대로', () => {
    const stop = { average: 4.2, count: 3, summary: '지점 요약' };
    expect(mergeStoreReview(stop, undefined)).toEqual(stop);
  });

  it('둘 다 없으면 null', () => {
    expect(mergeStoreReview(null, undefined)).toBeNull();
  });

  it('지점 값이 없어도 받아 온 리뷰가 있으면 그 값', () => {
    expect(mergeStoreReview(null, { summary: null, average: null, count: 0, items: [] })).toEqual({
      summary: null,
      average: null,
      count: 0,
    });
  });
});
