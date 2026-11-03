import type { TabItem } from './BottomTabBar';

function underPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 탭이 활성인가: `to`와 같거나(`end`가 아니면 그 아래 경로도), `match` 접두사 아래의 경로. */
export function isTabActive(pathname: string, tab: TabItem): boolean {
  const own = tab.end ? pathname === tab.to : underPrefix(pathname, tab.to);
  return own || (tab.match?.some((prefix) => underPrefix(pathname, prefix)) ?? false);
}
