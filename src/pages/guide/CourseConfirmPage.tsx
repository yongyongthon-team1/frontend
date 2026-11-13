import { ArrowUpRight, Check } from 'lucide-react';
import { useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useApplicantsBoard } from '@/features/applications/queries';
import {
  courseKinds,
  partnerStopCount,
  stopKindLabel,
  type Course,
} from '@/features/courses/model';
import { useConfirmCourse, useGuideCourse, useIsCreatingDraft } from '@/features/courses/queries';
import { formatDuration, formatMonthDay, formatTimeRange } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import type { Tone } from '@/shared/lib/types';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';
import { toneTextClass } from '@/shared/ui/tone';

const TITLE = '코스 확정 · 쿠폰 발급';
/** AI 초안(다시 만들기)이 진행 중이라 확정을 잠글 때의 사유. 1단계 생성 로딩 문구 `코스를 짜고 있어요`를 이었다. */
const DRAFTING_REASON = 'AI가 코스를 짜고 있어요. 끝나면 확정할 수 있어요.';

/**
 * 코스 확정 전 점검 · 완료(V2 G08 · guide-s06 · 판정 2A-R10). 초안 코스면 점검 화면(소요 · 지점 분류 요약, `승인된 고교생
 * 요청 반영` · `제휴 상점 1곳 이상` 두 줄)이고, `코스 확정하기`(연타해도 요청 1번)가 성공하면 같은 주소가 완료 상태로
 * 바뀐다. 이미 확정된 코스로 들어오면 처음부터 완료 상태다. 제휴 지점이 0이면 확정을 막고 편집(G03)으로 보낸다.
 * 완료 상태의 승인 수는 신청자 보드, 발급 수는 코스의 `issuedCouponCount`(확정 뒤 승인으로 더 발급된 쿠폰 포함)다.
 * 코스가 없으면 신청자 관리로 보낸다.
 */
