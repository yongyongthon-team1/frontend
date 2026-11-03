import { slotTimes } from '@/features/courses/model';
import { generateCourseDraft } from '@/mocks/ai/course';
import { mockNow } from '@/mocks/clock';
import { nextId } from '@/mocks/db/ids';
import type { CourseRow, CourseStopRow, DB, TourRow } from '@/mocks/db/schema';
import { toSeoulIso } from '@/shared/lib/date';
import { issueCouponsForApplication } from './coupons';
import { MockApiError } from './errors';

// 코스 규칙(C-01~04). 탐방마다 코스 행은 하나다(PK = tourId). 모두 `db`를 직접 고친다(저장은 핸들러의 `mutate`).
// 위에서부터 차례로 검사해 처음 걸린 오류를 던지고, 검사를 모두 마친 뒤에만 행을 바꾼다 — 규칙에 걸리면 DB는 그대로다.
// 방문 시간은 위치 슬롯에 고정이라 순서를 바꾸거나 지점을 빼면 `stopOrder`(1..n)와 `visitTime`을 다시 매긴다.

/** 가이드 본인의 탐방(없으면 404, 남의 탐방이면 403). */
function guideTour(db: DB, guideId: number, tourId: number): TourRow {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  if (tour.guideId !== guideId) throw new MockApiError(403, 'FORBIDDEN');
  return tour;
}

/** 고칠 수 있는 초안 코스(코스가 없으면 404, 확정됐으면 409). */
function draftCourse(
  db: DB,
  guideId: number,
  tourId: number,
): { tour: TourRow; course: CourseRow } {
  const tour = guideTour(db, guideId, tourId);
  const course = db.courses.find((c) => c.tourId === tourId);
  if (!course) throw new MockApiError(404, 'NOT_FOUND');
  if (course.status !== 'DRAFT') throw new MockApiError(409, 'COURSE_NOT_DRAFT');
  return { tour, course };
}

function stopsOf(db: DB, tourId: number): CourseStopRow[] {
  return db.courseStops
    .filter((s) => s.tourId === tourId)
    .sort((a, b) => a.stopOrder - b.stopOrder);
}

/** 주어진 순서대로 `stopOrder` 1..n과 위치 슬롯 시간을 다시 매긴다. */
function renumber(tour: TourRow, ordered: CourseStopRow[]): void {
  const times = slotTimes(tour.startsAt, ordered.length);
  ordered.forEach((stop, i) => {
    stop.stopOrder = i + 1;
    stop.visitTime = times[i];
  });
}

const approvedOf = (db: DB, tourId: number) =>
  db.applications
    .filter((a) => a.tourId === tourId && a.status === 'APPROVED')
    .sort((a, b) => a.id - b.id);

/**
 * AI 코스 초안을 만든다. 이미 초안이 있으면 그 지점을 모두 지우고 새로 만든다(코스 행은 그대로 하나, 관심사 ·
 * 수정 시각만 바뀐다). 확정된 코스는 다시 만들 수 없고(승인자가 없어졌어도 이 오류가 먼저), 승인자가 있어야 한다.
 * `now`는 시드가 체크포인트를 결정적으로 만들 때만 넘긴다(핸들러는 목업 시계).
 */
export function createDraft(
  db: DB,
  guideId: number,
  tourId: number,
  now: Date = mockNow(),
): CourseRow {
  guideTour(db, guideId, tourId);
  const existing = db.courses.find((c) => c.tourId === tourId);
  if (existing?.status === 'CONFIRMED') throw new MockApiError(409, 'COURSE_NOT_DRAFT');
  if (approvedOf(db, tourId).length === 0) throw new MockApiError(409, 'NO_APPROVED_APPLICANTS');

  const draft = generateCourseDraft(db, tourId);
  const at = toSeoulIso(now);
  // 배열 참조는 그대로 두고 이 탐방의 지점만 갈아 끼운다.
  const others = db.courseStops.filter((s) => s.tourId !== tourId);
  db.courseStops.splice(0, db.courseStops.length, ...others);
  for (const stop of draft.stops) db.courseStops.push({ ...stop, id: nextId(db), tourId });

  if (existing) {
    existing.interests = draft.interests;
    existing.updatedAt = at;
    return existing;
  }
  const course: CourseRow = {
    tourId,
    status: 'DRAFT',
    createdAt: at,
    updatedAt: at,
    confirmedAt: null,
    interests: draft.interests,
  };
  db.courses.push(course);
  return course;
}

