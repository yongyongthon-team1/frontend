import type { University } from '@/features/campuses/model';
import { AI_TIMEOUT_MS, listAll, request, withQuery } from '@/shared/lib/http';
import type {
  RecommendationQuery,
  RecommendationResult,
  TourDetail,
  TourFilter,
  TourSummary,
} from './model';
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

/** 관심사 문장으로 모집 중 탐방을 추천받는다(AI라 시간 제한이 길다). */
export function recommend(q: RecommendationQuery): Promise<RecommendationResult> {
  return request<RecommendationResult>('/recommendations', {
    method: 'POST',
    body: q,
    timeoutMs: AI_TIMEOUT_MS,
  });
}

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

/** T-02 `GET /tours/{tourId}`. */
export async function getTour(id: number, campuses: CampusesInput): Promise<TourDetail> {
  const [wire, joined] = await Promise.all([request<WireTourDetail>(`/tours/${id}`), campuses]);
  return fromWireTourDetail(wire, joined);
}
