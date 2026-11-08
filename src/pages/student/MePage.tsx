import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { completedTourCount } from '@/features/applications/model';
import { useMyApplications } from '@/features/applications/queries';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { studentVerificationPath } from '@/features/auth/landing';
import type { Me } from '@/features/auth/model';
import { splitInterests, verificationBadge } from '@/features/auth/profile';
import { useMe } from '@/features/auth/queries';
import { verifySteps } from '@/features/verification/model';
import { BrandMark } from '@/shared/ui/BrandMark';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { ListRow } from '@/shared/ui/ListRow';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-brand-soft p-4">
      <p className="text-2xl font-bold text-brand-strong">{value}</p>
      <p className="mt-0.5 text-[13px] text-muted">{label}</p>
    </div>
  );
}

/** 프로필 카드 아래 숫자 카드 둘. 참여한 탐방은 신청 목록에서 세므로 그 조회가 끝나기 전에는 자리만 잡는다. */
function Stats({ me }: { me: Me }) {
  const query = useMyApplications();
  const { data: applications } = query;
  const interests = `${splitInterests(me.studentProfile?.interestedMajor ?? null).length}개`;

  if (applications === undefined) {
    return query.isError ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[84px] rounded-lg" />
        <Skeleton className="h-[84px] rounded-lg" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat value={`${completedTourCount(applications)}회`} label="참여한 탐방" />
      <Stat value={interests} label="관심 전공" />
    </div>
  );
}

function ProfileCard({ me }: { me: Me }) {
  const badge = verificationBadge(me.verificationStatus);
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
      <div
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl font-bold text-brand-strong"
      >
        {[...me.name][0] ?? ''}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="max-w-full truncate text-[17px] font-bold text-ink">{me.name}</p>
        <p className="text-[13px] text-muted">고교생 · 탐방을 준비하는 중</p>
        <StatusChip tone={badge.tone}>{badge.label}</StatusChip>
      </div>
    </div>
  );
}

/**
 * H16 MY 홈 · 고교생(hs-a03). 프로필 · 숫자 카드 · `나의 활동` 행. 알림 및 설정(H18)은 없고(2B′-R23) `인증 상태 확인` ·
 * `로그아웃` 행이 그 자리에 있다. 인증이 안 끝났으면 `인증 이어하기` 안내가 소제목 위에 붙는다(막다른 곳 방지).
 */
export function MePage() {
  const { data: me } = useMe();
  return (
    <Page className="pt-6">
      <BrandMark variant="wordmark" />
      <PageHeading
        title="MY"
        description="내 정보와 탐방 기록을 한곳에서 관리해요."
        className="mt-5"
      />
      {me === undefined ? (
        <Skeleton className="mt-5 h-[96px] rounded-lg" />
      ) : (
        <>
          <div className="mt-5">
            <ProfileCard me={me} />
          </div>
          <div className="mt-3">
            <Stats me={me} />
          </div>
          {verifySteps(me).done ? null : (
            <InfoCard
              tone="brand"
              className="mt-5"
              title="인증을 마치면 탐방을 신청할 수 있어요."
              footer={
                <Link
                  to={studentVerificationPath(me)}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand"
                >
                  인증 이어하기
                  <ChevronRight aria-hidden className="size-4 shrink-0" />
                </Link>
              }
            />
          )}
        </>
      )}
      <h2 className="mt-6 text-lg font-bold text-ink">나의 활동</h2>
      <div className="mt-3 flex flex-col gap-3">
        <ListRow
          to="/my-tours?tab=past"
          title="지난 탐방"
          meta="완료한 캠퍼스 탐방과 후기를 확인해요."
        />
        <ListRow to="/me/wishes" title="내 희망 사항" meta="남긴 희망 사항을 보고 고쳐요." />
        <ListRow to="/me/edit" title="내 정보 수정" meta="이름·학교·관심 분야를 관리해요." />
        <ListRow to="/me/status" title="인증 상태 확인" meta="학생증 인증 및 보호자 동의 현황" />
        <LogoutButton variant="row" description="다른 계정으로 UNIRO 사용하기" />
      </div>
    </Page>
  );
}
