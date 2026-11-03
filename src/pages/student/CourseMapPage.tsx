import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMyApplication } from '@/features/applications/queries';
import { useMyCoupons } from '@/features/coupons/queries';
import { MapView } from '@/features/courses/components/MapView';
import { StopList } from '@/features/courses/components/StopList';
import { StoreSheet } from '@/features/courses/components/StoreSheet';
import { useCourse } from '@/features/courses/queries';
import { formatDuration, formatTourDate } from '@/shared/lib/date';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

/** 코스를 아직 볼 수 없다는 뜻의 오류. 그 밖의 오류는 다시 시도를 보여 준다. */
const NOT_READY_CODES = new Set(['COURSE_NOT_READY', 'FORBIDDEN']);

/**
 * 탐방 코스 지도(hs-s08). 서버가 승인된 신청자에게 확정 코스만 준다 — 승인 대기 신청은 코스를 부르지 않고 승인
 * 안내를, 그 밖에 볼 수 없으면 "준비 중"을 보여 준다. 지점(핀 · 카드)을 누르면 상점 시트가 열리고, 제휴 상점이면
 * 이 신청으로 발급된 쿠폰으로 이어진다.
 */
export function CourseMapPage() {
  const applicationId = Number(useParams().applicationId);
  const appQuery = useMyApplication(applicationId);
  const { data: app } = appQuery;
  const awaitingApproval = app?.status === 'PENDING';
  const courseQuery = useCourse(app === undefined || awaitingApproval ? undefined : app.tour.id);
  // 쿠폰 목록 오류는 따로 보이지 않는다 — 시트는 "쿠폰 보기" 없이 그려지고, 아래 버튼으로 쿠폰 목록에 갈 수 있다.
  const { data: coupons } = useMyCoupons(applicationId);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topBar = <TopBar title="오늘의 탐방 코스" back={`/my-tours/${applicationId}`} />;

  if (appQuery.isError) {
    return (
      <>
        {topBar}
        <Page>
          <ErrorState error={appQuery.error} onRetry={() => void appQuery.refetch()} />
        </Page>
      </>
    );
  }
  if (awaitingApproval) {
    return (
      <>
        {topBar}
        <Page>
          <EmptyState
            title="가이드 승인을 기다리고 있어요"
            description="승인되면 지도와 쿠폰이 열려요."
          />
        </Page>
      </>
    );
  }
  if (courseQuery.isError) {
    return (
      <>
        {topBar}
        <Page>
          {NOT_READY_CODES.has(courseQuery.error.code) ? (
            <EmptyState
              title="가이드가 코스를 준비 중이에요"
              description="확정되면 지도와 쿠폰이 열려요."
            />
          ) : (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          )}
        </Page>
      </>
    );
  }
  const course = courseQuery.data;
  if (course === undefined) {
    return (
      <>
        {topBar}
        <Page>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="mt-4 h-12" />
          <Skeleton className="mt-4 h-[var(--map-h)] rounded-lg" />
          <Skeleton className="mt-4 h-24" />
        </Page>
      </>
    );
  }

  const { tour } = course;
  const selected = course.stops.find((s) => s.id === selectedId) ?? null;
  const selectedCoupon =
    coupons?.find((c) => selected !== null && c.storeId === selected.storeId) ?? null;

  return (
    <>
      {topBar}
      <Page>
        <h2 className="text-xl leading-snug font-bold text-ink">
          {tour.endsAt === null
            ? '학교에서 동네까지'
            : `학교에서 동네까지, ${formatDuration(tour.startsAt, tour.endsAt)}`}
        </h2>
        <StatusChip className="mt-3">
          {`${formatTourDate(tour.startsAt)} · ${tour.universityShortName} ${tour.campusName}`}
        </StatusChip>

        <div className="mt-4">
          <MapView stops={course.stops} onSelect={setSelectedId} forceSchematic={false} />
        </div>
        <div className="mt-4">
          <StopList stops={course.stops} onSelect={setSelectedId} />
        </div>

        <Link
          to={`/my-tours/${applicationId}/coupons`}
          className={`${buttonClass('primary')} mt-6`}
        >
          제휴 상점 쿠폰 확인
        </Link>
      </Page>

      <StoreSheet
        stop={selected}
        coupon={selectedCoupon}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
