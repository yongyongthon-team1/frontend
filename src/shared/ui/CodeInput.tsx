import type { ChangeEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import { fieldClass } from './fieldStyles';

export interface CodeInputProps {
  value: string;
  onChange(value: string): void;
  onComplete?(value: string): void;
  length?: number;
  label?: string;
}

// 한 개의 input으로 만든 숫자 코드 입력. 숫자 외 문자는 지우고 길이를 넘으면 자른다.
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label = '6자리 쿠폰 코드',
}: CodeInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/\D/g, '').slice(0, length);
    if (next === value) return;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label={label}
      placeholder={'0'.repeat(length)}
      value={value}
      onChange={handleChange}
      className={cn(
        fieldClass,
        'h-[var(--field-h)] text-center text-2xl font-bold tracking-[0.4em] tabular-nums',
      )}
    />
  );
}
