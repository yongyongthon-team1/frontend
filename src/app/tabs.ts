import { CircleUser, List, Route, Search, Store, TicketCheck } from 'lucide-react';
import type { Role } from '@/features/auth/model';
import type { TabItem } from '@/shared/ui/BottomTabBar';

// 역할별 하단 탭(V2 GNB · 판정 2A-R8/R9). 운영자는 탭 없이 상단에 로그아웃.
// 가이드: `내 탐방`(G01 홈과 개설 탐방 · 신청자) · `코스 편집`(다가오는 탐방의 코스 화면 — 코스 URL 전부) · `MY`.
// 사장님: `내 가게` · `쿠폰`. MY 탭이 없으므로 로그아웃은 내 가게 화면 안에 둔다.
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
    {
      to: '/guide',
      label: '내 탐방',
      icon: List,
      end: true,
      match: ['/guide/tours'],
      exclude: [/^\/guide\/tours\/\d+\/course(\/|$)/],
    },
    {
      to: '/guide/course',
      label: '코스 편집',
      icon: Route,
      match: ['/guide/course', /^\/guide\/tours\/\d+\/course(\/|$)/],
    },
    { to: '/guide/me', label: 'MY', icon: CircleUser, match: ['/guide/me', '/guide/verify'] },
  ],
  OWNER: [
    { to: '/owner/store', label: '내 가게', icon: Store, match: ['/owner/store'] },
    {
      to: '/owner/coupons/redeem',
      label: '쿠폰',
      icon: TicketCheck,
      match: ['/owner/coupons'],
    },
  ],
  ADMIN: [],
};
