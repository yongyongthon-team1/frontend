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

/** 코스 지점의 상점 시트(설계 5.6): 시간 · 추천 이유 · AI 리뷰 요약 · 별점 · 데이터 출처 · 제휴 혜택과 쿠폰. */
export function StoreSheet({ stop, coupon, onOpenChange }: StoreSheetProps) {
  return (
    <BottomSheet open={stop !== null} onOpenChange={onOpenChange} title={stop?.name ?? ''}>
      {stop ? <StoreDetail stop={stop} coupon={coupon} /> : null}
    </BottomSheet>
  );
}

function StoreDetail({ stop, coupon }: { stop: CourseStop; coupon: Coupon | null }) {
  const { review, partnership } = stop;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{`${stop.visitTime} · ${stop.category}`}</p>

      {stop.recommendationReason ? (
        <div className="rounded-md bg-surface p-4">
          <AiBadge>추천 이유</AiBadge>
          <p className="mt-2 text-sm text-ink">{stop.recommendationReason}</p>
        </div>
      ) : null}

      {review && review.count > 0 ? (
        <div>
          {review.summary ? (
            <>
              <p className="text-sm font-bold text-ink">✦ AI 리뷰 요약</p>
              <p className="mt-1.5 text-sm text-ink">{review.summary}</p>
            </>
          ) : null}
          <p className="mt-1.5 text-sm text-muted">
            {review.average === null
              ? `리뷰 ${review.count}개`
              : `별점 ${review.average.toFixed(1)} · 리뷰 ${review.count}개`}
          </p>
        </div>
      ) : review ? (
        <p className="text-sm text-muted">아직 리뷰가 없어요.</p>
      ) : null}

      {stop.dataSource ? <p className="text-xs text-muted">{stop.dataSource}</p> : null}

      {partnership ? (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <p className="text-base font-bold text-ink">{`제휴 혜택 · ${partnership.discount}`}</p>
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
