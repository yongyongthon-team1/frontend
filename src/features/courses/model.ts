import { formatTime, toSeoulIso } from '@/shared/lib/date';

export type CourseStatus = 'DRAFT' | 'CONFIRMED';
export type StopType = 'CAMPUS' | 'STORE';

export interface CourseStop {
  id: number;
  order: number;
  visitTime: string;
  type: StopType;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description: string | null;
  recommendationReason: string | null;
  storeId: number | null;
  partnership: { discount: string } | null;
  review: { average: number | null; count: number; summary: string | null } | null;
  dataSource: string | null;
}

export interface CourseTourInfo {
  id: number;
  title: string;
  universityId: number;
  universityShortName: string;
  campusName: string;
  startsAt: string;
  endsAt: string | null;
}

export interface Course {
  tourId: number;
  status: CourseStatus;
  tour: CourseTourInfo;
  stops: CourseStop[];
  interests: string[];
  criteria: string;
  confirmedAt: string | null;
  issuedCouponCount: number;
}

/** 시작 시각으로부터 각 지점까지의 분 단위 간격. 5번째 뒤로는 50분씩 늘어난다. */
export const SLOT_OFFSETS_MIN = [0, 70, 120, 170, 220] as const;

const EXTRA_SLOT_STEP_MIN = 50;

/** 방문 시간은 위치 슬롯에 고정된다. 탐방 시작 시각에서 `count`개 지점의 `HH:mm`(Asia/Seoul)을 돌려준다. */
export function slotTimes(startsAt: string, count: number): string[] {
  const startMs = Date.parse(startsAt);
  const last = SLOT_OFFSETS_MIN[SLOT_OFFSETS_MIN.length - 1];
  return Array.from({ length: count }, (_, i) => {
    const offset =
      i < SLOT_OFFSETS_MIN.length
        ? SLOT_OFFSETS_MIN[i]
        : last + (i - (SLOT_OFFSETS_MIN.length - 1)) * EXTRA_SLOT_STEP_MIN;
    return formatTime(toSeoulIso(new Date(startMs + offset * 60_000)));
  });
}

/** 식사로 묶는 상점 업종. */
const MEAL_CATEGORIES = new Set(['한식', '분식', '중식', '일식', '양식', '식당']);

/**
 * 코스 확정 화면 경로 줄(`캠퍼스 → 식사 → 카페`)의 지점 분류. 캠퍼스 지점은 `캠퍼스`, 식사 업종은 `식사`이고,
 * 그 밖(`카페` 포함)은 업종 그대로다 — `보드게임카페`는 카페가 아니다.
 */
export function stopKindLabel(stop: Pick<CourseStop, 'type' | 'category'>): string {
  if (stop.type === 'CAMPUS') return '캠퍼스';
  return MEAL_CATEGORIES.has(stop.category) ? '식사' : stop.category;
}

/** 학생에게 보이는 코스 상태. 코스가 없거나 초안이면 아직 준비 중이다. */
export function studentCourseLabel(status: CourseStatus | null): '코스 준비 중' | '코스 확정' {
  return status === 'CONFIRMED' ? '코스 확정' : '코스 준비 중';
}

const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * 지점마다 머무는 분(2A-R6). 다음 지점 방문 시각까지이고, 마지막 지점은 탐방 종료 시각까지다. 종료 시각이 없거나
 * 마지막 방문 시각보다 이르면(음수 · 0분) 그 지점은 `null`이다 — 화면은 `· N분`을 생략한다.
 */
export function stopDurations(
  stops: Pick<CourseStop, 'visitTime'>[],
  endsAt: string | null,
): (number | null)[] {
  return stops.map((stop, i) => {
    const next = stops[i + 1]?.visitTime ?? (endsAt === null ? null : formatTime(endsAt));
    if (next === null) return null;
    const minutes = hhmmToMinutes(next) - hhmmToMinutes(stop.visitTime);
    return minutes > 0 ? minutes : null;
  });
}
