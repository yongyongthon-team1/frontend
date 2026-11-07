import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listCampuses } from '@/features/campuses/api';
import { resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import { CAMPUS_PLACES, CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import { COURSE_CONFIRM_OK, COURSE_NOT_READY } from '@/test/fixtures/backend/courses';
import { NEARBY_STORES } from '@/test/fixtures/backend/stores';
import { loginAs } from '@/test/loginAs';
import { wireFail, wireOk } from '@/test/wire';
import {
  getCourse,
  getGuideCourse,
  getCampusPlaces,
  getGuideCourseStatus,
  getNearbyStores,
  postConfirmCourse,
  postCourseDraft,
  putCourseSpots,
} from './api';
import { buildSpots } from './spots';

describe('코스 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date(), checkpoint: 'APPROVED' });
  });
  afterEach(() => configureHttp({ getToken: () => null }));

  it('가이드: 코스 없음(null) → 초안 → 스팟 PUT(순서 · 한줄평 · 빼기) → 확정, 학생: 확정 코스', async () => {
    const campuses = listCampuses(); // 약속째 넘겨도 된다(errata G13)
    loginAs(DEMO_EMAILS.guide);
    expect(await getGuideCourse(1, campuses)).toBeNull();
    expect(await getGuideCourseStatus(1)).toBeNull();

    const draft = await postCourseDraft(1, campuses);
    expect(draft.status).toBe('DRAFT');
    expect(await getGuideCourse(1, campuses)).toEqual(draft);
    expect(await getGuideCourseStatus(1)).toBe('DRAFT');

    const [campus, meal, cafe] = draft.stops;
    const reordered = await putCourseSpots(
      1,
      buildSpots(draft, { kind: 'reorder', stopIds: [campus.id, cafe.id, meal.id] }),
      campuses,
    );
    expect(reordered.stops.map((s) => s.id)).toEqual([campus.id, cafe.id, meal.id]);
    const described = await putCourseSpots(
      1,
      buildSpots(reordered, { kind: 'note', stopId: cafe.id, description: '과제하기 좋은 카페' }),
      campuses,
    );
    expect(described.stops.find((s) => s.id === cafe.id)?.description).toBe('과제하기 좋은 카페');
    const removed = await putCourseSpots(
      1,
      buildSpots(described, { kind: 'remove', stopId: campus.id }),
      campuses,
    );
    expect(removed.stops.map((s) => s.id)).toEqual([cafe.id, meal.id]);

    const confirmed = await postConfirmCourse(1, campuses);
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', issuedCouponCount: 6 }); // 승인 3 × 제휴 2
    expect(await getGuideCourseStatus(1)).toBe('CONFIRMED');

    loginAs(DEMO_EMAILS.student);
    expect(await getCourse(1, campuses)).toEqual(confirmed);
  });

  it('getGuideCourse: 404 · COURSE_NOT_READY만 null이고 다른 오류는 던진다 (2C-R14)', async () => {
    const campuses = await listCampuses();
    loginAs(DEMO_EMAILS.guide);
    await expect(getGuideCourse(2, campuses)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      backendCode: 'E403',
    });
    server.use(
      http.get('/api/tours/:tourId/course', () =>
        wireFail(COURSE_NOT_READY.code, { message: COURSE_NOT_READY.message }),
      ),
    );
    expect(await getGuideCourse(1, campuses)).toBeNull();
    expect(await getGuideCourseStatus(1)).toBeNull();
  });

  it('getGuideCourseStatus: 곁가지 호출이라 500 같은 어떤 오류도 null(코스 없음)이고, getGuideCourse는 그 오류를 그대로 낸다', async () => {
    const campuses = await listCampuses();
    loginAs(DEMO_EMAILS.guide);
    server.use(http.get('/api/tours/:tourId/course', () => wireFail('E500')));
    expect(await getGuideCourseStatus(1)).toBeNull();
    await expect(getGuideCourse(1, campuses)).rejects.toMatchObject({ status: 500 });
  });

  it('getCourse: 확정 전이면 COURSE_NOT_READY(409)', async () => {
    loginAs(DEMO_EMAILS.student);
    await expect(getCourse(1, await listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'COURSE_NOT_READY',
      backendCode: 'E409_COURSE_NOT_READY',
    });
  });

  it('postCourseDraft: AI 호출 실패(E502_AI_FAILED)는 AI_FAILED', async () => {
    loginAs(DEMO_EMAILS.guide);
    server.use(http.post('/api/tours/:tourId/course', () => wireFail('E502_AI_FAILED')));
    await expect(postCourseDraft(1, await listCampuses())).rejects.toMatchObject({
      status: 502,
      code: 'AI_FAILED',
      backendCode: 'E502_AI_FAILED',
      message: 'AI가 코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  });

  it('postConfirmCourse: 제휴 없음(E422_PARTNER_REQUIRED)은 COURSE_PARTNER_REQUIRED', async () => {
    loginAs(DEMO_EMAILS.guide);
    await postCourseDraft(1, await listCampuses());
    server.use(
      http.post('/api/tours/:tourId/course/confirm', () => wireFail('E422_PARTNER_REQUIRED')),
    );
    await expect(postConfirmCourse(1, await listCampuses())).rejects.toMatchObject({
      status: 422,
      code: 'COURSE_PARTNER_REQUIRED',
      backendCode: 'E422_PARTNER_REQUIRED',
      message: '제휴 상점을 1곳 이상 넣어 주세요.',
    });
  });

  it('postConfirmCourse: 발급 수는 확정 응답의 coupon_count', async () => {
    loginAs(DEMO_EMAILS.guide);
    await postCourseDraft(1, await listCampuses());
    server.use(
      http.post('/api/tours/:tourId/course/confirm', () =>
        wireOk({ ...COURSE_CONFIRM_OK.data, tour_id: 1 }),
      ),
    );
    const course = await postConfirmCourse(1, await listCampuses());
    expect(course.issuedCouponCount).toBe(COURSE_CONFIRM_OK.data.coupon_count);
  });

  describe('주변 상점 · 캠퍼스 장소', () => {
    const store = (storeId: number, name: string, lat: number) => ({
      ...NEARBY_STORES.data.items[0],
      store_id: storeId,
      name,
      lat,
    });

    it('getNearbyStores: 캠퍼스 중심에서 가까운 순, 거리가 같으면 이름 순(ko)', async () => {
      server.use(
        http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
        http.get('/api/stores/nearby', ({ request }) => {
          expect(new URL(request.url).searchParams.get('campus_id')).toBe('1');
          return wireOk({
            items: [
              store(1, '하나 식당', 37.3225),
              store(2, '가나 식당', 37.3225),
              store(3, '먼 곳', 37.3319),
              store(4, '가까운 곳', 37.3221),
            ],
          });
        }),
      );
      const list = await getNearbyStores(1, listCampuses());
      expect(list.map((s) => s.name)).toEqual(['가까운 곳', '가나 식당', '하나 식당', '먼 곳']);
    });

    it('getNearbyStores: 캠퍼스 목록에 없는 학교는 요청 없이 NOT_FOUND', async () => {
      let nearbyCalls = 0;
      server.use(
        http.get('/api/campuses', () => wireOk(CAMPUSES_LIST.data)),
        http.get('/api/stores/nearby', () => {
          nearbyCalls += 1;
          return wireOk({ items: [] });
        }),
      );
      await expect(getNearbyStores(0, listCampuses())).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
      expect(nearbyCalls).toBe(0);
      // 양성 대조: 있는 학교는 요청이 나간다.
      await getNearbyStores(1, listCampuses());
      expect(nearbyCalls).toBe(1);
    });

    it('getCampusPlaces: 서버 순서 그대로', async () => {
      server.use(
        http.get('/api/campuses/:campusId/places', () =>
          wireOk({
            items: [
              { ...CAMPUS_PLACES.data.items[0], campus_building_id: 9, name: '나' },
              CAMPUS_PLACES.data.items[0],
            ],
          }),
        ),
      );
      expect((await getCampusPlaces(1)).map((p) => p.campusBuildingId)).toEqual([9, 3]);
    });
  });
});
