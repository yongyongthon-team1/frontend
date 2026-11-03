import { useNavigate, useParams } from 'react-router';
import { useMe } from '@/features/auth/queries';
import { recommendationsPath } from '@/features/tours/lastQuery';
import { applyButtonState, TOUR_STATUS_LABEL, type TourDetail } from '@/features/tours/model';
import { useTour } from '@/features/tours/queries';
import { formatTimeRange, formatTourDate } from '@/shared/lib/date';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

function statusChip(tour: TourDetail) {
  if (tour.status === 'RECRUITING' && tour.remainingSeats > 0) {
    return <StatusChip tone="success">모집 중 · 남은 자리 {tour.remainingSeats}명</StatusChip>;
  }
  if (tour.status === 'RECRUITING' || tour.status === 'CLOSED') {
    return <StatusChip>마감</StatusChip>;
  }
  return <StatusChip>{TOUR_STATUS_LABEL[tour.status]}</StatusChip>;
}

/** 탐방 상세(hs-s05). 모든 역할이 보고, 신청 버튼은 `applyButtonState`가 정한다 · 신청 불가 상태는 hs-a06. */
export function TourDetailPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const tourQuery = useTour(tourId);
  const me = useMe();
  const { data: tour } = tourQuery;

  if (tourQuery.isError) {
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
          <Skeleton className="h-12" />
          <Skeleton className="mt-4 h-8 w-3/4" />
          <Skeleton className="mt-4 h-24" />
          <Skeleton className="mt-3 h-24" />
        </Page>
      </>
    );
  }

  const state = applyButtonState(me.data, tour, recommendationsPath());
  const action = state.action;

  return (
    <>
      <TopBar title="탐방 상세" back />
      <Page>
        {statusChip(tour)}
        <h2 className="mt-4 text-2xl leading-snug font-bold text-ink">{tour.title}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <InfoCard
            title={`가이드 ${tour.guideName}${tour.major ? ` · ${tour.major}` : ''}`}
            description={
              tour.guideVerified
                ? `✓ 재학 인증 완료${tour.guideIntroduction ? ` · ${tour.guideIntroduction}` : ''}`
                : undefined
            }
          />
          <InfoCard
            title={`${formatTourDate(tour.startsAt)} ${formatTimeRange(tour.startsAt, tour.endsAt)} · 정원 ${tour.capacity}명`}
            description="캠퍼스 소개 → 전공 공간 → 대학가 식사·카페"
          />
        </div>

        <h3 className="mt-6 text-lg font-bold text-ink">이 탐방에서 만날 수 있는 것</h3>
        <p className="mt-2 text-base leading-relaxed whitespace-pre-line text-ink">
          {tour.introduction}
        </p>

        <div className="mt-6">
          {state.enabled ? (
            <Button onClick={() => action && void navigate(action.to)}>{state.label}</Button>
          ) : (
            <Button disabled hint={{ reason: state.reason, action }}>
              {state.label}
            </Button>
          )}
        </div>
      </Page>
    </>
  );
}
