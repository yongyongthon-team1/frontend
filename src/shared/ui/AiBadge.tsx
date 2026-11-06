import type { ReactNode } from 'react';

// AI가 만든 결과에는 항상 ✦ 배지를 붙인다.
export function AiBadge({ children }: { children?: ReactNode }) {
  return (
    <span
      role="group"
      aria-label="AI 결과"
      className="inline-flex items-center gap-1 min-h-[27px] rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold text-brand"
    >
      <span aria-hidden className="text-brand">
        ✦
      </span>
      {children}
    </span>
  );
}
