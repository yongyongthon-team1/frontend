import { CircleUser, ClipboardList, List, Search, Store } from 'lucide-react';
import type { Role } from '@/features/auth/model';
import type { TabItem } from '@/shared/ui/BottomTabBar';

// 역할별 하단 탭(설계 5.3). 가이드 · 사장님의 `탐색`은 같은 둘러보기 화면이다. 운영자는 탭 없이 상단에 로그아웃.
export const TABS: Record<Role, TabItem[]> = {
  HIGH_SCHOOL: [
    {
      to: '/',
      label: '탐색',
      icon: Search,
      end: true,
      match: ['/', '/recommendations', '/tours'],
    },
    { to: '/my-tours', label: '내 탐방', icon: List, match: ['/my-tours', '/coupons', '/reviews'] },
    { to: '/me', label: 'MY', icon: CircleUser },
  ],
  UNIVERSITY: [
    { to: '/explore', label: '탐색', icon: Search },
    { to: '/guide/tours', label: '운영', icon: ClipboardList, match: ['/guide/tours'] },
    { to: '/guide/me', label: 'MY', icon: CircleUser },
  ],
  OWNER: [
    { to: '/explore', label: '탐색', icon: Search },
    {
      to: '/owner/store',
      label: '운영',
      icon: Store,
      match: ['/owner/store', '/owner/coupons', '/owner/report'],
    },
    { to: '/owner/me', label: 'MY', icon: CircleUser },
  ],
  ADMIN: [],
};
