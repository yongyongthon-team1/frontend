import { getTour, type CampusesInput } from '@/features/tours/api';
import { errorMessage } from '@/shared/lib/errors';
import { AI_TIMEOUT_MS, ApiError, listAll, request, withQuery } from '@/shared/lib/http';
import type { CampusPlace, Course, CourseStatus, NearbyStore } from './model';
import {
  fromWireCampusPlace,
  fromWireCourse,
  fromWireNearbyStore,
  type SpotInput,
  type WireCampusPlace,
  type WireConfirm,
  type WireCourse,
  type WireNearbyStore,
} from './wire';

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

/**
 * 가이드 탐방의 코스 지점 수(`spots.length`). 코스가 없으면(2C-R14) 0이다. 남의 탐방이면 403 FORBIDDEN을 그대로 낸다.
 * 탐방 상세 합성(`getGuideTour`)용이라 탐방 정보는 부르지 않는다.
 */
export async function getGuideCourseStopCount(tourId: number): Promise<number> {
  return (await guideCourseWire(tourId))?.spots.length ?? 0;
}

/** 가이드 본인 탐방의 코스(초안 · 확정). 아직 코스가 없으면 null이다. */
export async function getGuideCourse(
  tourId: number,
  campuses: CampusesInput,
): Promise<Course | null> {
  const [wire, tour] = await Promise.all([guideCourseWire(tourId), getTour(tourId, campuses)]);
  return wire === null ? null : fromWireCourse(wire, tour);
}

/**
 * 가이드 탐방의 코스 상태만(초안 여부, 2C-R27). 코스가 없으면 null — `getGuideCourse`와 같은 규칙이다.
 * 이 호출은 탐방 목록 · 신청자 보드에 곁들이는 장식이라, 어떤 오류든 null(코스 없음)로 접어 첫 화면을 살린다.
 * 코스가 꼭 필요한 화면은 `getGuideCourse`를 써서 진짜 오류를 낸다.
 */
export async function getGuideCourseStatus(tourId: number): Promise<CourseStatus | null> {
  try {
    return (await guideCourseWire(tourId))?.status ?? null;
  } catch {
    return null;
  }
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

/**
 * 주변 상점(S-02). 거리 칸이 없어 캠퍼스 중심(`University.lat/lng`)에서 직선거리를 재고 가까운 순(같으면 이름 순)으로 정렬한다(2B′-R15).
 * 캠퍼스 목록에 그 학교가 없으면 요청 없이 404 NOT_FOUND다. 반경 · 제휴 여부는 서버 몫이다.
 */
export async function getNearbyStores(
  universityId: number,
  campuses: CampusesInput,
): Promise<NearbyStore[]> {
  const campus = (await campuses).find((u) => u.id === universityId);
  if (campus === undefined) throw new ApiError(404, 'NOT_FOUND', errorMessage('NOT_FOUND'));
  const wire = await listAll<WireNearbyStore>(
    withQuery('/stores/nearby', { campus_id: campus.id }),
  );
  const origin = { lat: campus.lat, lng: campus.lng };
  return wire
    .map((w) => fromWireNearbyStore(w, origin))
    .sort((a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name, 'ko'));
}

/** 캠퍼스 장소(C-02 보완), 서버 순서 그대로. 없는 캠퍼스는 404 NOT_FOUND. */
export async function getCampusPlaces(universityId: number): Promise<CampusPlace[]> {
  const wire = await listAll<WireCampusPlace>(`/campuses/${universityId}/places`);
  return wire.map(fromWireCampusPlace);
}
