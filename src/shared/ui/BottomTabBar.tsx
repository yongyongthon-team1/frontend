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
  /**
   * 이 경로 아래 화면에서도 활성으로 친다. 문자열은 접두사(예: 탐색 탭 → `/recommendations`, `'/'`는 `/`만),
   * RegExp는 경로 전체에 `test`한다(예: 가이드 코스 화면 `/guide/tours/3/course/edit`).
   */
  match?: (string | RegExp)[];
  /** 이 정규식에 맞는 경로면 다른 규칙과 상관없이 비활성(예: `내 탐방` 탭 아래 코스 화면은 `코스 편집` 탭 몫). */
  exclude?: RegExp[];
}

export function BottomTabBar({ tabs }: { tabs: TabItem[] }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex h-[var(--tabbar-h)] shrink-0 items-stretch border-t border-border bg-surface"
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
              'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs',
              active ? 'font-bold text-brand' : 'font-medium text-muted',
            )}
          >
            <Icon aria-hidden className="size-[22px]" />
            <span className="max-w-full truncate px-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
