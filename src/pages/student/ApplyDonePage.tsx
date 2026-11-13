import { Check } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { campusLabel } from '@/features/tours/model';
import { useTour } from '@/features/tours/queries';
import { formatDotDateWeekday } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { StepList } from '@/shared/ui/StepList';
import { TopBar } from '@/shared/ui/TopBar';

const STEPS = ['신청 접수', '가이드 승인 대기', '승인 후 오픈채팅·코스 확인'];

/** 신청 완료 · 가이드 승인 대기(hs-s06 · V2 H08). 신청서에서 `replace`로 오므로 뒤로 가기 버튼이 없다. */
export function ApplyDonePage() {
  const tourId = Number(useParams().tourId);
  const tourQuery = useTour(tourId);
  const { data: tour } = tourQuery;

  return (
    <>
      <TopBar title="신청 완료 · 승인 대기" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="신청이 접수됐어요!"
          description="가이드가 신청 내용을 확인하고 있어요."
        />

        <section className="mt-5 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-surface text-brand"
          >
            <Check className="size-6" strokeWidth={2.5} />
          </span>
          <p className="mt-3 text-[17px] font-bold text-ink">승인 대기 중</p>
          <p className="mt-1 text-[13px] text-muted">확정되면 내 투어에서 바로 확인할 수 있어요.</p>
        </section>

        {/* 다시 불러오다 실패해도 이미 받은 탐방은 그대로 보인다(판정 24). */}
        {tour !== undefined ? (
          <div className="mt-3 rounded-xl bg-surface p-4">
            <StatusChip tone="success">신청 완료</StatusChip>
            <p className="mt-2 text-[17px] leading-snug font-bold text-ink">{tour.title}</p>
            <p className="mt-1 text-[13px] text-muted">
              {formatDotDateWeekday(tour.startsAt)} ·{' '}
              {campusLabel(tour.universityName, tour.campusName)}
            </p>
          </div>
        ) : tourQuery.isError ? (
          <div className="mt-3">
            <ErrorState error={tourQuery.error} onRetry={() => void tourQuery.refetch()} />
          </div>
        ) : (
          <Skeleton className="mt-3 h-[96px] rounded-xl" />
        )}

        <div className="mt-3">
          <StepList steps={STEPS} current={1} />
        </div>

        <BottomAction>
          <Link to="/my-tours" className={buttonClass('primary')}>
            내 투어로 가기
          </Link>
        </BottomAction>
      </Page>
    </>
  );
}
