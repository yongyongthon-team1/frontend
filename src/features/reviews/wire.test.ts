import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { REVIEW_CREATED, STORE_REVIEWS } from '@/test/fixtures/backend/reviews';
import {
  fromWireCreatedReview,
  fromWireStoreReviews,
  type WireCreatedReview,
  type WireStoreReviews,
} from './wire';

describe('fromWireStoreReviews (명세 R-02 예시)', () => {
  it('요약 · 평균 · 전체 수와 리뷰 항목을 도메인 모양으로 읽는다', () => {
    expect(fromWireStoreReviews(toCamel<WireStoreReviews>(STORE_REVIEWS.data))).toEqual({
      summary: '양이 많고 가격이 착하다는 평이 많아요',
      average: 4.5,
      count: 11,
      items: [
        {
          id: 90,
          rating: 5,
          content: '양도 많고 맛있었어요',
          author: '김*늘',
          createdAt: '2027-01-15T15:00:00+09:00',
        },
      ],
    });
  });

  it('요약 · 평균이 null이면 그대로 null', () => {
    const wire = toCamel<WireStoreReviews>({
      ...STORE_REVIEWS.data,
      summary: null,
      average_rating: null,
      review_count: 0,
      items: [],
      total: 0,
    });
    expect(fromWireStoreReviews(wire)).toEqual({
      summary: null,
      average: null,
      count: 0,
      items: [],
    });
  });
});

describe('fromWireCreatedReview (명세 R-01 예시)', () => {
  it('리뷰 id를 id로 읽는다', () => {
    expect(fromWireCreatedReview(toCamel<WireCreatedReview>(REVIEW_CREATED.data))).toEqual({
      id: 90,
      storeId: 201,
      rating: 5,
      content: '양도 많고 맛있었어요',
      createdAt: '2027-01-15T15:00:00+09:00',
    });
  });
});
