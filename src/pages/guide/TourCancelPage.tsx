import { useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { cancelActionState } from '@/features/applications/model';
import { useCancelTour, useGuideTour } from '@/features/applications/queries';
import { TOUR_STATUS_LABEL } from '@/features/tours/model';
import { formatDotDateWeekday } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';
import { GuideTourGate } from './GuideTourGate';

const LIST = '/guide/tours';

/**
 * 탐방 취소 확인(G10 · guide-a04, T-05). 확인 창 대신 별도 화면이다(2B′-R13). 버튼 활성은 어댑터가 계산한 값
 * (`cancelActionState`)이고, 되돌릴 수 없으므로 처리 중에는 두 버튼이 모두 잠기고 연타해도 요청은 한 번이다.
 * `돌아가기`는 이전 화면으로, 주소로 바로 들어왔으면 내가 개설한 탐방으로 간다.
 */
export function TourCancelPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const hasHistory = useLocation().key !== 'default';
  const query = useGuideTour(tourId);
  const cancel = useCancelTour(tourId);
  const sending = useRef(false);

  function onCancel() {
    if (sending.current) return; // 연타해도 요청은 한 번
    sending.current = true;
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast('투어를 취소했어요.');
        void navigate(LIST, { replace: true });
      },
      onError: (error) => toast.error(errorMessage(error.code)),
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  return (
    <GuideTourGate title="투어 취소 확인" back={LIST} query={query}>
      {(detail) => {
        const { tour } = detail;
        const state = cancelActionState(detail);
        return (
          <>
            <TopBar title="투어 취소 확인" back={LIST} />
            <Page className={BOTTOM_ACTION_PAGE}>
              <PageHeading
                as="h2"
                title="투어를 취소할까요?"
                description="참가자에게 취소 안내가 전달돼요."
              />

              <section className="mt-5 rounded-xl bg-danger-soft p-5">
                <span
                  aria-hidden
                  className="flex size-11 items-center justify-center rounded-full bg-surface text-xl font-bold text-danger"
                >
                  !
                </span>
                <p className="mt-3 text-[17px] font-bold text-ink">투어 전체가 취소돼요</p>
                <p className="mt-1 text-[13px] text-muted">
                  승인된 신청과 발급된 쿠폰도 함께 무효화돼요.
                </p>
              </section>

              <section className="mt-3 rounded-xl bg-surface p-4">
                {/* 취소할 수 없는 탐방(완료 · 이미 취소)에는 `취소 대상`이 거짓이라 탐방 상태를 보인다. */}
                {state.enabled ? (
                  <StatusChip tone="danger">취소 대상</StatusChip>
                ) : (
                  <StatusChip tone="neutral">{TOUR_STATUS_LABEL[tour.status]}</StatusChip>
                )}
                <p className="mt-2 text-[17px] leading-snug font-bold text-ink">{tour.title}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {formatDotDateWeekday(tour.startsAt)} · 참가자 {tour.approvedCount}명
                </p>
              </section>

              <p className="mt-3 px-1 text-[13px] text-muted">
                취소 후 같은 일정으로 복구하려면 새 투어를 개설해야 해요.
              </p>

              <BottomAction>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="danger"
                    loading={cancel.isPending}
                    disabled={!state.enabled}
                    hint={
                      state.enabled ? undefined : { reason: state.reason, action: state.action }
                    }
                    onClick={onCancel}
                  >
                    투어 취소 확정
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={cancel.isPending}
                    onClick={() => void (hasHistory ? navigate(-1) : navigate(LIST))}
                  >
                    돌아가기
                  </Button>
                </div>
              </BottomAction>
            </Page>
          </>
        );
      }}
    </GuideTourGate>
  );
}
