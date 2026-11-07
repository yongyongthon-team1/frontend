import type { ApplicationStatus } from '@/features/applications/model';
import { findCampus, splitCampusName } from '@/features/campuses/wire';
import type { University } from '@/features/campuses/model';
import { seoulDateAt } from '@/shared/lib/date';
import {
  shortUniversityName,
  tourTitle,
  type TourDetail,
  type TourStatus,
  type TourSummary,
} from './model';

// 백엔드 T-01 보완 `GET /tours` 항목과 T-02 `GET /tours/{tourId}`의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

export interface WireTourGuide {
  name: string;
  verified: boolean;
  major?: string | null;
  intro?: string | null;
}

export interface WireTourItem {
  tourId: number;
  campusName: string;
  major: string | null;
  date: string;
  startTime: string;
  capacity: number;
  remaining: number;
  status: TourStatus;
  guide: WireTourGuide;
  /** 목업 전용 확장(2C-R8). 실서버에는 없다. */
  campusId?: number;
}

export interface WireTourDetail extends WireTourItem {
  endTime: string | null;
  intro: string;
  openChatUrl: string | null;
  myApplication: { applicationId: number; status: ApplicationStatus } | null;
}

interface JoinedCampus {
  universityId: number;
  universityName: string;
  universityShortName: string;
  campusName: string;
}

/** 캠퍼스 조인(2C-R9): `campusId` · 이름으로 목록에서 찾고, 못 찾으면 이름을 첫 공백에서 나눈다(`universityId` 0). */
function joinCampus(w: WireTourItem, campuses: University[]): JoinedCampus {
  const found = findCampus(campuses, { campusId: w.campusId, campusName: w.campusName });
  if (found) {
    return {
      universityId: found.id,
      universityName: found.name,
      universityShortName: found.shortName,
      campusName: found.campusName,
    };
  }
  const split = splitCampusName(w.campusName);
  return {
    universityId: 0,
    universityName: split.universityName,
    universityShortName: shortUniversityName(split.universityName),
    campusName: split.campusName,
  };
}

function summaryFields(
  w: WireTourItem,
  campuses: University[],
  endTime: string | null,
): TourSummary {
  const campus = joinCampus(w, campuses);
  return {
    id: w.tourId,
    title: tourTitle(campus.universityName, campus.campusName, w.major),
    ...campus,
    major: w.major,
    guideName: w.guide.name,
    guideVerified: w.guide.verified,
    startsAt: seoulDateAt(w.date, w.startTime),
    endsAt: endTime === null ? null : seoulDateAt(w.date, endTime),
    capacity: w.capacity,
    approvedCount: w.capacity - w.remaining,
    remainingSeats: w.remaining,
    status: w.status,
  };
}

/** 목록 항목 → 요약. 목록에는 종료 시각이 없어 `endsAt`은 null이다. */
export function fromWireTourItem(w: WireTourItem, campuses: University[]): TourSummary {
  return summaryFields(w, campuses, null);
}

export function fromWireTourDetail(w: WireTourDetail, campuses: University[]): TourDetail {
  return {
    ...summaryFields(w, campuses, w.endTime),
    introduction: w.intro,
    guideIntroduction: w.guide.intro ?? null,
    openChatUrl: w.openChatUrl,
    myApplication: w.myApplication
      ? { id: w.myApplication.applicationId, status: w.myApplication.status }
      : null,
  };
}

/** 상세에서 요약 칸만 고른다(다른 도메인의 합성이 `GET /tours/{tourId}`로 요약을 만들 때 쓴다). */
export function summaryOf(detail: TourDetail): TourSummary {
  return {
    id: detail.id,
    title: detail.title,
    universityId: detail.universityId,
    universityName: detail.universityName,
    universityShortName: detail.universityShortName,
    campusName: detail.campusName,
    major: detail.major,
    guideName: detail.guideName,
    guideVerified: detail.guideVerified,
    startsAt: detail.startsAt,
    endsAt: detail.endsAt,
    capacity: detail.capacity,
    approvedCount: detail.approvedCount,
    remainingSeats: detail.remainingSeats,
    status: detail.status,
  };
}
