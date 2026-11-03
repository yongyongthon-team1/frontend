import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('뒤에 온 Tailwind 클래스가 이긴다', () => expect(cn('px-2', 'px-4')).toBe('px-4'));
  it('false 값은 버린다', () => {
    const active = false as boolean;
    expect(cn('a', active && 'b', 'c')).toBe('a c');
  });
});
