import { useEffect } from 'react';
import { useParams } from 'react-router';
import { couponStateLabel, type CouponState } from '@/features/coupons/model';
import { useMyCoupon } from '@/features/coupons/queries';
import { useDemoStore } from '@/demo/demoStore';
import { formatMonthDay } from '@/shared/lib/date';
import { cn } from '@/shared/lib/cn';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const STATE_HINT: Record<CouponState, string> = {
  BEFORE_DAY: '사장님이 코드를 입력하면 사용 완료로 바뀌어요.',
  USABLE: '사장님이 코드를 입력하면 사용 완료로 바뀌어요.',
  USED: '리뷰를 남기면 가게 AI 요약에 반영돼요.',
  EXPIRED: '이 쿠폰은 더 이상 쓸 수 없어요.',
};

/**
 * 쿠폰 상세(hs-s09). 사장님께 보여 줄 6자리 코드를 위쪽에 크게 둔다(무대 시연에서 스크롤 없이 보여야 한다).
 * 상태는 서버가 준 값을 그리고, 아직 쓸 수 있는 쿠폰이면 훅이 5초마다 다시 불러와 사장님의 사용 처리를 반영한다.
 */
export function CouponDetailPage() {
  const couponId = Number(useParams().couponId);
  const query = useMyCoupon(couponId);
  const { data: coupon } = query;
  const setLastCoupon = useDemoStore((s) => s.setLastCoupon);
  const code = coupon?.code;
  const storeId = coupon?.storeId;

  // 시연 도구가 사장님 쪽에서 이 쿠폰을 바로 열 수 있게 마지막으로 본 쿠폰을 기억한다.
  useEffect(() => {
    if (code !== undefined && storeId !== undefined) setLastCoupon({ code, storeId });
  }, [code, storeId, setLastCoupon]);

  if (query.isError) {
    return (
      <>
        <TopBar title="내 쿠폰" back />
        <Page>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Page>
      </>
    );
  }
  if (coupon === undefined) {
    return (
      <>
        <TopBar title="내 쿠폰" back />
        <Page>
          <Skeleton className="h-12" />
          <Skeleton className="mt-4 h-8 w-3/4" />
          <Skeleton className="mt-4 h-40" />
          <Skeleton className="mt-3 h-24" />
        </Page>
      </>
    );
  }

  const spent = coupon.state === 'USED' || coupon.state === 'EXPIRED';

  return (
    <>
      <TopBar title="내 쿠폰" back />
      <Page>
        <StatusChip>탐방 당일에만 사용 가능</StatusChip>
        <h2 className="mt-4 text-xl leading-snug font-bold text-ink">오늘의 로컬 혜택</h2>

        <InfoCard className="mt-4" title="쿠폰 코드" description="사장님께 아래 번호를 보여주세요.">
          <p
            data-testid="coupon-code"
            className={cn(
              'py-2 text-center text-4xl font-bold tabular-nums',
              spent ? 'text-muted' : 'text-ink',
            )}
          >
            {coupon.code.split('').join(' ')}
          </p>
        </InfoCard>

        <InfoCard
          className="mt-3"
          muted
          title={coupon.storeName}
          description="탐방 코스에 포함된 제휴 상점이에요."
        />
        <InfoCard
          className="mt-3"
          title={coupon.discount}
          description={`쿠폰 1회 사용 / ${formatMonthDay(coupon.tourStartsAt)} 당일 만료`}
        />
        <InfoCard
          className="mt-3"
          muted
          title={couponStateLabel(coupon.state, coupon.usedAt)}
          description={STATE_HINT[coupon.state]}
        />

        <p className="mt-4 text-xs text-muted">탐방 취소 시 해당 쿠폰은 자동 만료됩니다.</p>
      </Page>
    </>
  );
}
