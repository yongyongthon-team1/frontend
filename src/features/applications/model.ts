import type { CourseStatus } from '@/features/courses/model';
import type { TourSummary } from '@/features/tours/model';

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

/** 가이드 홈 · `코스 편집` 탭이 집중할 탐방: 모집 중 · 마감 중 `startsAt`이 가장 이른 것(없으면 null). */
export function pickFocusTour(tours: GuideTourSummary[]): GuideTourSummary | null {
  let focus: GuideTourSummary | null = null;
  for (const tour of tours) {
    if (tour.status !== 'RECRUITING' && tour.status !== 'CLOSED') continue;
    if (focus === null || Date.parse(tour.startsAt) < Date.parse(focus.startsAt)) focus = tour;
  }
  return focus;
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
    const open = app.tour.status === 'RECRUITING' || app.tour.status === 'CLOSED';
    if (open && app.status === 'APPROVED') upcoming.push(app);
    else if (open && app.status === 'PENDING') pending.push(app);
    else past.push(app);
  }
  upcoming.sort((a, b) => startsAtOf(a) - startsAtOf(b));
  pending.sort((a, b) => startsAtOf(a) - startsAtOf(b));
  past.sort((a, b) => startsAtOf(b) - startsAtOf(a));
  return { upcoming, pending, past };
}
