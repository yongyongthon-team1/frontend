import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { fieldClass, fieldErrorClass, fieldLabelClass, useFieldIds } from './fieldStyles';

export interface TextareaProps extends ComponentProps<'textarea'> {
  label: string;
  error?: string;
  hint?: string;
  showLabel?: boolean;
}

export function Textarea({
  label,
  error,
  hint,
  placeholder,
  showLabel = false,
  id,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: TextareaProps) {
  const { errorId, hintId, inputId, describedBy } = useFieldIds(error, hint, describedByProp);
  return (
    <div className="w-full">
      {showLabel ? (
        <label htmlFor={id ?? inputId} className={fieldLabelClass}>
          {label}
        </label>
      ) : null}
      <textarea
        id={showLabel ? (id ?? inputId) : id}
        aria-label={showLabel ? undefined : label}
        placeholder={placeholder ?? label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          fieldClass,
          'min-h-[120px] resize-none py-4',
          error && fieldErrorClass,
          className,
        )}
        {...rest}
      />
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
}
