import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { isUpcomingTour } from '@/features/applications/model';
import { useGuideTours } from '@/features/applications/queries';
import { hasGuideProfile } from '@/features/auth/guide';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import type { Me } from '@/features/auth/model';
import { guideSchoolLine, guideVerificationBadge } from '@/features/auth/profile';
import { useMe } from '@/features/auth/queries';
import { useUniversities } from '@/features/campuses/queries';
import { campusLabel } from '@/features/tours/model';
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

/** 숫자 카드 둘: 개설한 탐방(전체)과 진행 예정(모집 중 · 마감). 탐방 목록이 오기 전에는 자리만 잡는다. */
function Stats() {
  const query = useGuideTours();
  const { data: tours } = query;
  if (tours === undefined) {
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
      <Stat value={`${tours.length}회`} label="개설한 투어" />
      <Stat value={`${tours.filter(isUpcomingTour).length}회`} label="진행 예정" />
    </div>
  );
}

/** 학교 줄. 대학 목록이 오기 전에는 자리만 잡고, 못 받으면 학과만 보인다. */
function SchoolLine({ me }: { me: Me }) {
  const universities = useUniversities();
  if (universities.data === undefined && !universities.isError) {
    return <Skeleton className="h-4 w-48" />;
  }
  const universityId = me.guideProfile?.universityId ?? null;
  const university =
    universityId === null ? undefined : universities.data?.find((u) => u.id === universityId);
  return (
    <p className="text-[13px] text-muted">
      {guideSchoolLine(
        university ? campusLabel(university.name, university.campusName) : null,
        me.guideProfile?.major ?? null,
      )}
    </p>
  );
}

function ProfileCard({ me }: { me: Me }) {
  const badge = guideVerificationBadge(me.verificationStatus);
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
      <div
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl font-bold text-brand-strong"
      >
        {[...me.name][0] ?? ''}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="max-w-full truncate text-[17px] font-bold text-ink">{`${me.name} 가이드`}</p>
        <SchoolLine me={me} />
        <StatusChip tone={badge.tone}>{badge.label}</StatusChip>
      </div>
    </div>
  );
}

/**
 * G12 MY 홈 · 가이드(guide-s01). 프로필 · 숫자 카드 · `가이드 관리` 행. 알림 및 설정(G13)은 없고(2B′-R23) `내 정보·인증 상태` ·
 * `로그아웃` 행이 그 자리에 있다. 학과가 없으면 소제목 위에 프로필 등록 안내가 붙는다(막다른 곳 방지).
 */
export function GuideMyPage() {
  const { data: me } = useMe();
  return (
    <Page className="pt-6">
      <BrandMark variant="wordmark" />
      <PageHeading title="MY" description="내 가이드 활동과 프로필을 관리해요." className="mt-5" />
      {me === undefined ? (
        <Skeleton className="mt-5 h-[96px] rounded-lg" />
      ) : (
        <>
          <div className="mt-5">
            <ProfileCard me={me} />
          </div>
          <div className="mt-3">
            <Stats />
          </div>
          {hasGuideProfile(me) ? null : (
            <InfoCard
              tone="brand"
              className="mt-5"
              title="가이드 프로필을 먼저 등록해 주세요."
              footer={
                <Link
                  to="/guide/me/profile"
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand"
                >
                  프로필 등록하기
                  <ChevronRight aria-hidden className="size-4 shrink-0" />
                </Link>
              }
            />
          )}
        </>
      )}
      <h2 className="mt-6 text-lg font-bold text-ink">가이드 관리</h2>
      <div className="mt-3 flex flex-col gap-3">
        <ListRow
          to="/guide/me/profile"
          title="가이드 프로필 수정"
          meta="전공·학교·소개를 관리해요."
        />
        <ListRow
          to="/guide/wishes"
          title="고교생 희망 사항"
          meta="학생들이 남긴 희망 사항을 보고 투어를 준비해요."
        />
        <ListRow to="/guide/tours" title="내가 개설한 투어" meta="모집 상태와 참가자를 확인해요." />
        <ListRow
          to="/guide/me/status"
          title="내 정보·인증 상태"
          meta="계정과 재학 인증 정보를 확인해요."
        />
        <LogoutButton variant="row" description="다른 계정으로 UNIRO 사용하기" />
      </div>
    </Page>
  );
}
