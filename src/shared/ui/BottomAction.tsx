import type { ReactNode } from 'react';

// 화면 아래에 붙는 기본 버튼 자리(V2 H03 · H07 · H08). 내용이 짧으면 `Page`를 `flex min-h-[…] flex-col`로 두어 맨 아래로
// 밀리고, 길면 스크롤 영역 아래에 붙어 따라온다. 바탕색이 있어 아래로 지나가는 내용이 비치지 않는다.
export function BottomAction({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto -mx-[var(--gutter)] bg-bg px-[var(--gutter)] pt-3 pb-6">
      {children}
    </div>
  );
}

/** `BottomAction`을 쓰는 `Page`의 클래스: 상단 바를 뺀 높이를 채우고 아래 여백은 BottomAction이 가진다. */
export const BOTTOM_ACTION_PAGE = 'flex min-h-[calc(100%-var(--topbar-h))] flex-col pb-0';
