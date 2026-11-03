import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

// 화면 본문 여백: 좌우 20px, 하단 24px.
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-[var(--gutter)] pb-6', className)}>{children}</div>;
}
