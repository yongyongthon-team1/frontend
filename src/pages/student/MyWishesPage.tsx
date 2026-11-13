import { Link } from 'react-router';
import { WishCard } from '@/features/wishes/components/WishCard';
import { useMyWishes } from '@/features/wishes/queries';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

/**
 * T-07 내 희망 사항(V2 부품, 시안 없음 — 결정 0011). 남긴 그대로 최신순으로 보이고 카드마다 `고치기`가 있다.
 * 고쳐도 이미 본 탐방 결과는 바뀌지 않는다(희망 사항은 저장만 한다).
 */
export function MyWishesPage() {
  const query = useMyWishes();
  const { data: wishes } = query;
  return (
    <>
      <TopBar title="내 희망 사항" back="/me" />
      <Page className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          남긴 그대로 보여요. 고쳐도 이미 본 투어 결과는 바뀌지 않아요.
        </p>
        {wishes === undefined ? (
          query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-[140px] rounded-xl" />
              <Skeleton className="h-[140px] rounded-xl" />
            </div>
          )
        ) : wishes.length === 0 ? (
          <EmptyState
            title="아직 남긴 희망 사항이 없어요"
            description="홈에서 학교 · 학과와 하고 싶은 것을 남겨 보세요."
            action={{ label: '희망 사항 남기러 가기', to: '/' }}
          />
        ) : (
          <ul aria-label="내 희망 사항" className="flex flex-col gap-3">
            {wishes.map((wish) => (
              <li key={wish.id}>
                <WishCard
                  wish={wish}
                  action={
                    <Link
                      to={`/me/wishes/${wish.id}/edit`}
                      className={buttonClass('secondary', 'sm')}
                    >
                      고치기
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  );
}
