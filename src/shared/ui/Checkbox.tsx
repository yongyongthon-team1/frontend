import { Check } from 'lucide-react';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  label: ReactNode;
  error?: string;
}

/**
 * V2 체크 줄(C01A · C05): 22px 체크 상자 + 글자, 줄 높이 44(눌림 영역은 줄 전체).
 * 진짜 `<input type="checkbox">`를 화면에서만 숨겨 키보드(Tab · Space) · 스크린리더 동작을 그대로 쓴다.
 * 초점은 체크 상자 바깥 outline으로 보인다.
 */
export function Checkbox({ label, error, id, className, disabled, ...rest }: CheckboxProps) {
  const base = useId();
  const inputId = id ?? `${base}-input`;
  const errorId = `${base}-error`;
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-h-11 cursor-pointer items-center gap-3 px-1 text-[13px] font-bold text-ink',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input
          {...rest}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden
          data-checkbox-box
          className={cn(
            'flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 border-muted bg-surface text-on-primary transition-colors',
            'peer-checked:border-brand peer-checked:bg-brand peer-checked:[&_svg]:opacity-100',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            error && 'border-danger',
          )}
        >
          <Check className="size-4 opacity-0" strokeWidth={3} />
        </span>
        <span className="min-w-0">{label}</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="px-1 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
