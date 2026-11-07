import type { University } from '@/features/campuses/model';
import { findCampus } from '@/features/campuses/wire';
import { campusLabel } from '@/features/tours/model';
import type { TourWish } from './model';

// 백엔드 T-01 희망 사항 응답의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것). 목록 · 수정 응답에는 캠퍼스 id가
// 없어 목업 전용 확장(`campus_id` · 목록의 `date` · 수정의 `created_at`, 2C-R8)이 있으면 쓰고 없으면 이름 조인(2C-R9)이다.

/** `POST /tour-wishes` 201. */
export interface WireCreatedWish {
  wishId: number;
  campusId: number;
  major: string;
  wish: string;
  date: string | null;
  createdAt: string;
}

/** `GET /users/me/tour-wishes` · `GET /tour-wishes` 항목. */
export interface WireWishItem {
  wishId: number;
  campusName: string;
  major: string;
  wish: string;
  createdAt: string;
  campusId?: number;
  date?: string | null;
}

/** `PATCH /users/me/tour-wishes/{wishId}` 200. */
export interface WireUpdatedWish {
  wishId: number;
  campusName: string;
  major: string;
  wish: string;
  date: string | null;
  updatedAt: string;
  campusId?: number;
  createdAt?: string;
}

/** 등록 응답: 학교 줄은 `campus_id`로 찾은 캠퍼스의 `campusLabel`이고, 목록에 없으면 빈 문자열이다. */
export function fromWireCreatedWish(w: WireCreatedWish, campuses: University[]): TourWish {
  const campus = campuses.find((u) => u.id === w.campusId);
  return {
    id: w.wishId,
    universityId: w.campusId,
    campusLabel: campus ? campusLabel(campus.name, campus.campusName) : '',
    major: w.major,
    wish: w.wish,
    date: w.date,
    createdAt: w.createdAt,
  };
}

/** 확장 `campus_id`가 없으면 `campus_name`으로 캠퍼스를 찾는다(못 찾으면 null). */
function universityIdOf(
  w: { campusId?: number; campusName: string },
  campuses: University[],
): number | null {
  return w.campusId ?? findCampus(campuses, { campusName: w.campusName })?.id ?? null;
}

/** 목록 항목: 학교 줄은 `campus_name` 그대로, 확장 `date`가 없으면 null. */
export function fromWireWishItem(w: WireWishItem, campuses: University[]): TourWish {
  return {
    id: w.wishId,
    universityId: universityIdOf(w, campuses),
    campusLabel: w.campusName,
    major: w.major,
    wish: w.wish,
    date: w.date ?? null,
    createdAt: w.createdAt,
  };
}

/** 수정 응답: 확장 `created_at`이 없으면 등록 시각 null. */
export function fromWireUpdatedWish(w: WireUpdatedWish, campuses: University[]): TourWish {
  return {
    id: w.wishId,
    universityId: universityIdOf(w, campuses),
    campusLabel: w.campusName,
    major: w.major,
    wish: w.wish,
    date: w.date,
    createdAt: w.createdAt ?? null,
  };
}
