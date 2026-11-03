import { Link, useParams } from 'react-router';
import { couponStateLabel } from '@/features/coupons/model';
import { useMyCoupons } from '@/features/coupons/queries';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

/** 내 쿠폰 목록(hs-s09). 이 신청에 발급된 쿠폰을 상점별로 보여 주고, 누르면 6자리 코드가 있는 상세로 간다. */
export function CouponListPage() {
  const applicationId = Number(useParams().applicationId);
  const query = useMyCoupons(applicationId);
  const { data: coupons } = query;

  return (
    <>
      <TopBar title="내 쿠폰" back />
      <Page>
        {coupons === undefined && query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : coupons === undefined ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="mt-3 h-24" />
          </>
        ) : coupons.length === 0 ? (
          <EmptyState
            title="발급된 쿠폰이 없어요."
            description="코스에 제휴 상점이 있으면 코스 확정 때 쿠폰이 발급돼요."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {coupons.map((coupon) => (
              <li key={coupon.id}>
                <Link
                  to={`/coupons/${coupon.id}`}
                  className="block rounded-lg border border-border bg-bg p-5"
                >
                  <span className="block text-base font-bold text-ink">{coupon.storeName}</span>
                  <span className="mt-1.5 block text-sm text-muted">{coupon.discount}</span>
                  <StatusChip className="mt-3">
                    {couponStateLabel(coupon.state, coupon.usedAt)}
                  </StatusChip>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
