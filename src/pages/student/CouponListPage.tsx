import { Navigate, useParams } from 'react-router';
import { couponStateLabel, couponStateTone } from '@/features/coupons/model';
import { useMyCoupons } from '@/features/coupons/queries';
import { ReviewEntryLink } from '@/features/reviews/components/ReviewEntryLink';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { ListRow } from '@/shared/ui/ListRow';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

/**
 * 내 쿠폰 목록(hs-s09). 이 신청에 발급된 쿠폰을 상점별로 보여 주고, 누르면 코드가 있는 상세로 간다.
 * 쿠폰이 1장뿐이면 고를 것이 없으니 바로 상세로 간다 — `replace`라 상세에서 뒤로 가면 목록이 아니라 그 앞 화면이고,
 * 목록 → 상세 이동이 되풀이되지 않는다.
 */
export function CouponListPage() {
  const applicationId = Number(useParams().applicationId);
  const query = useMyCoupons(applicationId);
  const { data: coupons } = query;

  if (coupons?.length === 1) return <Navigate to={`/coupons/${coupons[0]!.id}`} replace />;

  return (
    <>
      <TopBar title="내 쿠폰" back />
      <Page>
        {coupons === undefined && query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : coupons === undefined ? (
          <>
            <Skeleton className="h-[90px]" />
            <Skeleton className="mt-3 h-[90px]" />
          </>
        ) : coupons.length === 0 ? (
          <EmptyState
            title="발급된 쿠폰이 없어요."
            description="코스에 제휴 상점이 있으면 코스 확정 때 쿠폰이 발급돼요."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {coupons.map((coupon) => (
              <li key={coupon.id}>
                <ListRow
                  to={`/coupons/${coupon.id}`}
                  eyebrow={coupon.storeCategory}
                  title={coupon.storeName}
                  meta={coupon.discount}
                  right={
                    <StatusChip tone={couponStateTone(coupon.state)}>
                      {couponStateLabel(coupon.state, coupon.usedAt)}
                    </StatusChip>
                  }
                />
                {/* 행 전체가 링크라 링크 안에 링크를 넣지 않고 형제로 둔다. */}
                <ReviewEntryLink coupon={coupon} size="sm" className="mt-1" />
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
