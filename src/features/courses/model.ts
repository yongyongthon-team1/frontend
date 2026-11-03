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

/** 학생에게 보이는 코스 상태. 코스가 없거나 초안이면 아직 준비 중이다. */
export function studentCourseLabel(status: CourseStatus | null): '코스 준비 중' | '코스 확정' {
  return status === 'CONFIRMED' ? '코스 확정' : '코스 준비 중';
}
