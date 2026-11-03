import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { FieldMessages } from './FieldMessages';
import { fieldClass, fieldErrorClass, useFieldIds } from './fieldStyles';

export interface TextareaProps extends ComponentProps<'textarea'> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  placeholder,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: TextareaProps) {
  const { errorId, hintId, describedBy } = useFieldIds(error, hint, describedByProp);
  return (
    <div className="w-full">
      <textarea
        aria-label={label}
        placeholder={placeholder ?? label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          fieldClass,
          'min-h-32 resize-none border-transparent bg-surface py-4',
          error && fieldErrorClass,
          className,
        )}
        {...rest}
      />
      <FieldMessages error={error} hint={hint} errorId={errorId} hintId={hintId} />
    </div>
  );
}
