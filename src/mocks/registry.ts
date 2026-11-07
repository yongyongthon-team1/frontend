import type { HttpHandler } from 'msw';
import type { MockDomain } from '@/shared/config/env';
import { applicationHandlers } from './handlers/applications';
import { authHandlers } from './handlers/auth';
import { campusHandlers } from './handlers/campuses';
import { couponHandlers } from './handlers/coupons';
import { courseHandlers } from './handlers/courses';
import { demoHandlers } from './handlers/demo';
import { reviewHandlers } from './handlers/reviews';
import { storeHandlers } from './handlers/stores';
import { tourLifecycleHandlers } from './handlers/tourLifecycle';
import { tourHandlers } from './handlers/tours';
import { wishHandlers } from './handlers/wishes';

// 도메인별 MSW 핸들러(`VITE_MOCK_DOMAINS`로 도메인 단위 목업을 켠다). 도메인 구분은 진척 대시보드의 API 연동표와 같다.
// stores(내 가게 조회만) · verification · admin은 P1 화면의 API라 MVP 2B′에서 채운다.

export const handlersByDomain: Record<MockDomain, HttpHandler[]> = {
  auth: authHandlers,
  campuses: campusHandlers,
  tours: [...tourHandlers, ...wishHandlers],
  applications: [...applicationHandlers, ...tourLifecycleHandlers],
  courses: courseHandlers,
  coupons: couponHandlers,
  demo: demoHandlers,
  stores: storeHandlers,
  reviews: reviewHandlers,
  verification: [],
  admin: [],
};

/** 고른 도메인의 핸들러. `'all'`이면 전부다. */
export function selectHandlers(domains: MockDomain[] | 'all'): HttpHandler[] {
  const picked =
    domains === 'all' ? (Object.keys(handlersByDomain) as MockDomain[]) : [...new Set(domains)];
  return picked.flatMap((domain) => handlersByDomain[domain]);
}
