import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { FrameProvider } from './FrameContext';

/**
 * 폰 프레임(설계 5.8). 폭 480px 미만은 전체 화면, 이상은 가운데 390px 프레임이다(CSS: globals.css `.mobile-*`).
 * 프레임은 `position: relative` · `overflow: hidden`이고 FrameProvider로 포털 대상이 된다(바텀시트 · 다이얼로그가
 * 프레임 안에 뜬다). 스크롤은 프레임이 아니라 안쪽 화면 영역이 한다. `transform: scale`은 쓰지 않는다(포털 · 지도 좌표가 어긋난다).
 * `aside`는 프레임 옆 슬롯(시연 패널 자리 — 폭 900px 미만이면 프레임 오른쪽 위에 뜬다)이고 비어 있으면 CSS가 숨긴다.
 * `overlay`는 화면 위에 겹쳐 그릴 것(발표 모드의 역할 배지)이며 스크롤하지 않는다.
 */
export function MobileFrame({
  children,
  aside,
  overlay,
}: {
  children: ReactNode;
  aside?: ReactNode;
  overlay?: ReactNode;
}) {
  // 콜백 ref + state: 마운트 뒤 프레임 DOM을 받아 포털 대상으로 넘긴다.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // 화면 영역이 직접 스크롤하므로 주소가 바뀌면 맨 위로 되돌린다(창 스크롤이 아니라 ScrollRestoration이 못 한다).
  useLayoutEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="mobile-stage">
      <div className="mobile-device">
        <div ref={setFrame} className="mobile-frame">
          <FrameProvider container={frame}>
            <div ref={screenRef} className="mobile-screen">
              {children}
            </div>
          </FrameProvider>
          {overlay}
        </div>
        <aside className="mobile-aside">{aside}</aside>
      </div>
    </div>
  );
}
