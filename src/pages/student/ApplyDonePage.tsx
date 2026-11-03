import { Link, useParams } from 'react-router';
import { recommendationsPath } from '@/features/tours/lastQuery';
import { TourCard } from '@/features/tours/components/TourCard';
import { useTour } from '@/features/tours/queries';
import { cn } from '@/shared/lib/cn';
import { formatMonthDay } from '@/shared/lib/date';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

/** 신청 완료 · 가이드 승인 대기(hs-s06). 신청서에서 `replace`로 오므로 뒤로 가기 버튼이 없다. */
export function ApplyDonePage() {
  const tourId = Number(useParams().tourId);
  const tourQuery = useTour(tourId);
  const { data: tour } = tourQuery;

  return (
    <>
      <TopBar title="신청이 접수됐어요!" />
      <Page>
        <InfoCard
          title="⌛ 가이드 승인 대기 중"
          description="신청이 완료되었어요. 승인 결과는 내 탐방에서 확인해요."
          muted
        />

        <h3 className="mt-6 text-lg font-bold text-ink">신청한 탐방</h3>
        <div className="mt-3">
          {tourQuery.isError ? (
            <ErrorState error={tourQuery.error} onRetry={() => void tourQuery.refetch()} />
          ) : tour === undefined ? (
            <Skeleton className="h-32" />
          ) : (
            <TourCard
              title={`${tour.universityName} ${tour.campusName}`}
              lines={[
                `${tour.major ? `${tour.major} · ` : ''}${formatMonthDay(tour.startsAt)}`,
                '가이드 승인 후 오픈채팅 링크가 공개돼요.',
                '상태 · 신청됨',
              ]}
            />
          )}
        </div>

        <div className="mt-4">
          <InfoCard
            title="가이드가 신청 내용을 확인하고 있어요."
            description="거절 시 다른 추천 탐방으로 이동할 수 있어요."
          />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link to="/my-tours" className={buttonClass('primary')}>
            내 탐방 확인하기
          </Link>
          <Link to={recommendationsPath()} className={cn(buttonClass('secondary'))}>
            다른 탐방 둘러보기
          </Link>
        </div>
      </Page>
    </>
  );
}
