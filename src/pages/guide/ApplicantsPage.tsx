import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { APPLICATION_STATUS_LABEL, type Applicant } from '@/features/applications/model';
import { useApplicantsBoard, useApprove, useReject } from '@/features/applications/queries';
import { TOUR_STATUS_LABEL } from '@/features/tours/model';
import { errorMessage } from '@/shared/lib/errors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const BACK = '/guide/tours';

/**
 * 신청자 관리(guide-s03). 승인 · 거절 요청이 하나라도 진행 중이면 모든 승인 · 거절 버튼을 잠가 요청이 겹치지 않게 한다.
 * 남은 자리 · 코스 상태는 서버가 준 보드 값을 그대로 그린다.
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
              <Skeleton className="h-12" />
              <Skeleton className="mt-4 h-24" />
              <Skeleton className="mt-3 h-32" />
              <Skeleton className="mt-3 h-32" />
            </>
          )}
        </Page>
      </>
    );
  }

  const { tour, counts, applicants, course } = board;
  const busy = approve.isPending || reject.isPending;
  const noSeats = counts.remaining === 0;

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
      <Page>
        <StatusChip>
          {tour.title} · {TOUR_STATUS_LABEL[tour.status]}
        </StatusChip>

        <div className="mt-4 flex flex-col gap-3">
          <InfoCard
            title={`모집 정원 ${tour.capacity}명 중 ${counts.approved}명 승인`}
            description={`대기 ${counts.pending}명 · 승인 ${counts.approved}명 · 남은 자리 ${counts.remaining}명`}
            muted
          />

          {applicants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">아직 신청한 학생이 없어요.</p>
          ) : (
            applicants.map((applicant) => (
              <ApplicantCard
                key={applicant.id}
                applicant={applicant}
                busy={busy}
                noSeats={noSeats}
                onApprove={() => onApprove(applicant.id)}
                onReject={() => setRejectTarget(applicant.id)}
              />
            ))
          )}
        </div>

        <div className="mt-6">
          {course === null ? (
            counts.approved === 0 ? (
              <Button disabled hint={{ reason: '승인한 신청자가 있어야 코스를 만들 수 있어요.' }}>
                AI 코스 만들기
              </Button>
            ) : (
              <Button onClick={() => navigate(`/guide/tours/${tour.id}/course/draft?generate=1`)}>
                AI 코스 만들기
              </Button>
            )
          ) : course.status === 'CONFIRMED' ? (
            <Button onClick={() => navigate(`/guide/tours/${tour.id}/course/confirmed`)}>
              확정 코스 보기
            </Button>
          ) : (
            <Button onClick={() => navigate(`/guide/tours/${tour.id}/course/edit`)}>
              코스 이어서 편집
            </Button>
          )}
        </div>
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

function ApplicantCard({
  applicant,
  busy,
  noSeats,
  onApprove,
  onReject,
}: {
  applicant: Applicant;
  busy: boolean;
  noSeats: boolean;
  onApprove(): void;
  onReject(): void;
}) {
  const grade = applicant.grade ? `고${applicant.grade}` : '학년 미입력';
  return (
    <article className="rounded-lg border border-border bg-bg p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold text-ink">
          {`${applicant.userName} · ${grade} · ${APPLICATION_STATUS_LABEL[applicant.status]}`}
        </h2>
        {applicant.verified ? <Badge tone="success">✓ 인증</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted">{`“${applicant.motivation}”`}</p>

      {applicant.status === 'PENDING' ? (
        <div className="mt-4 flex items-start gap-2">
          <Button
            size="sm"
            disabled={busy || noSeats}
            hint={noSeats ? { reason: '남은 자리가 없어요.' } : undefined}
            onClick={onApprove}
          >
            승인
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onReject}>
            거절
          </Button>
        </div>
      ) : null}
      {applicant.status === 'APPROVED' ? (
        <p className="mt-3 text-sm font-semibold text-ink">오픈채팅 링크가 공개된 상태예요.</p>
      ) : null}
    </article>
  );
}
