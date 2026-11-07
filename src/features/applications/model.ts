import type { CourseStatus } from '@/features/courses/model';
import { TOUR_STATUS_LABEL, type TourDetail, type TourSummary } from '@/features/tours/model';
import { seoulDateKey } from '@/shared/lib/date';
import type { Tone } from '@/shared/lib/types';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

export interface MyApplication {
  id: number;
  status: ApplicationStatus;
  motivation: string;
  createdAt: string;
  tour: TourSummary;
  courseStatus: CourseStatus | null;
  openChatUrl: string | null;
  couponCount: number;
  cancellable: boolean;
}

export interface Applicant {
  id: number;
  userName: string;
  grade: number | null;
  motivation: string;
  status: ApplicationStatus;
  verified: boolean;
}

export interface ApplicantsBoard {
  tour: TourSummary;
  counts: { pending: number; approved: number; remaining: number };
  applicants: Applicant[];
  course: { status: CourseStatus } | null;
}

export interface GuideTourSummary extends TourSummary {
  counts: { total: number; pending: number; approved: number };
  courseStatus: CourseStatus | null;
}

/**
 * `MyApplication.cancellable`: 대기 · 승인 신청이고 지금(서울 날짜)이 탐방 날짜 전이면 직접 취소할 수 있다.
 * 어댑터 · 목업 서버 전용(컴포넌트는 서버 값 `cancellable`을 그린다). 목업 `isCancellable`도 이 함수를 불러 규칙이 하나다.
 */
export function computeCancellable(
  status: ApplicationStatus,
  tourStartsAt: string,
  now: Date,
): boolean {
  return (
    (status === 'PENDING' || status === 'APPROVED') &&
    seoulDateKey(now) < seoulDateKey(tourStartsAt)
  );
}

/** 진행 예정 탐방: 모집 중 · 마감(끝나지 않은 탐방). */
export function isUpcomingTour(tour: Pick<TourSummary, 'status'>): boolean {
  return tour.status === 'RECRUITING' || tour.status === 'CLOSED';
}

/** 가이드 홈 · `코스 편집` 탭이 집중할 탐방: 모집 중 · 마감 중 `startsAt`이 가장 이른 것(없으면 null). */
export function pickFocusTour(tours: GuideTourSummary[]): GuideTourSummary | null {
  let focus: GuideTourSummary | null = null;
  for (const tour of tours) {
    if (!isUpcomingTour(tour)) continue;
    if (focus === null || Date.parse(tour.startsAt) < Date.parse(focus.startsAt)) focus = tour;
  }
  return focus;
}

/** 가이드 탐방 카드(G06 · G11)의 상태 칩: 진행 예정은 코스 확정 > 접수 중 · 마감, 지난 탐방은 탐방 상태 이름. */
export function guideTourChip(tour: GuideTourSummary): { label: string; tone: Tone } {
  if (!isUpcomingTour(tour)) return { label: TOUR_STATUS_LABEL[tour.status], tone: 'neutral' };
  if (tour.courseStatus === 'CONFIRMED') return { label: '코스 확정', tone: 'success' };
  return { label: tour.status === 'RECRUITING' ? '신청 접수 중' : '모집 마감', tone: 'neutral' };
}

/** 탐방의 코스로 가는 길: 확정 → 확정 점검, 초안 → 편집, 코스 없음 → 승인자가 있으면 초안 생성, 없으면 신청자 보기. */
export function coursePathFor(
  tourId: number,
  courseStatus: CourseStatus | null,
  approved: number,
): string {
  const base = `/guide/tours/${tourId}`;
  if (courseStatus === 'CONFIRMED') return `${base}/course/confirm`;
  if (courseStatus === 'DRAFT') return `${base}/course/edit`;
  return approved >= 1 ? `${base}/course/draft?generate=1` : `${base}/applicants`;
}

/** `coursePathFor`를 가이드 탐방 요약으로 부른다. */
export function guideCoursePath(tour: GuideTourSummary): string {
  return coursePathFor(tour.id, tour.courseStatus, tour.counts.approved);
}

