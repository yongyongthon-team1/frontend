import type { ReviewRow } from '@/mocks/db/schema';

// R-03 AI 리뷰 요약 흉내(2B′-R18). 실서버는 LLM이 대신한다 — 문장 틀은 제안 문구이고, 이름 같은 개인정보를 넣지 않는다.

type ReviewLike = Pick<ReviewRow, 'id' | 'rating' | 'content' | 'createdAt'>;

const QUOTE_MAX = 30;

/** 평균 별점: 소수 첫째 자리, 빈 배열은 null. 목업 응답(R-02 · 코스 지점 · 리포트)이 모두 이것을 쓴다(errata PM1). */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10;
}

/** 최근 것이 앞으로: 작성 시각 내림차순, 같으면 id 내림차순. */
export function newestFirst(a: ReviewLike, b: ReviewLike): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
}

/**
 * 상점 리뷰 전부로 만든 요약 한 문장. 리뷰가 없으면 null. 가장 최근 리뷰 내용이 30자를 넘으면 앞 29자 + `…`로 줄여 인용한다.
 */
export function summarizeReviews(reviews: ReviewLike[]): string | null {
  const [latest] = [...reviews].sort(newestFirst);
  if (latest === undefined) return null;
  const average = averageRating(reviews.map((r) => r.rating))!;
  const letters = Array.from(latest.content.trim());
  const quote =
    letters.length > QUOTE_MAX ? `${letters.slice(0, QUOTE_MAX - 1).join('')}…` : letters.join('');
  return `학생 ${reviews.length}명이 평균 ${average.toFixed(1)}점을 줬어요. 최근 리뷰에서는 "${quote}"라는 이야기가 나왔어요.`;
}
