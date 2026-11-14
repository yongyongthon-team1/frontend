import { Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { InsightCard } from '@/features/campuses/components/InsightCard';
import { MapView } from '@/features/courses/components/MapView';
import { StopActionSheet } from '@/features/courses/components/StopActionSheet';
import {
  COURSE_NOTE_MAX,
  courseKinds,
  MAX_COURSE_STOPS,
  partnerStopCount,
  stopDurations,
  type CourseStop,
} from '@/features/courses/model';
import {
  useCreateDraft,
  useDeleteStop,
  useGuideCourse,
  useIsCreatingDraft,
  useReorderStops,
  useUpdateStop,
} from '@/features/courses/queries';
import { useDemoStore } from '@/demo/demoStore';
import { cn } from '@/shared/lib/cn';
import { formatDuration } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { AiBadge } from '@/shared/ui/AiBadge';
import { AiReasonPrefix } from '@/shared/ui/AiReasonPrefix';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Illustration } from '@/shared/ui/Illustration';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { Textarea } from '@/shared/ui/Textarea';
import { TopBar } from '@/shared/ui/TopBar';

const showError = (error: { code: string }) => toast.error(errorMessage(error.code));

const PARTNER_CAPTION = '코스에 제휴 가게 1곳 이상 포함해 주세요.';

/**
 * 코스 완성(V2 G03 · guide-s04 · s05 · 판정 2A-R10): AI 초안과 편집이 한 화면이다. 지점 카드의 `≡`가 지점 시트(위로 ·
 * 아래로 이동 · 한줄평 · 다른 장소로 교체 · 빼기)를 열고, `이 코스로 확정하기`는 확정 전 점검(G08)으로 간다. 1단계
 * `다시 만들기`와 `+ 장소 추가`(장소 고르기 G07, 2B′-R14)는 소제목 오른쪽 작은 버튼이다 — 소제목 줄 높이가 늘지 않게
 * 버튼은 위아래 음수 여백이고 소제목은 말줄임이다(무대 ②, 1280×590@1.5 여유 7.5px). 지점이 5곳이면 `+ 장소 추가`는
 * 누를 수 있지만(aria-disabled) 상한 토스트만 보인다. 코스를 바꾸는 요청이 하나라도 진행 중이면(AI 초안 생성 · 다시
 * 만들기 포함) 편집 · 확정 버튼을 모두 잠가 요청이 겹치지 않게 한다. 편집은 전체 스팟 PUT이고 방문 시간은 위치 슬롯이다(`buildSpots`, 2C-R13). 백엔드는
 * 지점이 1곳 이상이어야 해서 마지막 지점의 빼기는 잠근다(2C-R12 ②).
 *
 * 무대 예산(2A-R4 · R10): 생성 직후 지점 카드 3장이 판정 뷰포트(본문 약 420px)에서 하단 탭 위에 다 보여야 해서
 * ① 히어로는 일러스트를 작게, 배지와 소요를 한 줄로(높이 110 미만) ② 소제목 · 간격을 줄이고 ③ 카드 설명은 한 줄
 * 말줄임 ④ 확정 버튼은 하단에 고정하지 않고 목록 바로 뒤에 둔다(고정 버튼이 셋째 카드를 덮는다, H05 판정 R5와 같음).
 * 추천 상점 기준 · 캠퍼스 인사이트(1단계 기능, 판정 R9)는 그 아래 접힘 밖에 남는다.
 */
