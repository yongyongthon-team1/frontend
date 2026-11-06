import { useState, type ChangeEvent } from 'react';
import { cn } from '@/shared/lib/cn';

export interface CodeInputProps {
  value: string;
  onChange(value: string): void;
  onComplete?(value: string): void;
  length?: number;
  label?: string;
}

// V2 숫자 코드 입력: 한 칸에 한 자리, 칸 수는 `length`. 실제 입력은 칸 위에 겹친 input 하나(숫자 외 문자는 지우고
// 길이를 넘으면 자른다)라서 키보드 · 붙여넣기 · 접근성 이름(`label`)은 그대로이고, 칸은 보이기만 한다.
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label = '6자리 쿠폰 코드',
}: CodeInputProps) {
  const [focused, setFocused] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/\D/g, '').slice(0, length);
    if (next === value) return;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  }

  // 지금 입력할 칸(다 찼으면 마지막 칸)을 강조한다.
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex h-16 items-center justify-center rounded-md border bg-surface text-2xl font-bold text-ink tabular-nums',
              focused && i === activeIndex ? 'border-brand' : 'border-border',
            )}
          >
            {value[i] ?? ''}
          </div>
        ))}
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  );
}
