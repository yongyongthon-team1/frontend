import { request } from '@/shared/lib/http';
import type { ApplicantsBoard, GuideTourSummary, MyApplication } from './model';

// 신청(고교생)과 신청자 관리(가이드). 목업 규칙 함수와 이름이 겹치지 않게 HTTP 동사를 앞에 붙인다.

export function postApplication(tourId: number, motivation: string): Promise<MyApplication> {
  return request<MyApplication>(`/tours/${tourId}/applications`, {
    method: 'POST',
    body: { motivation },
  });
}

export function getMyApplications(): Promise<MyApplication[]> {
  return request<MyApplication[]>('/me/applications');
}

export function getMyApplication(id: number): Promise<MyApplication> {
  return request<MyApplication>(`/me/applications/${id}`);
}

export function postCancelApplication(id: number): Promise<MyApplication> {
  return request<MyApplication>(`/me/applications/${id}/cancel`, { method: 'POST' });
}

export function getGuideTours(): Promise<GuideTourSummary[]> {
  return request<GuideTourSummary[]>('/guide/tours');
}

export function getApplicantsBoard(tourId: number): Promise<ApplicantsBoard> {
  return request<ApplicantsBoard>(`/guide/tours/${tourId}/applicants`);
}

/** 승인 · 거절은 바뀐 뒤의 신청자 보드 전체를 돌려준다. */
export function postApprove(id: number): Promise<ApplicantsBoard> {
  return request<ApplicantsBoard>(`/guide/applications/${id}/approve`, { method: 'POST' });
}

export function postReject(id: number): Promise<ApplicantsBoard> {
  return request<ApplicantsBoard>(`/guide/applications/${id}/reject`, { method: 'POST' });
}
