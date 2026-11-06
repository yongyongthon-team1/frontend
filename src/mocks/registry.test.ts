import { describe, expect, it } from 'vitest';
import { handlersByDomain, selectHandlers } from './registry';

/** `docs/api/frontend-needs.md` 3절 표의 골든 패스 엔드포인트(쿼리 문자열은 뺀 경로). */
const CONTRACT = [
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'GET /api/me',
  'GET /api/universities',
  'GET /api/universities/:id/insight',
  'POST /api/recommendations',
  'GET /api/tours',
  'GET /api/tours/:id',
  'POST /api/tours/:id/applications',
  'GET /api/me/applications',
  'GET /api/me/applications/:id',
  'POST /api/me/applications/:id/cancel',
  'GET /api/guide/tours',
  'GET /api/guide/tours/:id/applicants',
  'POST /api/guide/applications/:id/approve',
  'POST /api/guide/applications/:id/reject',
  'GET /api/guide/tours/:id/course',
  'POST /api/guide/tours/:id/course/draft',
  'PUT /api/guide/tours/:id/course/order',
  'PATCH /api/guide/tours/:id/course/stops/:stopId',
  'DELETE /api/guide/tours/:id/course/stops/:stopId',
  'POST /api/guide/tours/:id/course/confirm',
  'GET /api/tours/:id/course',
  'GET /api/me/coupons',
  'GET /api/me/coupons/:id',
  'GET /api/owner/coupons/:code',
  'POST /api/owner/coupons/:code/redeem',
  'GET /api/health',
  'POST /api/demo/reset',
];

/** 계약 3-2절(P1 엔드포인트, 동결 대상 아님) 중 목업이 있는 것. 2B가 행을 더한다. */
const P1 = ['GET /api/owner/store'];

describe('registry', () => {
  it('도메인 일부만 고르면 그 핸들러만', () => {
    expect(selectHandlers(['auth']).length).toBe(handlersByDomain.auth.length);
    expect(selectHandlers('all').length).toBe(Object.values(handlersByDomain).flat().length);
  });

  it('고른 도메인의 핸들러를 그대로 돌려준다', () => {
    expect(selectHandlers(['tours', 'coupons'])).toEqual([
      ...handlersByDomain.tours,
      ...handlersByDomain.coupons,
    ]);
    expect(selectHandlers([])).toEqual([]);
  });

  it('계약 표의 29개 엔드포인트와 P1 엔드포인트 1개를 메서드 · 경로 그대로 모두 등록한다', () => {
    const registered = selectHandlers('all').map((h) => `${h.info.method} ${String(h.info.path)}`);
    expect(CONTRACT).toHaveLength(29);
    expect(P1).toHaveLength(1);
    expect([...registered].sort()).toEqual([...CONTRACT, ...P1].sort());
  });

  it('stores 도메인이 P1 엔드포인트를 가진다', () => {
    expect(
      selectHandlers(['stores']).map((h) => `${h.info.method} ${String(h.info.path)}`),
    ).toEqual(P1);
  });
});
