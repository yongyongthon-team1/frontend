import { addDaysKey, seoulDateKey } from '@/shared/lib/date';

export interface Vacation {
  startDate: string;
  endDate: string;
  label: string | null;
}

export interface University {
  id: number;
  name: string;
  shortName: string;
  campusName: string;
  address: string | null;
  lat: number;
  lng: number;
  administrativeDong: string | null;
  vacations: Vacation[];
}

export interface Insight {
  universityId: number;
  title: string;
  text: string;
  source: string;
  isPlaceholder: boolean;
}

/** `dayKey`(서울 `yyyy-MM-dd`)가 방학 기간 안인지 — 시작일 · 종료일을 포함한다. */
export function isWithinVacation(vacations: Vacation[], dayKey: string): boolean {
  return vacations.some((v) => v.startDate <= dayKey && dayKey <= v.endDate);
}

/**
 * 탐방을 열 수 있는 날짜의 안내 범위(T-03 · 2B′-R12). 내일 이후에 끝나는 방학만 보고, `min`은 내일과 그중 첫 방학
 * 시작일 중 늦은 날, `max`는 마지막 방학의 끝이다. 그런 방학이 없으면 null이다. 사이의 학기 중 날짜는 범위 안이어도 열 수 없으니
 * 정확한 판정은 `isWithinVacation`과 서버 몫이다("내일 이후" 규칙은 명세에 없어 서버는 오늘도 막지 않는다 — 이 범위는 안내다).
 */
export function tourDateBounds(
  vacations: Vacation[],
  todayKey: string,
): { min: string; max: string } | null {
  const tomorrow = addDaysKey(todayKey, 1);
  const upcoming = vacations.filter((v) => v.endDate >= tomorrow);
  if (upcoming.length === 0) return null;
  const firstStart = upcoming.reduce(
    (a, v) => (v.startDate < a ? v.startDate : a),
    upcoming[0].startDate,
  );
  const lastEnd = upcoming.reduce((a, v) => (v.endDate > a ? v.endDate : a), upcoming[0].endDate);
  return { min: firstStart > tomorrow ? firstStart : tomorrow, max: lastEnd };
}

/**
 * `tourDateBounds`를 지금(서울 날짜) 기준으로. 화면은 시계로 유효 여부를 판단하지 않으므로(PM3) 이 함수만 부른다.
 * 서버가 최종 판정이다.
 */
export function tourDateBoundsNow(vacations: Vacation[]): { min: string; max: string } | null {
  return tourDateBounds(vacations, seoulDateKey(new Date()));
}
