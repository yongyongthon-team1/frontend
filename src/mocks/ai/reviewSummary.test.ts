import { describe, expect, it } from 'vitest';
import { summarizeReviews } from './reviewSummary';

const review = (id: number, rating: number, content: string, createdAt: string) => ({
  id,
  rating,
  content,
  createdAt,
});

describe('summarizeReviews (2B′-R18)', () => {
  it('리뷰가 없으면 null', () => {
    expect(summarizeReviews([])).toBeNull();
  });

  it('학생 수 · 평균(소수 첫째) · 가장 최근 내용을 문장 틀에 넣는다', () => {
    expect(
      summarizeReviews([
        review(1, 5, 'old', '2026-10-01T10:00:00+09:00'),
        review(2, 4, 'a', '2026-10-02T10:00:00+09:00'),
      ]),
    ).toBe('학생 2명이 평균 4.5점을 줬어요. 최근 리뷰에서는 "a"라는 이야기가 나왔어요.');
  });

  it('입력 순서와 상관없이 createdAt 내림차순, 같으면 id 내림차순으로 가장 최근을 고른다', () => {
    const same = '2026-10-02T10:00:00+09:00';
    expect(
      summarizeReviews([
        review(3, 4, 'third', same),
        review(5, 4, 'fifth', same),
        review(4, 4, 'x', same),
      ]),
    ).toContain('"fifth"');
  });

  it('최근 내용이 30자를 넘으면 앞 29자 + …', () => {
    const long = '가'.repeat(31);
    expect(summarizeReviews([review(1, 5, long, '2026-10-01T10:00:00+09:00')])).toBe(
      `학생 1명이 평균 5.0점을 줬어요. 최근 리뷰에서는 "${'가'.repeat(29)}…"라는 이야기가 나왔어요.`,
    );
  });

  it('정확히 30자면 그대로 둔다', () => {
    const exact = '나'.repeat(30);
    expect(summarizeReviews([review(1, 3, exact, '2026-10-01T10:00:00+09:00')])).toContain(
      `"${exact}"`,
    );
  });
});
