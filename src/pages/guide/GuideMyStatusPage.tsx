import { Link } from 'react-router';
import type { Me } from '@/features/auth/model';
import { guideSchoolLine } from '@/features/auth/profile';
import { useMe } from '@/features/auth/queries';
import { useUniversities } from '@/features/campuses/queries';
import { campusLabel } from '@/features/tours/model';
import { StatusRowLink } from '@/features/verification/components/StatusRowLink';
import { VERIFICATION_STATUS_LABEL, VERIFICATION_TONE } from '@/features/verification/model';
import { BrandMark } from '@/shared/ui/BrandMark';
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

/** 학교 · 학과 줄. 대학 목록이 오기 전에는 자리만 잡고, 못 받으면 학과만 보인다(G12와 같다). */
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
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg bg-surface p-5">
      <StatusChip tone="info" dot={false}>
        대학생 가이드
      </StatusChip>
      <p className="mt-1 max-w-full truncate text-[17px] font-bold text-ink">{me.name}</p>
      <p className="max-w-full truncate text-[13px] text-muted">{me.email}</p>
      <SchoolLine me={me} />
    </div>
  );
}

/**
 * C07 내 정보 · 인증 상태 · 가이드(새 시안). 고교생 화면과 같은 모양에서 보호자 줄이 없고 프로필 카드에 학교 · 학과가 있다.
 * 학생증 인증 줄은 C03 · C08(`/guide/verify`)로 이어진다. 설정 행은 없다(판정 A6). MY의 `내 정보·인증 상태` 행이 여기로 온다.
 */
export function GuideMyStatusPage() {
  const { data: me } = useMe();
  return (
    <Page className={BOTTOM_ACTION_PAGE_TAB_ROOT}>
      <BrandMark variant="wordmark" />
      <PageHeading title="내 정보" description="계정과 인증 상태를 확인해요." className="mt-5" />
      {me === undefined ? (
        <Skeleton className="mt-5 h-[200px] rounded-lg" />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <ProfileCard me={me} />
          <StatusRowLink
            to="/guide/verify"
            label="학생증 인증"
            value={VERIFICATION_STATUS_LABEL[me.verificationStatus]}
            tone={VERIFICATION_TONE[me.verificationStatus]}
          />
        </div>
      )}
      <BottomAction>
        <Link to="/guide/me/profile" className={buttonClass('primary')}>
          정보 수정하기
        </Link>
      </BottomAction>
    </Page>
  );
}
