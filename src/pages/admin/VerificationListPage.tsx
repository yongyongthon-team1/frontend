import { Link } from 'react-router';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import {
  SUBJECT_CHECK_LABEL,
  SUBJECT_ROLE_LABEL,
  type AdminVerificationItem,
} from '@/features/admin/model';
import { usePendingVerifications } from '@/features/admin/queries';
import { formatShortDate } from '@/shared/lib/date';
import { BrandMark } from '@/shared/ui/BrandMark';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

export const ADMIN_LIST_PATH = '/admin/verifications';

/**
 * 맨 위 줄: 왼쪽 로고, 오른쪽 `로그아웃`(운영자는 탭이 없다). 발표 모드 배지가 같은 자리에 겹치므로 사장님 O01(`MyStorePage`)과 같이
 * `--header-action-clear`만큼 왼쪽으로 비켜 선다(발표 배지가 머리 줄 조작을 가리지 않음). 로그아웃 동작과 연타 잠금은 공용 `LogoutButton`이 가진다.
 */
function Header() {
  return (
    <div className="flex items-center justify-between">
      <BrandMark variant="wordmark" />
      <LogoutButton
        variant="ghost"
        size="sm"
        className="relative right-[var(--header-action-clear,0px)] -mr-3 w-auto px-3 hover:bg-transparent hover:text-ink"
      />
    </div>
  );
}

function VerificationCard({ item }: { item: AdminVerificationItem }) {
  return (
    <Link
      to={`${ADMIN_LIST_PATH}/${item.id}`}
      className="flex min-h-[90px] items-center gap-3 rounded-[18px] bg-surface p-4 transition-colors hover:brightness-[0.98]"
    >
      <div className="min-w-0 flex-1">
        <StatusChip tone="info">학생증 심사</StatusChip>
        <p className="mt-2 truncate text-[17px] leading-[1.4] font-bold text-ink">
          {`${item.userName} · ${SUBJECT_ROLE_LABEL[item.role]}`}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {`${formatShortDate(item.submittedAt)} 제출 · ${SUBJECT_CHECK_LABEL[item.role]}`}
        </p>
      </div>
      <span className="shrink-0 text-[13px] font-bold text-brand">자료 확인하기 ›</span>
    </Link>
  );
}

/**
 * 운영자 인증 심사 목록(owner-s06, A01). 심사 대기만 오래된 제출 순으로 보인다 — 명세에 처리 내역이 없어 `처리 완료` 탭은 없고(2B′-R11),
 * 처리한 건은 주소로만 읽기 전용으로 열린다. 다시 불러오다 실패해도 이미 받은 목록은 그대로 보인다.
 */
export function VerificationListPage() {
  const query = usePendingVerifications();
  const { data: items } = query;

  return (
    <Page className="pt-6">
      <Header />
      <PageHeading
        title="인증 심사"
        description="제출된 인증 자료를 검토해 주세요."
        className="mt-5"
      />
      {items === undefined ? (
        query.isError ? (
          <div className="mt-6">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            <Skeleton className="mt-6 h-6 w-24" />
            <Skeleton className="mt-3 h-[106px] rounded-xl" />
            <Skeleton className="mt-3 h-[106px] rounded-xl" />
          </>
        )
      ) : (
        <section className="mt-6">
          <h2 className="text-[17px] font-bold text-ink">{`대기 ${items.length}건`}</h2>
          {items.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="심사할 요청이 없어요."
                description="새 인증 요청이 오면 여기에 보여요."
              />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <VerificationCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Page>
  );
}
