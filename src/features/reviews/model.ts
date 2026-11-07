// 상점 리뷰(R-01 · R-02)의 도메인 모양과 상수. 화면(상점 시트 · 리포트 · 리뷰 쓰기)이 같이 쓴다.

import type { ApplicationStatus } from '@/features/applications/model';
import type { Coupon } from '@/features/coupons/model';
import type { CourseStop } from '@/features/courses/model';
import { errorMessage } from '@/shared/lib/errors';
import type { ActionLink } from '@/shared/lib/types';

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

/** 상점 시트가 그리는 요약 · 평균 · 수. */
export interface MergedStoreReview {
  summary: string | null;
  average: number | null;
  count: number;
}

/**
 * 상점 시트의 리뷰 값(2B′-R16): R-02 응답이 오면 그 요약 · 평균 · 수(전체 기준), 오기 전이나 실패하면 코스 지점 값, 둘 다 없으면
 * null. 데이터 우선 — 로딩 · 실패에 오류 문구를 두지 않는다.
 */
export function mergeStoreReview(
  stop: CourseStop['review'],
  fetched: StoreReviews | undefined,
): MergedStoreReview | null {
  if (fetched !== undefined) {
    return { summary: fetched.summary, average: fetched.average, count: fetched.count };
  }
  return stop;
}

/** H12 리뷰 쓰기 화면의 주소. */
export function reviewNewPath(couponId: number): string {
  return `/reviews/new?couponId=${couponId}`;
}

/** 그 상점 지점의 시트를 연 채 시작하는 코스 지도 주소(리뷰를 쓴 뒤 AI 요약 갱신이 보이는 곳). */
export function courseStorePath(applicationId: number, storeId: number): string {
  return `/my-tours/${applicationId}/course?storeId=${storeId}`;
}

/** 쿠폰에서 리뷰로 가는 길: 쓰러 가기(WRITE) · 이미 씀(DONE) · 해당 없음(null). */
export type ReviewEntry = { kind: 'WRITE'; to: string } | { kind: 'DONE' } | null;

export function reviewEntry(
  coupon: Pick<Coupon, 'id' | 'state' | 'reviewWritten'> | null,
): ReviewEntry {
  if (coupon === null || coupon.state !== 'USED') return null;
  return coupon.reviewWritten ? { kind: 'DONE' } : { kind: 'WRITE', to: reviewNewPath(coupon.id) };
}

/** 리뷰를 쓴 뒤 가는 곳(2B′-R17): 신청이 승인 상태면 그 상점 시트를 연 코스, 아니면 쿠폰 상세. */
export function reviewLandingPath(
  coupon: Pick<Coupon, 'id' | 'applicationId' | 'storeId'>,
  applicationStatus: ApplicationStatus | null,
): string {
  return applicationStatus === 'APPROVED'
    ? courseStorePath(coupon.applicationId, coupon.storeId)
    : `/coupons/${coupon.id}`;
}

/** 리뷰를 쓸 수 없는 쿠폰의 사유 + 다음 행동. 쓸 수 있으면 null. */
export function reviewBlock(
  coupon: Pick<Coupon, 'id' | 'state' | 'reviewWritten' | 'applicationId' | 'storeId'>,
  applicationStatus: ApplicationStatus | null,
): { reason: string; action: ActionLink } | null {
  const couponLink: ActionLink = { label: '쿠폰 보기', to: `/coupons/${coupon.id}` };
  if (coupon.state !== 'USED') {
    return { reason: errorMessage('REVIEW_NOT_ALLOWED'), action: couponLink };
  }
  if (coupon.reviewWritten) {
    return {
      reason: errorMessage('REVIEW_DUPLICATE'),
      action:
        applicationStatus === 'APPROVED'
          ? { label: '코스 지도 보기', to: courseStorePath(coupon.applicationId, coupon.storeId) }
          : couponLink,
    };
  }
  return null;
}
