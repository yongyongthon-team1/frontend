import { COURSE_NOTE_MAX } from '@/features/courses/model';
import type { SpotInput } from '@/features/courses/wire';
import { generateCourseDraft } from '@/mocks/ai/course';
import { mockNow } from '@/mocks/clock';
import { nextId } from '@/mocks/db/ids';
import type { CourseRow, CourseStopRow, DB, TourRow } from '@/mocks/db/schema';
import { seoulDateKey, toSeoulIso } from '@/shared/lib/date';
import { issueCouponsForApplication } from './coupons';
import { fieldError, MockApiError } from './errors';

// 코스 규칙(C-01~04). 탐방마다 코스 행은 하나다(PK = tourId). 모두 `db`를 직접 고친다(저장은 핸들러의 `mutate`).
// 위에서부터 차례로 검사해 처음 걸린 오류를 던지고, 검사를 모두 마친 뒤에만 행을 바꾼다 — 규칙에 걸리면 DB는 그대로다.
// 코스 수정은 백엔드처럼 전체 스팟 교체(`replaceSpots`)뿐이다 — 순서 · 시각 · 한줄평은 보낸 배열 그대로다(2C-R13).

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

/** 이 탐방의 지점을 모두 `rows`로 갈아 끼운다(배열 참조는 그대로 둔다). */
function replaceStopRows(db: DB, tourId: number, rows: CourseStopRow[]): void {
  const others = db.courseStops.filter((s) => s.tourId !== tourId);
  db.courseStops.splice(0, db.courseStops.length, ...others, ...rows);
}

/** 탐방 날짜(서울 `yyyy-MM-dd`)에 유효한 상점 제휴(쿠폰 발급과 같은 기준). 지점 행의 `partnershipId`는 보지 않는다. */
export function partnershipOn(db: DB, storeId: number, tourDay: string) {
  return db.partnerships.find(
    (p) => p.storeId === storeId && p.startDate <= tourDay && tourDay <= p.endDate,
  );
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
  replaceStopRows(
    db,
    tourId,
    draft.stops.map((stop) => ({ ...stop, id: nextId(db), tourId })),
  );

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const HHMM = /^\d{2}:\d{2}$/;

/** 검사를 마친 스팟 하나. */
interface CheckedSpot {
  stopType: CourseStopRow['stopType'];
  storeId: number | null;
  campusBuildingId: number | null;
  startTime: string;
  description: string | null;
}

/** 스팟 하나를 검사한다(HTTP 본문에서 바로 오므로 모양부터 본다). */
function checkSpot(db: DB, tour: TourRow, spot: unknown): CheckedSpot {
  if (!isRecord(spot)) throw fieldError('spots');
  const { stopType, storeId, campusBuildingId, startTime, comment } = spot;
  let place: Pick<CheckedSpot, 'stopType' | 'storeId' | 'campusBuildingId'>;
  if (stopType === 'STORE' && db.stores.some((s) => s.id === storeId)) {
    place = { stopType, storeId: storeId as number, campusBuildingId: null };
  } else if (
    stopType === 'CAMPUS' &&
    db.campusPlaces.some(
      (p) => p.campusBuildingId === campusBuildingId && p.universityId === tour.universityId,
    )
  ) {
    place = { stopType, storeId: null, campusBuildingId: campusBuildingId as number };
  } else {
    throw fieldError('spots', '고를 수 없는 장소예요.');
  }
  if (typeof startTime !== 'string' || !HHMM.test(startTime)) throw fieldError('spots');
  let description: string | null = null;
  if (comment !== undefined && comment !== null) {
    const text = typeof comment === 'string' ? comment.trim() : null;
    if (text === null || text.length > COURSE_NOTE_MAX) {
      throw fieldError('spots', '한줄평은 100자 이내로 적어 주세요.');
    }
    description = text === '' ? null : text;
  }
  return { ...place, startTime, description };
}

/**
 * 코스 수정(C-02): 보낸 `spots` 배열 전체가 새 코스가 된다(배열 순서가 곧 순서, 시각 · 한줄평도 보낸 그대로). 같은 상점
 * (캠퍼스면 같은 건물)을 유지한 지점은 기존 행의 id · 추천 이유를 지키고(같은 장소가 둘이면 앞에서부터 하나씩), 새로 넣은
 * 지점의 추천 이유는 null이다. 확정된 코스는 고칠 수 없다.
 */
export function replaceSpots(
  db: DB,
  guideId: number,
  tourId: number,
  spots: SpotInput[],
  now: Date,
): void {
  const { tour, course } = draftCourse(db, guideId, tourId);
  if (!Array.isArray(spots) || spots.length === 0) {
    throw fieldError('spots', '지점을 1곳 이상 넣어 주세요.');
  }
  const checked = spots.map((spot: unknown) => checkSpot(db, tour, spot));

  const tourDay = seoulDateKey(tour.startsAt);
  const unused = stopsOf(db, tourId);
  const rows = checked.map((spot, i): CourseStopRow => {
    const at = unused.findIndex(
      (row) =>
        row.stopType === spot.stopType &&
        row.storeId === spot.storeId &&
        row.campusBuildingId === spot.campusBuildingId,
    );
    const [kept] = at < 0 ? [] : unused.splice(at, 1);
    return {
      id: kept?.id ?? nextId(db),
      tourId,
      stopType: spot.stopType,
      campusBuildingId: spot.campusBuildingId,
      storeId: spot.storeId,
      partnershipId:
        kept?.partnershipId ??
        (spot.storeId === null ? null : (partnershipOn(db, spot.storeId, tourDay)?.id ?? null)),
      stopOrder: i + 1,
      visitTime: spot.startTime,
      description: spot.description,
      recommendationReason: kept?.recommendationReason ?? null,
    };
  });
  replaceStopRows(db, tourId, rows);
  course.updatedAt = toSeoulIso(now);
}

/**
 * 코스를 확정하고 승인자(신청 id 순서)마다 쿠폰을 발급해 그 합계를 돌려준다. 쿠폰 발급 규칙은 확정 코스만 보므로
 * 먼저 CONFIRMED로 바꾼 뒤 발급한다(승인자 × 탐방 날짜에 유효한 제휴 지점). 탐방 날짜에 유효한 제휴 지점이 하나도
 * 없으면 확정할 수 없다(백엔드 C-03, 2C-R11).
 */
export function confirmCourse(
  db: DB,
  guideId: number,
  tourId: number,
  now: Date,
): { issuedCouponCount: number } {
  const { tour, course } = draftCourse(db, guideId, tourId);
  const stops = stopsOf(db, tourId);
  if (stops.length === 0) throw new MockApiError(409, 'COURSE_EMPTY');
  const tourDay = seoulDateKey(tour.startsAt);
  if (!stops.some((s) => s.storeId !== null && partnershipOn(db, s.storeId, tourDay))) {
    throw new MockApiError(422, 'COURSE_PARTNER_REQUIRED');
  }

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
