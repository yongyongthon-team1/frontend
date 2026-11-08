import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { toneDotClass, toneTextClass } from './tone';

/**
 * V2 상태 줄(C07 · 가이드 승인 상태): 흰 상자 안에 라벨(13 muted) + 값(17 Bold, tone 색).
 * 라벨 `dt` · 값 `dd`라서 스크린리더가 `라벨, 값`으로 이어 읽는다. tone을 안 주면 본문색이다.
 * warning만 `StatusChip`의 규칙을 따른다: 주황(#ff9f72) 글자는 흰 바탕에서 약 2.1:1이라 AA 미달이므로 글자는 본문색,
 * tone은 앞의 점으로 보인다. 나머지 tone은 시안대로 글자색이다.
 */
export function StatusRow({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <dl className={cn('rounded-lg bg-surface px-5 py-4', className)}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-[17px] font-bold',
          tone && tone !== 'warning' ? toneTextClass[tone] : 'text-ink',
          tone === 'warning' && 'flex items-center gap-2',
        )}
      >
        {tone === 'warning' ? (
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', toneDotClass.warning)} />
        ) : null}
        {value}
      </dd>
    </dl>
  );
}
