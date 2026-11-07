import { newestFirst, summarizeReviews } from '@/mocks/ai/reviewSummary';
import { nextId } from '@/mocks/db/ids';
import type { DB, ReviewRow } from '@/mocks/db/schema';
import { toSeoulIso } from '@/shared/lib/date';
import { REVIEW_CONTENT_MAX } from '@/features/reviews/model';
import { fieldError, MockApiError } from './errors';

// 상점 리뷰 규칙(R-01 · R-02). 검사를 모두 마친 뒤에만 행을 바꾼다 — 규칙에 걸리면 DB는 그대로다.

function requireStore(db: DB, storeId: number): void {
  if (!db.stores.some((s) => s.id === storeId)) throw new MockApiError(404, 'NOT_FOUND');
}

/** 상점의 리뷰 전부, 최신순(같으면 id 내림차순). 없는 상점은 404 NOT_FOUND. */
export function listStoreReviews(db: DB, storeId: number): ReviewRow[] {
  requireStore(db, storeId);
  return db.reviews.filter((r) => r.storeId === storeId).sort(newestFirst);
}

/** 상점의 리뷰 전부로 요약을 다시 만들어 요약 행을 더한다(가장 최근 행이 쓰인다, 2B′-R18). */
function refreshStoreSummary(db: DB, storeId: number, now: Date): void {
  const summary = summarizeReviews(db.reviews.filter((r) => r.storeId === storeId));
  if (summary === null) return;
  db.reviewSummaries.push({
    id: nextId(db),
    storeId,
    summary,
    reviewCount: db.reviews.filter((r) => r.storeId === storeId).length,
    generatedAt: toSeoulIso(now),
  });
}

/**
 * 리뷰 작성(R-01). 순서: 없는 상점 404 → 별점(정수 1~5) → 내용(앞뒤 공백을 뺀 1~100자) → 쿠폰이 내 신청의 이 상점 `USED` 쿠폰이
 * 아니면 403 `REVIEW_NOT_ALLOWED` → 같은 쿠폰 또는 같은 (사용자 · 탐방 · 상점)의 리뷰가 있으면 409 `REVIEW_DUPLICATE`.
 * 저장하면 그 상점의 요약을 다시 만든다.
 */
export function createReview(
  db: DB,
  userId: number,
  storeId: number,
  body: { couponId?: unknown; rating?: unknown; content?: unknown },
  now: Date,
): ReviewRow {
  requireStore(db, storeId);
  const { couponId, rating, content } = body;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw fieldError('rating', '별점은 1~5점으로 골라 주세요.');
  }
  const text = typeof content === 'string' ? content.trim() : '';
  if (text.length < 1 || text.length > REVIEW_CONTENT_MAX) {
    throw fieldError('content', '한 줄 평은 1~100자로 적어 주세요.');
  }

  const coupon = db.coupons.find((c) => c.id === couponId);
  const application = db.applications.find((a) => a.id === coupon?.applicationId);
  if (
    coupon === undefined ||
    application === undefined ||
    application.userId !== userId ||
    coupon.storeId !== storeId ||
    coupon.status !== 'USED'
  ) {
    throw new MockApiError(403, 'REVIEW_NOT_ALLOWED');
  }
  const tourId = application.tourId;
  if (
    db.reviews.some(
      (r) =>
        r.couponId === coupon.id ||
        (r.userId === userId && r.tourId === tourId && r.storeId === storeId),
    )
  ) {
    throw new MockApiError(409, 'REVIEW_DUPLICATE');
  }

  const stamp = toSeoulIso(now);
  const row: ReviewRow = {
    id: nextId(db),
    userId,
    tourId,
    storeId,
    couponId: coupon.id,
    rating,
    content: text,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.reviews.push(row);
  refreshStoreSummary(db, storeId, now);
  return row;
}
