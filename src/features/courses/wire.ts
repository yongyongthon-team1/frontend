import type { TourDetail } from '@/features/tours/model';
import {
  COURSE_CRITERIA,
  PARTNER_DISCOUNT_FALLBACK,
  partnerStopCount,
  STORE_DATA_SOURCE,
  type Course,
  type CourseStatus,
  type CourseStop,
  type StopType,
} from './model';

// 백엔드 C. 코스의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것). 스팟 형식은 모든 코스 응답에서 같다.

/** 코스 스팟. `stopType`이 STORE면 상점 칸을, CAMPUS면 캠퍼스 건물 칸을 채우고 나머지는 null이다. */
export interface WireSpot {
  order: number;
  stopType: StopType;
  storeId: number | null;
  campusBuildingId: number | null;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  startTime: string;
  /** AI 추천 이유. */
  reason: string | null;
  /** 가이드 한줄평. */
  comment: string | null;
  isPartner: boolean;
  reviewSummary: string | null;
  /** 목업 전용 확장(2C-R8). 실서버에는 없다. */
  spotId?: number;
  discountText?: string | null;
  reviewAverage?: number | null;
  reviewCount?: number;
}

export interface WireCourse {
  tourId: number;
  status: CourseStatus;
  spots: WireSpot[];
  /** 목업 전용 확장(2C-R8): 이 코스로 발급된 쿠폰 수. */
  couponCount?: number;
}

/** `POST /tours/{tourId}/course/confirm` 응답. */
export interface WireConfirm {
  tourId: number;
  status: CourseStatus;
  couponCount: number;
}

/** `PUT /tours/{tourId}/course/spots`의 `spots[]` 항목(보낼 때 `request`가 snake로 바꾼다). */
export interface SpotInput {
  stopType: StopType;
  storeId?: number;
  campusBuildingId?: number;
  /** `HH:mm` */
  startTime: string;
  comment?: string;
}

/** 캠퍼스 지점의 분류 라벨(백엔드는 캠퍼스 지점의 `category`를 null로 준다). */
const CAMPUS_CATEGORY = '캠퍼스';

function fromWireSpot(w: WireSpot): CourseStop {
  const isStore = w.stopType === 'STORE';
  return {
    id: w.spotId ?? w.order,
    order: w.order,
    visitTime: w.startTime,
    type: w.stopType,
    name: w.name,
    category: w.category ?? CAMPUS_CATEGORY,
    lat: w.lat,
    lng: w.lng,
    description: w.comment,
    recommendationReason: w.reason,
    storeId: w.storeId,
    campusBuildingId: w.campusBuildingId,
    partnership: w.isPartner ? { discount: w.discountText ?? PARTNER_DISCOUNT_FALLBACK } : null,
    review: isStore
      ? {
          average: w.reviewAverage ?? null,
          count: w.reviewCount ?? 0,
          summary: w.reviewSummary,
        }
      : null,
    dataSource: isStore ? STORE_DATA_SOURCE : null,
  };
}

/**
 * 코스 응답 → `Course`. 탐방 정보는 `GET /tours/{tourId}` 상세에서 채운다(2C-R7 합성). 확장이 없으면(실서버) 지점 id는
 * `order`, 발급 쿠폰 수는 확정 코스면 승인 수 × 제휴 지점 수, 초안이면 0이다. 관심사 · 확정 시각은 백엔드에 없다.
 */
export function fromWireCourse(w: WireCourse, tour: TourDetail): Course {
  const stops = [...w.spots].sort((a, b) => a.order - b.order).map(fromWireSpot);
  return {
    tourId: w.tourId,
    status: w.status,
    tour: {
      id: tour.id,
      title: tour.title,
      universityId: tour.universityId,
      universityShortName: tour.universityShortName,
      campusName: tour.campusName,
      startsAt: tour.startsAt,
      endsAt: tour.endsAt,
    },
    stops,
    interests: [],
    criteria: COURSE_CRITERIA,
    confirmedAt: null,
    issuedCouponCount:
      w.couponCount ??
      (w.status === 'CONFIRMED' ? tour.approvedCount * partnerStopCount(stops) : 0),
  };
}
