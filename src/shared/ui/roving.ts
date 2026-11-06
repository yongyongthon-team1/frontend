import type { KeyboardEvent } from 'react';

// 탭 · 라디오 줄의 방향키 이동. 이웃 항목을 고르고(onChange) 그 항목으로 초점을 옮긴다.
export function handleRovingKeyDown(
  e: KeyboardEvent<HTMLElement>,
  role: 'tab' | 'radio',
  values: string[],
  current: string,
  onChange: (value: string) => void,
) {
  const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const step = keys[e.key];
  if (step === undefined || values.length === 0) return;
  e.preventDefault();
  const at = Math.max(values.indexOf(current), 0);
  const next = (at + step + values.length) % values.length;
  onChange(values[next]);
  const items = e.currentTarget.querySelectorAll<HTMLElement>(`[role="${role}"]`);
  items[next]?.focus();
}
