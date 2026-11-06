import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { toneBgClass, toneDotClass, toneTextClass } from './tone';

// V2 상태 칩(알약, 높이 27). 화면 맨 위 안내(예: "모집 중 · 남은 자리 3명")와 카드 안 상태(예: "참여 확정")에 쓴다.
// 글자는 언제나 본문색(ink) — 연한 바탕 위 tone 색 글자는 대비가 모자라다(success 2.76:1). tone은 -soft 바탕과 tone 색
// 아이콘(없으면 점)으로 보여, 색만으로 뜻을 전하지 않는다(`Badge`와 같다).
export function StatusChip({
  icon,
  dot = true,
  tone = 'neutral',
  className,
  children,
}: {
  icon?: ReactNode;
  /** 아이콘이 없을 때 tone 색 점을 그린다(기본 켬). */
  dot?: boolean;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'inline-flex min-h-[27px] w-fit max-w-full items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-bold',
        toneBgClass[tone],
        'text-ink',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className={cn('flex shrink-0 items-center', toneTextClass[tone])}>
          {icon}
        </span>
      ) : dot ? (
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', toneDotClass[tone])} />
      ) : null}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
