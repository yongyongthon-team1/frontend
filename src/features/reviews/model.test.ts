import { describe, expect, it } from 'vitest';
import type { Coupon } from '@/features/coupons/model';
import {
  courseStorePath,
  mergeStoreReview,
  reviewBlock,
  reviewEntry,
  reviewLandingPath,
  reviewNewPath,
} from './model';

const COUPON: Pick<Coupon, 'id' | 'state' | 'reviewWritten' | 'applicationId' | 'storeId'> = {
  id: 7,
  state: 'USED',
  reviewWritten: false,
  applicationId: 3,
  storeId: 1,
};

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

describe('리뷰 경로 (2B′-R17)', () => {
  it('리뷰 쓰기 주소와 상점 시트를 연 코스 주소', () => {
    expect(reviewNewPath(7)).toBe('/reviews/new?couponId=7');
    expect(courseStorePath(3, 1)).toBe('/my-tours/3/course?storeId=1');
  });
});

describe('reviewEntry', () => {
  it('쿠폰이 없거나 USED가 아니면 null', () => {
    expect(reviewEntry(null)).toBeNull();
    expect(reviewEntry({ ...COUPON, state: 'USABLE' })).toBeNull();
    expect(reviewEntry({ ...COUPON, state: 'EXPIRED' })).toBeNull();
    expect(reviewEntry({ ...COUPON, state: 'BEFORE_DAY' })).toBeNull();
  });

  it('USED + 미작성은 WRITE(쓰는 주소), 작성했으면 DONE', () => {
    expect(reviewEntry(COUPON)).toEqual({ kind: 'WRITE', to: '/reviews/new?couponId=7' });
    expect(reviewEntry({ ...COUPON, reviewWritten: true })).toEqual({ kind: 'DONE' });
  });
});

describe('reviewLandingPath', () => {
  it('신청이 APPROVED면 그 상점 시트를 연 코스, 아니면 쿠폰 상세', () => {
    expect(reviewLandingPath(COUPON, 'APPROVED')).toBe('/my-tours/3/course?storeId=1');
    expect(reviewLandingPath(COUPON, null)).toBe('/coupons/7');
    expect(reviewLandingPath(COUPON, 'CANCELED')).toBe('/coupons/7');
  });
});

describe('reviewBlock', () => {
  it('쓸 수 있으면 null', () => {
    expect(reviewBlock(COUPON, 'APPROVED')).toBeNull();
  });

  it('USED가 아니면 쓸 수 없다는 사유 + 쿠폰 보기', () => {
    expect(reviewBlock({ ...COUPON, state: 'USABLE' }, 'APPROVED')).toEqual({
      reason: '쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요.',
      action: { label: '쿠폰 보기', to: '/coupons/7' },
    });
  });

  it('이미 썼으면 사유 + (APPROVED면 코스 지도 보기, 아니면 쿠폰 보기)', () => {
    const written = { ...COUPON, reviewWritten: true };
    expect(reviewBlock(written, 'APPROVED')).toEqual({
      reason: '이미 리뷰를 작성했어요.',
      action: { label: '코스 지도 보기', to: '/my-tours/3/course?storeId=1' },
    });
    expect(reviewBlock(written, null)).toEqual({
      reason: '이미 리뷰를 작성했어요.',
      action: { label: '쿠폰 보기', to: '/coupons/7' },
    });
  });
});
