import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useApplyToTour } from '@/features/applications/queries';
import { useMe } from '@/features/auth/queries';
import { recommendationsPath } from '@/features/tours/lastQuery';
import { applyButtonState } from '@/features/tours/model';
import { useTour } from '@/features/tours/queries';
import { useDemoToolsOn } from '@/demo/demoStore';
import { DEMO_MOTIVATION } from '@/shared/config/demoAccounts';
import { formatMonthDay, formatTimeRange } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { Textarea } from '@/shared/ui/Textarea';
import { TopBar } from '@/shared/ui/TopBar';

const MIN_LENGTH = 5;
const MAX_LENGTH = 300;

function validate(motivation: string): string | undefined {
  if (motivation.length < MIN_LENGTH) return `하고 싶은 것을 ${MIN_LENGTH}자 이상 적어 주세요.`;
  if (motivation.length > MAX_LENGTH) return `${MAX_LENGTH}자 이내로 적어 주세요.`;
  return undefined;
}

/** 탐방 신청서(hs-a04). 신청이 막힌 상태면(정원 마감 · 인증 미완료 · 이미 신청) 버튼이 잠기고 사유가 보인다(hs-a06). */
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
        <TopBar title="탐방 신청서" back />
        <Page>
          <ErrorState error={tourQuery.error} onRetry={() => void tourQuery.refetch()} />
        </Page>
      </>
    );
  }
  if (tour === undefined || me.data === undefined) {
    return (
      <>
        <TopBar title="탐방 신청서" back />
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
  const verified = me.data.verificationStatus === 'APPROVED';
  const agreed = me.data.guardianStatus === 'AGREED';

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
      <TopBar title="탐방 신청서" back />
      <Page>
        <StatusChip>신청 전 정보 확인</StatusChip>
        <form onSubmit={onSubmit} noValidate>
          <div className="mt-4">
            <InfoCard
              title={tour.title}
              description={`${formatMonthDay(tour.startsAt)} · ${formatTimeRange(tour.startsAt, tour.endsAt)}${tour.guideVerified ? ' · 가이드 재학 인증 완료' : ''}`}
            />
          </div>

          <h3 className="mt-6 text-lg font-bold text-ink">가이드에게 하고 싶은 이야기는?</h3>
          <div className="mt-3">
            <Textarea
              label="하고 싶은 것 입력"
              placeholder="실기 준비와 대학에서 배우는 수업이 궁금해요."
              hint="예: 전공 수업, 시설, 대학 생활"
              value={motivation}
              error={error}
              onChange={(e) => {
                setMotivation(e.target.value);
                setError(undefined);
              }}
            />
          </div>

          <div className="mt-4">
            <InfoCard title="신청 조건 확인" muted>
              <p className="text-sm text-ink">재학 인증 승인 {verified ? '✓' : '✗'}</p>
              <p className="mt-1 text-sm text-ink">보호자 동의 완료 {agreed ? '✓' : '✗'}</p>
            </InfoCard>
          </div>

          <div className="mt-6">
            <Button
              type="submit"
              loading={apply.isPending}
              disabled={!canApply}
              hint={canApply ? undefined : { reason: state.reason, action: state.action }}
            >
              탐방 신청 완료하기
            </Button>
          </div>
          <p className="mt-3 px-1 text-sm text-muted">
            정원 마감 · 중복 신청 시 신청 버튼이 비활성화돼요.
          </p>
        </form>
      </Page>
    </>
  );
}
