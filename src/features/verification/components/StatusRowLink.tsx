import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Tone } from '@/shared/lib/types';
import { StatusRow } from '@/shared/ui/StatusRow';

/**
 * C07의 상태 줄 + 그 인증 화면으로 가는 링크(`›`). 링크 이름은 `라벨 값`(예: `학생증 인증 심사 중`)이다.
 * 눌림 영역은 줄 전체라 44px를 넘는다.
 */
export function StatusRowLink({
  to,
  label,
  value,
  tone,
}: {
  to: string;
  label: string;
  value: string;
  tone: Tone;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg bg-surface pr-4 transition-colors hover:brightness-[0.98]"
    >
      <StatusRow
        label={label}
        value={value}
        tone={tone}
        className="min-w-0 flex-1 bg-transparent"
      />
      <ChevronRight aria-hidden className="size-6 shrink-0 text-muted" />
    </Link>
  );
}
