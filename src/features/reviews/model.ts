// 상점 리뷰(R-01 · R-02)의 도메인 모양과 상수. 화면(상점 시트 · 리포트 · 리뷰 쓰기)이 같이 쓴다.

/** 리뷰 한 줄 평 최대 길이(명세 R-01 `content` 100자 이내). */
export const REVIEW_CONTENT_MAX = 100;
/** 상점 시트 · 리포트가 보이는 최근 리뷰 수. */
export const RECENT_REVIEWS_SIZE = 3;
/** 리뷰를 쓴 뒤 AI 요약 갱신이 응답과 별개라(R-01) 한 번 더 다시 읽기까지 기다리는 시간(2B′-R17). */
export const REVIEW_SUMMARY_REFETCH_MS = 3_000;

export interface StoreReviewItem {
  id: number;
  rating: number;
  content: string;
  /** 서버가 가린 이름(`김*늘`). */
  author: string;
  createdAt: string;
}

/** 상점의 AI 요약 · 평균 · 전체 리뷰 수와 최근 리뷰 한 쪽. 요약이 아직 없으면 `summary`는 null, 리뷰가 없으면 `average`도 null. */
export interface StoreReviews {
  summary: string | null;
  average: number | null;
  count: number;
  items: StoreReviewItem[];
}

export interface CreateReviewInput {
  storeId: number;
  couponId: number;
  rating: number;
  content: string;
}

export interface CreatedReview {
  id: number;
  storeId: number;
  rating: number;
  content: string;
  createdAt: string;
}
