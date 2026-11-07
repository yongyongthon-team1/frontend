import { Link } from 'react-router';
import type { Coupon } from '@/features/coupons/model';
import type { CourseStop } from '@/features/courses/model';
import { AiBadge } from '@/shared/ui/AiBadge';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { buttonClass } from '@/shared/ui/buttonStyles';

export interface StoreSheetProps {
  /** 연 지점. null이면 시트가 닫혀 있다. */
  stop: CourseStop | null;
  /** 이 지점 상점으로 발급된 내 쿠폰. 없으면 제휴 혜택만 보이고 쿠폰 보기 버튼은 없다. */
  coupon: Coupon | null;
  onOpenChange(open: boolean): void;
}

/**
 * 코스 지점의 상점 시트(설계 5.6 · V2): 흰 시트에 시간 · 업종 → AI 추천 이유(페일 블루) → ✦ AI 리뷰 요약 · 별점 → 데이터 출처
 * → 제휴 혜택(페일 피치)과 쿠폰 보기.
 */
export function StoreSheet({ stop, coupon, onOpenChange }: StoreSheetProps) {
  return (
    <BottomSheet open={stop !== null} onOpenChange={onOpenChange} title={stop?.name ?? ''}>
      {stop ? <StoreDetail stop={stop} coupon={coupon} /> : null}
    </BottomSheet>
  );
}

function StoreDetail({ stop, coupon }: { stop: CourseStop; coupon: Coupon | null }) {
  const { review, partnership } = stop;
  // AI 요약은 리뷰 수가 없어도(실서버에는 리뷰 수가 없다) 보이고, 별점 줄은 리뷰가 있을 때만이다(2C-R12 ⑥).
  const hasSummary = Boolean(review?.summary);
  const hasReviews = review !== null && review.count > 0;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">{`${stop.visitTime} · ${stop.category}`}</p>

      {stop.recommendationReason ? (
        <div className="rounded-lg bg-brand-soft p-4">
          <AiBadge>추천 이유</AiBadge>
          <p className="mt-2 text-sm text-ink">{stop.recommendationReason}</p>
        </div>
      ) : null}

      {review && (hasSummary || hasReviews) ? (
        <div className="rounded-lg bg-bg p-4">
          {hasSummary ? (
            <>
              <p className="text-sm font-bold text-brand">✦ AI 리뷰 요약</p>
              <p className="mt-1.5 text-sm text-ink">{review.summary}</p>
            </>
          ) : null}
          {hasReviews ? (
            <p className="mt-1.5 flex items-center gap-1 text-[13px] text-muted">
              <span aria-hidden className="text-warning">
                ★
              </span>
              <span>
                {review.average === null
                  ? `리뷰 ${review.count}개`
                  : `별점 ${review.average.toFixed(1)} · 리뷰 ${review.count}개`}
              </span>
            </p>
          ) : null}
        </div>
      ) : review ? (
        <p className="text-[13px] text-muted">아직 리뷰가 없어요.</p>
      ) : null}

      {stop.dataSource ? <p className="text-xs text-muted">{stop.dataSource}</p> : null}

      {partnership ? (
        <div className="flex flex-col gap-3 rounded-lg bg-local-soft p-4">
          <p className="text-[17px] font-bold text-ink">{`제휴 혜택 · ${partnership.discount}`}</p>
          {coupon ? (
            <Link to={`/coupons/${coupon.id}`} className={buttonClass('primary')}>
              쿠폰 보기
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
