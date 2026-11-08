import { Link } from 'react-router';
import { useMe } from '@/features/auth/queries';
import { splitInterests } from '@/features/auth/profile';
import type { Me } from '@/features/auth/model';
import { StatusRowLink } from '@/features/verification/components/StatusRowLink';
import {
  GUARDIAN_STATUS_LABEL,
  GUARDIAN_TONE,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_TONE,
} from '@/features/verification/model';
import { BrandMark } from '@/shared/ui/BrandMark';
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

function ProfileCard({ me }: { me: Me }) {
  const interests = splitInterests(me.studentProfile?.interestedMajor ?? null);
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg bg-surface p-5">
      <StatusChip tone="info" dot={false}>
        고교생
      </StatusChip>
      <p className="mt-1 max-w-full truncate text-[17px] font-bold text-ink">{me.name}</p>
      <p className="max-w-full truncate text-[13px] text-muted">{me.email}</p>
      {interests.length > 0 ? (
        <p className="text-[13px] text-muted">{`관심 분야: ${interests.join(' · ')}`}</p>
      ) : null}
    </div>
  );
}

/**
 * C07 내 정보 · 인증 상태 · 고교생(새 시안). 프로필 카드 + 학생증 인증 · 보호자 참여 동의 상태 줄. 줄은 C03 · C04로 이어진다.
 * 시안의 `계정 및 알림 설정` 행은 뺀다(판정 A6 — 알림 설정은 명세에 없다). MY의 `인증 상태 확인` 행이 여기로 온다.
 */
export function MyStatusPage() {
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
            to="/verify"
            label="학생증 인증"
            value={VERIFICATION_STATUS_LABEL[me.verificationStatus]}
            tone={VERIFICATION_TONE[me.verificationStatus]}
          />
          <StatusRowLink
            to="/verify/guardian"
            label="보호자 참여 동의"
            value={GUARDIAN_STATUS_LABEL[me.guardianStatus]}
            tone={GUARDIAN_TONE[me.guardianStatus]}
          />
        </div>
      )}
      <BottomAction>
        <Link to="/me/edit" className={buttonClass('primary')}>
          정보 수정하기
        </Link>
      </BottomAction>
    </Page>
  );
}
