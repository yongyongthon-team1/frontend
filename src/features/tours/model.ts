import type { ApplicationStatus } from '@/features/applications/model';
import type { Me } from '@/features/auth/model';
import type { ActionLink } from '@/shared/lib/types';

export type TourStatus = 'RECRUITING' | 'CLOSED' | 'CANCELED' | 'COMPLETED';

export interface TourSummary {
  id: number;
  title: string;
  universityId: number;
  universityName: string;
  universityShortName: string;
  campusName: string;
  major: string | null;
  guideName: string;
  guideVerified: boolean;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  approvedCount: number;
  remainingSeats: number;
  status: TourStatus;
}

export interface TourDetail extends TourSummary {
  introduction: string;
  guideIntroduction: string | null;
  openChatUrl: string | null;
  myApplication: { id: number; status: ApplicationStatus } | null;
}

export interface RecommendationQuery {
  q: string;
  major?: string;
  universityId?: number;
  date?: string;
}

export interface Recommendation {
  tour: TourSummary;
  reason: string;
}

export interface RecommendationResult {
  headline: string;
  keywords: string[];
  items: Recommendation[];
  fallback: null | 'SCHOOL' | 'ALL';
}

export const TOUR_STATUS_LABEL: Record<TourStatus, string> = {
  RECRUITING: '모집 중',
  CLOSED: '마감',
  CANCELED: '취소',
  COMPLETED: '완료',
};

/** `한국외국어대학교`는 `한국외대`, 그 밖에는 끝의 `학교`를 뗀다(`경희대학교` → `경희대`). */
export function shortUniversityName(name: string): string {
  if (name === '한국외국어대학교') return '한국외대';
  return name.endsWith('학교') ? name.slice(0, -'학교'.length) : name;
}

/** 목록 행의 학교 줄: `경희대학교 국제캠퍼스`. 캠퍼스명이 `본교`면 학교 이름만. */
export function campusLabel(universityName: string, campusName: string): string {
  return campusName === '본교' ? universityName : `${universityName} ${campusName}`;
}

/** 캠퍼스명이 `본교`면 캠퍼스를 생략하고, 학과가 없으면 `캠퍼스 탐방`으로 쓴다. */
export function tourTitle(
  universityName: string,
  campusName: string,
  major: string | null,
): string {
  const parts = [shortUniversityName(universityName)];
  if (campusName !== '본교') parts.push(campusName);
  parts.push(major ?? '캠퍼스', '탐방');
  return parts.join(' ');
}

export interface ApplyButtonState {
  kind:
    | 'APPLY'
    | 'LOGIN'
    | 'NOT_STUDENT'
    | 'APPLIED'
    | 'REJECTED'
    | 'NOT_RECRUITING'
    | 'CLOSED'
    | 'NEED_VERIFICATION';
  enabled: boolean;
  label: string;
  reason: string | null;
  action: ActionLink | null;
}

/** 탐방 상세의 신청 버튼. 위에서부터 차례로 검사하고 처음 걸린 사유를 돌려준다. */
export function applyButtonState(
  me: Me | null,
  tour: TourDetail,
  recommendationsPath: string,
): ApplyButtonState {
  if (me === null) {
    return {
      kind: 'LOGIN',
      enabled: true,
      label: '로그인하고 신청하기',
      reason: null,
      action: { label: '로그인', to: `/login?next=/tours/${tour.id}` },
    };
  }
  if (me.role !== 'HIGH_SCHOOL') {
    return {
      kind: 'NOT_STUDENT',
      enabled: false,
      label: '고교생만 신청할 수 있어요',
      reason: null,
      action: null,
    };
  }
  const mine = tour.myApplication?.status;
  if (mine === 'PENDING' || mine === 'APPROVED') {
    return {
      kind: 'APPLIED',
      enabled: false,
      label: '신청됨',
      reason: '이미 신청한 탐방이에요.',
      action: { label: '내 탐방에서 상태 확인', to: '/my-tours' },
    };
  }
  const otherTours: ActionLink = { label: '다른 추천 보기', to: recommendationsPath };
  if (mine === 'REJECTED') {
    return {
      kind: 'REJECTED',
      enabled: false,
      label: '신청 불가',
      reason: '거절된 탐방에는 다시 신청할 수 없어요.',
      action: otherTours,
    };
  }
  if (tour.status === 'CANCELED' || tour.status === 'COMPLETED') {
    return {
      kind: 'NOT_RECRUITING',
      enabled: false,
      label: '모집 종료',
      reason: '모집이 끝난 탐방이에요.',
      action: otherTours,
    };
  }
  if (tour.status === 'CLOSED' || tour.remainingSeats <= 0) {
    return {
      kind: 'CLOSED',
      enabled: false,
      label: '정원 마감',
      reason: '남은 자리가 없어요.',
      action: otherTours,
    };
  }
  if (me.verificationStatus !== 'APPROVED' || me.guardianStatus !== 'AGREED') {
    return {
      kind: 'NEED_VERIFICATION',
      enabled: false,
      label: '탐방 신청하기',
      reason: '학생증 승인·보호자 동의 완료 후 신청할 수 있어요.',
      action: { label: '역할 인증 단계로 이동', to: '/verify' },
    };
  }
  return {
    kind: 'APPLY',
    enabled: true,
    label: '탐방 신청하기',
    reason: null,
    action: { label: '탐방 신청하기', to: `/tours/${tour.id}/apply` },
  };
}

/**
 * 탐방 소개를 V2 `이런 경험을 해요` 번호 목록의 항목으로 나눈다. 줄바꿈 · `·` · 마침표(뒤에 공백이나 끝이 오는 것만 — `3.5시간` ·
 * 주소는 자르지 않는다)로 나누고 빈 조각은 버리며 최대 3개다. 한 덩어리뿐이면 그 한 개다.
 */
export function tourHighlights(introduction: string): string[] {
  return introduction
    .split(/\n|·|\.(?=\s|$)/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .slice(0, 3);
}
