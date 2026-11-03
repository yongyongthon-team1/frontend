import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { isImeComposing, preventImeEnter } from './ime';

function keyEvent(key: string, nativeEvent: { isComposing?: boolean; keyCode?: number }) {
  return { key, nativeEvent, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

describe('isImeComposing', () => {
  it('isComposing이 true이면 조합 중이다', () => {
    expect(isImeComposing({ nativeEvent: { isComposing: true } })).toBe(true);
  });
  it('keyCode 229(일부 브라우저의 조합 확정 키)도 조합 중이다', () => {
    expect(isImeComposing({ nativeEvent: { keyCode: 229 } })).toBe(true);
  });
  it('둘 다 아니면 조합 중이 아니다', () => {
    expect(isImeComposing({ nativeEvent: { isComposing: false, keyCode: 13 } })).toBe(false);
  });
});

describe('preventImeEnter', () => {
  it('조합 중 Enter는 기본 동작을 막는다', () => {
    const e = keyEvent('Enter', { isComposing: true });
    preventImeEnter(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });
  it('조합 중이 아닌 Enter는 그대로 둔다', () => {
    const e = keyEvent('Enter', { isComposing: false, keyCode: 13 });
    preventImeEnter(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it('조합 중이어도 Enter가 아니면 그대로 둔다', () => {
    const e = keyEvent('a', { isComposing: true });
    preventImeEnter(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
