import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { fieldClass, fieldErrorClass, useFieldIds } from './fieldStyles';

export interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: string;
}

// 와이어프레임처럼 라벨을 placeholder로 보여 주고, 스크린리더에는 aria-label로 알린다.
export function TextField({
  label,
  error,
  hint,
  placeholder,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: TextFieldProps) {
  const { errorId, hintId, describedBy } = useFieldIds(error, hint, describedByProp);
  return (
    <div className="w-full">
      <input
        aria-label={label}
        placeholder={placeholder ?? label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClass, 'h-[var(--field-h)]', error && fieldErrorClass, className)}
        {...rest}
      />
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
}
