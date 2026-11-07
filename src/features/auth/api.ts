import { getMyStore } from '@/features/stores/api';
import { ApiError, recode, request } from '@/shared/lib/http';
import { errorMessage } from '@/shared/lib/errors';
import type {
  GuideProfileInput,
  LoginResponse,
  Me,
  Role,
  SignupInput,
  StudentProfileInput,
} from './model';
import { fromWireMe, type WireLogin, type WireMe, type WireSignupResult } from './wire';

/**
 * 로그인(U-02) 합성: `POST /auth/login` → `GET /users/me`(+ 사장님이면 `GET /users/me/store`를 함께). 로그인 응답의 `user`가
 * 작아서 내 정보를 한 번 더 읽고, 역할은 로그인 응답에 있어서 사장님의 두 호출은 나란히 간다(errata G6). 지금 세션 토큰은 붙이지 않고, 실패 401(자격 증명 오류)이 지금 세션을 만료 처리하지 않는다 —
 * 로그인한 채 다른 계정으로 바꿔 로그인하다 실패해도(시연 역할 전환) 지금 세션이 남는다.
 */
export async function login(input: { email: string; password: string }): Promise<LoginResponse> {
  const { accessToken, user } = await request<WireLogin>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
  return { token: accessToken, me: await fetchMe(accessToken, user.role) };
}

export async function logout(): Promise<void> {
  await request<null>('/auth/logout', { method: 'POST' });
}

/**
 * 내 정보(U-03). `token`을 주면 세션 토큰 대신 그 토큰으로 부르고 401이어도 세션 만료 처리를 하지 않는다(로그인 직후 합성용).
 * 사장님이면 `GET /users/me/store`로 내 가게 id를 얻는다. 역할을 미리 알면(`role`, 로그인 응답) 두 호출을 함께 보내고,
 * 모르면 이 응답의 역할을 본 뒤에 이어서 부른다.
 * `queryFn`에 직접 넣지 않는다 — TanStack이 컨텍스트 객체를 첫 인자로 넘긴다(`() => fetchMe()`).
 */
export async function fetchMe(token?: string, role?: Role): Promise<Me> {
  const meRequest = request<WireMe>(
    '/users/me',
    token === undefined ? {} : { headers: { Authorization: `Bearer ${token}` }, auth: false },
  );
  if (role === 'OWNER') {
    const [wire, store] = await Promise.all([meRequest, getMyStore(token)]);
    return fromWireMe(wire, store?.id ?? null);
  }
  const wire = await meRequest;
  const store = role === undefined && wire.role === 'OWNER' ? await getMyStore(token) : null;
  return fromWireMe(wire, store?.id ?? null);
}

/**
 * 가입(U-01). 로그인 없이 부르고(`auth: false`), 응답에는 토큰이 없어서 성공하면 늘 같은 자격으로 `login()`을 잇는다.
 * 이메일 중복(`E409`)은 `EMAIL_DUPLICATE`로 읽고, 서버가 칸 오류를 안 주면 `fieldErrors.email`을 채운다.
 */
export async function postSignup(input: SignupInput): Promise<LoginResponse> {
  try {
    await request<WireSignupResult>('/auth/signup', {
      method: 'POST',
      body: input,
      auth: false,
      errorMap: { E409: 'EMAIL_DUPLICATE' },
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'EMAIL_DUPLICATE' && !error.fieldErrors) {
      throw recode(error, 'EMAIL_DUPLICATE', {
        fieldErrors: { email: errorMessage('EMAIL_DUPLICATE') },
      });
    }
    throw error;
  }
  return login({ email: input.email, password: input.password });
}

/**
 * 고교생 프로필(이름 포함) 저장(U-03 `PATCH /users/me`). 학교 · 관심 학과는 `null`로 지우고, 학년이 `null`이면(인증 전) `grade` 키를 아예 빼서
 * 실서버가 `grade: null`을 거절하지 않게 한다. 저장 뒤 새 `Me`를 다시 읽는다.
 * 학교 · 관심 학과의 칸 오류는 화면 칸 이름(`highSchoolName` · `interestedMajor`)으로 돌려준다.
 */
export async function patchMe(input: StudentProfileInput): Promise<Me> {
  await request<unknown>('/users/me', {
    method: 'PATCH',
    body: {
      name: input.name,
      schoolName: input.highSchoolName,
      ...(input.grade === null ? {} : { grade: input.grade }),
      interestMajor: input.interestedMajor,
    },
    fieldMap: { school_name: 'highSchoolName', interest_major: 'interestedMajor' },
  });
  return fetchMe();
}

/** 가이드 프로필 저장(U-04 `PUT /users/me/guide-profile`). 학교는 보내지 않는다. 새 `Me`를 다시 읽는다. */
export async function putGuideProfile(input: GuideProfileInput): Promise<Me> {
  await request<unknown>('/users/me/guide-profile', {
    method: 'PUT',
    body: { major: input.major, intro: input.introduction },
    fieldMap: { intro: 'introduction' },
  });
  return fetchMe();
}
