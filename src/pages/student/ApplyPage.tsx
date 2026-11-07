import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useApplyToTour } from '@/features/applications/queries';
import { useMe } from '@/features/auth/queries';
import { recommendationsPath } from '@/features/tours/lastQuery';
import { applyButtonState, campusLabel } from '@/features/tours/model';
import { useTour } from '@/features/tours/queries';
import { useDemoToolsOn } from '@/demo/demoStore';
import { DEMO_MOTIVATION } from '@/shared/config/demoAccounts';
import { formatDotDateWeekday } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { Textarea } from '@/shared/ui/Textarea';
import { TopBar } from '@/shared/ui/TopBar';

const MIN_LENGTH = 5;
/** 신청서 최대 길이 — 백엔드 A-01 `wish` 100자(2C-R12 ④). */
const APPLY_WISH_MAX = 100;

function validate(motivation: string): string | undefined {
  if (motivation.length < MIN_LENGTH) return `하고 싶은 것을 ${MIN_LENGTH}자 이상 적어 주세요.`;
  if (motivation.length > APPLY_WISH_MAX) return `${APPLY_WISH_MAX}자 이내로 적어 주세요.`;
  return undefined;
}

/** 탐방 신청서(hs-a04 · V2 H07). 신청이 막힌 상태면(정원 마감 · 인증 미완료 · 이미 신청) 버튼이 잠기고 사유가 보인다(hs-a06). */
export function ApplyPage() {
  const tourId = Number(useParams().tourId);
  const navigate = useNavigate();
  const tourQuery = useTour(tourId);
  const me = useMe();
  const apply = useApplyToTour(tourId);
  const demoOn = useDemoToolsOn();
  const [motivation, setMotivation] = useState(demoOn ? DEMO_MOTIVATION : '');
  const [error, setError] = useState<string | undefined>();
  const { data: tour } = tourQuery;

  // 다시 불러오다 실패해도 이미 받은 탐방은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만.
  if (tour === undefined && tourQuery.isError) {
    return (
      <>
        <TopBar title="탐방 신청서 · 하고 싶은 것" back />
        <Page>
          <ErrorState error={tourQuery.error} onRetry={() => void tourQuery.refetch()} />
        </Page>
      </>
    );
  }
  if (tour === undefined || me.data === undefined) {
    return (
      <>
        <TopBar title="탐방 신청서 · 하고 싶은 것" back />
        <Page>
          <Skeleton className="h-12" />
          <Skeleton className="mt-4 h-24" />
          <Skeleton className="mt-4 h-32" />
        </Page>
      </>
    );
  }

  const state = applyButtonState(me.data, tour, recommendationsPath());
  const canApply = state.kind === 'APPLY';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (apply.isPending || !canApply) return;
    const trimmed = motivation.trim();
    const problem = validate(trimmed);
    setError(problem);
    if (problem) return;
    apply.mutate(trimmed, {
      onSuccess: () => void navigate(`/tours/${tourId}/apply/done`, { replace: true }),
      onError: (err) => toast.error(errorMessage(err.code)),
    });
  }

  return (
    <>
      <TopBar title="탐방 신청서 · 하고 싶은 것" back />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="탐방을 신청할까요?"
          description="가이드에게 전할 관심사를 적어 주세요."
        />
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-1 flex-col">
          <div className="rounded-xl bg-surface p-4">
            <StatusChip tone="info">신청할 탐방</StatusChip>
            <p className="mt-2 text-[17px] leading-snug font-bold text-ink">{tour.title}</p>
            <p className="mt-1 text-[13px] text-muted">
              {campusLabel(tour.universityName, tour.campusName)} ·{' '}
              {formatDotDateWeekday(tour.startsAt)}
            </p>
          </div>

          <div className="mt-5">
            <Textarea
              showLabel
              label="탐방에서 하고 싶은 것"
              placeholder="예: 전공 수업을 듣고, 학생 식당도 가보고 싶어요."
              value={motivation}
              error={error}
              onChange={(e) => {
                setMotivation(e.target.value);
                setError(undefined);
              }}
            />
          </div>

          <p className="mt-3 rounded-lg bg-brand-soft px-4 py-3 text-[13px] text-muted">
            작성한 내용은 승인 후 AI 코스 초안의 추천 기준으로만 활용돼요.
          </p>

          <BottomAction>
            <Button
              type="submit"
              loading={apply.isPending}
              disabled={!canApply}
              hint={canApply ? undefined : { reason: state.reason, action: state.action }}
            >
              신청 완료하기
            </Button>
          </BottomAction>
        </form>
      </Page>
    </>
  );
}
