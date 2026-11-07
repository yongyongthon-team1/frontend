import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listCampuses } from '@/features/campuses/api';
import { resetDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import { COURSE_CONFIRM_OK, COURSE_NOT_READY } from '@/test/fixtures/backend/courses';
import { loginAs } from '@/test/loginAs';
import { wireFail, wireOk } from '@/test/wire';
import {
  getCourse,
  getGuideCourse,
  getGuideCourseStatus,
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
});
