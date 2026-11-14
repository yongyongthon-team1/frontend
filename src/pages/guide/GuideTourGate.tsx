import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { GuideTourDetail } from '@/features/applications/model';
import { errorMessage } from '@/shared/lib/errors';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

const MY_TOURS = { label: '내가 개설한 탐방', to: '/guide/tours' };

/**
 * G09 · G10 공통 틀: 탐방을 불러오는 동안 `Skeleton`, 남의 탐방 · 없는 탐방(`FORBIDDEN` · `NOT_FOUND`)은 안내 + `내가 개설한 탐방`,
 * 그 밖 오류는 `ErrorState`. 다시 불러오다 실패해도 이미 받은 탐방은 그대로 보인다(판정 24).
 */
export function GuideTourGate({
  title,
  back,
  query,
  children,
}: {
  title: string;
  back: string;
  query: UseQueryResult<GuideTourDetail, { code: string }>;
  children: (detail: GuideTourDetail) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  const code = query.error?.code;
  return (
    <>
      <TopBar title={title} back={back} />
      <Page>
        {code === 'FORBIDDEN' || code === 'NOT_FOUND' ? (
          <EmptyState title={errorMessage(code)} action={MY_TOURS} />
        ) : query.isError ? (
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
