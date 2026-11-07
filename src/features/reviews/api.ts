import { request, withQuery } from '@/shared/lib/http';
import {
  RECENT_REVIEWS_SIZE,
  type CreatedReview,
  type CreateReviewInput,
  type StoreReviews,
} from './model';
import {
  fromWireCreatedReview,
  fromWireStoreReviews,
  type WireCreatedReview,
  type WireStoreReviews,
} from './wire';

// 상점 리뷰 · 요약 조회(R-02)와 리뷰 작성(R-01). 요약 · 평균 · 수는 응답에 다 있어 합성이 없다.

const reviewsPath = (storeId: number) => `/stores/${storeId}/reviews`;

/**
 * R-02 `GET /stores/{storeId}/reviews?page=1&size=`. 최근 리뷰 한 쪽만 읽는다(`listAll` 아님) — 요약 · 평균 · 리뷰 수는 상점 전체 기준이다.
 * 없는 상점은 404 `NOT_FOUND`.
 */
export async function getStoreReviews(
  storeId: number,
  size: number = RECENT_REVIEWS_SIZE,
): Promise<StoreReviews> {
  const wire = await request<WireStoreReviews>(withQuery(reviewsPath(storeId), { page: 1, size }));
  return fromWireStoreReviews(wire);
}

/**
 * R-01 `POST /stores/{storeId}/reviews` 본문 `{ coupon_id, rating, content }`. 쿠폰을 쓰지 않았거나 내 쿠폰이 아니면
 * `E403_COUPON_NOT_USED` → `REVIEW_NOT_ALLOWED`, 이미 썼으면 `E409_ALREADY_REVIEWED` → `REVIEW_DUPLICATE`.
 */
export async function postReview(input: CreateReviewInput): Promise<CreatedReview> {
  const wire = await request<WireCreatedReview>(reviewsPath(input.storeId), {
    method: 'POST',
    body: { couponId: input.couponId, rating: input.rating, content: input.content },
    errorMap: { E409_ALREADY_REVIEWED: 'REVIEW_DUPLICATE' },
  });
  return fromWireCreatedReview(wire);
}
