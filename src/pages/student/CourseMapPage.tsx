import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { STUDENT_APPLICATION_STATUS, type MyApplication } from '@/features/applications/model';
import { useMyApplication } from '@/features/applications/queries';
import { useMyCoupons } from '@/features/coupons/queries';
import { CourseStepBar } from '@/features/courses/components/CourseStepBar';
import { CourseTimeline } from '@/features/courses/components/CourseTimeline';
import { MapView } from '@/features/courses/components/MapView';
import { StoreSheet } from '@/features/courses/components/StoreSheet';
import { stopDurations } from '@/features/courses/model';
import { useCourse } from '@/features/courses/queries';
import { campusLabel } from '@/features/tours/model';
import { useDemoStore } from '@/demo/demoStore';
import { cn } from '@/shared/lib/cn';
import { formatDotDateWeekday, formatDuration, formatMonthDay } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Illustration } from '@/shared/ui/Illustration';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { StepList } from '@/shared/ui/StepList';
import { TopBar } from '@/shared/ui/TopBar';

/** 코스를 아직 볼 수 없다는 뜻의 오류. 그 밖의 오류는 다시 시도를 보여 준다. */
const NOT_READY_CODES = new Set(['COURSE_NOT_READY', 'FORBIDDEN']);

const PREPARING_STEPS = ['참여 신청 승인', '하고 싶은 것 취합', '가이드가 코스 초안 검토 · 확정'];

/**
 * 코스 준비 중(V2 H14). 승인 대기 신청과 코스가 아직 확정되지 않은 승인 신청이 같은 레이아웃을 쓰고, 카드 문구와 단계
 * 표시만 다르다. 거절 · 취소된 신청은 "기다린다"는 문구 없이 신청 상태 칩과 신청 내역 링크만 보인다.
 */
function CoursePreparing({ app }: { app: MyApplication }) {
  const { tour } = app;
  const status = STUDENT_APPLICATION_STATUS[app.status];
  const awaitingApproval = app.status === 'PENDING';
  const closed = app.status === 'REJECTED' || app.status === 'CANCELED';
  const tourCard = (
    <section className="mt-3 rounded-xl bg-surface p-5">
      <StatusChip tone={status.chipTone}>{status.label}</StatusChip>
      <h3 className="mt-3 text-xl leading-snug font-bold text-ink">{tour.title}</h3>
      <p className="mt-2 text-[13px] text-muted">
        {`${campusLabel(tour.universityName, tour.campusName)} · ${formatDotDateWeekday(tour.startsAt)}`}
      </p>
    </section>
  );

  if (closed) {
    return (
      <>
        <TopBar title="코스 보기" back={`/my-tours/${app.id}`} />
        <Page>
          <PageHeading as="h2" title="이 신청으로는 코스를 볼 수 없어요." className="mt-3" />
          {tourCard}
          <div className="mt-4">
            <Link to={`/my-tours/${app.id}`} className={buttonClass('secondary')}>
              신청 내역 보기
            </Link>
          </div>
        </Page>
      </>
    );
  }

  return (
    <>
      <TopBar title="코스 준비 중" back={`/my-tours/${app.id}`} />
      <Page>
        <PageHeading
          as="h2"
          title="투어 코스를 준비하고 있어요."
          description="가이드가 신청자들의 관심사를 모으고 있어요."
          className="mt-3"
        />

        <section className="mt-6 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-surface text-brand"
          >
            <ArrowUpRight className="size-6" />
          </span>
          <p className="mt-4 text-xl leading-snug font-bold text-ink">
            {awaitingApproval ? '가이드 승인을 기다리고 있어요' : '코스 확정을 기다려요'}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            {awaitingApproval
              ? '승인되면 지도와 쿠폰이 열려요.'
              : '가이드가 최종 확정하면 지도와 장소별 설명이 열려요.'}
          </p>
        </section>

        {tourCard}

        <div className="mt-3">
          <StepList steps={PREPARING_STEPS} current={awaitingApproval ? 0 : 2} />
        </div>
      </Page>
    </>
  );
}

/**
 * 탐방 코스(hs-s08 · V2 H04 · H14). 서버가 승인된 신청자에게 확정 코스만 준다 — 승인 대기 신청은 코스를 부르지 않고
 * 승인 안내를, 그 밖에 볼 수 없으면 "준비 중"을 보여 준다. 확정 코스는 단계 막대 + 시간표가 첫 화면이고, 지도(카카오맵 ·
 * 도식 폴백)는 그 아래 `지도로 보기`를 펼칠 때만 그린다(2A-R5). 카드(또는 지도 핀)를 누르면 상점 시트가 열리고, 제휴
 * 상점이면 이 신청으로 발급된 쿠폰으로 이어진다.
 */
