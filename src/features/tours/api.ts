import { AI_TIMEOUT_MS, request } from '@/shared/lib/http';
import type {
  RecommendationQuery,
  RecommendationResult,
  TourDetail,
  TourStatus,
  TourSummary,
} from './model';

/** 관심사 문장으로 모집 중 탐방을 추천받는다(AI라 시간 제한이 길다). */
export function recommend(q: RecommendationQuery): Promise<RecommendationResult> {
  return request<RecommendationResult>('/recommendations', {
    method: 'POST',
    body: q,
    timeoutMs: AI_TIMEOUT_MS,
  });
}

export function listTours(filter: {
  status?: TourStatus;
  universityId?: number;
}): Promise<TourSummary[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.universityId !== undefined) params.set('universityId', String(filter.universityId));
  const query = params.toString();
  return request<TourSummary[]>(query ? `/tours?${query}` : '/tours');
}

export function getTour(id: number): Promise<TourDetail> {
  return request<TourDetail>(`/tours/${id}`);
}
