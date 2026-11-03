import { request } from '@/shared/lib/http';
import type { LoginResponse, Me } from './model';

/**
 * 로그인. 지금 세션 토큰을 붙이지 않고, 실패 401(자격 증명 오류)이 지금 세션을 만료 처리하지 않는다 —
 * 로그인한 채 다른 계정으로 바꿔 로그인하다 실패해도(시연 역할 전환) 지금 세션이 남는다.
 */
export function login(input: { email: string; password: string }): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', { method: 'POST', body: input, auth: false });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<Me> {
  return request<Me>('/me');
}
