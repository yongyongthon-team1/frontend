import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

// 와이어프레임의 둥근 카드. muted면 회색 면, 아니면 테두리 카드.
export function InfoCard({
  title,
  description,
  muted = false,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  muted?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-5',
        muted ? 'bg-surface' : 'border border-border bg-bg',
        className,
      )}
    >
      <div className="text-base font-bold text-ink">{title}</div>
      {description ? <div className="mt-1.5 text-sm text-muted">{description}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
