import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { averageRating, latestReviewSummary, maskName } from '@/mocks/wire/reviews';
import type { ErrorCode } from '@/shared/lib/errors';
import { redeemCoupon } from './coupons';
import { createReview, listStoreReviews } from './reviews';

const today = new Date('2026-11-15T01:00:00Z'); // 시연일 KST 10:00, 탐방 1은 그날 14:00
const dayOf = new Date('2026-11-15T05:00:00Z'); // KST 14:00 — 사용 처리
const later = new Date('2026-11-15T07:00:00Z'); // KST 16:00 — 리뷰

let db: DB;
beforeEach(() => {
  db = createSeed(today, 'CONFIRMED');
});

const userId = (email: string) => db.users.find((u) => u.email === email)!.id;
const couponOf = (email: string, storeId: number) => {
  const apps = db.applications.filter((a) => a.userId === userId(email) && a.tourId === 1);
  return db.coupons.find(
    (c) => apps.some((a) => a.id === c.applicationId) && c.storeId === storeId,
  )!;
};
/** 그 학생의 탐방 1 쿠폰을 그 상점 사장님이 사용 처리해 USED로 만든다. */
function usedCoupon(email: string, storeId: number) {
  const coupon = couponOf(email, storeId);
  redeemCoupon(db, userId(`owner${storeId}@demo.kr`), coupon.code, dayOf);
  return coupon;
}
const body = (couponId: number, rating: unknown = 4, content: unknown = '양이 많아요') => ({
  couponId,
  rating,
  content,
});
const student = 'student@demo.kr';

function codeOf(run: () => unknown): ErrorCode | undefined {
  try {
    run();
  } catch (e) {
    return (e as { code: ErrorCode }).code;
  }
  return undefined;
}
const fieldsOf = (run: () => unknown) => {
  try {
    run();
  } catch (e) {
    return (e as { fieldErrors?: Record<string, string> }).fieldErrors;
  }
  return undefined;
};

