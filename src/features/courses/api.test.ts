import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/mocks/db/store';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { loginAs } from '@/test/loginAs';
import {
  deleteCourseStop,
  getCourse,
  getGuideCourse,
  patchStop,
  postConfirmCourse,
  postCourseDraft,
  putStopOrder,
} from './api';

describe('코스 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date(), checkpoint: 'APPROVED' });
  });

  it('가이드: 코스 없음(null) → 초안 → 순서 · 한줄평 · 삭제 → 확정, 학생: 확정 코스', async () => {
    loginAs(DEMO_EMAILS.guide);
    expect(await getGuideCourse(1)).toBeNull();

    const draft = await postCourseDraft(1);
    expect(draft.status).toBe('DRAFT');
    expect(await getGuideCourse(1)).toEqual(draft);

    const [campus, meal, cafe] = draft.stops;
    const reordered = await putStopOrder(1, [campus.id, cafe.id, meal.id]);
    expect(reordered.stops.map((s) => s.id)).toEqual([campus.id, cafe.id, meal.id]);
    const described = await patchStop(1, cafe.id, '과제하기 좋은 카페');
    expect(described.stops.find((s) => s.id === cafe.id)?.description).toBe('과제하기 좋은 카페');
    const removed = await deleteCourseStop(1, campus.id);
    expect(removed.stops.map((s) => s.id)).toEqual([cafe.id, meal.id]);
    const confirmed = await postConfirmCourse(1);
    expect(confirmed.status).toBe('CONFIRMED');

    loginAs(DEMO_EMAILS.student);
    expect(await getCourse(1)).toEqual(confirmed);
  });

  it('getGuideCourse는 404만 null이고 다른 오류는 던진다', async () => {
    loginAs(DEMO_EMAILS.guide);
    await expect(getGuideCourse(2)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('getCourse: 확정 전이면 COURSE_NOT_READY', async () => {
    loginAs(DEMO_EMAILS.student);
    await expect(getCourse(1)).rejects.toMatchObject({ status: 404, code: 'COURSE_NOT_READY' });
  });
});
