import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { toneTextClass } from './tone';

// 화면 맨 위의 회색 알약 안내(예: "모집 중 · 남은 자리 3명").
export function StatusChip({
  icon,
  tone = 'neutral',
  className,
  children,
}: {
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-ink',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className={cn('flex shrink-0 items-center', toneTextClass[tone])}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
