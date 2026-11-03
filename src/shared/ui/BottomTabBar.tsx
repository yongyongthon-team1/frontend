import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/cn';

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// 현재 경로의 탭은 NavLink가 aria-current="page"를 붙인다.
export function BottomTabBar({ tabs }: { tabs: TabItem[] }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex h-[var(--tabbar-h)] shrink-0 items-start border-t border-border bg-bg pt-1"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 flex-1 items-center justify-center gap-1.5 text-base',
              isActive ? 'font-bold text-ink' : 'font-medium text-muted',
            )
          }
        >
          <Icon aria-hidden className="size-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