/** 지점 순서를 바꾼다. `stopIds`는 지금 지점 id들을 빠짐없이 한 번씩 담아야 한다(아니면 400). 시간은 칸에 고정. */
export function reorderStops(db: DB, guideId: number, tourId: number, stopIds: number[]): void {
  const { tour, course } = draftCourse(db, guideId, tourId);
  const stops = stopsOf(db, tourId);
  // HTTP 본문에서 바로 넘어오면 배열이 아니거나 숫자가 아닐 수도 있다.
  const ordered = Array.isArray(stopIds) ? stopIds.map((id) => stops.find((s) => s.id === id)) : [];
  if (
    !Array.isArray(stopIds) ||
    stopIds.length !== stops.length ||
    new Set(stopIds).size !== stopIds.length ||
    ordered.some((s) => s === undefined)
  ) {
    throw new MockApiError(400, 'VALIDATION');
  }
  renumber(tour, ordered as CourseStopRow[]);
  course.updatedAt = toSeoulIso(mockNow());
}

/** 지점 한줄평(`description`)을 고친다. 앞뒤 공백을 지우고, 비우면 null(화면은 추천 이유를 대신 보여준다). */
export function updateStopDescription(
  db: DB,
  guideId: number,
  tourId: number,
  stopId: number,
  description: string,
): void {
  const { course } = draftCourse(db, guideId, tourId);
  const stop = db.courseStops.find((s) => s.id === stopId && s.tourId === tourId);
  if (!stop) throw new MockApiError(404, 'NOT_FOUND');
  if (typeof description !== 'string') throw new MockApiError(400, 'VALIDATION');

  const text = description.trim();
  stop.description = text === '' ? null : text;
  course.updatedAt = toSeoulIso(mockNow());
}

/** 지점을 뺀다. 남은 지점의 순서 · 시간을 다시 매긴다(마지막 지점도 뺄 수 있고, 그러면 확정이 막힌다). */
export function deleteStop(db: DB, guideId: number, tourId: number, stopId: number): void {
  const { tour, course } = draftCourse(db, guideId, tourId);
  const index = db.courseStops.findIndex((s) => s.id === stopId && s.tourId === tourId);
  if (index < 0) throw new MockApiError(404, 'NOT_FOUND');

  db.courseStops.splice(index, 1);
  renumber(tour, stopsOf(db, tourId));
  course.updatedAt = toSeoulIso(mockNow());
}

/**
 * 코스를 확정하고 승인자(신청 id 순서)마다 쿠폰을 발급해 그 합계를 돌려준다. 쿠폰 발급 규칙은 확정 코스만 보므로
 * 먼저 CONFIRMED로 바꾼 뒤 발급한다(승인자 × 탐방 날짜에 유효한 제휴 지점, 제휴 지점이 없으면 0장).
 */
export function confirmCourse(
  db: DB,
  guideId: number,
  tourId: number,
  now: Date,
): { issuedCouponCount: number } {
  const { course } = draftCourse(db, guideId, tourId);
  if (stopsOf(db, tourId).length === 0) throw new MockApiError(409, 'COURSE_EMPTY');

  const at = toSeoulIso(now);
  course.status = 'CONFIRMED';
  course.confirmedAt = at;
  course.updatedAt = at;
  const issuedCouponCount = approvedOf(db, tourId).reduce(
    (sum, app) => sum + issueCouponsForApplication(db, app.id, now).length,
    0,
  );
  return { issuedCouponCount };
}

/** 코스를 볼 수 있는 사람: 그 탐방의 승인(APPROVED) 신청자이거나 그 탐방의 가이드. 코스 상태는 보지 않는다. */
export function isCourseAudience(db: DB, userId: number, tourId: number): boolean {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) return false;
  return (
    tour.guideId === userId ||
    db.applications.some(
      (a) => a.tourId === tourId && a.userId === userId && a.status === 'APPROVED',
    )
  );
}

/** 확정 코스 조회(C-04): 코스가 CONFIRMED이고 요청자가 audience일 때만. */
export function canViewCourse(db: DB, userId: number, tourId: number): boolean {
  return (
    isCourseAudience(db, userId, tourId) &&
    db.courses.some((c) => c.tourId === tourId && c.status === 'CONFIRMED')
  );
}
