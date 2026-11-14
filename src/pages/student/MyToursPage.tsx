import { ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import {
  groupMyApplications,
  STUDENT_APPLICATION_STATUS,
  type MyApplication,
} from '@/features/applications/model';
import { useMyApplications } from '@/features/applications/queries';
import { campusLabel } from '@/features/tours/model';
import { formatDotDateWeekday, formatTimeRange } from '@/shared/lib/date';
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
  { value: 'upcoming', label: '예정된 탐방' },
  { value: 'past', label: '지난 탐방' },
];

const HEADINGS: Record<Tab, { title: string; description: string }> = {
  upcoming: { title: '내 탐방', description: '신청한 탐방과 참여 현황을 확인해요.' },
  past: { title: '지난 탐방', description: '지금까지 다녀온 캠퍼스를 모아봤어요.' },
};

const dot = ' · ';
const APPROVED_CHIP = STUDENT_APPLICATION_STATUS.APPROVED;
const PENDING_CHIP = STUDENT_APPLICATION_STATUS.PENDING;

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <div className="mt-6 mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {count !== undefined ? (
        <span className="rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
          {count}건
        </span>
      ) : null}
    </div>
  );
}

/** 승인된 예정 탐방 카드. 윗부분은 상세로, 아랫 버튼은 코스로 가는 별개의 링크다(링크 안에 링크가 겹치지 않는다). */
function UpcomingCard({ app }: { app: MyApplication }) {
  const { tour } = app;
  const courseOpen = app.courseStatus === 'CONFIRMED';
  return (
    <article className="rounded-xl bg-surface p-5">
      <Link to={`/my-tours/${app.id}`} className="block">
        <div className="flex items-center justify-between gap-3">
          <StatusChip tone={APPROVED_CHIP.chipTone}>{APPROVED_CHIP.label}</StatusChip>
          <span className="shrink-0 text-xs text-muted">{formatDotDateWeekday(tour.startsAt)}</span>
        </div>
        <p className="mt-4 truncate text-xl leading-snug font-bold text-ink">{tour.title}</p>
        <p className="mt-3 truncate text-[13px] text-muted">
          {campusLabel(tour.universityName, tour.campusName)}
        </p>
        <p className="mt-1 truncate text-[13px] text-muted">
          {formatTimeRange(tour.startsAt, tour.endsAt)}
          {dot}
          {tour.capacity}명 정원
        </p>
      </Link>
      <div className="mt-4 border-t border-neutral-100 pt-4">
        {courseOpen ? (
          <Link to={`/my-tours/${app.id}/course`} className={buttonClass('soft')}>
            <span className="min-w-0 truncate">코스 확인하기</span>
            <ChevronRight aria-hidden className="size-4 shrink-0" />
          </Link>
        ) : (
          <p className="text-[13px] text-muted">가이드가 코스를 확정하면 열려요.</p>
        )}
      </div>
    </article>
  );
}

/** 승인 대기 카드: 카드 전체가 상세 링크다. */
function PendingCard({ app }: { app: MyApplication }) {
  return (
    <article>
      <Link
        to={`/my-tours/${app.id}`}
        className="flex items-center gap-3 rounded-xl bg-surface p-5 transition-colors hover:brightness-[0.98]"
      >
        <div className="min-w-0 flex-1">
          <StatusChip tone={PENDING_CHIP.chipTone}>{PENDING_CHIP.label}</StatusChip>
          <p className="mt-3 truncate text-xl leading-snug font-bold text-ink">{app.tour.title}</p>
          <p className="mt-1 truncate text-xs text-muted">신청 접수 완료{dot}가이드 승인 대기 중</p>
        </div>
        <ChevronRight aria-hidden className="size-6 shrink-0 text-muted" />
      </Link>
    </article>
  );
}

