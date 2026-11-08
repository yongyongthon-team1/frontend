import type { ReactNode } from 'react';
import type { Tone } from '@/shared/lib/types';
import { StatusChip } from '@/shared/ui/StatusChip';

/**
 * 진행 상태 카드(C04): 흰 카드 안 칩 `진행 상태` → 17/Bold 제목 → 13 muted 설명. 제목이 현재 상태 이름이다.
 * 화면의 영역(region)이라 이름(`진행 상태`)으로 찾을 수 있다.
 */
export function ProgressCard({
  tone,
  title,
  description,
  children,
}: {
  tone: Tone;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-label="진행 상태" className="flex flex-col gap-2 rounded-lg bg-surface p-5">
      <StatusChip tone={tone} dot={false}>
        진행 상태
      </StatusChip>
      <h3 className="text-[17px] font-bold text-ink">{title}</h3>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      {children}
    </section>
  );
}
