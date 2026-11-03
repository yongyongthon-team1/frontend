import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AiBadge } from '@/shared/ui/AiBadge';

export interface TourCardProps {
  title: string;
  lines: ReactNode[];
  /** AI가 만든 추천 이유. 있으면 `AiBadge`와 함께 보여 준다. */
  reason?: string;
  footer?: ReactNode;
  /** 있으면 카드 전체가 이 주소로 가는 하나의 링크다. */
  to?: string;
}

// 와이어프레임 hs-s04의 탐방 카드.
export function TourCard({ title, lines, reason, footer, to }: TourCardProps) {
  const body = (
    <>
      <p className="text-base font-bold text-ink">{title}</p>
      {lines.map((line, i) => (
        <p key={i} className="mt-1 text-sm text-muted">
          {line}
        </p>
      ))}
      {reason ? (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-surface p-3">
          <AiBadge />
          <p className="min-w-0 text-sm text-ink">{reason}</p>
        </div>
      ) : null}
      {footer ? (
        <div className="mt-3 flex items-center justify-between text-sm font-semibold text-ink">
          {footer}
        </div>
      ) : null}
    </>
  );
  const cardClass = 'block rounded-lg border border-border bg-bg p-5';
  return to ? (
    <Link to={to} className={`${cardClass} hover:bg-surface/60`}>
      {body}
    </Link>
  ) : (
    <div className={cardClass}>{body}</div>
  );
}
