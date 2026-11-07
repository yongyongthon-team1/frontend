import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/shared/lib/cn';
import type { Coupon } from '@/features/coupons/model';
import { buttonClass, type ButtonSize } from '@/shared/ui/buttonStyles';
import { reviewEntry } from '../model';

export interface ReviewEntryLinkProps {
  coupon: Coupon | null;
  size?: ButtonSize;
  /** 쓰러 가는 링크의 글(기본 `리뷰 쓰기`). */
  label?: string;
  className?: string;
}

/**
 * 쿠폰에서 리뷰 쓰기로 가는 입구(R-01). 사용 완료 + 미작성이면 primary 링크, 이미 썼으면 체크 + `리뷰 작성 완료`(버튼이 아니다),
 * 그 밖에는 아무것도 그리지 않는다.
 */
export function ReviewEntryLink({
  coupon,
  size,
  label = '리뷰 쓰기',
  className,
}: ReviewEntryLinkProps) {
  const entry = reviewEntry(coupon);
  if (entry === null) return null;
  if (entry.kind === 'DONE') {
    return (
      <p
        className={cn('flex min-h-11 items-center gap-1.5 text-sm font-bold text-muted', className)}
      >
        <Check aria-hidden className="size-4 text-success" strokeWidth={2.5} />
        리뷰 작성 완료
      </p>
    );
  }
  return (
    <Link to={entry.to} className={cn(buttonClass('primary', size), className)}>
      {label}
    </Link>
  );
}
