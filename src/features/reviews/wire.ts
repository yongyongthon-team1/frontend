import type { CreatedReview, StoreReviewItem, StoreReviews } from './model';

// 백엔드 R-02 `GET /stores/{storeId}/reviews` · R-01 `POST /stores/{storeId}/reviews`의 와이어 모양
// (키는 `request`가 camelCase로 바꾼 뒤의 것).

export interface WireReviewItem {
  reviewId: number;
  rating: number;
  content: string;
  author: string;
  createdAt: string;
}

export interface WireStoreReviews {
  summary: string | null;
  averageRating: number | null;
  reviewCount: number;
  items: WireReviewItem[];
  page: number;
  size: number;
  total: number;
}

export interface WireCreatedReview {
  reviewId: number;
  storeId: number;
  rating: number;
  content: string;
  createdAt: string;
}

function fromWireItem(w: WireReviewItem): StoreReviewItem {
  return {
    id: w.reviewId,
    rating: w.rating,
    content: w.content,
    author: w.author,
    createdAt: w.createdAt,
  };
}

/** 리뷰 수 · 평균은 상점 전체 기준이고 `items`는 요청한 한 쪽이다. 쪽 정보는 버린다. */
export function fromWireStoreReviews(w: WireStoreReviews): StoreReviews {
  return {
    summary: w.summary,
    average: w.averageRating,
    count: w.reviewCount,
    items: w.items.map(fromWireItem),
  };
}

export function fromWireCreatedReview(w: WireCreatedReview): CreatedReview {
  return {
    id: w.reviewId,
    storeId: w.storeId,
    rating: w.rating,
    content: w.content,
    createdAt: w.createdAt,
  };
}
