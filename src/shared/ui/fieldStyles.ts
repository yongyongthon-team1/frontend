import { useId } from 'react';

// 입력창 공통: 모양 · 오류/도움말 id와 aria-describedby 조합.
export const fieldClass =
  'w-full rounded-md border border-border bg-surface px-4 text-[15px] text-ink placeholder:text-[13px] placeholder:font-medium placeholder:text-muted disabled:bg-neutral-100 disabled:text-muted';
export const fieldErrorClass = 'border-danger';
// 보이는 라벨(showLabel): 13/Bold, 입력 위.
export const fieldLabelClass = 'mb-2 block px-1 text-[13px] font-bold text-ink';

export function useFieldIds(error: string | undefined, hint: string | undefined, extra?: string) {
  const base = useId();
  const errorId = `${base}-error`;
  const hintId = `${base}-hint`;
  const inputId = `${base}-input`;
  const describedBy =
    [extra, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return { errorId, hintId, inputId, describedBy };
}