describe('listStoreReviews', () => {
  it('createdAt 내림차순, 같으면 id 내림차순(시드 리뷰는 시각이 같다)', () => {
    const rows = listStoreReviews(db, 1);
    expect(rows).toHaveLength(5);
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('없는 상점은 404 NOT_FOUND', () => {
    expect(codeOf(() => listStoreReviews(db, 999))).toBe('NOT_FOUND');
  });
});

describe('createReview — 검사 순서', () => {
  it('없는 상점이 가장 먼저(404)', () => {
    expect(codeOf(() => createReview(db, userId(student), 999, body(1, 0, ''), later))).toBe(
      'NOT_FOUND',
    );
  });

  it.each([0, 6, 4.5, '5', null])('별점 %s는 fieldErrors.rating', (rating) => {
    const coupon = usedCoupon(student, 1);
    expect(
      fieldsOf(() => createReview(db, userId(student), 1, body(coupon.id, rating), later)),
    ).toEqual({ rating: '별점은 1~5점으로 골라 주세요.' });
  });

  it('별점 칸이 없으면 fieldErrors.rating', () => {
    const coupon = usedCoupon(student, 1);
    expect(
      fieldsOf(() =>
        createReview(db, userId(student), 1, { couponId: coupon.id, content: 'x' }, later),
      ),
    ).toHaveProperty('rating');
  });

  it('별점이 내용보다 먼저', () => {
    const coupon = usedCoupon(student, 1);
    expect(
      fieldsOf(() => createReview(db, userId(student), 1, body(coupon.id, 0, '   '), later)),
    ).toHaveProperty('rating');
  });

  it.each(['   ', '', 'x'.repeat(101), 7, null])('내용 %j는 fieldErrors.content', (content) => {
    const coupon = usedCoupon(student, 1);
    expect(
      fieldsOf(() => createReview(db, userId(student), 1, body(coupon.id, 4, content), later)),
    ).toEqual({ content: '한 줄 평은 1~100자로 적어 주세요.' });
  });

  it('내용은 앞뒤 공백을 뺀 길이로 센다(100자 + 공백은 통과)', () => {
    const coupon = usedCoupon(student, 1);
    const row = createReview(
      db,
      userId(student),
      1,
      body(coupon.id, 4, ` ${'x'.repeat(100)} `),
      later,
    );
    expect(row.content).toBe('x'.repeat(100));
  });

  it('내용이 쿠폰보다 먼저', () => {
    expect(
      fieldsOf(() => createReview(db, userId(student), 1, body(9999, 4, '  '), later)),
    ).toHaveProperty('content');
  });

  it('없는 쿠폰 · 남의 쿠폰 · 다른 상점 쿠폰 · ISSUED 쿠폰은 403 REVIEW_NOT_ALLOWED', () => {
    expect(codeOf(() => createReview(db, userId(student), 1, body(999999), later))).toBe(
      'REVIEW_NOT_ALLOWED',
    );
    const others = usedCoupon('haeun@demo.kr', 1);
    expect(codeOf(() => createReview(db, userId(student), 1, body(others.id), later))).toBe(
      'REVIEW_NOT_ALLOWED',
    );
    const store2 = usedCoupon(student, 2);
    expect(codeOf(() => createReview(db, userId(student), 1, body(store2.id), later))).toBe(
      'REVIEW_NOT_ALLOWED',
    );
    const issued = couponOf(student, 1);
    expect(issued.status).toBe('ISSUED');
    expect(codeOf(() => createReview(db, userId(student), 1, body(issued.id), later))).toBe(
      'REVIEW_NOT_ALLOWED',
    );
    expect(db.reviews).toHaveLength(10); // 검사에 걸리면 DB는 그대로
  });

  it('쿠폰 id가 숫자가 아니면 REVIEW_NOT_ALLOWED', () => {
    expect(
      codeOf(() => createReview(db, userId(student), 1, { rating: 4, content: 'x' }, later)),
    ).toBe('REVIEW_NOT_ALLOWED');
  });

  it('같은 쿠폰으로 두 번째는 409 REVIEW_DUPLICATE', () => {
    const coupon = usedCoupon(student, 1);
    createReview(db, userId(student), 1, body(coupon.id), later);
    expect(codeOf(() => createReview(db, userId(student), 1, body(coupon.id), later))).toBe(
      'REVIEW_DUPLICATE',
    );
  });

  it('같은 (사용자 · 탐방 · 상점)의 리뷰가 이미 있으면 다른 쿠폰이어도 REVIEW_DUPLICATE', () => {
    const coupon = usedCoupon(student, 1);
    createReview(db, userId(student), 1, body(coupon.id), later);
    const app = db.applications.find((a) => a.id === coupon.applicationId)!;
    db.coupons.push({ ...coupon, id: 777777, code: '999999', applicationId: app.id });
    expect(codeOf(() => createReview(db, userId(student), 1, body(777777), later))).toBe(
      'REVIEW_DUPLICATE',
    );
  });
});

describe('createReview — 저장', () => {
  it('공백을 뺀 내용으로 행을 더하고 요약 행도 더한다', () => {
    const coupon = usedCoupon(student, 1);
    const before = db.reviewSummaries.length;
    const row = createReview(db, userId(student), 1, body(coupon.id, 4, '  양이 많아요  '), later);
    expect(row).toMatchObject({
      userId: userId(student),
      tourId: 1,
      storeId: 1,
      couponId: coupon.id,
      rating: 4,
      content: '양이 많아요',
    });
    expect(row.createdAt).toBe('2026-11-15T16:00:00+09:00');
    expect(db.reviews).toContain(row);
    expect(db.reviewSummaries).toHaveLength(before + 1);
    expect(db.reviewSummaries.at(-1)).toMatchObject({
      storeId: 1,
      reviewCount: 6,
      generatedAt: '2026-11-15T16:00:00+09:00',
    });
    const summary = latestReviewSummary(db, 1)!.summary;
    expect(summary.startsWith('학생 6명이')).toBe(true);
    expect(summary).toContain('평균 4.5점');
    expect(summary).toContain('"양이 많아요"');
  });

  it('다른 상점의 요약은 건드리지 않는다', () => {
    const coupon = usedCoupon(student, 1);
    const store2 = latestReviewSummary(db, 2);
    createReview(db, userId(student), 1, body(coupon.id), later);
    expect(latestReviewSummary(db, 2)).toBe(store2);
  });
});

describe('maskName · averageRating · latestReviewSummary (mocks/wire/reviews)', () => {
  it.each([
    ['김하늘', '김*늘'],
    ['남궁민수', '남**수'],
    ['이준', '이*'],
    ['김', '*'],
  ])('maskName(%s) → %s', (name, masked) => {
    expect(maskName(name)).toBe(masked);
  });

  it('averageRating: 소수 첫째 자리, 빈 배열은 null', () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([5, 5, 4, 5, 4])).toBe(4.6);
    expect(averageRating([5, 4])).toBe(4.5);
  });

  it('latestReviewSummary: generatedAt 내림차순, 같으면 id 내림차순, 없으면 undefined', () => {
    expect(latestReviewSummary(db, 999)).toBeUndefined();
    const base = { storeId: 1, reviewCount: 5 };
    db.reviewSummaries.push(
      { ...base, id: 50, summary: 'older id', generatedAt: '2026-12-01T10:00:00+09:00' },
      { ...base, id: 51, summary: 'newer id', generatedAt: '2026-12-01T10:00:00+09:00' },
      { ...base, id: 49, summary: 'earlier', generatedAt: '2026-11-30T10:00:00+09:00' },
    );
    expect(latestReviewSummary(db, 1)!.summary).toBe('newer id');
  });
});
