import type { CampusesInput } from '@/features/tours/api';
import { listAll, request, withQuery } from '@/shared/lib/http';
import type { GuideWishFilter, TourWish, TourWishInput } from './model';
import {
  fromWireCreatedWish,
  fromWireUpdatedWish,
  fromWireWishItem,
  type WireCreatedWish,
  type WireUpdatedWish,
  type WireWishItem,
} from './wire';

// 백엔드 T-01 희망 사항. `campuses`는 배열이나 아직 받는 중인 약속(`loadCampuses`)을 받는다 — 요청과 동시에 기다린다(errata G13).

/**
 * T-01 `POST /tour-wishes`(고교생). 본문은 `{ campus_id, major, wish, date }`(날짜가 없으면 null)이고, 학교 칸 오류
 * (`errors[].field = campus_id`)는 폼 칸 `universityId`로 온다.
 */
export async function postTourWish(
  input: TourWishInput,
  campuses: CampusesInput,
): Promise<TourWish> {
  const [wire, joined] = await Promise.all([
    request<WireCreatedWish>('/tour-wishes', {
      method: 'POST',
      body: {
        campusId: input.universityId,
        major: input.major,
        wish: input.wish,
        date: input.date,
      },
      fieldMap: { campus_id: 'universityId' },
    }),
    campuses,
  ]);
  return fromWireCreatedWish(wire, joined);
}

/** T-07 `GET /users/me/tour-wishes`(고교생). 모든 쪽을 이어 받는다. 서버 순서(최신순)를 그대로 쓴다. */
export async function listMyWishes(campuses: CampusesInput): Promise<TourWish[]> {
  const [items, joined] = await Promise.all([
    listAll<WireWishItem>('/users/me/tour-wishes'),
    campuses,
  ]);
  return items.map((w) => fromWireWishItem(w, joined));
}

/**
 * T-07 `PATCH /users/me/tour-wishes/{wishId}`(고교생). 받은 칸만 `{ campus_id?, major?, wish?, date? }`로 보낸다
 * (`date: null`은 날짜 지우기). 학교 칸 오류(`errors[].field = campus_id`)는 폼 칸 `universityId`로 온다.
 */
export async function patchTourWish(
  id: number,
  patch: Partial<TourWishInput>,
  campuses: CampusesInput,
): Promise<TourWish> {
  const body: Record<string, unknown> = {};
  if (patch.universityId !== undefined) body.campusId = patch.universityId;
  if (patch.major !== undefined) body.major = patch.major;
  if (patch.wish !== undefined) body.wish = patch.wish;
  if (patch.date !== undefined) body.date = patch.date;
  const [wire, joined] = await Promise.all([
    request<WireUpdatedWish>(`/users/me/tour-wishes/${id}`, {
      method: 'PATCH',
      body,
      fieldMap: { campus_id: 'universityId' },
    }),
    campuses,
  ]);
  return fromWireUpdatedWish(wire, joined);
}

/**
 * T-08 `GET /tour-wishes`(인증을 마친 대학생). 학교를 빼면 서버가 내 인증 학교로 찾고, 학과는 부분 일치다.
 * 모든 쪽을 이어 받고 서버 순서(최신순)를 그대로 쓴다.
 */
export async function listGuideWishes(
  filter: GuideWishFilter,
  campuses: CampusesInput,
): Promise<TourWish[]> {
  const [items, joined] = await Promise.all([
    listAll<WireWishItem>(
      withQuery('/tour-wishes', { campus_id: filter.universityId, major: filter.major }),
    ),
    campuses,
  ]);
  return items.map((w) => fromWireWishItem(w, joined));
}
