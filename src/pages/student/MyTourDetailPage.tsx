import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { studentCourseLabel } from '@/features/courses/model';
import type { ApplicationStatus } from '@/features/applications/model';
import { useCancelMyApplication, useMyApplication } from '@/features/applications/queries';
import { formatMonthDay, formatShortDate, formatTimeRange } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import type { Tone } from '@/shared/lib/types';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const STATUS_CHIP: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  APPROVED: { label: '✓ 신청 승인 완료', tone: 'success' },
  PENDING: { label: '⌛ 가이드 승인 대기 중', tone: 'warning' },
  REJECTED: { label: '신청 거절', tone: 'danger' },
  CANCELED: { label: '취소됨', tone: 'neutral' },
};

/** 내 탐방 상세(hs-s07). 오픈채팅은 서버가 승인된 신청에만 준다. 취소 가능 여부도 서버 값(`cancellable`)을 그린다. */
export function MyTourDetailPage() {
  const applicationId = Number(useParams().applicationId);
  const query = useMyApplication(applicationId);
  const cancel = useCancelMyApplication(applicationId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: app } = query;

  if (query.isError) {
    return (
      <>
        <TopBar title="내 탐방" back="/my-tours" />
        <Page>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Page>
      </>
    );
  }
  if (app === undefined) {
    return (
      <>
        <TopBar title="내 탐방" back="/my-tours" />
        <Page>
          <Skeleton className="h-12" />
          <Skeleton className="mt-4 h-8 w-3/4" />
          <Skeleton className="mt-4 h-28" />
          <Skeleton className="mt-3 h-24" />
        </Page>
      </>
    );
  }

  const { tour } = app;
  const chip = STATUS_CHIP[app.status];
  const active = app.status === 'PENDING' || app.status === 'APPROVED';
  const confirmed = app.courseStatus === 'CONFIRMED';

  function onConfirmCancel() {
    cancel.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast('신청을 취소했어요.');
      },
      onError: (error) => {
        setConfirmOpen(false);
        toast.error(errorMessage(error.code));
      },
    });
  }

  return (
    <>
      <TopBar title="내 탐방" back="/my-tours" />
      <Page>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
        <h2 className="mt-4 text-2xl leading-snug font-bold text-ink">
          {app.status === 'APPROVED' ? `${formatMonthDay(tour.startsAt)}에 만나요!` : tour.title}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          <InfoCard
            title={`${tour.universityName} ${tour.campusName}`}
            description={`${formatShortDate(tour.startsAt)} ${formatTimeRange(tour.startsAt, tour.endsAt)} · ${tour.guideName} 가이드`}
          >
            <p className="text-sm font-semibold text-ink">
              진행 상태 · {studentCourseLabel(app.courseStatus)}
            </p>
          </InfoCard>

          {app.openChatUrl ? (
            <InfoCard
              title="가이드와 오픈채팅 참여하기"
              description="승인된 신청자에게만 링크가 열려요."
              muted
            >
              <a
                href={app.openChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('secondary')}
              >
                오픈채팅 바로가기 ↗
              </a>
            </InfoCard>
          ) : null}

          {active ? (
            <InfoCard title="캠퍼스 & 상권 코스">
              {confirmed ? (
                <div className="flex flex-col gap-2">
                  <Link to={`/my-tours/${app.id}/course`} className={buttonClass('primary')}>
                    코스 지도 보기
                  </Link>
                  <Link to={`/my-tours/${app.id}/coupons`} className={buttonClass('secondary')}>
                    쿠폰 보기
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.
                </p>
              )}
            </InfoCard>
          ) : null}
        </div>

        {active ? (
          <div className="mt-6">
            {app.cancellable ? (
              <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
                탐방 신청 취소
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled
                hint={{ reason: '탐방 날짜가 되어 취소할 수 없어요.' }}
              >
                탐방 신청 취소
              </Button>
            )}
          </div>
        ) : null}
      </Page>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="신청을 취소할까요?"
        description="승인된 신청을 취소하면 자리가 다른 학생에게 돌아가고, 발급된 쿠폰은 만료돼요."
        confirmLabel="신청 취소"
        onConfirm={onConfirmCancel}
        pending={cancel.isPending}
      />
    </>
  );
}
