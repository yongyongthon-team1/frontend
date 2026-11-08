import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

export interface NoticeProps extends ComponentProps<'div'> {
  /** info = 페일 블루 바탕 + 보조 글자(기본), danger = danger-soft 바탕 + danger 글자(반려 사유). */
  tone?: 'info' | 'danger';
}

/** V2 안내 상자(C01 · C01A · C03 · C04 · C06 · C08): 한두 줄 13px 글자의 둥근 상자. 모양만 있고 역할은 부르는 쪽이 정한다. */
export function Notice({ tone = 'info', className, children, ...rest }: NoticeProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-lg px-4 py-3 text-[13px]',
        tone === 'danger' ? 'bg-danger-soft font-medium text-danger' : 'bg-brand-soft text-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}
