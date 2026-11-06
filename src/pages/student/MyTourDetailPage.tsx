import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { isUpcomingTour, STUDENT_APPLICATION_STATUS } from '@/features/applications/model';
import { useMyApplication } from '@/features/applications/queries';
import { campusLabel } from '@/features/tours/model';
import { formatDotDateWeekday, formatTimeRange } from '@/shared/lib/date';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { toneTextClass } from '@/shared/ui/tone';
import { TopBar } from '@/shared/ui/TopBar';

function LinkRow({ title, description }: { title: string; description: string }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[17px] font-bold text-ink">
          {title}
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
        </p>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
    </>
  );
}

const rowClass = 'flex items-center gap-3 rounded-lg bg-surface px-5 py-4';

function Header({ children }: { children?: ReactNode }) {
  return (
    <>
      <TopBar title="신청 내역 상세" back="/my-tours" />
      <Page>{children}</Page>
    </>
  );
}

/** 신청 내역 상세(hs-s07 · V2 H10). 오픈채팅은 서버가 승인된 신청에만 준다. 취소 가능 여부도 서버 값(`cancellable`)을 그린다. */
export function MyTourDetailPage() {
  const applicationId = Number(useParams().applicationId);
  const navigate = useNavigate();
  const query = useMyApplication(applicationId);
  const { data: app } = query;

  // 다시 불러오다 실패해도 이미 받은 신청은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만.
  if (app === undefined && query.isError) {
    return (
      <Header>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Header>
    );
  }
  if (app === undefined) {
    return (
      <Header>
        <Skeleton className="h-12" />
        <Skeleton className="mt-5 h-[140px] rounded-xl" />
        <Skeleton className="mt-3 h-[70px]" />
        <Skeleton className="mt-3 h-[70px]" />
      </Header>
    );
  }

  const { tour } = app;
  const status = STUDENT_APPLICATION_STATUS[app.status];
  const live = app.status === 'PENDING' || app.status === 'APPROVED';
  // 취소 UI(버튼 · 무효화 안내)는 아직 끝나지 않은 탐방의 살아 있는 신청에만. 이 분류가 내 탐방 목록의 예정 탭과 같다
  // (`groupMyApplications`) — 뒤로 가기도 온 탭으로 돌아간다.
  const active = live && isUpcomingTour(tour);
  // 코스는 승인된 신청자에게만 열린다(서버도 승인 대기 신청에는 코스를 주지 않는다).
  const courseOpen = app.status === 'APPROVED' && app.courseStatus === 'CONFIRMED';

  return (
    <>
      <TopBar title="신청 내역 상세" back={active ? '/my-tours' : '/my-tours?tab=past'} />
      <Page className={active ? BOTTOM_ACTION_PAGE : undefined}>
        <PageHeading as="h2" title="신청 내역" description="참여 일정을 확인하고 준비해 주세요." />

        <section className="mt-5 rounded-xl bg-surface p-5">
          <StatusChip tone={status.chipTone}>{status.label}</StatusChip>
          <h3 className="mt-3 text-xl leading-snug font-bold text-ink">{tour.title}</h3>
          <p className="mt-2 text-[13px] text-muted">
            {formatDotDateWeekday(tour.startsAt)} · {formatTimeRange(tour.startsAt, tour.endsAt)}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {campusLabel(tour.universityName, tour.campusName)}
          </p>
        </section>

        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-lg bg-surface px-5 py-4">
            <p className="text-[13px] text-muted">가이드 승인 상태</p>
            <p className={`mt-1 text-[17px] font-bold ${toneTextClass[status.textTone]}`}>
              {status.label}
            </p>
          </div>

          {app.openChatUrl ? (
            <a
              href={app.openChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={rowClass}
            >
              <LinkRow title="가이드 오픈채팅" description="승인된 참가자만 입장할 수 있어요." />
            </a>
          ) : null}

          {live && (active || courseOpen) ? (
            courseOpen ? (
              <Link to={`/my-tours/${app.id}/course`} className={rowClass}>
                <LinkRow title="코스 보기" description="캠퍼스 · 전공 Q&A · 로컬 상점" />
              </Link>
            ) : (
              <div className="rounded-lg bg-surface px-5 py-4">
                <p className="text-[17px] font-bold text-ink">코스 보기</p>
                <p className="mt-1 text-xs text-muted">
                  {app.status === 'PENDING'
                    ? '가이드가 신청을 승인하면 지도와 쿠폰이 공개돼요.'
                    : '가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.'}
                </p>
              </div>
            )
          ) : null}

          {active ? (
            <p className="rounded-lg bg-brand-soft px-4 py-3 text-[13px] text-muted">
              신청을 취소하면 참여 권한과 발급 쿠폰이 무효화돼요.
            </p>
          ) : null}
        </div>

        {active ? (
          <BottomAction>
            {app.cancellable ? (
              <Button
                variant="secondary"
                onClick={() => void navigate(`/my-tours/${app.id}/cancel`)}
              >
                신청 취소하기
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled
                hint={{ reason: '탐방 날짜가 되어 취소할 수 없어요.' }}
              >
                신청 취소하기
              </Button>
            )}
          </BottomAction>
        ) : null}
      </Page>
    </>
  );
}
