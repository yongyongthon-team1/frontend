import { cn } from '@/shared/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'lg' | 'sm';

// Button과 버튼 모양 링크(EmptyState 등)가 같은 모양을 쓰도록 클래스만 따로 둔다.
// soft는 카드 안 작은 버튼이라 size를 따르지 않는다(높이 36 · 눌림 영역은 위아래로 넓혀 44).
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg'): string {
  if (variant === 'soft') {
    return cn(
      'relative inline-flex h-9 w-full items-center justify-between gap-2 rounded-md bg-brand-soft px-4 text-[13px] font-bold text-brand transition-colors',
      'before:absolute before:inset-x-0 before:-inset-y-1 before:content-[""]',
      'hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed',
    );
  }
  return cn(
    'inline-flex items-center justify-center gap-2 font-bold transition-colors',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
    size === 'lg'
      ? 'h-[var(--btn-h)] w-full rounded-lg px-5 text-[17px]'
      : 'min-h-11 rounded-md px-4 text-sm',
    variant === 'primary' &&
      'bg-brand text-on-primary hover:bg-brand-strong disabled:bg-neutral-100 disabled:text-muted',
    variant === 'secondary' &&
      'bg-brand-soft text-brand hover:brightness-95 disabled:bg-neutral-100 disabled:text-muted',
    variant === 'ghost' && 'bg-transparent text-muted hover:bg-neutral-100 disabled:opacity-60',
    variant === 'danger' &&
      'bg-danger text-on-primary hover:brightness-90 disabled:bg-neutral-100 disabled:text-muted',
  );
}
