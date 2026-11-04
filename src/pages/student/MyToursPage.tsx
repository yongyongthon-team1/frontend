import { Link } from 'react-router';
import { myTourDisplay } from '@/features/applications/model';
import { useMyApplications } from '@/features/applications/queries';
import { recommendationsPath } from '@/features/tours/lastQuery';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { toneDotClass } from '@/shared/ui/tone';
import { TopBar } from '@/shared/ui/TopBar';
import { cn } from '@/shared/lib/cn';

/** 내 탐방 상태별 목록(hs-a05). 카드 자체는 링크가 아니고, 다음 행동만 링크다(링크 안에 링크가 겹치지 않게). */
export function MyToursPage() {
  const query = useMyApplications();
  const { data: applications } = query;
  const toRecommendations = recommendationsPath();

  return (
    <>
      <TopBar title="내 탐방 · 신청 상태" />
      <Page>
        {/* 다시 불러오다 실패해도 이미 받은 목록은 그대로 보인다(판정 24) — 오류 화면은 받은 데이터가 없을 때만. */}
        {applications === undefined ? (
          query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-4 h-28" />
              <Skeleton className="mt-3 h-28" />
            </>
          )
        ) : applications.length === 0 ? (
          <EmptyState
            title="아직 신청한 탐방이 없어요."
            action={{ label: '추천받으러 가기', to: '/' }}
          />
        ) : (
          <>
            <p className="text-sm font-semibold text-muted">신청한 탐방 · 상태별 목록</p>
            <ul className="mt-3 flex flex-col gap-3">
              {applications.map((app) => {
                const { label, description, tone, action } = myTourDisplay(app, toRecommendations);
                return (
                  <li key={app.id}>
                    <InfoCard
                      title={
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={cn('size-2 shrink-0 rounded-full', toneDotClass[tone])}
                          />
                          {label}
                        </span>
                      }
                      description={description}
                      footer={
                        action ? (
                          <Link
                            to={action.to}
                            className="inline-flex min-h-11 items-center text-sm font-bold text-accent underline underline-offset-2"
                          >
                            {action.label} →
                          </Link>
                        ) : undefined
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="mt-6 px-1 text-sm text-muted">승인된 탐방의 오픈채팅 링크만 공개됩니다.</p>
      </Page>
    </>
  );
}
