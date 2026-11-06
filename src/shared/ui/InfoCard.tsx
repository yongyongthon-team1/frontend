import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

const toneBg = { default: 'bg-surface', brand: 'bg-brand-soft', local: 'bg-local-soft' } as const;

// V2 카드: 바탕 위 흰 카드(테두리 · 그림자 없음). tone으로 페일 블루(brand) · 페일 피치(local) 카드, muted면 회색 면.
export function InfoCard({
  title,
  description,
  muted = false,
  tone = 'default',
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  muted?: boolean;
  tone?: 'default' | 'brand' | 'local';
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg p-4',
        tone === 'default' ? (muted ? 'bg-neutral-100' : toneBg.default) : toneBg[tone],
        className,
      )}
    >
      <div className="text-[17px] font-bold text-ink">{title}</div>
      {description ? <div className="mt-1.5 text-[13px] text-muted">{description}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
