import { describe, expect, it } from 'vitest';
import { handlersByDomain, selectHandlers } from './registry';

// 등록 핸들러 = (BACKEND_CONTRACT − NOT_MOCKED) ∪ EXTENSIONS ∪ LEGACY (2C-R24).
// 도메인 태스크가 자기 줄을 LEGACY · NOT_MOCKED에서 지운다. 끝나면 LEGACY는 없어지고 NOT_MOCKED는 2B가 채울 20개다.
// 경로는 `/api`를 뗀 꼴이다(비교할 때 `label(h).replace(' /api/', ' /')`).

/** `docs/api/backend-spec.md`의 `### METHOD /path` 46개(명세 순서). */
const BACKEND_CONTRACT: string[] = [
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/logout',
  'GET /users/me',
  'PATCH /users/me',
  'PUT /users/me/guide-profile',
  'POST /verifications/enrollment',
  'POST /guardian-consents',
  'GET /guardian-consents/:consentToken',
  'PATCH /guardian-consents/:consentToken',
  'POST /verifications/business',
  'GET /admin/verifications',
  'GET /admin/verifications/:verificationId',
  'PATCH /admin/verifications/:verificationId',
  'GET /tours',
  'POST /tour-wishes',
  'GET /users/me/tour-wishes',
  'PATCH /users/me/tour-wishes/:wishId',
  'GET /tour-wishes',
  'GET /tours/:tourId',
  'POST /tours',
  'GET /users/me/tours',
  'POST /tours/:tourId/cancel',
  'POST /tours/:tourId/complete',
  'POST /tours/:tourId/applications',
  'PATCH /applications/:applicationId/decision',
  'POST /applications/:applicationId/cancel',
  'GET /tours/:tourId/applications',
  'POST /tours/:tourId/course',
  'PUT /tours/:tourId/course/spots',
  'POST /tours/:tourId/course/confirm',
  'GET /tours/:tourId/course',
  'GET /stores/search',
  'POST /users/me/store',
  'GET /users/me/store',
  'PATCH /users/me/store',
  'GET /stores/nearby',
  'PUT /users/me/store/partnership',
  'GET /users/me/coupons',
  'GET /coupons/:couponCode',
  'POST /coupons/:couponCode/redeem',
  'GET /users/me/store/report',
  'POST /stores/:storeId/reviews',
  'GET /stores/:storeId/reviews',
  'GET /campuses',
  'GET /campuses/:campusId/places',
];

/** 목업 전용 확장 엔드포인트(2C-R8). Task 4가 `GET /campuses/:campusId/insight`를 더한다. */
const EXTENSIONS: string[] = ['GET /health', 'POST /demo/reset'];

/** 아직 목업이 없는 백엔드 경로. 도메인 태스크가 자기 줄을 지운다. 끝에 남는 20개는 2B 몫이다. */
const NOT_MOCKED: string[] = [
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/logout',
  'GET /users/me',
  'PATCH /users/me',
  'PUT /users/me/guide-profile',
  'POST /verifications/enrollment',
  'POST /guardian-consents',
  'GET /guardian-consents/:consentToken',
  'PATCH /guardian-consents/:consentToken',
  'POST /verifications/business',
  'GET /admin/verifications',
  'GET /admin/verifications/:verificationId',
  'PATCH /admin/verifications/:verificationId',
  'GET /tours',
  'POST /tour-wishes',
  'GET /users/me/tour-wishes',
  'PATCH /users/me/tour-wishes/:wishId',
  'GET /tour-wishes',
  'GET /tours/:tourId',
  'POST /tours',
  'GET /users/me/tours',
  'POST /tours/:tourId/cancel',
  'POST /tours/:tourId/complete',
  'POST /tours/:tourId/applications',
  'PATCH /applications/:applicationId/decision',
  'POST /applications/:applicationId/cancel',
  'GET /tours/:tourId/applications',
  'POST /tours/:tourId/course',
  'PUT /tours/:tourId/course/spots',
  'POST /tours/:tourId/course/confirm',
  'GET /tours/:tourId/course',
  'GET /stores/search',
  'POST /users/me/store',
  'GET /users/me/store',
  'PATCH /users/me/store',
  'GET /stores/nearby',
  'PUT /users/me/store/partnership',
  'GET /users/me/coupons',
  'GET /coupons/:couponCode',
  'POST /coupons/:couponCode/redeem',
  'GET /users/me/store/report',
  'POST /stores/:storeId/reviews',
  'GET /stores/:storeId/reviews',
  'GET /campuses',
  'GET /campuses/:campusId/places',
];

