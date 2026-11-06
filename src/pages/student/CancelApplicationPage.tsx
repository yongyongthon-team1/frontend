import { useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCancelMyApplication, useMyApplication } from '@/features/applications/queries';
import { formatDotDateWeekday, formatTimeRange } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

/**
 * 신청 취소 확인(V2 H11). 확인 창 대신 별도 화면이다. 취소할 수 없는 신청(오늘 탐방 · 이미 끝난 신청)으로 들어오면 상세로 보낸다.
 * 서버 값(`cancellable`)만 믿는다 — 화면이 날짜를 계산하지 않는다.
 */
export function CancelApplicationPage() {
  const applicationId = Number(useParams().applicationId);
  const navigate = useNavigate();
  const query = useMyApplication(applicationId);
  const cancel = useCancelMyApplication(applicationId);
  const sending = useRef(false);
  const { data: app } = query;
  const detailPath = `/my-tours/${applicationId}`;

  function onConfirm() {
    if (sending.current) return; // 연타해도 요청은 한 번
    sending.current = true;
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast('신청을 취소했어요.');
        void navigate(detailPath, { replace: true });
      },
      onError: (error) => toast.error(errorMessage(error.code)),
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  // 다시 불러오다 실패해도 이미 받은 신청은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만.
  if (app === undefined) {
    return (
      <>
        <TopBar title="신청 취소 확인" back={detailPath} />
        <Page>
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <Skeleton className="h-12" />
              <Skeleton className="mt-5 h-[130px] rounded-xl" />
              <Skeleton className="mt-3 h-[96px] rounded-xl" />
            </>
          )}
        </Page>
      </>
    );
  }

  // 취소할 수 없는 신청 → 상세(사유는 거기서 보인다). 방금 취소한 신청도 같은 곳으로 간다.
  if (!app.cancellable) return <Navigate to={detailPath} replace />;

  const { tour } = app;
  return (
    <>
      <TopBar title="신청 취소 확인" back={detailPath} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="정말 신청을 취소할까요?"
          description="취소 후에는 다시 신청해야 해요."
        />

        <section className="mt-5 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-xl font-bold text-danger"
          >
            !
          </span>
          <p className="mt-3 text-[17px] font-bold text-ink">참여 일정이 취소돼요</p>
          <p className="mt-1 text-[13px] text-muted">
            이미 승인된 신청과 연결된 쿠폰도 무효화돼요.
          </p>
        </section>

        <section className="mt-3 rounded-xl bg-surface p-4">
          <StatusChip tone="danger">취소 대상</StatusChip>
          <p className="mt-2 text-[17px] leading-snug font-bold text-ink">{tour.title}</p>
          <p className="mt-1 text-[13px] text-muted">
            {formatDotDateWeekday(tour.startsAt)} · {formatTimeRange(tour.startsAt, tour.endsAt)}
          </p>
        </section>

        <p className="mt-3 rounded-lg bg-brand-soft px-4 py-3 text-[13px] text-muted">
          정원 마감 시 다시 신청하지 못할 수 있어요.
        </p>

        <BottomAction>
          <Button variant="danger" loading={cancel.isPending} onClick={onConfirm}>
            신청 취소 확정
          </Button>
        </BottomAction>
      </Page>
    </>
  );
}
