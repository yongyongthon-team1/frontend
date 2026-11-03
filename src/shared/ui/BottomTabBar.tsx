import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { isTabActive } from './tabActive';

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** true면 `to`와 정확히 같은 경로에서만 활성(하위 경로 제외). */
  end?: boolean;
  /** 이 경로 접두사 아래 화면에서도 활성으로 친다(예: 탐색 탭 → `/recommendations`). `'/'`는 `/`만 맞는다. */
  match?: string[];
}

export function BottomTabBar({ tabs }: { tabs: TabItem[] }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex h-[var(--tabbar-h)] shrink-0 items-start border-t border-border bg-bg pt-1"
    >
      {tabs.map((tab) => {
        const { to, label, icon: Icon } = tab;
        const active = isTabActive(pathname, tab);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-1.5 text-base',
              active ? 'font-bold text-ink' : 'font-medium text-muted',
            )}
          >
            <Icon aria-hidden className="size-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
