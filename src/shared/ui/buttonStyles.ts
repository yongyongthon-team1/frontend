import { cn } from '@/shared/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'lg' | 'sm';

// Button과 버튼 모양 링크(EmptyState 등)가 같은 모양을 쓰도록 클래스만 따로 둔다.
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg'): string {
  return cn(
    'inline-flex items-center justify-center gap-2 font-bold transition-colors',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
    size === 'lg'
      ? 'h-[var(--btn-h)] w-full rounded-md px-5 text-base'
      : 'min-h-11 rounded-sm px-4 text-sm',
    variant === 'primary' &&
      'bg-primary text-on-primary hover:bg-primary/90 disabled:bg-border disabled:text-muted',
    variant === 'secondary' &&
      'border border-border bg-bg text-ink hover:bg-surface disabled:text-muted disabled:opacity-60',
    variant === 'ghost' && 'bg-transparent text-ink hover:bg-surface disabled:text-muted',
  );
}
