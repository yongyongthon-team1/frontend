import type { CourseStatus } from '@/features/courses/model';
import type { TourDetail, TourStatus } from '@/features/tours/model';
import { summaryOf } from '@/features/tours/wire';
import {
  computeCancellable,
  type Applicant,
  type ApplicantsBoard,
  type ApplicationStatus,
  type GuideTourSummary,
  type MyApplication,
} from './model';

// 백엔드 T-04 `GET /users/me/tours`와 A. 신청(A-01~04)의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).
// 탐방 요약은 응답에 없어 `GET /tours/{tourId}`의 상세로 합성한다(2C-R7).

/** T-04 고교생 항목. `wish` · `createdAt` · `couponCount`는 목업 전용 확장(2C-R8)이라 실서버에는 없다. */
export interface WireMyTourRow {
  tourId: number;
  campusName: string;
  date: string;
  tourStatus: TourStatus;
  applicationId: number;
  applicationStatus: ApplicationStatus;
  courseConfirmed: boolean;
  wish?: string;
  createdAt?: string;
  couponCount?: number;
}

/** T-04 대학생 항목(내가 개설한 탐방). */
export interface WireGuideTourRow {
  tourId: number;
  date: string;
  tourStatus: TourStatus;
  capacity: number;
  approvedCount: number;
  pendingCount: number;
  courseConfirmed: boolean;
}

/** A-04 신청자 목록 항목. */
export interface WireApplicant {
  applicationId: number;
  name: string;
  grade: number | null;
  wish: string;
  status: ApplicationStatus;
  createdAt: string;
}

/** A-01 신청 응답(201). */
export interface WireApplyResult {
  applicationId: number;
  tourId: number;
  status: ApplicationStatus;
  createdAt: string;
}

/**
 * 내 탐방 행 + 그 탐방의 상세 → 내 신청. 확장이 없으면 동기 · 신청 시각은 빈 문자열이고, 쿠폰 수는 호출하는 쪽이 센 값이다.
 * 코스는 확정 여부만 안다(학생 화면은 초안을 준비 중으로 같이 본다, 2C-R27). 오픈채팅은 승인된 신청에만 둔다 — 상세의 링크는
 * 탐방 단위라 같은 탐방의 다른 신청(예: 취소한 옛 신청)에도 실려 올 수 있다.
 */
export function fromWireMyTourRow(
  row: WireMyTourRow,
  tour: TourDetail,
  couponCount: number,
  now: Date,
): MyApplication {
  return {
    id: row.applicationId,
    status: row.applicationStatus,
    motivation: row.wish ?? '',
    createdAt: row.createdAt ?? '',
    tour: summaryOf(tour),
    courseStatus: row.courseConfirmed ? 'CONFIRMED' : null,
    openChatUrl: row.applicationStatus === 'APPROVED' ? tour.openChatUrl : null,
    couponCount,
    cancellable: computeCancellable(row.applicationStatus, tour.startsAt, now),
  };
}

/**
 * 가이드 탐방 행 + 상세 → 가이드 탐방 요약. `courseStatus`는 확정이 아닐 때의 코스 상태(`getGuideCourseStatus`, 초안이면
 * DRAFT)이고 행이 확정이면 CONFIRMED다. 신청 수는 승인 + 대기(거절 제외, 2C-R27 · errata Task 9).
 */
export function fromWireGuideTourRow(
  row: WireGuideTourRow,
  tour: TourDetail,
  courseStatus: CourseStatus | null,
): GuideTourSummary {
  return {
    ...summaryOf(tour),
    counts: {
      total: row.approvedCount + row.pendingCount,
      pending: row.pendingCount,
      approved: row.approvedCount,
    },
    courseStatus: row.courseConfirmed ? 'CONFIRMED' : courseStatus,
  };
}

const byCreatedAt = (a: WireApplicant, b: WireApplicant) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.applicationId - b.applicationId;

function toApplicant(w: WireApplicant): Applicant {
  return {
    id: w.applicationId,
    userName: w.name,
    grade: w.grade,
    motivation: w.wish,
    status: w.status,
    // 신청은 재학 인증 APPROVED만 받는다(A-01) — 신청자는 모두 인증을 마쳤다(2C-R27).
    verified: true,
  };
}

/**
 * 신청자 목록 + 탐방 상세 + 코스 상태 → 신청자 보드. 취소한 신청은 빼고 거절한 신청은 남기며, 신청 시각이 빠른 순(같으면 id)이다.
 * 남은 자리는 탐방 상세의 값이다.
 */
export function fromWireApplicants(
  items: WireApplicant[],
  tour: TourDetail,
  courseStatus: CourseStatus | null,
): ApplicantsBoard {
  const live = items.filter((a) => a.status !== 'CANCELED').sort(byCreatedAt);
  const count = (status: ApplicationStatus) => live.filter((a) => a.status === status).length;
  return {
    tour: summaryOf(tour),
    counts: {
      pending: count('PENDING'),
      approved: count('APPROVED'),
      remaining: tour.remainingSeats,
    },
    applicants: live.map(toApplicant),
    course: courseStatus === null ? null : { status: courseStatus },
  };
}