export function CourseEditPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const courseQuery = useGuideCourse(tourId);
  const reorder = useReorderStops(tourId);
  const updateStop = useUpdateStop(tourId);
  const deleteStop = useDeleteStop(tourId);
  const createDraft = useCreateDraft(tourId);
  const drafting = useIsCreatingDraft(tourId);
  const [sheetStopId, setSheetStopId] = useState<number | null>(null);
  const [noteStopId, setNoteStopId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [deleteStopId, setDeleteStopId] = useState<number | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  // 시연 패널의 지도 `도식`: 카카오맵을 부르지 않고 도식 지도로 고정한다(결정 0004의 수동 토글).
  const mapMode = useDemoStore((s) => s.mapMode);
  const scheduleHeadingRef = useRef<HTMLHeadingElement>(null);
  /** 지점 시트를 연 `≡`의 지점과 그때의 순서 — 창이 다 닫히면 포커스를 이리로 돌려준다. */
  const focusReturn = useRef<{ stopId: number; index: number } | null>(null);
  const course = courseQuery.data;
  const loadedStops = course?.stops;
  const busy = reorder.isPending || updateStop.isPending || deleteStop.isPending || drafting;
  const overlayOpen = sheetStopId !== null || noteStopId !== null || deleteStopId !== null;
  const base = `/guide/tours/${tourId}`;

  // 지점 시트 → 한줄평 · 빼기 창은 한 번에 닫히고 열려서, 창이 닫힐 때 Radix가 포커스를 돌려줄 곳(사라진 시트 버튼)이
  // 없다(포커스가 body로 떨어진다). 창이 모두 닫히고 요청이 끝나면 그 지점의 `≡`로 돌려준다 — 빠진 지점이면 같은
  // 자리의 다음(없으면 이전) 지점, 지점이 하나도 없으면 일정 소제목. 순서를 바꾼 지점은 새 자리의 `≡`가 받는다.
  useEffect(() => {
    const target = focusReturn.current;
    if (target === null || overlayOpen || busy || loadedStops === undefined) return;
    focusReturn.current = null;
    const stop =
      loadedStops.find((s) => s.id === target.stopId) ??
      loadedStops[target.index] ??
      loadedStops[target.index - 1];
    const button =
      stop === undefined
        ? null
        : listRef.current?.querySelector<HTMLButtonElement>(`button[data-stop-id="${stop.id}"]`);
    (button ?? scheduleHeadingRef.current)?.focus();
  }, [overlayOpen, busy, loadedStops]);
  const topBar = <TopBar title="탐방 코스 편집" back={`${base}/applicants`} />;

  if (course === undefined) {
    return (
      <>
        {topBar}
        <Page>
          {courseQuery.isError ? (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : (
            <>
              <Skeleton className="h-14 w-3/4" />
              <Skeleton className="mt-3 h-[72px] rounded-xl" />
              <Skeleton className="mt-3 h-6 w-40" />
              <Skeleton className="mt-3 h-[60px] rounded-lg" />
              <Skeleton className="mt-2 h-[60px] rounded-lg" />
              <Skeleton className="mt-2 h-[60px] rounded-lg" />
            </>
          )}
        </Page>
      </>
    );
  }
  // 코스가 없으면 신청자 관리(승인자가 있으면 그곳의 `승인 완료 후 코스 만들기`가 초안을 만든다).
  if (course === null) return <Navigate to={`${base}/applicants`} replace />;
  if (course.status === 'CONFIRMED') return <Navigate to={`${base}/course/confirm`} replace />;

  const { tour, stops } = course;
  const durations = stopDurations(stops, tour.endsAt);
  const kinds = courseKinds(stops).join('·');
  const hasPartner = partnerStopCount(stops) > 0;
  const sheetIndex = stops.findIndex((s) => s.id === sheetStopId);
  const sheetStop = stops[sheetIndex] ?? null;
  const noteStop = stops.find((s) => s.id === noteStopId) ?? null;

  function move(index: number, offset: -1 | 1) {
    const ids = stops.map((s) => s.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorder.mutate(ids, { onError: showError });
  }

  function openNote(stop: CourseStop) {
    setNote(stop.description ?? '');
    setNoteStopId(stop.id);
  }

  function onSaveNote() {
    if (noteStopId === null) return;
    updateStop.mutate(
      { stopId: noteStopId, description: note },
      { onSuccess: () => setNoteStopId(null), onError: showError },
    );
  }

  function onConfirmDelete() {
    if (deleteStopId === null) return;
    deleteStop.mutate(deleteStopId, {
      onSuccess: () => setDeleteStopId(null),
      onError: (error) => {
        setDeleteStopId(null);
        showError(error);
      },
    });
  }

  const atStopLimit = stops.length >= MAX_COURSE_STOPS;
  const pickPath = `${base}/course/stops/pick`;

  function onAddPlace() {
    if (atStopLimit) {
      toast.error(errorMessage('COURSE_STOP_LIMIT'));
      return;
    }
    navigate(`${pickPath}?mode=add`);
  }

  // 다시 만들기가 실패하면 지금 초안을 그대로 두고 알린다(규칙에 걸리면 서버 코스도 그대로다).
  function onRegenerate() {
    createDraft.mutate(undefined, {
      onSuccess: () => setRegenerateOpen(false),
      onError: (error) => {
        setRegenerateOpen(false);
        showError(error);
      },
    });
  }

  return (
    <>
      {topBar}
      <Page>
        <PageHeading
          as="h2"
          title="코스를 완성해 볼까요?"
          description="승인된 학생의 '하고 싶은 것'만 반영했어요."
        />

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-brand-soft py-3 pr-3 pl-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <AiBadge className="bg-surface">AI 추천 코스</AiBadge>
              {tour.endsAt === null ? null : (
                <p className="text-xl leading-[1.4] font-bold text-ink">
                  {formatDuration(tour.startsAt, tour.endsAt)}
                </p>
              )}
            </div>
            {kinds ? <p className="mt-0.5 truncate text-[13px] text-muted">{kinds}</p> : null}
          </div>
          <Illustration kind="dining" className="h-[52px] w-auto shrink-0 object-contain" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {/* 지점이 모두 빠지면 포커스가 이 제목으로 돌아온다(tabIndex -1: 탭 순서에는 넣지 않는다). */}
          <h3
            ref={scheduleHeadingRef}
            tabIndex={-1}
            className="min-w-0 truncate text-lg leading-[1.4] font-bold text-ink"
          >{`일정 · ${stops.length}개 장소`}</h3>
          <div className="-my-3 -mr-3 flex shrink-0">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-disabled={atStopLimit || undefined}
              onClick={onAddPlace}
              className="shrink-0 px-3 text-[13px] text-brand aria-disabled:opacity-60"
            >
              + 장소 추가
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setRegenerateOpen(true)}
              className="shrink-0 px-3 text-[13px] text-brand"
            >
              다시 만들기
            </Button>
          </div>
        </div>
        {hasPartner ? (
          <p className="text-xs text-muted">{PARTNER_CAPTION}</p>
        ) : (
          <StatusChip tone="warning" icon="!" className="mt-1">
            {PARTNER_CAPTION}
          </StatusChip>
        )}

        <ol ref={listRef} aria-label="코스 지점" className="mt-2 flex flex-col gap-2">
          {stops.map((stop, index) => (
            <StopCard
              key={stop.id}
              stop={stop}
              minutes={durations[index] ?? null}
              busy={busy}
              onEdit={() => {
                focusReturn.current = { stopId: stop.id, index };
                setSheetStopId(stop.id);
              }}
            />
          ))}
        </ol>

        <div className="mt-4">
          <Button
            disabled={busy || stops.length === 0}
            hint={
              stops.length === 0
                ? { reason: '지점이 하나 이상 있어야 확정할 수 있어요.' }
                : undefined
            }
            onClick={() => navigate(`${base}/course/confirm`)}
          >
            이 코스로 확정하기
          </Button>
        </div>

        {/* 확정 전에도 코스 지도를 늘 펼쳐 둔다. 편집(순서 · 교체 · 빼기 · 추가)하면 핀 · 선 · 영역이 바로 따라간다.
            지점 카드 3장이 무대 화면에 다 보여야 해서(무대 ②) 목록 · 확정 버튼 아래에 둔다. 핀은 그 지점의 시트를 연다. */}
        {stops.length > 0 ? (
          <section aria-label="코스 지도" className="mt-4">
            <MapView
              stops={stops}
              forceSchematic={mapMode === 'schematic'}
              onSelect={(stopId) => {
                if (busy) return;
                const index = stops.findIndex((s) => s.id === stopId);
                focusReturn.current = { stopId, index };
                setSheetStopId(stopId);
              }}
            />
          </section>
        ) : null}

        <InfoCard className="mt-6" muted title="추천 상점 기준" description={course.criteria} />
        <div className="mt-3">
          <InsightCard universityId={tour.universityId} />
        </div>
      </Page>

      <StopActionSheet
        stop={sheetStop}
        isFirst={sheetIndex === 0}
        isLast={sheetIndex === stops.length - 1}
        canRemove={stops.length > 1}
        busy={busy}
        onMoveUp={() => move(sheetIndex, -1)}
        onMoveDown={() => move(sheetIndex, 1)}
        onEditNote={() => {
          if (sheetStop) openNote(sheetStop);
        }}
        onReplace={() => {
          if (sheetStop) navigate(`${pickPath}?mode=replace&stopId=${sheetStop.id}`);
        }}
        onRemove={() => setDeleteStopId(sheetStopId)}
        onClose={() => setSheetStopId(null)}
      />

      <BottomSheet
        open={noteStop !== null}
        onOpenChange={(open) => {
          if (!open) setNoteStopId(null);
        }}
        title={noteStop ? `${noteStop.name} 한줄평` : '한줄평'}
      >
        <Textarea
          label="한줄평"
          value={note}
          maxLength={COURSE_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button className="mt-4" loading={updateStop.isPending} onClick={onSaveNote}>
          저장
        </Button>
      </BottomSheet>

      <ConfirmDialog
        open={deleteStopId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteStopId(null);
        }}
        title="이 지점을 뺄까요?"
        description="시간은 남은 지점 순서대로 다시 맞춰져요."
        confirmLabel="빼기"
        onConfirm={onConfirmDelete}
        pending={deleteStop.isPending}
      />

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

/**
 * G03 지점 카드: 시간 알약 · 이름 · `{한줄평 또는 AI 추천 이유} · {N분}`(한 줄, 이유만 말줄임) · 오른쪽 `≡`(지점 시트).
 * 한줄평이 없어 AI 추천 이유를 보일 때만 앞에 ✦와 화면 낭독기용 `AI 추천 이유:`를 붙인다(1단계 규칙: AI 결과에는 ✦ ·
 * `AI 결과` 표시). 가이드 한줄평에는 붙이지 않는다.
 */
function StopCard({
  stop,
  minutes,
  busy,
  onEdit,
}: {
  stop: CourseStop;
  minutes: number | null;
  busy: boolean;
  onEdit(): void;
}) {
  const detail = stop.description ?? stop.recommendationReason;
  const fromAi = stop.description === null && stop.recommendationReason !== null;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface py-2.5 pr-1 pl-3">
      <span className="shrink-0 rounded-pill bg-brand-soft px-3 py-1.5 text-[13px] font-bold text-brand tabular-nums">
        {stop.visitTime}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[17px] leading-[1.4] font-bold text-ink">{stop.name}</h4>
        {detail !== null || minutes !== null ? (
          <p className="flex min-w-0 text-xs text-muted">
            {detail === null ? null : (
              <span className="min-w-0 truncate">
                {fromAi ? <AiReasonPrefix /> : null}
                {detail}
              </span>
            )}
            {minutes === null ? null : (
              <span className={cn('shrink-0', detail !== null && 'pl-1')}>
                {detail === null ? `${minutes}분` : `· ${minutes}분`}
              </span>
            )}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`${stop.name} 편집`}
        data-stop-id={stop.id}
        disabled={busy}
        onClick={onEdit}
        className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
      >
        <Menu aria-hidden className="size-5" />
      </button>
    </li>
  );
}
