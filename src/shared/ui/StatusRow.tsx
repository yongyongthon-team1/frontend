import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { Tone } from '@/shared/lib/types';
import { toneTextClass } from './tone';

/**
 * V2 상태 줄(C07 · 가이드 승인 상태): 흰 상자 안에 라벨(13 muted) + 값(17 Bold, tone 색).
 * 라벨 `dt` · 값 `dd`라서 스크린리더가 `라벨, 값`으로 이어 읽는다. tone을 안 주면 본문색이다.
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
      <dd className={cn('mt-1 text-[17px] font-bold', tone ? toneTextClass[tone] : 'text-ink')}>
        {value}
      </dd>
    </dl>
  );
}
