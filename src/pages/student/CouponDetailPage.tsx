import { Check } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import {
  couponStateLabel,
  couponStateTone,
  formatCouponCode,
  type Coupon,
} from '@/features/coupons/model';
import { useMyCoupon } from '@/features/coupons/queries';
import { ReviewEntryLink } from '@/features/reviews/components/ReviewEntryLink';
import { useDemoStore } from '@/demo/demoStore';
import { cn } from '@/shared/lib/cn';
import { formatDotDate, formatDotDateWeekday, formatTime } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Illustration } from '@/shared/ui/Illustration';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

/** 쿠폰 카드 윗부분: 상태 칩 · 상점 이름 · 혜택. 상점이 코드보다 먼저다(판정 23). */
function StoreBlock({ coupon, chip }: { coupon: Coupon; chip: string }) {
  return (
    <>
      <StatusChip tone={couponStateTone(coupon.state)}>{chip}</StatusChip>
      <h3 className="mt-3 text-[19px] leading-[1.4] font-bold text-ink">{coupon.storeName}</h3>
      <p className="text-[15px] text-muted">{coupon.discount}</p>
    </>
  );
}

/** 사용 완료(V2 H15): 같은 주소의 쿠폰이 USED가 되면 이 모습이다. 코드는 지난 번호로만 남긴다. */
function UsedCoupon({ coupon }: { coupon: Coupon }) {
  const usedAt = coupon.usedAt;
  return (
    <>
      <TopBar title="쿠폰 사용 완료" back />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="쿠폰을 사용했어요!"
          description="방문한 가게의 경험을 남겨주세요."
          className="mt-3"
        />

        <section className="mt-5 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-surface text-brand"
          >
            <Check className="size-6" strokeWidth={2.5} />
          </span>
          <p className="mt-3 text-xl leading-snug font-bold text-ink">사용 완료</p>
          {usedAt ? (
            <p className="mt-1 text-[13px] text-muted">
              {`${formatDotDateWeekday(usedAt)} ${formatTime(usedAt)} · 사장님 확인 완료`}
            </p>
          ) : null}
        </section>

        <section className="mt-3 rounded-lg bg-surface p-4">
          <StoreBlock coupon={coupon} chip="사용 완료" />
          <p className="mt-1 text-[13px] text-muted">
            쿠폰 번호{' '}
            <span data-testid="coupon-code" className="tabular-nums">
              {formatCouponCode(coupon.code)}
            </span>
          </p>
        </section>

        <p className="mt-3 rounded-lg bg-brand-soft px-4 py-3 text-[13px] text-muted">
          쿠폰은 한 번만 사용할 수 있어요.
        </p>

        <BottomAction>
          <ReviewEntryLink coupon={coupon} label="방문 리뷰 작성하기" />
        </BottomAction>
      </Page>
    </>
  );
}

/**
 * 쿠폰 상세(hs-s09 · V2 H05 · H15). 사장님께 보여 줄 코드를 크게 보여 준다(무대 시연에서 스크롤 없이 보여야 한다).
 * 상태는 서버가 준 값을 그리고, 아직 쓸 수 있는 쿠폰이면 훅이 5초마다 다시 불러와 사장님의 사용 처리를 반영한다 —
 * 그 값이 USED로 바뀌면 같은 화면이 사용 완료 모습으로 바뀐다.
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

  // 다시 불러오다 실패해도 이미 받은 쿠폰은 그대로 보인다 — 시연 중 코드가 오류 화면으로 바뀌면 안 된다.
  if (coupon === undefined && query.isError) {
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
          <Skeleton className="mt-3 h-12 w-3/4" />
          <Skeleton className="mt-4 h-[120px] rounded-xl" />
          <Skeleton className="mt-3 h-[200px] rounded-xl" />
        </Page>
      </>
    );
  }

  if (coupon.state === 'USED') return <UsedCoupon coupon={coupon} />;

  const expired = coupon.state === 'EXPIRED';

  return (
    <>
      <TopBar title="내 쿠폰" back />
      <Page>
        <PageHeading
          as="h2"
          title="투어의 작은 혜택"
          description="함께 둘러볼 동네 가게에서 사용해요."
          className="mt-3"
        />

        {/* 무대 예산(2A-R4): 코드가 하단 탭 위에 보이도록 일러스트 상자는 낮게(88) 둔다. */}
        <div className="mt-3 flex h-[88px] items-center justify-center rounded-xl bg-local-soft">
          <Illustration kind="cafe" className="h-[76px] w-auto object-contain" />
        </div>

        <section className="mt-3 rounded-xl bg-surface p-5">
          <StoreBlock coupon={coupon} chip={couponStateLabel(coupon.state, coupon.usedAt)} />
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs text-muted">쿠폰 코드</p>
            <p
              data-testid="coupon-code"
              className={cn(
                'text-[29px] leading-[1.4] font-bold tabular-nums',
                expired ? 'text-muted' : 'text-ink',
              )}
            >
              {formatCouponCode(coupon.code)}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {`${formatDotDate(coupon.tourStartsAt)} 투어 당일에만 사용할 수 있어요.`}
            </p>
          </div>
        </section>

        <p className="mt-3 text-xs text-muted">
          {expired
            ? '이 쿠폰은 더 이상 쓸 수 없어요.'
            : '사장님에게 코드를 보여 주세요. 사용 완료 후 리뷰를 쓸 수 있어요.'}
        </p>

        {/* 하단에 고정하지 않는다: 고정 버튼은 무대 화면에서 위쪽 코드를 덮는다. */}
        <Link
          to={`/my-tours/${coupon.applicationId}/course`}
          className={cn(buttonClass('primary'), 'mt-4')}
        >
          코스 지도로 돌아가기
        </Link>
      </Page>
    </>
  );
}
