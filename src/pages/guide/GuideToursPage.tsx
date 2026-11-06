import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { guideCoursePath, type GuideTourSummary } from '@/features/applications/model';
import { useGuideTours } from '@/features/applications/queries';
import { TOUR_STATUS_LABEL } from '@/features/tours/model';
import { formatDotDateWeekday } from '@/shared/lib/date';
import type { Tone } from '@/shared/lib/types';
import { BrandMark } from '@/shared/ui/BrandMark';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { segmentedPanelProps } from '@/shared/ui/segmentedPanel';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

type Tab = 'upcoming' | 'past';

const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: '진행 예정' },
  { value: 'past', label: '지난 탐방' },
];

const dot = ' · ';

function isUpcoming(tour: GuideTourSummary): boolean {
  return tour.status === 'RECRUITING' || tour.status === 'CLOSED';
}

const startsAtOf = (tour: GuideTourSummary) => Date.parse(tour.startsAt);

/** 진행 예정 탐방은 늘 시작 시각이 이른 것부터 세운다(판정 35 — API 순서나 시연 탐방 id에 기대지 않는다). */
function orderUpcoming(tours: GuideTourSummary[]): GuideTourSummary[] {
  return tours.filter(isUpcoming).sort((a, b) => startsAtOf(a) - startsAtOf(b));
}

/** 지난 탐방(끝남 · 취소)은 최근 것부터. */
function orderPast(tours: GuideTourSummary[]): GuideTourSummary[] {
  return tours.filter((tour) => !isUpcoming(tour)).sort((a, b) => startsAtOf(b) - startsAtOf(a));
}

function chipOf(tour: GuideTourSummary): { label: string; tone: Tone } {
  if (!isUpcoming(tour)) return { label: TOUR_STATUS_LABEL[tour.status], tone: 'neutral' };
  if (tour.courseStatus === 'CONFIRMED') return { label: '코스 확정', tone: 'success' };
  if (tour.status === 'RECRUITING') return { label: '신청 접수 중', tone: 'neutral' };
  return { label: '모집 마감', tone: 'neutral' };
}

function SoftLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className={`${buttonClass('soft')} mt-4`}>
      <span className="min-w-0 truncate">{children}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}

/** 탐방 카드. 코스가 확정이면 코스 확인하기, 아니면 신청자 관리하기. 지난 탐방은 확정 코스가 있을 때만 버튼이 있다. */
function TourCard({ tour, past }: { tour: GuideTourSummary; past: boolean }) {
  const chip = chipOf(tour);
  const confirmed = tour.courseStatus === 'CONFIRMED';
  return (
    <article className="rounded-xl bg-surface p-5">
      <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      <h2 className="mt-3 truncate text-xl leading-snug font-bold text-ink">{tour.title}</h2>
      <p className="mt-1 truncate text-[13px] text-muted">
        {formatDotDateWeekday(tour.startsAt)}
        {dot}
        {tour.counts.approved}/{tour.capacity}명 승인
      </p>
      {confirmed ? (
        <SoftLink to={guideCoursePath(tour)}>코스 확인하기</SoftLink>
      ) : past ? null : (
        <SoftLink to={`/guide/tours/${tour.id}/applicants`}>신청자 관리하기</SoftLink>
      )}
      {past ? null : (
        <div className="mt-1 flex justify-end">
          <Link
            to={`/guide/tours/${tour.id}/cancel`}
            className="inline-flex min-h-11 items-center px-1 text-xs text-muted underline underline-offset-2"
          >
            탐방 취소
          </Link>
        </div>
      )}
    </article>
  );
}

/** 가이드가 개설한 탐방 목록(G06 · guide-a02). 탭은 주소(`?tab=past`)가 기준이다. */
export function GuideToursPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'past' ? 'past' : 'upcoming';
  const query = useGuideTours();
  const { data: tours } = query;

  function onTab(next: string) {
    setParams(next === 'past' ? { tab: 'past' } : {}, { replace: true });
  }

  return (
    <Page className="pt-6">
      <BrandMark variant="wordmark" />
      <PageHeading
        title="내가 개설한 탐방"
        description="모집 상태와 참가자를 한곳에서 관리해요."
        className="mt-5"
      />
      <div className="mt-5">
        <SegmentedTabs
          id="guide-tours"
          tabs={TABS}
          value={tab}
          onChange={onTab}
          label="탐방 구분"
        />
      </div>

      <div className="mt-5" {...segmentedPanelProps('guide-tours', tab)}>
        {/* 다시 불러오다 실패해도 이미 받은 목록은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만. */}
        {tours === undefined ? (
          query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <Skeleton className="h-[150px] rounded-xl" />
              <Skeleton className="mt-3 h-[150px] rounded-xl" />
            </>
          )
        ) : tab === 'upcoming' ? (
          <UpcomingList tours={orderUpcoming(tours)} />
        ) : (
          <PastList tours={orderPast(tours)} />
        )}
      </div>
    </Page>
  );
}

function UpcomingList({ tours }: { tours: GuideTourSummary[] }) {
  if (tours.length === 0) {
    return (
      <EmptyState
        title="아직 개설한 탐방이 없어요."
        action={{ label: '새 탐방 개설하기', to: '/guide/tours/new' }}
      />
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {tours.map((tour) => (
          <li key={tour.id}>
            <TourCard tour={tour} past={false} />
          </li>
        ))}
      </ul>
      <Link to="/guide/tours/new" className="mt-3 block rounded-xl bg-surface p-5">
        <span className="flex items-center gap-2 text-[17px] font-bold text-ink">
          새 탐방 개설하기
          <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
        </span>
        <span className="mt-1 block text-[13px] text-muted">
          학생들과 나누고 싶은 하루를 등록해요.
        </span>
      </Link>
    </>
  );
}

function PastList({ tours }: { tours: GuideTourSummary[] }) {
  if (tours.length === 0) return <EmptyState title="아직 지난 탐방이 없어요." />;
  return (
    <ul className="flex flex-col gap-3">
      {tours.map((tour) => (
        <li key={tour.id}>
          <TourCard tour={tour} past />
        </li>
      ))}
    </ul>
  );
}