/** 지난 탐방 칩: 탐방이 끝났으면 참여 완료(+ 쿠폰이 있으면 리뷰 작성 가능), 아니면 취소됨 · 신청 거절 · 종료. */
function pastChips(app: MyApplication): { label: string; tone: Tone }[] {
  // 지난 탐방에서는 거절 · 취소를 조용한 neutral로 보인다(V2 H09) — 문구만 H10과 같은 표를 쓴다.
  if (app.status === 'REJECTED') {
    return [{ label: STUDENT_APPLICATION_STATUS.REJECTED.label, tone: 'neutral' }];
  }
  if (app.status === 'CANCELED' || app.tour.status === 'CANCELED') {
    return [{ label: STUDENT_APPLICATION_STATUS.CANCELED.label, tone: 'neutral' }];
  }
  if (app.status === 'APPROVED' && app.tour.status === 'COMPLETED') {
    return app.couponCount > 0
      ? [
          { label: '참여 완료', tone: 'success' },
          { label: '리뷰 작성 가능', tone: 'success' },
        ]
      : [{ label: '참여 완료', tone: 'success' }];
  }
  return [{ label: '종료됨', tone: 'neutral' }];
}

function PastCard({ app }: { app: MyApplication }) {
  const { tour } = app;
  const review = app.status === 'APPROVED' && tour.status === 'COMPLETED' && app.couponCount > 0;
  return (
    <article className="rounded-xl bg-surface p-5">
      <div className="flex flex-wrap gap-2">
        {pastChips(app).map((chip) => (
          <StatusChip key={chip.label} tone={chip.tone}>
            {chip.label}
          </StatusChip>
        ))}
      </div>
      <p className="mt-3 truncate text-xl leading-snug font-bold text-ink">{tour.title}</p>
      <p className="mt-1 truncate text-[13px] text-muted">
        {campusLabel(tour.universityName, tour.campusName)}
        {dot}
        {formatDotDateWeekday(tour.startsAt)}
      </p>
      <Link
        to={review ? `/my-tours/${app.id}/coupons` : `/my-tours/${app.id}`}
        className={`${buttonClass('soft')} mt-4`}
      >
        <span className="min-w-0 truncate">{review ? '리뷰 남기기' : '탐방 기록 보기'}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0" />
      </Link>
    </article>
  );
}

/** 내 탐방(hs-a05 · V2 H06 · H09). 탭은 주소(`?tab=past`)가 기준이라 새로고침 · 링크로 들어와도 같은 탭이다. */
export function MyToursPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'past' ? 'past' : 'upcoming';
  const query = useMyApplications();
  const { data: applications } = query;
  const heading = HEADINGS[tab];
  const groups = applications ? groupMyApplications(applications) : null;

  function onTab(next: string) {
    setParams(next === 'past' ? { tab: 'past' } : {}, { replace: true });
  }

  return (
    <Page className="pt-6">
      <BrandMark variant="wordmark" />
      <PageHeading title={heading.title} description={heading.description} className="mt-5" />
      <div className="mt-5">
        <SegmentedTabs
          id="my-tours"
          tabs={TABS}
          value={tab}
          onChange={onTab}
          label="내 탐방 구분"
        />
      </div>

      <div {...segmentedPanelProps('my-tours', tab)}>
        {/* 다시 불러오다 실패해도 이미 받은 목록은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만. */}
        {groups === null ? (
          query.isError ? (
            <div className="mt-6">
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            </div>
          ) : (
            <>
              <Skeleton className="mt-6 h-6 w-1/3" />
              <Skeleton className="mt-3 h-[180px] rounded-xl" />
              <Skeleton className="mt-3 h-[100px] rounded-xl" />
            </>
          )
        ) : tab === 'upcoming' ? (
          groups.upcoming.length === 0 && groups.pending.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="아직 신청한 탐방이 없어요."
                action={{ label: '탐방 찾으러 가기', to: '/' }}
              />
            </div>
          ) : (
            <>
              {groups.upcoming.length > 0 ? (
                <section>
                  <SectionTitle count={groups.upcoming.length}>다가오는 탐방</SectionTitle>
                  <ul className="flex flex-col gap-3">
                    {groups.upcoming.map((app) => (
                      <li key={app.id}>
                        <UpcomingCard app={app} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {groups.pending.length > 0 ? (
                <section>
                  <SectionTitle>승인 대기</SectionTitle>
                  <ul className="flex flex-col gap-3">
                    {groups.pending.map((app) => (
                      <li key={app.id}>
                        <PendingCard app={app} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )
        ) : groups.past.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="아직 지난 탐방이 없어요."
              action={{ label: '탐방 찾으러 가기', to: '/' }}
            />
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {groups.past.map((app) => (
              <li key={app.id}>
                <PastCard app={app} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