export function CourseConfirmPage() {
  const tourId = Number(useParams().tourId);
  const courseQuery = useGuideCourse(tourId);
  // 완료 상태의 승인 수를 위해 점검 화면에서부터 미리 받아 둔다(확정 직후 완료 카드가 바로 그려진다).
  const boardQuery = useApplicantsBoard(tourId);
  const course = courseQuery.data;
  const base = `/guide/tours/${tourId}`;

  if (course === null) return <Navigate to={`${base}/applicants`} replace />;
  if (course === undefined) {
    return (
      <>
        <TopBar title={TITLE} back={`${base}/course/edit`} />
        <Page>
          {courseQuery.isError ? (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : (
            <>
              <Skeleton className="mt-3 h-14 w-3/4" />
              <Skeleton className="mt-5 h-[150px] rounded-xl" />
              <Skeleton className="mt-3 h-[72px] rounded-xl" />
              <Skeleton className="mt-3 h-[72px] rounded-xl" />
            </>
          )}
        </Page>
      </>
    );
  }
  return course.status === 'CONFIRMED' ? (
    <ConfirmedCourse course={course} boardQuery={boardQuery} />
  ) : (
    <CourseCheck course={course} />
  );
}

/** 확정 전 점검(초안 코스). 뒤로는 코스 완성(G03). */
function CourseCheck({ course }: { course: Course }) {
  const { tour, stops } = course;
  const base = `/guide/tours/${tour.id}`;
  const confirm = useConfirmCourse(tour.id);
  const drafting = useIsCreatingDraft(tour.id);
  const sending = useRef(false);
  const ready = partnerStopCount(stops) > 0;
  const kinds = courseKinds(stops);
  const places = `${stops.length}개 장소로 구성했어요.`;

  function onConfirm() {
    if (sending.current) return; // 연타해도 요청은 한 번
    sending.current = true;
    // 성공하면 코스 캐시가 CONFIRMED로 바뀌어 같은 화면이 완료 상태가 된다.
    confirm.mutate(undefined, {
      onError: (error) => toast.error(errorMessage(error.code)),
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  return (
    <>
      <TopBar title={TITLE} back={`${base}/course/edit`} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="코스를 확정할까요?"
          description="확정 후 참가자에게 최종 일정이 공개돼요."
          className="mt-3"
        />

        <section className="mt-5 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-surface text-brand"
          >
            <ArrowUpRight className="size-6" />
          </span>
          <h3 className="mt-4 text-xl leading-snug font-bold text-ink">
            {tour.endsAt === null
              ? '코스 초안 완성'
              : `${formatDuration(tour.startsAt, tour.endsAt)} 코스 초안 완성`}
          </h3>
          <p className="mt-1.5 text-[13px] text-muted">
            {kinds.length > 0 ? `${kinds.join(' · ')} 등 ${places}` : places}
          </p>
        </section>

        <dl className="mt-3 flex flex-col gap-3">
          <CheckRow label="승인된 고교생 요청 반영" value="확인 완료" tone="success" />
          <CheckRow
            label="제휴 상점 1곳 이상"
            value={ready ? '충족' : '미충족'}
            tone={ready ? 'success' : 'danger'}
          />
        </dl>

        <p className="mt-3 rounded-lg bg-brand-soft px-4 py-3 text-xs text-muted">
          확정하면 참가자에게 코스가 공개되고 쿠폰이 자동 발급돼요.
        </p>

        <BottomAction>
          <Button
            disabled={!ready || drafting}
            loading={confirm.isPending}
            hint={
              !ready
                ? {
                    reason: '제휴 상점을 1곳 이상 넣어 주세요.',
                    action: { label: '코스 편집으로', to: `${base}/course/edit` },
                  }
                : drafting
                  ? { reason: DRAFTING_REASON }
                  : undefined
            }
            onClick={onConfirm}
          >
            코스 확정하기
          </Button>
        </BottomAction>
      </Page>
    </>
  );
}

function CheckRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="rounded-xl bg-surface px-5 py-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`mt-1 text-[17px] font-bold ${toneTextClass[tone]}`}>{value}</dd>
    </div>
  );
}

/**
 * 확정 완료 상태. 뒤로는 신청자 관리다 — 편집 주소는 확정 코스를 다시 이 화면으로 보내므로 뒤로가 제자리걸음이 된다.
 */
function ConfirmedCourse({
  course,
  boardQuery,
}: {
  course: Course;
  boardQuery: ReturnType<typeof useApplicantsBoard>;
}) {
  const { tour, stops, issuedCouponCount } = course;
  const base = `/guide/tours/${tour.id}`;
  const board = boardQuery.data;

  return (
    <>
      <TopBar title={TITLE} back={`${base}/applicants`} />
      <Page className={BOTTOM_ACTION_PAGE}>
        {/* 완료 카드는 신청자 보드와 상관없이 늘 그린다 — 보드는 승인 수 줄에만 쓴다(데이터 우선 렌더링). */}
        <section className="mt-3 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-surface text-success"
          >
            <Check className="size-6" />
          </span>
          <h2 className="mt-4 text-xl leading-snug font-bold text-ink">코스를 확정했어요</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            {`${formatMonthDay(tour.startsAt)} ${formatTimeRange(tour.startsAt, tour.endsAt)}`}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {`${stops.map(stopKindLabel).join(' · ')} / 총 ${stops.length}개 장소`}
          </p>
          {board !== undefined ? (
            <p className="mt-3 text-[15px] font-bold text-ink">
              {`참가 승인 ${board.counts.approved}명 · 쿠폰 ${issuedCouponCount}장 발급`}
            </p>
          ) : boardQuery.isError ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 text-[13px] text-muted">
                {errorMessage(boardQuery.error.code)}
              </p>
              <Button variant="secondary" size="sm" onClick={() => void boardQuery.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : (
            <Skeleton className="mt-3 h-6 w-2/3" />
          )}
          {issuedCouponCount === 0 ? (
            <p className="mt-1 text-[13px] text-muted">
              코스에 제휴 상점이 없어 발급된 쿠폰이 없어요.
            </p>
          ) : null}
          <p className="mt-3 text-[13px] text-muted">
            코스 확정 후에 신청을 승인하면 새 승인자에게도 쿠폰을 발급해요.
          </p>
        </section>

        <div className="mt-4">
          <Link to={`${base}/course`} className={buttonClass('secondary')}>
            확정 코스 지도 보기
          </Link>
        </div>

        <BottomAction>
          <Link to="/guide/tours" className={buttonClass('primary')}>
            내가 개설한 투어로
          </Link>
        </BottomAction>
      </Page>
    </>
  );
}
