import { getTour, type CampusesInput } from '@/features/tours/api';
import { errorMessage } from '@/shared/lib/errors';
import { AI_TIMEOUT_MS, ApiError, request } from '@/shared/lib/http';
import type { Course, CourseStatus } from './model';
import { fromWireCourse, type SpotInput, type WireConfirm, type WireCourse } from './wire';

// 백엔드 C. 코스(C-01~04). 학생 · 가이드 모두 `GET /tours/{tourId}/course`로 읽고(2C-R14), 탐방 정보는
// `GET /tours/{tourId}`를 같은 때 불러 합성한다(2C-R7). `campuses`는 그 상세의 캠퍼스 조인(2C-R9)용이고 배열이나
// 아직 받는 중인 약속(`loadCampuses`)을 받는다 — 코스 요청과 동시에 나간다(errata G13).
// 목업 규칙 함수와 이름이 겹치지 않게 HTTP 동사를 앞에 붙인다.

const coursePath = (tourId: number) => `/tours/${tourId}/course`;

/** 코스 와이어와 탐방 상세를 함께 받아 `Course`로 읽는다. */
async function withTour(
  tourId: number,
  wire: Promise<WireCourse>,
  campuses: CampusesInput,
): Promise<Course> {
  const [course, tour] = await Promise.all([wire, getTour(tourId, campuses)]);
  return fromWireCourse(course, tour);
}

/** 확정 코스(C-04). 승인된 신청자 · 그 가이드가 아니면 403 FORBIDDEN, 확정 전이면 409 COURSE_NOT_READY. */
export function getCourse(tourId: number, campuses: CampusesInput): Promise<Course> {
  return withTour(tourId, request<WireCourse>(coursePath(tourId)), campuses);
}

/** 가이드가 부른 코스 와이어. 코스가 없으면(404 · COURSE_NOT_READY) null이다(2C-R14). */
async function guideCourseWire(tourId: number): Promise<WireCourse | null> {
  try {
    return await request<WireCourse>(coursePath(tourId));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.code === 'COURSE_NOT_READY')) {
      return null;
    }
    throw error;
  }
}

/** 가이드 본인 탐방의 코스(초안 · 확정). 아직 코스가 없으면 null이다. */
export async function getGuideCourse(
  tourId: number,
  campuses: CampusesInput,
): Promise<Course | null> {
  const [wire, tour] = await Promise.all([guideCourseWire(tourId), getTour(tourId, campuses)]);
  return wire === null ? null : fromWireCourse(wire, tour);
}

/** 가이드 탐방의 코스 상태만(초안 여부, 2C-R27). 코스가 없으면 null — `getGuideCourse`와 같은 규칙이다. */
export async function getGuideCourseStatus(tourId: number): Promise<CourseStatus | null> {
  return (await guideCourseWire(tourId))?.status ?? null;
}

/** AI 코스 초안(C-01, AI라 시간 제한이 길다). 이미 초안이 있으면 새 초안으로 바뀐다. AI 실패는 502 AI_FAILED. */
export function postCourseDraft(tourId: number, campuses: CampusesInput): Promise<Course> {
  return withTour(
    tourId,
    request<WireCourse>(coursePath(tourId), { method: 'POST', timeoutMs: AI_TIMEOUT_MS }),
    campuses,
  );
}

/** 코스 수정(C-02): 보낸 `spots`가 통째로 새 코스가 된다(순서 · 한줄평 · 빼기는 `buildSpots`가 만든다, 2C-R13). */
export function putCourseSpots(
  tourId: number,
  spots: SpotInput[],
  campuses: CampusesInput,
): Promise<Course> {
  return withTour(
    tourId,
    request<WireCourse>(`${coursePath(tourId)}/spots`, { method: 'PUT', body: { spots } }),
    campuses,
  );
}

/**
 * 코스 확정(C-03 · S-04). 응답은 상태와 발급 쿠폰 수뿐이라 확정된 코스를 다시 읽고 발급 수를 그 응답 값으로 둔다.
 * 제휴 지점이 0이면 422 COURSE_PARTNER_REQUIRED.
 */
export async function postConfirmCourse(tourId: number, campuses: CampusesInput): Promise<Course> {
  const res = await request<WireConfirm>(`${coursePath(tourId)}/confirm`, { method: 'POST' });
  const course = await getGuideCourse(tourId, campuses);
  if (course === null) throw new ApiError(404, 'NOT_FOUND', errorMessage('NOT_FOUND'));
  return { ...course, issuedCouponCount: res.couponCount };
}
