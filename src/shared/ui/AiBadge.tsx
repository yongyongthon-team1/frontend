import type { ReactNode } from 'react';

// AI가 만든 결과에는 항상 ✦ 배지를 붙인다.
export function AiBadge({ children }: { children?: ReactNode }) {
  return (
    <span
      role="group"
      aria-label="AI 결과"
      className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-ink"
    >
      <span aria-hidden className="text-accent">
        ✦
      </span>
      {children}
    </span>
  );
}
