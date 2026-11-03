import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { InsightCard } from '@/features/campuses/components/InsightCard';
import type { CourseStop } from '@/features/courses/model';
import { useCreateDraft, useGuideCourse } from '@/features/courses/queries';
import { formatDuration } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { AiBadge } from '@/shared/ui/AiBadge';
import { AiLoading } from '@/shared/ui/AiLoading';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { KeywordChips } from '@/shared/ui/KeywordChips';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const GENERATE_STEPS = [
  '신청자 관심사를 모으고 있어요',
  '주변 상점을 찾고 있어요',
  '코스를 짜고 있어요',
];

/**
 * AI 코스 초안(guide-s04). 코스가 없고 주소에 `?generate=1`이 있으면 초안을 한 번 만든다 — StrictMode가 마운트
 * effect를 두 번 돌려도 ref로 한 번만 보내고, 성공하면 주소에서 `?generate=1`을 지워 새로고침해도 다시 만들지 않는다.
 * 무대 화면 450px 제약(설계 5.7) 때문에 와이어프레임과 달리 지점 카드를 위로 올리고 기준 · 인사이트 카드를 내린다.
 */
export function CourseDraftPage() {
  const tourId = Number(useParams().tourId);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseQuery = useGuideCourse(tourId);
  const createDraft = useCreateDraft(tourId);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const started = useRef(false);
  const course = courseQuery.data;
  const wantsGenerate = searchParams.get('generate') === '1';
  const base = `/guide/tours/${tourId}`;

  const { mutate: create } = createDraft;
  const generate = useCallback(() => {
    create(undefined, {
      onSuccess: () => void navigate(`${base}/course/draft`, { replace: true }),
    });
  }, [create, navigate, base]);

  useEffect(() => {
    if (course !== null || !wantsGenerate || started.current) return;
    started.current = true;
    generate();
  }, [course, wantsGenerate, generate]);

  const topBar = <TopBar title="탐방 코스 초안" back={`${base}/applicants`} />;

  if (course === undefined) {
    return (
      <>
        {topBar}
        <Page>
          {courseQuery.isError ? (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : (
            <>
              <Skeleton className="h-11" />
              <Skeleton className="mt-4 h-14" />
              <Skeleton className="mt-5 h-[76px] rounded-lg" />
              <Skeleton className="mt-2 h-[76px] rounded-lg" />
              <Skeleton className="mt-2 h-[76px] rounded-lg" />
            </>
          )}
        </Page>
      </>
    );
  }
  if (course === null) {
    return (
      <>
        {topBar}
        <Page>
          {createDraft.isError ? (
            <ErrorState error={createDraft.error} onRetry={generate} />
          ) : createDraft.isPending || wantsGenerate ? (
            <AiLoading steps={GENERATE_STEPS} />
          ) : (
            <EmptyState
              title="아직 코스 초안이 없어요"
              action={{ label: 'AI 코스 만들기', to: `${base}/course/draft?generate=1` }}
            />
          )}
        </Page>
      </>
    );
  }
  if (course.status === 'CONFIRMED') return <Navigate to={`${base}/course/confirmed`} replace />;

  const { tour } = course;

  // 다시 만들기가 실패하면 지금 초안을 그대로 두고 알린다(규칙에 걸리면 서버 코스도 그대로다).
  function onRegenerate() {
    create(undefined, {
      onSuccess: () => setRegenerateOpen(false),
      onError: (error) => {
        setRegenerateOpen(false);
        toast.error(errorMessage(error.code));
      },
    });
  }

  return (
    <>
      {topBar}
      <Page>
        <StatusChip icon="✦" tone="info">
          신청자 관심사 + 상권 데이터
        </StatusChip>
        <h2 className="mt-4 text-xl leading-snug font-bold whitespace-pre-line text-ink">
          {'신청자들이 궁금해한 주제로\n캠퍼스와 대학가를 연결했어요.'}
        </h2>
        <div className="mt-3 flex items-start gap-2">
          <span className="shrink-0 py-1.5 text-sm font-semibold text-muted">입력된 관심사</span>
          <div className="min-w-0 flex-1">
            <KeywordChips keywords={course.interests} />
          </div>
        </div>

        <h2 className="mt-5 text-lg font-bold text-ink">
          {tour.endsAt === null
            ? '추천 코스'
            : `${formatDuration(tour.startsAt, tour.endsAt)} 추천 코스`}
        </h2>
        <ol className="mt-2 flex flex-col gap-2">
          {course.stops.map((stop) => (
            <DraftStopCard key={stop.id} stop={stop} />
          ))}
        </ol>

        <InfoCard className="mt-4" muted title="추천 상점 기준" description={course.criteria} />
        <div className="mt-3">
          <InsightCard universityId={tour.universityId} />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => navigate(`${base}/course/edit`)}>코스 수정하기</Button>
          <Button variant="secondary" onClick={() => setRegenerateOpen(true)}>
            다시 만들기
          </Button>
        </div>
      </Page>

      <ConfirmDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="초안을 다시 만들까요?"
        description="지금 초안과 편집 내용이 새 초안으로 바뀌어요."
        confirmLabel="다시 만들기"
        onConfirm={onRegenerate}
        pending={createDraft.isPending}
      />
    </>
  );
}

/** 무대 화면에 세 곳이 한 번에 보이도록 72px 안팎으로 낮춘 지점 카드. 누르는 카드가 아니다. */
function DraftStopCard({ stop }: { stop: CourseStop }) {
  return (
    <li className="rounded-lg border border-border bg-bg px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 truncate text-base font-bold text-ink">{`${stop.visitTime} ${stop.name}`}</h3>
        {stop.partnership ? <Badge tone="info">제휴</Badge> : null}
      </div>
      {stop.recommendationReason ? (
        <div className="mt-1 flex items-center gap-1.5">
          <AiBadge />
          <p className="min-w-0 truncate text-sm text-muted">{stop.recommendationReason}</p>
        </div>
      ) : null}
    </li>
  );
}
