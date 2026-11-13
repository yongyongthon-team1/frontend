import { RecentReviewList } from '@/features/reviews/components/RecentReviews';
import type { StoreReportView } from '@/features/stores/model';
import { useStoreReportView } from '@/features/stores/queries';
import { formatMonthDay } from '@/shared/lib/date';
import { AiBadge } from '@/shared/ui/AiBadge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

const TITLE = '방문 · 리뷰 리포트';

/** `YYYY-MM-DD`를 `M월 D일`로(서울 날짜). */
const dayLabel = (key: string) => formatMonthDay(`${key}T00:00:00+09:00`);

/**
 * 사장님 방문 · 리뷰 리포트(S-07, owner-s04, V2 시안 없음 — V2 부품으로 그리고 디자이너 공유 메모를 남겼다). 숫자 카드 셋
 * (기간 안의 방문 · 평균 별점 · 리뷰) 아래에 AI 리뷰 요약과 최근 리뷰. 리포트 · 내 가게 · 상점 리뷰 합성은 `useStoreReportView`가 한다.
 */
export function StoreReportPage() {
  const query = useStoreReportView();
  const { data } = query;

  if (data === undefined) {
    return (
      <>
        <TopBar title={TITLE} back="/owner/store" />
        <Page>
          {query.isError ? (
            <div className="mt-3">
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            </div>
          ) : (
            <div aria-busy="true" aria-label="리포트를 불러오는 중">
              <Skeleton className="mt-3 h-[72px] w-3/4" />
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Skeleton className="h-[88px] rounded-xl" />
                <Skeleton className="h-[88px] rounded-xl" />
                <Skeleton className="h-[88px] rounded-xl" />
              </div>
              <Skeleton className="mt-4 h-[120px] rounded-xl" />
            </div>
          )}
        </Page>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <TopBar title={TITLE} back="/owner/store" />
        <Page className="pt-3">
          <EmptyState
            title="연결된 가게가 없어요"
            description="가게를 연결하면 리포트를 볼 수 있어요."
            action={{ to: '/owner/store', label: '내 가게로' }}
          />
        </Page>
      </>
    );
  }

  return <Report view={data} />;
}

function Report({ view }: { view: StoreReportView }) {
  const { report, reviews } = view;
  const noActivity = report.visitCount === 0 && report.reviewCount === 0 && reviews.count === 0;

  return (
    <>
      <TopBar title={TITLE} back="/owner/store" />
      <Page>
        <PageHeading
          as="h2"
          title={'우리 가게를 찾은\n학생들이에요.'}
          description={`${dayLabel(report.from)} ~ ${dayLabel(report.to)} 기준이에요.`}
          className="mt-3"
        />

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StatCard value={`${report.visitCount}명`} label="투어로 온 학생" />
          <StatCard
            value={report.averageRating === null ? '-' : report.averageRating.toFixed(1)}
            label="평균 별점"
          />
          <StatCard value={`${report.reviewCount}개`} label="리뷰" />
        </div>

        {noActivity ? (
          <div className="mt-4">
            <EmptyState
              title="아직 투어로 온 학생이 없어요"
              description="학생들이 쿠폰을 쓰고 리뷰를 남기면 여기에 모여요."
              action={{ to: '/owner/coupons/redeem', label: '쿠폰 사용 처리하기' }}
            />
          </div>
        ) : (
          <>
            <section className="mt-4 rounded-xl bg-surface p-5">
              <AiBadge>AI 리뷰 요약</AiBadge>
              <p className="mt-3 text-[15px] break-words text-ink">
                {reviews.summary ?? '리뷰가 더 모이면 AI가 요약해 드려요.'}
              </p>
              {reviews.summary !== null ? (
                <p className="mt-2 text-xs text-muted">{`전체 리뷰 ${reviews.count}개를 요약했어요.`}</p>
              ) : null}
            </section>

            <h2 className="mt-8 mb-3 text-lg font-bold text-ink">최근 리뷰</h2>
            {reviews.items.length === 0 ? (
              <p className="text-[13px] text-muted">아직 리뷰가 없어요.</p>
            ) : (
              <RecentReviewList items={reviews.items} />
            )}
          </>
        )}
      </Page>
    </>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl bg-brand-soft px-2 py-4 text-center">
      <p className="text-xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
