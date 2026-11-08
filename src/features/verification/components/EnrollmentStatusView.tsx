import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { VerificationStatus } from '@/features/auth/model';
import type { ActionLink } from '@/shared/lib/types';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StatusRow } from '@/shared/ui/StatusRow';
import { TopBar } from '@/shared/ui/TopBar';
import { VERIFICATION_STATUS_LABEL, VERIFICATION_TONE } from '../model';

const HEADING: Record<'PENDING' | 'APPROVED', { title: string; description: string }> = {
  PENDING: {
    title: '학생증을 심사하고 있어요.',
    description: '결과는 내 정보 · 인증 상태에서도 볼 수 있어요.',
  },
  APPROVED: {
    title: '재학 인증이 끝났어요.',
    description: '학생증 확인이 완료됐어요.',
  },
};

/**
 * 재학 인증을 이미 냈을 때(심사 중 · 승인)의 `/verify` · `/guide/verify` 모습. 시안에는 없는 상태라(C03 `시안에 없는 것`)
 * C03과 같은 상단 바 머리 + 상태 줄 + 안내 상자 + 하단 고정 다음 행동으로 그린다. 반려는 C08(`EnrollmentScreen`)이다.
 */
export function EnrollmentStatusView({
  status,
  backTo,
  notice,
  extra,
  action,
}: {
  status: Extract<VerificationStatus, 'PENDING' | 'APPROVED'>;
  backTo: string;
  /** 안내 상자 안 글(줄마다 한 문장). */
  notice: string[];
  /** 상태 줄 아래 덧붙일 것(예: 가이드의 제출한 대학). */
  extra?: ReactNode;
  action: ActionLink;
}) {
  const heading = HEADING[status];
  return (
    <>
      <TopBar title="재학 인증" back={backTo} />
      <Page className={`${BOTTOM_ACTION_PAGE} pt-3`}>
        <PageHeading as="h2" title={heading.title} description={heading.description} />
        <div className="mt-5 flex flex-1 flex-col gap-3">
          <StatusRow
            label="학생증 인증"
            value={VERIFICATION_STATUS_LABEL[status]}
            tone={VERIFICATION_TONE[status]}
          />
          {extra}
          <Notice>
            <div className="flex flex-col gap-1">
              {notice.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </Notice>
        </div>
        <BottomAction>
          <Link to={action.to} className={buttonClass('primary')}>
            {action.label}
          </Link>
        </BottomAction>
      </Page>
    </>
  );
}
