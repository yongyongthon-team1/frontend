import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { fieldClass, fieldErrorClass, fieldLabelClass, useFieldIds } from './fieldStyles';

export interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: string;
  // true면 라벨을 입력 위에 보이게 그린다(V2 폼 화면). 기본은 placeholder + aria-label.
  showLabel?: boolean;
}

// 기본은 라벨을 placeholder로 보여 주고 스크린리더에는 aria-label로 알린다. showLabel이면 보이는 라벨이 위에 붙는다.
export function TextField({
  label,
  error,
  hint,
  placeholder,
  showLabel = false,
  id,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: TextFieldProps) {
  const { errorId, hintId, inputId, describedBy } = useFieldIds(error, hint, describedByProp);
  return (
    <div className="w-full">
      {showLabel ? (
        <label htmlFor={id ?? inputId} className={fieldLabelClass}>
          {label}
        </label>
      ) : null}
      <input
        id={showLabel ? (id ?? inputId) : id}
        aria-label={showLabel ? undefined : label}
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
