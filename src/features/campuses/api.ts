import { request } from '@/shared/lib/http';
import type { Insight, University } from './model';

export function listUniversities(): Promise<University[]> {
  return request<University[]>('/universities');
}

export function getInsight(universityId: number): Promise<Insight> {
  return request<Insight>(`/universities/${universityId}/insight`);
}
