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

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  CANCELED: '취소됨',
};
