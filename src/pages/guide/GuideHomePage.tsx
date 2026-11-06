import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { guideTodos } from '@/features/applications/guideHome';
import {
  isUpcomingTour,
  pickFocusTour,
  type GuideTourSummary,
} from '@/features/applications/model';
import { useGuideTours } from '@/features/applications/queries';
import { campusLabel } from '@/features/tours/model';
import { formatAmPm, formatDotDateWeekday, formatLongDate } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { BrandMark } from '@/shared/ui/BrandMark';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

const dot = ' · ';

/** 화면 맨 아래 링크. `›`는 장식이라 링크 이름은 `내가 개설한 탐방`이다. */
function AllToursLink() {
  return (
    <Link
      to="/guide/tours"
      className="mt-6 inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-brand"
    >
      내가 개설한 탐방
      <ChevronRight aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <p className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 text-2xl font-bold text-brand-strong">{value}</span>{' '}
      <span className="truncate text-[13px] text-muted">{label}</span>
    </p>
  );
}

/** 가이드 홈(G01) · 신청자 없음(G11). 집중하는 탐방은 `pickFocusTour`(가장 이른 진행 예정 탐방)다. */
export function GuideHomePage() {
  const query = useGuideTours();
  const { data: tours } = query;

  if (tours === undefined) {
    return (
      <Page className="pt-6">
        <h1 className="sr-only">내 탐방</h1>
        <div>
          <BrandMark variant="wordmark" />
        </div>
        {query.isError ? (
          <div className="mt-6">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            <Skeleton className="mt-5 h-[72px] w-3/4" />
            <Skeleton className="mt-6 h-[190px] rounded-xl" />
            <Skeleton className="mt-4 h-14" />
          </>
        )}
      </Page>
    );
  }

  const focus = pickFocusTour(tours);
  if (focus === null) {
    return (
      <Page className="flex flex-col pt-6">
        <div>
          <BrandMark variant="wordmark" />
        </div>
        <PageHeading
          title="아직 준비 중인 탐방이 없어요."
          description="학생들에게 특별한 대학 생활을 보여주세요."
          className="mt-5"
        />
        <div className="mt-6">
          <EmptyState
            title={tours.length > 0 ? '진행 예정인 탐방이 없어요.' : '아직 개설한 탐방이 없어요.'}
            action={{ label: '새 탐방 개설하기', to: '/guide/tours/new' }}
          />
        </div>
        <AllToursLink />
      </Page>
    );
  }

  if (focus.counts.total === 0) return <NoApplicants tour={focus} />;

  const upcoming = tours.filter(isUpcomingTour).length;
  const todos = guideTodos(focus);
  return (
    <Page className="flex flex-col pt-6">
      <div>
        <BrandMark variant="wordmark" />
      </div>
      <PageHeading
        title={`이번 주, ${upcoming >= 2 ? `${upcoming}개의` : '하나의'} 탐방을\n준비하고 있어요.`}
        description="학생들에게 특별한 대학 생활을 보여주세요."
        className="mt-5"
      />

      <section aria-label="이번 탐방" className="mt-6 rounded-xl bg-brand-soft p-5">
        <p className="truncate text-[13px] font-bold text-brand">
          {formatLongDate(focus.startsAt)}
          {dot}
          {formatAmPm(focus.startsAt)}
        </p>
        <h2 className="mt-2 truncate text-xl leading-[1.4] font-bold text-ink">{focus.title}</h2>
        <p className="truncate text-[13px] text-muted">
          {campusLabel(focus.universityName, focus.campusName)}
        </p>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-surface pt-4">
          <Stat value={`${focus.counts.approved}명`} label="승인했어요" />
          <Stat value={`${Math.max(0, focus.remainingSeats)}자리`} label="남았어요" />
        </div>
      </section>

      <Link to={`/guide/tours/${focus.id}/applicants`} className={`${buttonClass('primary')} mt-4`}>
        신청자 확인하기
      </Link>

      <h2 className="mt-8 mb-3 text-lg font-bold text-ink">오늘 해야 할 일</h2>
      {todos.length === 0 ? (
        <p className="rounded-xl bg-surface p-5 text-[13px] text-muted">지금 처리할 일이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {todos.map((todo) => (
            <li key={todo.action.to} className="rounded-xl bg-surface p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden className="size-3 shrink-0 rounded-full bg-local" />
                <p className="min-w-0 text-[15px] font-bold text-ink">{todo.title}</p>
              </div>
              <p className="mt-1 pl-6 text-xs text-muted">{todo.description}</p>
              <div className="mt-3 border-t border-border pt-1">
                <Link
                  to={todo.action.to}
                  className="inline-flex min-h-11 items-center gap-1 text-[13px] font-bold text-brand"
                >
                  {todo.action.label}
                  <ChevronRight aria-hidden className="size-4 shrink-0" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AllToursLink />
    </Page>
  );
}

/** G11: 집중하는 탐방에 아직 신청자가 없을 때. */
function NoApplicants({ tour }: { tour: GuideTourSummary }) {
  // V2 G11 문구는 `모집 중`이라 G06 칩(`신청 접수 중`)과 다르다. 마감 탐방이 포커스일 수 있어 상태로 가른다.
  const chipLabel = tour.status === 'CLOSED' ? '모집 마감' : '모집 중';
  return (
    <Page className={BOTTOM_ACTION_PAGE_TAB_ROOT}>
      <div>
        <BrandMark variant="wordmark" />
      </div>
      <PageHeading
        title="아직 신청자가 없어요."
        description="학생들이 찾기 쉽도록 탐방 소개를 점검해 봐요."
        className="mt-5"
      />

      <section className="mt-6 rounded-xl bg-brand-soft p-5">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-surface text-xl text-brand"
        >
          ☺
        </span>
        <h2 className="mt-3 text-lg font-bold text-ink">첫 신청을 기다리는 중</h2>
        <p className="mt-1 text-[13px] text-muted">모집 중인 탐방이 학생의 추천 화면에 노출돼요.</p>
      </section>

      <section aria-label="모집 중인 탐방" className="mt-4 rounded-xl bg-surface p-5">
        <StatusChip>{chipLabel}</StatusChip>
        <h2 className="mt-3 truncate text-[17px] font-bold text-ink">{tour.title}</h2>
        <p className="mt-1 truncate text-[13px] text-muted">
          {formatDotDateWeekday(tour.startsAt)}
          {dot}정원 {tour.capacity}명
        </p>
      </section>

      <p className="mt-4 rounded-lg bg-brand-soft px-4 py-3 text-xs text-muted">
        승인된 신청자가 1명 이상이면 코스 초안 생성을 진행할 수 있어요.
      </p>

      <AllToursLink />

      <BottomAction>
        <Link to={`/tours/${tour.id}`} className={buttonClass('primary')}>
          탐방 상세 보기
        </Link>
      </BottomAction>
    </Page>
  );
}
