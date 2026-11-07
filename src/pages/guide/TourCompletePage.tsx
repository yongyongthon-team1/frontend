import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { completeActionState } from '@/features/applications/model';
import { useCompleteTour, useGuideTour } from '@/features/applications/queries';
import { TOUR_STATUS_LABEL } from '@/features/tours/model';
import { formatDotDateWeekday, formatTimeRange } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StatusChip } from '@/shared/ui/StatusChip';
import { StepList } from '@/shared/ui/StepList';
import { TopBar } from '@/shared/ui/TopBar';
import { GuideTourGate } from './GuideTourGate';

const STEPS = [
  '탐방이 실제로 종료됐는지 확인',
  '완료 시 참가자에게 리뷰 작성 안내',
  '가이드의 지난 탐방 목록에 저장',
];

/**
 * 탐방 종료 · 완료 처리(G09 · guide-s07, T-06). 화면 자체가 확인 단계라 확인 창이 없다(2B′-R13). 버튼 활성은 어댑터가 계산한
 * 값(`completeActionState`)이고, 되돌릴 수 없으므로 처리 중에는 잠기고 연타해도 요청은 한 번이다. 끝나면 지난 탐방 탭으로 간다.
 */
export function TourCompletePage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const query = useGuideTour(tourId);
  const complete = useCompleteTour(tourId);
  const sending = useRef(false);
  const applicantsPath = `/guide/tours/${tourId}/applicants`;

  function onComplete() {
    if (sending.current) return; // 연타해도 요청은 한 번
    sending.current = true;
    complete.mutate(undefined, {
      onSuccess: () => {
        toast('탐방을 완료 처리했어요.');
        void navigate('/guide/tours?tab=past', { replace: true });
      },
      onError: (error) => toast.error(errorMessage(error.code)),
      onSettled: () => {
        sending.current = false;
      },
    });
  }

  return (
    <GuideTourGate title="탐방 종료 · 완료 처리" back={applicantsPath} query={query}>
      {(detail) => {
        const { tour, courseStopCount } = detail;
        const state = completeActionState(detail);
        return (
          <>
            <TopBar title="탐방 종료 · 완료 처리" back={applicantsPath} />
            <Page className={BOTTOM_ACTION_PAGE}>
              <PageHeading
                as="h2"
                title="탐방을 마쳤나요?"
                description="실제 진행이 끝난 후 완료 처리해 주세요."
              />

              <section className="mt-5 rounded-xl bg-surface p-4">
                {/* 완료할 수 없는 탐방(날짜 전 · 완료 · 취소)에는 `진행 중`이 거짓이라 탐방 상태를 보인다. */}
                {state.enabled ? (
                  <StatusChip tone="info">진행 중</StatusChip>
                ) : (
                  <StatusChip tone="neutral">{TOUR_STATUS_LABEL[tour.status]}</StatusChip>
                )}
                <p className="mt-2 text-[17px] leading-snug font-bold text-ink">{tour.title}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {formatDotDateWeekday(tour.startsAt)} ·{' '}
                  {formatTimeRange(tour.startsAt, tour.endsAt)}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  참가자 {tour.approvedCount}명 · 코스 {courseStopCount}개 장소
                </p>
              </section>

              <div className="mt-3">
                <StepList steps={STEPS} />
              </div>
              <p className="mt-3 px-1 text-[13px] text-muted">
                완료 처리 후에는 참가자의 리뷰 작성이 가능해져요.
              </p>

              <BottomAction>
                <Button
                  loading={complete.isPending}
                  disabled={!state.enabled}
                  hint={state.enabled ? undefined : { reason: state.reason, action: state.action }}
                  onClick={onComplete}
                >
                  탐방 완료 처리
                </Button>
              </BottomAction>
            </Page>
          </>
        );
      }}
    </GuideTourGate>
  );
}
