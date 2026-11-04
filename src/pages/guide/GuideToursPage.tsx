import { Link } from 'react-router';
import type { GuideTourSummary } from '@/features/applications/model';
import { useGuideTours } from '@/features/applications/queries';
import { TOUR_STATUS_LABEL } from '@/features/tours/model';
import { formatShortDate } from '@/shared/lib/date';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const linkClass =
  'inline-flex min-h-11 items-center text-sm font-bold text-accent underline underline-offset-2';

function isActive(tour: GuideTourSummary): boolean {
  return tour.status === 'RECRUITING' || tour.status === 'CLOSED';
}

/** 진행 중 탐방은 늘 시작 시각이 이른 것부터 세운다(판정 35 — API 순서나 시연 탐방 id에 기대지 않는다). */
function orderActive(tours: GuideTourSummary[]): GuideTourSummary[] {
  return tours.filter(isActive).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** 가이드가 개설한 탐방 목록(guide-a02). 진행 중 탐방은 신청자 관리로, 지난 탐방은 기록으로만 보여 준다. */
export function GuideToursPage() {
  const query = useGuideTours();
  const { data: tours } = query;

  return (
    <>
      <TopBar title="내가 개설한 탐방" />
      <Page>
        {tours === undefined ? (
          query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <Skeleton className="h-12" />
              <Skeleton className="mt-4 h-32" />
              <Skeleton className="mt-3 h-32" />
            </>
          )
        ) : (
          <GuideTourList tours={tours} />
        )}
      </Page>
    </>
  );
}

function GuideTourList({ tours }: { tours: GuideTourSummary[] }) {
  const active = orderActive(tours);
  const past = tours.filter((tour) => !isActive(tour));

  return (
    <>
      <StatusChip>개설한 탐방 목록</StatusChip>

      {active.length === 0 ? (
        <EmptyState
          title="아직 개설한 탐방이 없어요."
          action={{ label: '새 탐방 개설하기', to: '/guide/tours/new' }}
        />
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {active.map((tour) => (
              <li key={tour.id}>
                <InfoCard
                  title={tour.title}
                  description={`${TOUR_STATUS_LABEL[tour.status]} · 신청 ${tour.counts.total}명 · 승인 ${tour.counts.approved}명 · ${formatShortDate(tour.startsAt)}`}
                  footer={
                    <div className="flex gap-4">
                      <Link to={`/guide/tours/${tour.id}/applicants`} className={linkClass}>
                        신청자 보기
                      </Link>
                      <Link to={`/guide/tours/${tour.id}/cancel`} className={linkClass}>
                        탐방 취소
                      </Link>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
          <Link to="/guide/tours/new" className={`${buttonClass('primary')} mt-6`}>
            새 탐방 개설하기
          </Link>
        </>
      )}

      {past.length > 0 ? (
        <section className="mt-8" aria-labelledby="past-tours">
          <h2 id="past-tours" className="text-sm font-semibold text-muted">
            지난 탐방 기록
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {past.map((tour) => (
              <li key={tour.id}>
                <InfoCard
                  muted
                  title={tour.title}
                  description={`${TOUR_STATUS_LABEL[tour.status]} · ${formatShortDate(tour.startsAt)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
