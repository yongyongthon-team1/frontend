import type { ApplicationStatus } from '@/features/applications/model';

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
