import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { toneBgClass, toneChipTextClass, toneTextClass } from './tone';

// V2 상태 칩(알약, 높이 27). 화면 맨 위 안내(예: "모집 중 · 남은 자리 3명")와 카드 안 상태(예: "참여 확정")에 쓴다.
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
        'inline-flex min-h-[27px] w-fit max-w-full items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-bold',
        toneBgClass[tone],
        toneChipTextClass[tone],
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
