import { useId } from 'react';

// 입력창 공통: 모양 · 오류/도움말 id와 aria-describedby 조합.
export const fieldClass =
  'w-full rounded-md border border-border bg-bg px-4 text-base text-ink placeholder:text-muted disabled:bg-surface disabled:text-muted';
export const fieldErrorClass = 'border-danger';

export function useFieldIds(error: string | undefined, hint: string | undefined, extra?: string) {
  const base = useId();
  const errorId = `${base}-error`;
  const hintId = `${base}-hint`;
  const describedBy =
    [extra, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return { errorId, hintId, describedBy };
}
