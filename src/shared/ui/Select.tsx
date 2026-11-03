import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { fieldClass, fieldErrorClass, useFieldIds } from './fieldStyles';

export interface SelectProps extends ComponentProps<'select'> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  hint?: string;
}

// 네이티브 select(모바일에서 OS 선택창을 쓴다).
export function Select({
  label,
  options,
  error,
  hint,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: SelectProps) {
  const { errorId, hintId, describedBy } = useFieldIds(error, hint, describedByProp);
  return (
    <div className="w-full">
      <div className="relative">
        <select
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldClass,
            'h-[var(--field-h)] appearance-none pr-11',
            error && fieldErrorClass,
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted"
        />
      </div>
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
}
