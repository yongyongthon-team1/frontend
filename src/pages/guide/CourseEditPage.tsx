import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { CourseStop } from '@/features/courses/model';
import {
  useConfirmCourse,
  useDeleteStop,
  useGuideCourse,
  useReorderStops,
  useUpdateStop,
} from '@/features/courses/queries';
import { circled } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { AiBadge } from '@/shared/ui/AiBadge';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Textarea } from '@/shared/ui/Textarea';
import { TopBar } from '@/shared/ui/TopBar';

const showError = (error: { code: string }) => toast.error(errorMessage(error.code));

/**
 * 코스 편집(guide-s05): 순서(위로 · 아래로) · 한줄평 · 지점 빼기와 최종 확정. 지점 추가 · 상점 교체는 2단계다.
 * 코스를 바꾸는 요청이 하나라도 진행 중이면 편집 · 확정 버튼을 모두 잠가 요청이 겹치지 않게 한다. 방문 시간은
 * 서버가 위치 슬롯으로 다시 매긴 값을 그대로 그린다.
 */
export function CourseEditPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const courseQuery = useGuideCourse(tourId);
  const reorder = useReorderStops(tourId);
  const updateStop = useUpdateStop(tourId);
  const deleteStop = useDeleteStop(tourId);
  const confirm = useConfirmCourse(tourId);
  const [noteStopId, setNoteStopId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [deleteStopId, setDeleteStopId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const course = courseQuery.data;
  const base = `/guide/tours/${tourId}`;
  const topBar = <TopBar title="탐방 코스 편집" back={`${base}/course/draft`} />;

  if (course === undefined) {
    return (
      <>
        {topBar}
        <Page>
          {courseQuery.isError ? (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-4 h-36 rounded-lg" />
              <Skeleton className="mt-3 h-36 rounded-lg" />
              <Skeleton className="mt-3 h-36 rounded-lg" />
            </>
          )}
        </Page>
      </>
    );
  }
  // 코스가 없으면 초안 화면이 "아직 초안이 없어요"와 AI 코스 만들기를 보여 준다.
  if (course === null) return <Navigate to={`${base}/course/draft`} replace />;
  if (course.status === 'CONFIRMED') return <Navigate to={`${base}/course/confirmed`} replace />;

  const { stops } = course;
  const busy =
    reorder.isPending || updateStop.isPending || deleteStop.isPending || confirm.isPending;
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

  function onConfirmCourse() {
    confirm.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        void navigate(`${base}/course/confirmed`, { replace: true });
      },
      onError: (error) => {
        setConfirmOpen(false);
        showError(error);
      },
    });
  }

  return (
    <>
      {topBar}
      <Page>
        <p className="text-sm text-muted">순서를 바꾸고 장소를 교체할 수 있어요.</p>

        <ol aria-label="코스 지점" className="mt-4 flex flex-col gap-3">
          {stops.map((stop, index) => (
            <li key={stop.id}>
              <EditStopItem
                stop={stop}
                busy={busy}
                first={index === 0}
                last={index === stops.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                onNote={() => openNote(stop)}
                onDelete={() => setDeleteStopId(stop.id)}
              />
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <Button
            disabled={busy || stops.length === 0}
            hint={
              stops.length === 0
                ? { reason: '지점이 하나 이상 있어야 확정할 수 있어요.' }
                : undefined
            }
            onClick={() => setConfirmOpen(true)}
          >
            최종 코스 확정
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted">확정 후에는 참가자에게 지도와 쿠폰이 공개돼요.</p>
      </Page>

      <BottomSheet
        open={noteStop !== null}
        onOpenChange={(open) => {
          if (!open) setNoteStopId(null);
        }}
        title={noteStop ? `${noteStop.name} 한줄평` : '한줄평'}
      >
        <Textarea label="한줄평" value={note} onChange={(e) => setNote(e.target.value)} />
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
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="코스를 확정할까요?"
        description="확정하면 더 이상 수정할 수 없고, 승인된 신청자에게 지도와 쿠폰이 공개돼요."
        confirmLabel="확정하기"
        onConfirm={onConfirmCourse}
        pending={confirm.isPending}
      />
    </>
  );
}

function EditStopItem({
  stop,
  busy,
  first,
  last,
  onUp,
  onDown,
  onNote,
  onDelete,
}: {
  stop: CourseStop;
  busy: boolean;
  first: boolean;
  last: boolean;
  onUp(): void;
  onDown(): void;
  onNote(): void;
  onDelete(): void;
}) {
  // 가이드 한줄평이 없으면 AI 추천 이유를 보여 주고, 그때만 AI 배지를 붙인다.
  const aiReason = stop.description === null ? stop.recommendationReason : null;
  const detail = stop.description ?? stop.recommendationReason;
  return (
    <article className="rounded-lg border border-border bg-bg p-5">
      <h2 className="text-base font-bold text-ink">
        <span aria-hidden="true">≡ </span>
        {`${circled(stop.order)} ${stop.name} · ${stop.visitTime}`}
      </h2>
      {detail ? (
        <div className="mt-1.5 flex items-start gap-1.5">
          {aiReason ? <AiBadge /> : null}
          <p className="min-w-0 text-sm text-muted">{detail}</p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label={`${stop.name} 위로 이동`}
          disabled={busy || first}
          onClick={onUp}
        >
          위로
        </Button>
        <Button
          size="sm"
          variant="secondary"
          aria-label={`${stop.name} 아래로 이동`}
          disabled={busy || last}
          onClick={onDown}
        >
          아래로
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onNote}>
          한줄평
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onDelete}>
          삭제
        </Button>
      </div>
    </article>
  );
}
