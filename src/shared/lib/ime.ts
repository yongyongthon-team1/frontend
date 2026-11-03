import type { KeyboardEvent } from 'react';

// 한글 같은 IME 입력은 조합 중에 Enter(조합 확정)를 누르면 폼이 제출되는 문제가 있다.
// 일부 브라우저는 조합 확정 keydown의 isComposing이 false이고 keyCode가 229로 온다.
export function isImeComposing(e: {
  nativeEvent: { isComposing?: boolean; keyCode?: number };
}): boolean {
  return e.nativeEvent.isComposing === true || e.nativeEvent.keyCode === 229;
}

// Enter + 조합 중이면 기본 동작(폼 제출)을 막는다. 입력창의 onKeyDown에 건다.
export function preventImeEnter(e: KeyboardEvent): void {
  if (e.key === 'Enter' && isImeComposing(e)) e.preventDefault();
}