/**
 * 학생이 보는 신청 상태(H06 · H10 · H14): 칩 문구 · 칩 색 · 상태 행 글자색. 화면마다 따로 쓰면 어긋나므로(예: 거절된
 * 신청이 "참여 확정"으로 보임) 한 곳에 둔다.
 */
export const STUDENT_APPLICATION_STATUS: Record<
  ApplicationStatus,
  { label: string; chipTone: Tone; textTone: Tone }
> = {
  APPROVED: { label: '참여 확정', chipTone: 'success', textTone: 'success' },
  PENDING: { label: '승인 대기', chipTone: 'neutral', textTone: 'info' },
  REJECTED: { label: '신청 거절', chipTone: 'danger', textTone: 'danger' },
  CANCELED: { label: '취소됨', chipTone: 'neutral', textTone: 'neutral' },
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  CANCELED: '취소됨',
};

export interface MyApplicationGroups {
  /** 승인됐고 탐방이 아직 끝나지 않음(모집 중 · 마감). */
  upcoming: MyApplication[];
  /** 승인을 기다리고 탐방이 아직 끝나지 않음. */
  pending: MyApplication[];
  /** 나머지: 탐방이 끝남 · 취소됨, 또는 신청이 거절 · 취소됨. */
  past: MyApplication[];
}

const startsAtOf = (a: MyApplication) => Date.parse(a.tour.startsAt);

/** 내 탐방 목록(H06 · H09)의 분류. 예정 · 승인 대기는 시작이 빠른 순, 지난 탐방은 최근 먼저. */
export function groupMyApplications(apps: MyApplication[]): MyApplicationGroups {
  const upcoming: MyApplication[] = [];
  const pending: MyApplication[] = [];
  const past: MyApplication[] = [];
  for (const app of apps) {
    const open = isUpcomingTour(app.tour);
    if (open && app.status === 'APPROVED') upcoming.push(app);
    else if (open && app.status === 'PENDING') pending.push(app);
    else past.push(app);
  }
  upcoming.sort((a, b) => startsAtOf(a) - startsAtOf(b));
  pending.sort((a, b) => startsAtOf(a) - startsAtOf(b));
  past.sort((a, b) => startsAtOf(b) - startsAtOf(a));
  return { upcoming, pending, past };
}

/** 탐방 개설(T-03) 입력. 제목 칸은 없다 — 카드 제목은 파생 제목이다(명세에 제목이 없다, 9절 11번). */
export interface CreateTourInput {
  /** 서울 날짜 `yyyy-MM-dd`. */
  date: string;
  /** `HH:mm`. */
  startTime: string;
  endTime: string;
  capacity: number;
  introduction: string;
  openChatUrl: string;
}

/** 모집 정원 상한(명세 T-03: 1~10). */
export const TOUR_CAPACITY_MAX = 10;
/** 탐방 소개 최대 길이(명세 T-03: 300자 이내). */
export const TOUR_INTRO_MAX = 300;

/** 가이드 탐방 상세(G09)의 버튼 활성(`computeTourActions`). */
export interface TourActions {
  completable: boolean;
  cancellable: boolean;
}

/**
 * 가이드 탐방의 완료 · 취소 버튼 활성(2B′-R13). 취소는 모집 중 · 마감일 때, 완료는 그리고 오늘(서울)이 탐방 날짜 이후일 때다
 * (당일 허용 — 9절 23번). 어댑터 전용이다(컴포넌트는 서버가 계산해 온 `actions`를 그린다 — `computeCancellable`과 같은 원칙).
 */
export function computeTourActions(
  tour: Pick<TourSummary, 'status' | 'startsAt'>,
  now: Date,
): TourActions {
  const open = isUpcomingTour(tour);
  return {
    cancellable: open,
    completable: open && seoulDateKey(now) >= seoulDateKey(tour.startsAt),
  };
}

/** 가이드가 보는 탐방 상세(G09): 탐방 상세 + 확정 코스 지점 수(없으면 0) + 완료 · 취소 활성. */
export interface GuideTourDetail {
  tour: TourDetail;
  courseStopCount: number;
  actions: TourActions;
}
