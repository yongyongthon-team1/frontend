import { User } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMe } from '@/features/auth/queries';
import { recommendationsPath } from '@/features/tours/lastQuery';
import {
  applyButtonState,
  campusLabel,
  tourHighlights,
  type ApplyButtonState,
} from '@/features/tours/model';
import { useTour } from '@/features/tours/queries';
import { formatDotDateTimeRange } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { HeroCard } from '@/shared/ui/HeroCard';
import { NumberedList } from '@/shared/ui/NumberedList';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';
import type { Tone } from '@/shared/lib/types';

// 비활성 사유 카드(V2 H13)의 문구(판정 P1). 신청 종류별로 V2 문구를 쓰고, 표에 없는 종류는 `applyButtonState`가 준
// 사유 · 행동 문구를 그대로 쓴다. 링크 대상은 언제나 `state.action.to`다.
const NOTICE_COPY: Partial<
  Record<
    ApplyButtonState['kind'],
    { chip: string; chipTone: Tone; title: string; description: string; actionLabel: string }
  >
> = {
  CLOSED: {
    chip: '모집 마감',
    chipTone: 'danger',
    title: '이번 탐방은 자리가 없어요',
    description: '비슷한 전공의 다른 일정을 확인해요.',
    actionLabel: '다른 탐방 보기 ›',
  },
  APPLIED: {
    chip: '중복 신청',
    chipTone: 'info',
    title: '이미 신청한 탐방이에요',
    description: '내 탐방에서 현재 상태를 확인할 수 있어요.',
    actionLabel: '내 탐방 확인 ›',
  },
};

function NoticeCard({ state, descId }: { state: ApplyButtonState; descId: string }) {
  const copy = NOTICE_COPY[state.kind];
  const title = copy?.title ?? state.reason;
  if (title === null || title === undefined) return null;
  const action = state.action;
  return (
    <section className="mt-4 rounded-xl bg-surface p-5">
      {copy ? <StatusChip tone={copy.chipTone}>{copy.chip}</StatusChip> : null}
      <h2 id={descId} className={`text-[17px] font-bold text-ink${copy ? ' mt-3' : ''}`}>
        {title}
      </h2>
      {copy ? <p className="mt-1 text-[13px] text-muted">{copy.description}</p> : null}
      {action ? (
        <Link
          to={action.to}
          className="mt-4 flex min-h-11 items-center rounded-md bg-brand-soft px-4 text-[13px] font-bold text-brand"
        >
          {copy?.actionLabel ?? action.label}
        </Link>
      ) : null}
    </section>
  );
}

/**
 * 탐방 상세(hs-s05 · V2 H03). 모든 역할이 보고, 신청 버튼은 `applyButtonState`가 정한다. 신청이 막힌 이유와 다음 행동은
 * 사유 카드(V2 H13 · hs-a06)가 보인다.
 */
export function TourDetailPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const tourQuery = useTour(tourId);
  const me = useMe();
  const { data: tour } = tourQuery;

  // 다시 불러오다 실패해도 이미 받은 탐방은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만.
  if (tour === undefined && tourQuery.isError) {
    return (
      <>
        <TopBar title="탐방 상세" back />
        <Page>
          <ErrorState error={tourQuery.error} onRetry={() => void tourQuery.refetch()} />
        </Page>
      </>
    );
  }
  if (tour === undefined || me.data === undefined) {
    return (
      <>
        <TopBar title="탐방 상세" back />
        <Page>
          <Skeleton className="h-[140px] rounded-xl" />
          <Skeleton className="mt-4 h-8 w-3/4" />
          <Skeleton className="mt-4 h-[72px]" />
          <Skeleton className="mt-3 h-24" />
        </Page>
      </>
    );
  }

  const state = applyButtonState(me.data, tour, recommendationsPath());
  const action = state.action;
  const label = state.label === '탐방 신청하기' ? '이 탐방 신청하기' : state.label;
  const highlights = tourHighlights(tour.introduction);
  const noticeId = `apply-notice-${tour.id}`;
  const hasNotice =
    !state.enabled && (NOTICE_COPY[state.kind] !== undefined || state.reason !== null);

  return (
    <>
      <TopBar title="탐방 상세" back />
      <Page className={BOTTOM_ACTION_PAGE}>
        <HeroCard
          eyebrow={campusLabel(tour.universityName, tour.campusName)}
          title={'전공자와 함께\n캠퍼스를 걸어요'}
          illustration="campus"
        />

        <h2 className="mt-5 text-2xl leading-snug font-bold text-ink">{tour.title}</h2>
        <p className="mt-1 text-[13px] text-muted">
          {formatDotDateTimeRange(tour.startsAt, tour.endsAt)} · {tour.capacity}명 정원
        </p>

        {/* 신청이 막힌 이유와 다음 행동은 아래 버튼에 가려지지 않게 위쪽에 둔다. */}
        {hasNotice ? <NoticeCard state={state} descId={noticeId} /> : null}

        <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface p-4">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-300"
          >
            <User className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-ink">{tour.guideName} 가이드</p>
            {tour.guideVerified ? (
              <p className="truncate text-xs font-medium text-success">
                재학 인증 완료{tour.major ? ` · ${tour.major}` : ''}
              </p>
            ) : tour.major ? (
              <p className="truncate text-xs text-muted">{tour.major}</p>
            ) : null}
          </div>
        </div>

        {highlights.length > 0 ? (
          <>
            <h3 className="mt-6 mb-3 text-lg font-bold text-ink">이런 경험을 해요</h3>
            <NumberedList items={highlights} />
          </>
        ) : null}
        <p className="mt-4 text-xs text-muted">학교가 운영하는 공식 프로그램은 아니에요.</p>

        <BottomAction>
          {state.enabled ? (
            <Button onClick={() => action && void navigate(action.to)}>{label}</Button>
          ) : (
            <Button disabled aria-describedby={hasNotice ? noticeId : undefined}>
              {label}
            </Button>
          )}
        </BottomAction>
      </Page>
    </>
  );
}
