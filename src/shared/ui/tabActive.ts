import type { TabItem } from './BottomTabBar';

function underPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 탭이 활성인가: `exclude`에 맞으면 비활성. 아니면 `to`와 같거나(`end`가 아니면 그 아래 경로도),
 * `match`의 접두사(문자열) 아래이거나 정규식(RegExp)에 맞는 경로.
 */
export function isTabActive(pathname: string, tab: TabItem): boolean {
  if (tab.exclude?.some((re) => re.test(pathname))) return false;
  const own = tab.end ? pathname === tab.to : underPrefix(pathname, tab.to);
  return (
    own ||
    (tab.match?.some((m) =>
      typeof m === 'string' ? underPrefix(pathname, m) : m.test(pathname),
    ) ??
      false)
  );
}
