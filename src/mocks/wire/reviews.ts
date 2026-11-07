import type { WireCreatedReview, WireStoreReviews } from '@/features/reviews/wire';
import type { DB, ReviewRow, ReviewSummaryRow } from '@/mocks/db/schema';
import { listStoreReviews } from '@/mocks/rules/reviews';
import { averageRating } from '@/mocks/ai/reviewSummary';
import { pageOf } from './envelope';

// 리뷰 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 확장 필드는 없다(R-01 · R-02 명세 그대로).

// 평균 별점 판정의 출처는 하나다(errata PM1): 순환 import를 피하려고 구현은 AI 요약 옆에 두고 여기서 내보낸다.
export { averageRating };

/** 이름 가리기(명세 "김*늘"): 1자 `*` · 2자 첫 글자 + `*` · 3자 이상 첫 글자 + `*`×(길이−2) + 끝 글자. */
export function maskName(name: string): string {
  const letters = Array.from(name);
  if (letters.length <= 1) return '*';
  if (letters.length === 2) return `${letters[0]}*`;
  return `${letters[0]}${'*'.repeat(letters.length - 2)}${letters[letters.length - 1]}`;
}

/** 그 상점의 가장 최근 요약 행(`generatedAt` 내림차순, 같으면 id 내림차순). 없으면 undefined. 코스 지점 · 주변 상점 · R-02가 같이 쓴다. */
export function latestReviewSummary(db: DB, storeId: number): ReviewSummaryRow | undefined {
  return db.reviewSummaries
    .filter((s) => s.storeId === storeId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt) || b.id - a.id)[0];
}

/** R-02. 요약 = 가장 최근 요약 문장(없으면 null), 평균 · 수는 상점 전체, `items`는 `page` · `size`(기본 1 · 20)의 한 쪽이다. 없는 상점은 404. */
export function toWireStoreReviews(
  db: DB,
  storeId: number,
  search: URLSearchParams,
): WireStoreReviews {
  const rows = listStoreReviews(db, storeId);
  const page = pageOf(rows, search);
  return {
    summary: latestReviewSummary(db, storeId)?.summary ?? null,
    averageRating: averageRating(rows.map((r) => r.rating)),
    reviewCount: rows.length,
    items: page.items.map((r) => ({
      reviewId: r.id,
      rating: r.rating,
      content: r.content,
      author: maskName(db.users.find((u) => u.id === r.userId)?.name ?? ''),
      createdAt: r.createdAt,
    })),
    page: page.page,
    size: page.size,
    total: page.total,
  };
}

/** R-01 응답. */
export function toWireCreatedReview(row: ReviewRow): WireCreatedReview {
  return {
    reviewId: row.id,
    storeId: row.storeId,
    rating: row.rating,
    content: row.content,
    createdAt: row.createdAt,
  };
}
