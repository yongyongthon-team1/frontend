import type { CourseStatus } from '@/features/courses/model';
import type { TourSummary } from '@/features/tours/model';
import { formatShortDate } from '@/shared/lib/date';
import type { ActionLink, Tone } from '@/shared/lib/types';

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

export interface MyTourDisplay {
  label: string;
  description: string;
  tone: Tone;
  action: ActionLink | null;
}

/** 내 탐방 카드(와이어 hs-a05)의 상태 라벨 · 설명 · 다음 행동. */
export function myTourDisplay(app: MyApplication, recommendationsPath: string): MyTourDisplay {
  const { title } = app.tour;
  const myTourPath = `/my-tours/${app.id}`;

  if (app.status === 'CANCELED') {
    return {
      label: '취소 · 쿠폰 만료',
      description:
        app.tour.status === 'CANCELED'
          ? `${title} · 가이드가 탐방을 취소했어요`
          : `${title} · 신청을 취소했어요`,
      tone: 'neutral',
      action: null,
    };
  }
  if (app.status === 'REJECTED') {
    return {
      label: '거절 · 다른 탐방 보기',
      description: `${title} · 신청 거절`,
      tone: 'danger',
      action: { label: '추천 탐방으로 다시 이동', to: recommendationsPath },
    };
  }
  if (app.status === 'PENDING') {
    return {
      label: '신청 · 가이드 승인 대기',
      description: `${title} · ${formatShortDate(app.tour.startsAt)}`,
      tone: 'warning',
      action: { label: app.cancellable ? '승인 전 직접 취소 가능' : '상세 보기', to: myTourPath },
    };
  }
  if (app.tour.status === 'COMPLETED') {
    return {
      label: '탐방 완료 · 리뷰 쓰기',
      description: `${title} · 다녀온 상점에 리뷰를 남겨 주세요`,
      tone: 'success',
      action: { label: '쿠폰 쓴 상점 리뷰 쓰기', to: `${myTourPath}/coupons` },
    };
  }
  if (app.courseStatus === 'CONFIRMED') {
    return {
      label: '승인 · 코스 확정',
      description: `${title} · 지도와 쿠폰이 열렸어요`,
      tone: 'success',
      action: { label: '코스 지도 보기', to: `${myTourPath}/course` },
    };
  }
  return {
    label: '승인 · 코스 준비 중',
    description: `${title} · 오픈채팅 공개`,
    tone: 'info',
    action: { label: '확정되면 코스 지도와 쿠폰 열림', to: myTourPath },
  };
}
