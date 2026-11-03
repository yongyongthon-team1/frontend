import { Navigate, useNavigate, useParams } from 'react-router';
import { useApplicantsBoard } from '@/features/applications/queries';
import { stopKindLabel } from '@/features/courses/model';
import { useGuideCourse } from '@/features/courses/queries';
import { formatMonthDay, formatTimeRange } from '@/shared/lib/date';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

/**
 * 코스 확정 · 쿠폰 발급 결과(guide-s06). 승인 수는 신청자 보드, 발급 수는 코스의 `issuedCouponCount`(확정 뒤 승인으로
 * 더 발급된 쿠폰 포함)를 그린다. 아직 확정 전이면 편집 화면으로, 코스가 없으면 신청자 관리로 보낸다.
 */
export function CourseConfirmedPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const courseQuery = useGuideCourse(tourId);
  const boardQuery = useApplicantsBoard(tourId);
  const course = courseQuery.data;
  const board = boardQuery.data;
  const base = `/guide/tours/${tourId}`;
  const topBar = <TopBar title="코스를 확정했어요!" />;

  if (course === null) return <Navigate to={`${base}/applicants`} replace />;
  if (course?.status === 'DRAFT') return <Navigate to={`${base}/course/edit`} replace />;
  if (course === undefined || board === undefined) {
    const error =
      (course === undefined && courseQuery.error) || (board === undefined && boardQuery.error);
    return (
      <>
        {topBar}
        <Page>
          {error ? (
            <ErrorState
              error={error}
              onRetry={() => {
                if (course === undefined) void courseQuery.refetch();
                if (board === undefined) void boardQuery.refetch();
              }}
            />
          ) : (
            <>
              <Skeleton className="h-11" />
              <Skeleton className="mt-6 h-6 w-24" />
              <Skeleton className="mt-3 h-40 rounded-lg" />
              <Skeleton className="mt-3 h-24 rounded-lg" />
            </>
          )}
        </Page>
      </>
    );
  }

  const { tour, stops, issuedCouponCount } = course;
  return (
    <>
      {topBar}
      <Page>
        <StatusChip icon="✓" tone="success">
          참가자에게 코스 공개 완료
        </StatusChip>

        <h2 className="mt-6 text-lg font-bold text-ink">탐방 정보</h2>
        <div className="mt-3 flex flex-col gap-3">
          <InfoCard
            title={`${tour.universityShortName} ${tour.campusName}`}
            description={
              <>
                <p>{`${formatMonthDay(tour.startsAt)} ${formatTimeRange(tour.startsAt, tour.endsAt)}`}</p>
                <p className="mt-1">
                  {`${stops.map(stopKindLabel).join(' → ')} / 총 ${stops.length}개 장소`}
                </p>
              </>
            }
            footer={
              <p className="text-sm font-semibold text-ink">
                {`참가 승인 ${board.counts.approved}명 · 쿠폰 ${issuedCouponCount}장 발급`}
              </p>
            }
          />
          <InfoCard
            muted
            title="확정된 코스는 신청자에게 공개돼요."
            description={
              issuedCouponCount > 0
                ? '승인된 신청자에게 제휴 상점 쿠폰이 발급돼요.'
                : '코스에 제휴 상점이 없어 발급된 쿠폰이 없어요. 제휴 상점으로 바꾸면 발급돼요.'
            }
          />
          <InfoCard
            title="코스 확정 후에 신청을 승인하면"
            description="새 승인자에게도 쿠폰을 발급해요."
          />
        </div>

        <Button className="mt-6" onClick={() => navigate(`${base}/applicants`)}>
          신청자 관리로 이동
        </Button>
      </Page>
    </>
  );
}
