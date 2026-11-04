import { createContext, useContext, type ReactNode } from 'react';

// 모바일 프레임(무대 위 폰 모양 컨테이너) DOM. 바텀시트 · 다이얼로그가 프레임 안에 그려지도록 포털 대상을 알려 준다.
const FrameContext = createContext<HTMLElement | null>(null);

export function FrameProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  return <FrameContext.Provider value={container}>{children}</FrameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFrameContainer(): HTMLElement | null {
  return useContext(FrameContext);
}
