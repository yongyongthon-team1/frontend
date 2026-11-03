import type { HttpHandler } from 'msw';
import type { MockDomain } from '@/shared/config/env';
import { applicationHandlers } from './handlers/applications';
import { authHandlers } from './handlers/auth';
import { campusHandlers } from './handlers/campuses';
import { couponHandlers } from './handlers/coupons';
import { courseHandlers } from './handlers/courses';
import { demoHandlers } from './handlers/demo';
import { tourHandlers } from './handlers/tours';

// 도메인별 MSW 핸들러(`VITE_MOCK_DOMAINS`로 도메인 단위 목업을 켠다). 도메인 구분은 진척 대시보드의 API 연동표와 같다.
// stores · reviews · verification · admin은 P1 화면의 API라 MVP 2단계에서 채운다.

export const handlersByDomain: Record<MockDomain, HttpHandler[]> = {
  auth: authHandlers,
  campuses: campusHandlers,
  tours: tourHandlers,
  applications: applicationHandlers,
  courses: courseHandlers,
  coupons: couponHandlers,
  demo: demoHandlers,
  stores: [],
  reviews: [],
  verification: [],
  admin: [],
};

/** 고른 도메인의 핸들러. `'all'`이면 전부다. */
export function selectHandlers(domains: MockDomain[] | 'all'): HttpHandler[] {
  const picked =
    domains === 'all' ? (Object.keys(handlersByDomain) as MockDomain[]) : [...new Set(domains)];
  return picked.flatMap((domain) => handlersByDomain[domain]);
}
