import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { CourseStepBar } from '@/features/courses/components/CourseStepBar';
import { CourseTimeline } from '@/features/courses/components/CourseTimeline';
import { MapView } from '@/features/courses/components/MapView';
import { StoreSheet } from '@/features/courses/components/StoreSheet';
import { stopDurations } from '@/features/courses/model';
import { useGuideCourse } from '@/features/courses/queries';
import { useDemoStore } from '@/demo/demoStore';
import { cn } from '@/shared/lib/cn';
import { formatDuration, formatMonthDay } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const TITLE = '확정 코스 지도 보기';

/**
 * 가이드의 확정 코스 보기(`/guide/tours/:tourId/course`, V2에 없음 — 고교생 H04를 재사용). 단계 막대 + 시간표가 첫 화면이고
 * 지도(카카오맵 · 도식 폴백)는 `지도로 보기`를 펼칠 때만 그린다. 카드(또는 지도 핀)는 상점 시트를 여는데 가이드에게는 쿠폰이
 * 없어 `제휴 혜택`만 보인다. 코스가 없으면 신청자 관리로, 초안이면 코스 편집으로 보낸다(확정 점검 화면과 같은 규칙).
 * 학생 `CourseMapPage`를 추출하지 않고 같은 부품을 직접 조립한다(무대 화면을 건드리지 않는다).
 */
export function GuideCourseMapPage() {
  const tourId = Number(useParams().tourId);
  const courseQuery = useGuideCourse(tourId);
  const course = courseQuery.data;
  const base = `/guide/tours/${tourId}`;
  // 주소로 바로 들어와 이전 화면이 없으면 뒤로 가기가 앱을 떠나지 않게 신청자 관리로 보낸다.
  const { key } = useLocation();
  const back = key === 'default' ? `${base}/applicants` : true;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const mapPanelId = useId();
  const mapPanelRef = useRef<HTMLDivElement>(null);
  // 시연 패널의 지도 `도식`: 카카오맵을 부르지 않고 도식 지도로 고정한다(결정 0004의 수동 토글).
  const mapMode = useDemoStore((s) => s.mapMode);

  // 지도는 시간표 맨 아래에서 열리므로 하단 고정 버튼 뒤에 가려지지 않게 열린 지도를 화면 안으로 가져온다.
  useEffect(() => {
    if (mapOpen) mapPanelRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [mapOpen]);

  if (course === null) return <Navigate to={`${base}/applicants`} replace />;
  if (course === undefined) {
    return (
      <>
        <TopBar title={TITLE} back={back} />
        <Page>
          {courseQuery.isError ? (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : (
            <>
              <Skeleton className="mt-3 h-12 w-3/4" />
              <Skeleton className="mt-4 h-[200px] rounded-xl" />
              <Skeleton className="mt-4 h-[78px]" />
              <Skeleton className="mt-3 h-[78px]" />
            </>
          )}
        </Page>
      </>
    );
  }
  if (course.status === 'DRAFT') return <Navigate to={`${base}/course/edit`} replace />;

  const { tour, stops } = course;
  const durations = stopDurations(stops, tour.endsAt);
  const selected = stops.find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <TopBar title={TITLE} back={back} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="함께 걸을 캠퍼스와 동네"
          description={`${tour.title} · ${formatMonthDay(tour.startsAt)}`}
          className="mt-3"
        />

        <section className="mt-5 rounded-xl bg-brand-soft p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-[17px] font-bold text-ink">
              {tour.endsAt === null
                ? '우리의 투어 코스'
                : `우리의 ${formatDuration(tour.startsAt, tour.endsAt)} 코스`}
            </h3>
            <StatusChip dot={false} className="shrink-0 bg-surface text-brand">
              {`${stops.length}개 장소`}
            </StatusChip>
          </div>
          <div className="mt-4">
            <CourseStepBar stops={stops} />
          </div>
        </section>

        <p className="mt-3 mb-3 text-xs font-bold text-brand">
          {`${stops.length}개 장소 · 일정을 위아래로 스크롤해 확인하세요`}
        </p>
        <CourseTimeline stops={stops} durations={durations} onSelect={setSelectedId} />

        <section className="mt-4">
          <button
            type="button"
            aria-expanded={mapOpen}
            aria-controls={mapPanelId}
            onClick={() => setMapOpen((open) => !open)}
            className="flex min-h-11 w-full items-center justify-between rounded-lg bg-surface px-4 text-[15px] font-bold text-ink"
          >
            지도로 보기
            <ChevronDown
              aria-hidden
              className={cn('size-5 text-muted transition-transform', mapOpen && 'rotate-180')}
            />
          </button>
          <div id={mapPanelId} ref={mapPanelRef} hidden={!mapOpen} className="mt-3">
            {/* 열 때만 그린다 — 닫혀 있으면 카카오 SDK도 부르지 않는다. */}
            {mapOpen ? (
              <MapView
                stops={stops}
                onSelect={setSelectedId}
                forceSchematic={mapMode === 'schematic'}
              />
            ) : null}
          </div>
        </section>

        <BottomAction>
          <Link to={`${base}/applicants`} className={buttonClass('primary')}>
            신청자 관리로 이동
          </Link>
        </BottomAction>
      </Page>

      <StoreSheet
        stop={selected}
        coupon={null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
