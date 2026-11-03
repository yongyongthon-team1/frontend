import { Link, useRouteError } from 'react-router';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
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