export function CourseMapPage() {
  const applicationId = Number(useParams().applicationId);
  const appQuery = useMyApplication(applicationId);
  const { data: app } = appQuery;
  // 승인 대기 · 거절 · 취소된 신청은 코스를 부르지 않는다(서버도 승인된 신청자에게만 코스를 준다).
  const courseClosed = app !== undefined && app.status !== 'APPROVED';
  const courseQuery = useCourse(app === undefined || courseClosed ? undefined : app.tour.id);
  // 쿠폰 목록 오류는 따로 보이지 않는다 — 시트는 "쿠폰 보기" 없이 그려지고, 아래 버튼으로 쿠폰 목록에 갈 수 있다.
  const { data: coupons } = useMyCoupons(applicationId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 리뷰를 쓴 뒤 `?storeId=`로 돌아오면 그 상점 시트를 연 채 시작한다(AI 요약 갱신이 보이는 곳). 시트를 닫으면 주소에서 지운다.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const storeIdParam = /^[1-9]\d*$/.test(searchParams.get('storeId') ?? '')
    ? Number(searchParams.get('storeId'))
    : null;
  const [mapOpen, setMapOpen] = useState(false);
  const mapPanelId = useId();
  const mapPanelRef = useRef<HTMLDivElement>(null);
  // 시연 패널의 지도 `도식`: 카카오맵을 부르지 않고 도식 지도로 고정한다(결정 0004의 수동 토글).
  const mapMode = useDemoStore((s) => s.mapMode);

  // 지도는 시간표 맨 아래에서 열리므로 하단 고정 버튼 뒤에 가려지지 않게 열린 지도를 화면 안으로 가져온다.
  useEffect(() => {
    if (mapOpen) mapPanelRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [mapOpen]);

  const topBar = <TopBar title="코스 보기" back={`/my-tours/${applicationId}`} />;
  const course = courseQuery.data;

  // 다시 불러오다 실패해도 이미 받은 신청 · 코스는 그대로 보인다(판정 24) — 오류 · 준비 중 화면은 받은 데이터가
  // 없을 때만.
  if (app === undefined && appQuery.isError) {
    return (
      <>
        {topBar}
        <Page>
          <ErrorState error={appQuery.error} onRetry={() => void appQuery.refetch()} />
        </Page>
      </>
    );
  }
  if (app !== undefined && courseClosed) return <CoursePreparing app={app} />;
  if (course === undefined && courseQuery.isError) {
    if (app !== undefined && NOT_READY_CODES.has(courseQuery.error.code)) {
      return <CoursePreparing app={app} />;
    }
    return (
      <>
        {topBar}
        <Page>
          <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
        </Page>
      </>
    );
  }
  if (course === undefined) {
    return (
      <>
        {topBar}
        <Page>
          <Skeleton className="mt-3 h-12 w-3/4" />
          <Skeleton className="mt-4 h-[200px] rounded-xl" />
          <Skeleton className="mt-4 h-[78px]" />
          <Skeleton className="mt-3 h-[78px]" />
        </Page>
      </>
    );
  }

  const { tour, stops } = course;
  const durations = stopDurations(stops, tour.endsAt);
  const selected =
    stops.find((s) => s.id === selectedId) ??
    stops.find((s) => storeIdParam !== null && s.storeId === storeIdParam) ??
    null;
  const selectedCoupon =
    coupons?.find((c) => selected !== null && c.storeId === selected.storeId) ?? null;

  return (
    <>
      {topBar}
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="함께 걸을 캠퍼스와 동네"
          // 탐방 제목이 이미 `{학교 짧은 이름} …`으로 시작한다(`tourTitle`) — 학교 이름을 한 번 더 붙이지 않는다.
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
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-ink">학교에서 동네까지</p>
              <p className="mt-0.5 text-xs text-muted">도보로 이어지는 투어</p>
            </div>
            <Illustration kind="cafe" className="h-auto max-h-14 w-auto shrink-0 object-contain" />
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
          <Link to={`/my-tours/${applicationId}/coupons`} className={buttonClass('primary')}>
            내 쿠폰 확인하기
          </Link>
        </BottomAction>
      </Page>

      <StoreSheet
        stop={selected}
        coupon={selectedCoupon}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedId(null);
          if (storeIdParam !== null)
            void navigate(`/my-tours/${applicationId}/course`, { replace: true });
        }}
      />
    </>
  );
}
