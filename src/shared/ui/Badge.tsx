import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { toneBgClass, toneDotClass } from './tone';

// 상태 표시 배지. 색 점 + 본문색 글자라 색만으로 뜻을 전하지 않는다.
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink',
        toneBgClass[tone],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', toneDotClass[tone])} />
      {children}
    </span>
  );
}
