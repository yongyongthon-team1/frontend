import type { University } from '@/features/campuses/model';
import { listAll, request, withQuery } from '@/shared/lib/http';
import type { TourDetail, TourFilter, TourSummary, WishToursResult } from './model';
import type { WishSearch } from './wishSearch';
import {
  fromWireTourDetail,
  fromWireTourItem,
  type WireTourDetail,
  type WireTourItem,
} from './wire';

/**
 * 캠퍼스 조인(2C-R9)용 목록. 이미 받은 배열이나 아직 받는 중인 약속(`loadCampuses`)을 모두 받는다 —
 * 약속이면 탐방 요청과 캠퍼스 요청이 동시에 나간다(errata G13).
 */
export type CampusesInput = University[] | Promise<University[]>;

/**
 * T-01 보완 `GET /tours`. 모든 쪽을 이어 받아 시작 시각 오름차순(같으면 id)으로 돌려준다.
 * `status`를 빼면 백엔드 기본(RECRUITING)이다. `campuses`는 캠퍼스 조인(2C-R9)에 쓴다(배열 또는 약속).
 */
export async function listTours(
  filter: TourFilter,
  campuses: CampusesInput,
): Promise<TourSummary[]> {
  const [items, joined] = await Promise.all([
    listAll<WireTourItem>(
      withQuery('/tours', {
        status: filter.status,
        campus_id: filter.universityId,
        major: filter.major,
        date_from: filter.dateFrom,
        date_to: filter.dateTo,
      }),
    ),
    campuses,
  ]);
  return items
    .map((w) => fromWireTourItem(w, joined))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id);
}

/**
 * T-01 탐방 찾기(2C-R16 · R17). 학교 · 학과(부분 일치) · 희망 날짜(있으면 그날 이후 `date_from`)에 맞는 모집 중 탐방을 찾고,
 * 0건이면 학과 · 날짜를 빼고 같은 학교의 모집 중 탐방을 한 번 더 찾는다(대체). 둘 다 날짜 빠른 순(`listTours`)이다.
 */
export async function findWishTours(
  search: WishSearch,
  campuses: CampusesInput,
): Promise<WishToursResult> {
  const matched = await listTours(
    {
      status: 'RECRUITING',
      universityId: search.universityId,
      major: search.major,
      ...(search.date ? { dateFrom: search.date } : {}),
    },
    campuses,
  );
  if (matched.length > 0) return { tours: matched, fallback: false };
  const sameSchool = await listTours(
    { status: 'RECRUITING', universityId: search.universityId },
    campuses,
  );
  return { tours: sameSchool, fallback: true };
}

/** T-02 `GET /tours/{tourId}`. */
export async function getTour(id: number, campuses: CampusesInput): Promise<TourDetail> {
  const [wire, joined] = await Promise.all([request<WireTourDetail>(`/tours/${id}`), campuses]);
  return fromWireTourDetail(wire, joined);
}
