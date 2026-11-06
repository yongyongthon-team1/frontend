import { request } from '@/shared/lib/http';
import type {
  GuideProfileInput,
  LoginResponse,
  Me,
  SignupInput,
  StudentProfileInput,
} from './model';

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

/**
 * 가입(#1). 로그인 없이 부르고(`auth: false`), 성공하면 바로 로그인된 응답(토큰 + Me)을 받는다.
 * 서버가 토큰 없이 가입만 끝냈다면 같은 자격으로 `login()`을 잇는다.
 */
export async function postSignup(input: SignupInput): Promise<LoginResponse> {
  const created = await request<Partial<LoginResponse> | null>('/auth/signup', {
    method: 'POST',
    body: input,
    auth: false,
  });
  if (created?.token && created.me) return { token: created.token, me: created.me };
  return login({ email: input.email, password: input.password });
}

/** 고교생 프로필 저장(#2). PUT이라 네 키를 모두 보내고, 새 `Me`를 받는다. */
export function putStudentProfile(input: StudentProfileInput): Promise<Me> {
  return request<Me>('/me/student-profile', { method: 'PUT', body: input });
}

/** 가이드 프로필 저장(#3). 학교는 보내지 않는다. 새 `Me`를 받는다. */
export function putGuideProfile(input: GuideProfileInput): Promise<Me> {
  return request<Me>('/me/guide-profile', { method: 'PUT', body: input });
}
