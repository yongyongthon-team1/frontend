import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { ActionLink, Tone } from '@/shared/lib/types';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { InfoCard } from '@/shared/ui/InfoCard';
import { StatusChip } from '@/shared/ui/StatusChip';

export interface VerificationStatusCardProps {
  title: string;
  badge?: { label: string; tone: Tone } | null;
  /** 반려일 때만 넘긴다(REJECTED가 아닌 상태의 사유는 보이지 않는다). */
  rejectionReason?: string | null;
  description?: ReactNode;
  action?: ActionLink | null;
  muted?: boolean;
  children?: ReactNode;
}

/**
 * 인증 단계 카드(재학 인증 · 보호자 동의 · 사업자 인증 …): 제목 + 오른쪽 상태 칩, 반려 사유 줄, 다음 행동 링크.
 * 제목을 이름으로 가진 영역(region)이라 E2E가 클래스 이름 대신 역할로 카드를 찾는다.
 */
export function VerificationStatusCard({
  title,
  badge,
  rejectionReason,
  description,
  action,
  muted = false,
  children,
}: VerificationStatusCardProps) {
  const titleId = useId();
  const body = (
    <>
      {rejectionReason ? (
        <p className="rounded-sm bg-danger-soft px-3 py-2 text-[13px] font-bold text-danger">
          {`반려 사유: ${rejectionReason}`}
        </p>
      ) : null}
      {children}
      {action ? (
        <Link to={action.to} className={buttonClass('soft')}>
          <span className="min-w-0 truncate">{action.label}</span>
          <ChevronRight aria-hidden className="size-4 shrink-0" />
        </Link>
      ) : null}
    </>
  );
  return (
    <InfoCard
      labelledBy={titleId}
      muted={muted}
      title={
        <div className="flex items-start justify-between gap-3">
          <span id={titleId} className="min-w-0">
            {title}
          </span>
          {badge ? (
            <StatusChip tone={badge.tone} className="shrink-0">
              {badge.label}
            </StatusChip>
          ) : null}
        </div>
      }
      description={description}
    >
      {rejectionReason || children || action ? (
        <div className="flex flex-col gap-3">{body}</div>
      ) : null}
    </InfoCard>
  );
}
