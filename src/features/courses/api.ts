import { AI_TIMEOUT_MS, ApiError, request } from '@/shared/lib/http';
import type { Course } from './model';

// 학생의 확정 코스(C-04)와 가이드의 코스 초안 · 편집 · 확정. 목업 규칙 함수와 이름이 겹치지 않게 HTTP 동사를
// 앞에 붙인다. 코스를 바꾸는 API는 모두 바뀐 뒤의 전체 `Course`를 돌려준다.

/** 확정 코스. 승인된 신청자(또는 그 가이드)가 아니면 403 FORBIDDEN, 코스가 없거나 초안이면 404 COURSE_NOT_READY. */
export function getCourse(tourId: number): Promise<Course> {
  return request<Course>(`/tours/${tourId}/course`);
}

/** 가이드 본인 탐방의 코스. 아직 코스가 없으면(404) null이다. */
export async function getGuideCourse(tourId: number): Promise<Course | null> {
  try {
    return await request<Course>(`/guide/tours/${tourId}/course`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** AI 코스 초안(AI라 시간 제한이 길다). */
export function postCourseDraft(tourId: number): Promise<Course> {
  return request<Course>(`/guide/tours/${tourId}/course/draft`, {
    method: 'POST',
    timeoutMs: AI_TIMEOUT_MS,
  });
}

export function putStopOrder(tourId: number, stopIds: number[]): Promise<Course> {
  return request<Course>(`/guide/tours/${tourId}/course/order`, {
    method: 'PUT',
    body: { stopIds },
  });
}

export function patchStop(tourId: number, stopId: number, description: string): Promise<Course> {
  return request<Course>(`/guide/tours/${tourId}/course/stops/${stopId}`, {
    method: 'PATCH',
    body: { description },
  });
}

export function deleteCourseStop(tourId: number, stopId: number): Promise<Course> {
  return request<Course>(`/guide/tours/${tourId}/course/stops/${stopId}`, { method: 'DELETE' });
}

export function postConfirmCourse(tourId: number): Promise<Course> {
  return request<Course>(`/guide/tours/${tourId}/course/confirm`, { method: 'POST' });
}
