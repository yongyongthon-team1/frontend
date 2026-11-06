import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

export interface TopBarProps {
  title: string;
  // true면 이전 화면(navigate(-1)), 문자열이면 그 경로로 이동한다.
  back?: boolean | string;
  right?: ReactNode;
}

export function TopBar({ title, back, right }: TopBarProps) {
  const navigate = useNavigate();
  const showBack = back !== undefined && back !== false;

  return (
    <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-1 bg-bg px-[var(--gutter)]">
      {showBack ? (
        <button
          type="button"
          aria-label="뒤로 가기"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-neutral-100"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </button>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-ink">{title}</h1>
      {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
    </header>
  );
}
