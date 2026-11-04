import { Link, useRouteError } from 'react-router';
import { getLandingPath } from '@/features/auth/landing';
import { useMe } from '@/features/auth/queries';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { TopBar } from '@/shared/ui/TopBar';
import { MobileFrame } from './layouts/MobileFrame';

/** 루트 라우트의 오류 화면(렌더 중 오류). 앱 셸 대신 그려지므로 프레임을 직접 둔다. */
export function ErrorPage() {
  const error = useRouteError();
  return (
    <MobileFrame>
      <main className="flex flex-1 flex-col justify-center px-[var(--gutter)]">
        <ErrorState error={error} onRetry={() => window.location.reload()} />
        <Link to="/" className={buttonClass('ghost', 'sm')}>
          처음으로
        </Link>
      </main>
    </MobileFrame>
  );
}

/**
 * 로그인한 화면의 오류(화면 단위 에러 경계, 설계 5.10). 하단 탭 레이아웃 안에 그려져 폰 프레임 · 하단 탭 · 시연 패널이
 * 남는다 — 무대에서 화면 하나가 렌더 중에 깨져도 탭이나 역할 버튼으로 이어 간다. 다른 주소로 가면 오류에서 벗어난다.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const { data: me } = useMe();
  return (
    <>
      <TopBar title="화면을 열지 못했어요" />
      <Page>
        <ErrorState error={error} onRetry={() => window.location.reload()} />
        <Link to={me ? getLandingPath(me) : '/'} className={buttonClass('secondary')}>
          처음 화면으로
        </Link>
      </Page>
    </>
  );
}
