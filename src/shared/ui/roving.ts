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

// 선택값이 어느 항목에도 없을 때도 그룹이 Tab으로 닿도록, 선택 항목(없으면 첫 항목)만 정지점(0)으로 둔다.
export function rovingTabIndex(values: string[], current: string, value: string): 0 | -1 {
  const stop = values.includes(current) ? current : values[0];
  return value === stop ? 0 : -1;
}
