import type { CampusesInput } from '@/features/tours/api';
import { request } from '@/shared/lib/http';
import type { TourWish, TourWishInput } from './model';
import { fromWireCreatedWish, type WireCreatedWish } from './wire';

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
