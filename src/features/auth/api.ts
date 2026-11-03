import { request } from '@/shared/lib/http';
import type { LoginResponse, Me } from './model';

export function login(input: { email: string; password: string }): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', { method: 'POST', body: input });
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<Me> {
  return request<Me>('/me');
}