/** 아직 바꾸지 않은 옛 경로(전환 기간). 도메인 태스크가 자기 줄을 지운다. */
const LEGACY: string[] = [
  'POST /auth/login',
  'POST /auth/logout',
  'GET /me',
  'GET /universities',
  'GET /universities/:id/insight',
  'POST /recommendations',
  'GET /tours',
  'GET /tours/:id',
  'POST /tours/:id/applications',
  'GET /me/applications',
  'GET /me/applications/:id',
  'POST /me/applications/:id/cancel',
  'GET /guide/tours',
  'GET /guide/tours/:id/applicants',
  'POST /guide/applications/:id/approve',
  'POST /guide/applications/:id/reject',
  'GET /guide/tours/:id/course',
  'POST /guide/tours/:id/course/draft',
  'PUT /guide/tours/:id/course/order',
  'PATCH /guide/tours/:id/course/stops/:stopId',
  'DELETE /guide/tours/:id/course/stops/:stopId',
  'POST /guide/tours/:id/course/confirm',
  'GET /tours/:id/course',
  'GET /me/coupons',
  'GET /me/coupons/:id',
  'GET /owner/coupons/:code',
  'POST /owner/coupons/:code/redeem',
  'GET /owner/store',
  'POST /auth/signup',
  'PUT /me/student-profile',
  'PUT /me/guide-profile',
];

const label = (h: { info: { method: unknown; path: unknown } }) =>
  `${String(h.info.method)} ${String(h.info.path)}`.replace(' /api/', ' /');

const sorted = (xs: Iterable<string>) => [...xs].sort();

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

  it('BACKEND_CONTRACT는 46개이고 겹치지 않는다', () => {
    expect(BACKEND_CONTRACT).toHaveLength(46);
    expect(new Set(BACKEND_CONTRACT).size).toBe(46);
  });

  it('NOT_MOCKED ⊆ BACKEND_CONTRACT 이고 EXTENSIONS ∩ BACKEND_CONTRACT = ∅', () => {
    expect(NOT_MOCKED.filter((e) => !BACKEND_CONTRACT.includes(e))).toEqual([]);
    expect(EXTENSIONS.filter((e) => BACKEND_CONTRACT.includes(e))).toEqual([]);
  });

  it('LEGACY ∩ (BACKEND_CONTRACT − NOT_MOCKED) = ∅ (옛 줄을 지우지 않은 채 새 줄을 더하는 실수를 잡는다)', () => {
    const mocked = BACKEND_CONTRACT.filter((e) => !NOT_MOCKED.includes(e));
    expect(LEGACY.filter((e) => mocked.includes(e))).toEqual([]);
  });

  it('등록 핸들러 = (BACKEND_CONTRACT − NOT_MOCKED) ∪ EXTENSIONS ∪ LEGACY', () => {
    const expected = new Set([
      ...BACKEND_CONTRACT.filter((e) => !NOT_MOCKED.includes(e)),
      ...EXTENSIONS,
      ...LEGACY,
    ]);
    const registered = selectHandlers('all').map(label);
    expect(new Set(registered).size).toBe(registered.length);
    expect(sorted(registered)).toEqual(sorted(expected));
  });
});
