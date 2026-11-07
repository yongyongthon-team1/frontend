import { useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  APPLICATION_STATUS_LABEL,
  coursePathFor,
  isUpcomingTour,
  type Applicant,
} from '@/features/applications/model';
import { useApplicantsBoard, useApprove, useReject } from '@/features/applications/queries';
import { errorMessage } from '@/shared/lib/errors';
import type { Tone } from '@/shared/lib/types';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const BACK = '/guide';

const STATUS_TONE: Record<Applicant['status'], Tone> = {
  PENDING: 'neutral',
  APPROVED: 'success',
  REJECTED: 'neutral',
  CANCELED: 'neutral',
};

/**
 * 신청자 승인(G02 · guide-s03). 승인 · 거절 요청이 하나라도 진행 중이면 모든 승인 · 거절 버튼을 잠가 요청이 겹치지 않게 한다.
 * 남은 자리 · 코스 상태는 서버가 준 보드 값을 그대로 쓴다.
 */
export function ApplicantsPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const query = useApplicantsBoard(tourId);
  const approve = useApprove(tourId);
  const reject = useReject(tourId);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const { data: board } = query;

  if (board === undefined) {
    return (
      <>
        <TopBar title="신청자 관리" back={BACK} />
        <Page>
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <Skeleton className="h-[72px] w-3/4" />
              <Skeleton className="mt-4 h-[110px] rounded-xl" />
              <Skeleton className="mt-3 h-[110px] rounded-xl" />
            </>
          )}
        </Page>
      </>
    );
  }

  const { tour, counts, applicants, course } = board;
  const busy = approve.isPending || reject.isPending;
  const noSeats = counts.remaining === 0;
  // 모집 중 · 마감이 아닌(완료 · 취소된) 탐방의 신청자 보드는 읽기 전용이다.
  const editable = isUpcomingTour(tour);
  const coursePath = coursePathFor(tour.id, course?.status ?? null, counts.approved);

  function onApprove(applicantId: number) {
    approve.mutate(applicantId, {
      onSuccess: (next) => {
        const name = next.applicants.find((a) => a.id === applicantId)?.userName;
        toast(name ? `${name} 님을 승인했어요.` : '신청을 승인했어요.');
      },
      onError: (error) => toast.error(errorMessage(error.code)),
    });
  }

  function onConfirmReject() {
    if (rejectTarget === null) return;
    reject.mutate(rejectTarget, {
      onSuccess: () => setRejectTarget(null),
      onError: (error) => {
        setRejectTarget(null);
        toast.error(errorMessage(error.code));
      },
    });
  }

  return (
    <>
      <TopBar title="신청자 관리" back={BACK} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title={
            counts.pending > 0
              ? `학생 ${counts.pending}명이\n승인을 기다려요.`
              : '신청자를 모두 확인했어요.'
          }
          description="참가 이유를 읽고 함께할 학생을 선택해요."
        />

        <div className="mt-5 flex flex-col gap-3">
          {applicants.length === 0 ? (
            <EmptyState title="아직 신청한 학생이 없어요." />
          ) : (
            applicants.map((applicant) => (
              <ApplicantCard
                key={applicant.id}
                applicant={applicant}
                busy={busy}
                noSeats={noSeats}
                editable={editable}
                onApprove={() => onApprove(applicant.id)}
                onReject={() => setRejectTarget(applicant.id)}
              />
            ))
          )}
        </div>

        {/* 고정 바 밖(본문)에 둔다 — 시연 화면에서 고정 바가 커져 보이는 창이 좁아지지 않게(고정 바는 늘 같은 높이). */}
        {editable ? (
          <div className="mt-2 flex justify-center gap-4">
            <TextLink to={`/guide/tours/${tour.id}/complete`}>탐방 완료</TextLink>
            <TextLink to={`/guide/tours/${tour.id}/cancel`}>탐방 취소</TextLink>
          </div>
        ) : null}

        <BottomAction>
          <p className="mb-3 text-center text-xs text-muted">
            승인하면 학생에게 오픈채팅 링크가 공개돼요.
          </p>
          {course === null ? (
            counts.approved === 0 ? (
              <Button disabled hint={{ reason: '승인한 신청자가 있어야 코스를 만들 수 있어요.' }}>
                승인 완료 후 코스 만들기
              </Button>
            ) : (
              <Button onClick={() => navigate(coursePath)}>승인 완료 후 코스 만들기</Button>
            )
          ) : (
            <Button onClick={() => navigate(coursePath)}>
              {course.status === 'CONFIRMED' ? '확정 코스 보기' : '코스 이어서 편집'}
            </Button>
          )}
        </BottomAction>
      </Page>

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        title="이 신청을 거절할까요?"
        description="거절하면 학생에게 거절로 표시돼요."
        confirmLabel="거절"
        onConfirm={onConfirmReject}
        pending={reject.isPending}
      />
    </>
  );
}

/** 신청자 목록 뒤의 작은 텍스트 링크(터치 44). */
function TextLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center px-1 text-xs text-muted underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

function ApplicantCard({
  applicant,
  busy,
  noSeats,
  editable,
  onApprove,
  onReject,
}: {
  applicant: Applicant;
  busy: boolean;
  noSeats: boolean;
  /** false면 승인 · 거절 버튼 없이 상태만 보인다. */
  editable: boolean;
  onApprove(): void;
  onReject(): void;
}) {
  const noSeatsId = useId();
  const pending = applicant.status === 'PENDING' && editable;
  const quote = `“ ${applicant.grade ? `고${applicant.grade} · ` : ''}${applicant.motivation} ”`;
  return (
    <article className="rounded-xl bg-surface p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-bold text-muted"
        >
          {applicant.userName.slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="min-w-0 truncate text-[17px] font-bold text-ink">{applicant.userName}</h2>
          {applicant.verified ? (
            <StatusChip tone="success" className="shrink-0">
              인증
            </StatusChip>
          ) : null}
        </div>
        {pending ? (
          <div className="w-[104px] shrink-0">
            <Button
              variant="soft"
              disabled={busy || noSeats}
              aria-describedby={noSeats ? noSeatsId : undefined}
              onClick={onApprove}
            >
              승인하기
            </Button>
          </div>
        ) : (
          <StatusChip tone={STATUS_TONE[applicant.status]} className="shrink-0">
            {APPLICATION_STATUS_LABEL[applicant.status]}
          </StatusChip>
        )}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[13px] break-words text-muted">{quote}</p>
      {pending ? (
        <>
          {noSeats ? (
            <p id={noSeatsId} className="mt-1 text-[13px] text-muted">
              남은 자리가 없어요.
            </p>
          ) : null}
          <div className="mt-1 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onReject}
              className="text-[13px]"
            >
              거절하기
            </Button>
          </div>
        </>
      ) : null}
    </article>
  );
}
