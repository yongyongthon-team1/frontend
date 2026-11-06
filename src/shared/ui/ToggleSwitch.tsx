import { useId } from 'react';
import { cn } from '@/shared/lib/cn';

export interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
}

/** V2 한 줄 흰 카드 행: 왼쪽 라벨 15/Bold + 설명 12 muted, 오른쪽 스위치. 행 전체가 `role="switch"` 버튼이다(최소 터치 44). */
export function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleSwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span id={labelId} className="block text-[15px] font-bold text-ink">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-xs text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'flex h-7 w-12 shrink-0 items-center rounded-pill p-0.5 transition-colors',
          checked ? 'bg-brand' : 'bg-neutral-300',
        )}
      >
        <span
          className={cn(
            'size-6 rounded-full bg-surface transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
