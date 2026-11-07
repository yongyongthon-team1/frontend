import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AdminVerificationDetail } from '@/features/admin/model';
import { errorMessage } from '@/shared/lib/errors';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';
import { ADMIN_LIST_PATH } from './VerificationListPage';

/**
 * A02 · A03 공통 틀: 심사 요청을 불러오는 동안 `Skeleton`, 없는 요청(`NOT_FOUND` · 주소가 숫자가 아님)은 안내 + `목록으로`,
 * 그 밖 오류는 `ErrorState`. 다시 불러오다 실패해도 이미 받은 요청은 그대로 보인다.
 */
export function ReviewGate({
  title,
  back,
  id,
  query,
  children,
}: {
  title: string;
  back: string;
  /** 주소의 id. 양의 정수가 아니면 요청 없이 바로 없는 요청으로 본다. */
  id: number;
  query: UseQueryResult<AdminVerificationDetail, { code: string }>;
  children: (detail: AdminVerificationDetail) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  const invalid = !Number.isInteger(id) || id < 1;
  const code = invalid ? 'NOT_FOUND' : query.error?.code;
  return (
    <>
      <TopBar title={title} back={back} />
      <Page>
        {code === 'NOT_FOUND' || code === 'FORBIDDEN' ? (
          <EmptyState
            title={errorMessage(code)}
            action={{ label: '목록으로', to: ADMIN_LIST_PATH }}
          />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <Skeleton className="h-12" />
            <Skeleton className="mt-5 h-[110px] rounded-xl" />
            <Skeleton className="mt-3 h-[200px] rounded-xl" />
          </>
        )}
      </Page>
    </>
  );
}
