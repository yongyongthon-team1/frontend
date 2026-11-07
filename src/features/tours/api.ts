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
 * `status`를 빼면 백엔드 기본(RECRUITING)이다. `campuses`는 캠퍼스 조인(2C-R9)에 쓴다.
 */
export async function listTours(
  filter: TourFilter,
  campuses: University[],
): Promise<TourSummary[]> {
  const items = await listAll<WireTourItem>(
    withQuery('/tours', {
      status: filter.status,
      campus_id: filter.universityId,
      major: filter.major,
      date_from: filter.dateFrom,
      date_to: filter.dateTo,
    }),
  );
  return items
    .map((w) => fromWireTourItem(w, campuses))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id);
}

/** T-02 `GET /tours/{tourId}`. */
export async function getTour(id: number, campuses: University[]): Promise<TourDetail> {
  return fromWireTourDetail(await request<WireTourDetail>(`/tours/${id}`), campuses);
}
