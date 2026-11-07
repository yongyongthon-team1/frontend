import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { login } from '@/features/auth/api';
import type { Me } from '@/features/auth/model';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { DEMO_CONSENT_TOKENS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import { testImage } from '@/test/files';
import { wireFail } from '@/test/wire';
import type { EnrollmentSubmit } from './model';
import {
  useConsent,
  useDecideConsent,
  useDemoConsentToken,
  useRequestGuardianConsent,
  useSubmitEnrollment,
} from './queries';

const HS: EnrollmentSubmit = {
  role: 'HIGH_SCHOOL',
  schoolName: '용인고등학교',
  grade: 1,
  document: testImage(),
};
const GUARDIAN = { guardianName: '최보호', guardianEmail: 'parent@example.com' };

/** 계정으로 로그인한 HTTP 클라이언트 + 그 사용자의 `['me']`가 채워진 쿼리 클라이언트. */
async function setup(email: string) {
  const { token, me } = await login({ email, password: 'demo1234' });
  configureHttp({ getToken: () => token });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(qk.me, me);
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const invalidated = (key: readonly unknown[]) =>
    invalidate.mock.calls.some(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(key),
    );
  return { queryClient, wrapper, invalidated };
}

/** 나간 `PATCH /api/users/me` 본문을 모은다. */
function capturePatchMe(): unknown[] {
  const bodies: unknown[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PATCH' && new URL(request.url).pathname === '/api/users/me') {
      void request
        .clone()
        .json()
        .then((body: unknown) => bodies.push(body));
    }
  });
  return bodies;
}

afterEach(() => {
  server.events.removeAllListeners('request:start');
  configureHttp({ getToken: () => null });
});

describe('useSubmitEnrollment (2B′-R8 · D17)', () => {
  it('고교생: 제출 → PATCH /users/me(방금 낸 학교 · 새 학년, 이름 · 관심 학과는 지금 값) → 새 Me가 캐시에', async () => {
    const patches = capturePatchMe();
    const { queryClient, wrapper } = await setup('newbie@demo.kr');
    const { result } = renderHook(() => useSubmitEnrollment(), { wrapper });
    const returned = await act(() => result.current.mutateAsync(HS));

    const me = queryClient.getQueryData<Me>(qk.me)!;
    expect(me.verificationStatus).toBe('PENDING');
    // 목업 시드의 지금 학교는 수원영통고등학교다 — 방금 낸 학교로 남아야 한다.
    expect(me.studentProfile).toMatchObject({ highSchoolName: '용인고등학교', grade: 1 });
    expect(returned).toEqual(me);
    await waitFor(() =>
      expect(patches).toEqual([
        { name: '최하늘', school_name: '용인고등학교', grade: 1, interest_major: null },
      ]),
    );
  });

  it('학교 이름 앞뒤 공백은 뺀다', async () => {
    const patches = capturePatchMe();
    const { wrapper } = await setup('newbie@demo.kr');
    const { result } = renderHook(() => useSubmitEnrollment(), { wrapper });
    await act(() => result.current.mutateAsync({ ...HS, schoolName: '  용인고등학교  ' }));
    await waitFor(() => expect(patches).toMatchObject([{ school_name: '용인고등학교' }]));
  });

  it('첫 쓰기(enrollment)가 실패하면 둘째(PATCH)를 부르지 않는다', async () => {
    const patches = capturePatchMe();
    const { queryClient, wrapper } = await setup('newbie@demo.kr');
    const { result } = renderHook(() => useSubmitEnrollment(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          ...HS,
          document: testImage('x.pdf', { type: 'application/pdf' }),
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        fieldErrors: { document: expect.any(String) },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(patches).toEqual([]);
    expect(queryClient.getQueryData<Me>(qk.me)!.verificationStatus).toBe('NONE');
  });

  it('둘째 쓰기가 실패하면 내 정보를 다시 읽은 뒤(제출은 이미 PENDING) 그 오류를 그대로 낸다', async () => {
    const { queryClient, wrapper } = await setup('newbie@demo.kr');
    server.use(http.patch('/api/users/me', () => wireFail('E500')));
    const { result } = renderHook(() => useSubmitEnrollment(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(HS)).rejects.toMatchObject({ status: 500 });
    });
    expect(queryClient.getQueryData<Me>(qk.me)!.verificationStatus).toBe('PENDING');
  });

  it('대학생: 제출 → 내 정보 다시 읽기, PATCH는 없다', async () => {
    const patches = capturePatchMe();
    const { queryClient, wrapper } = await setup('guide-new@demo.kr');
    const { result } = renderHook(() => useSubmitEnrollment(), { wrapper });
    const returned = await act(() =>
      result.current.mutateAsync({ role: 'UNIVERSITY', universityId: 2, document: testImage() }),
    );
    const me = queryClient.getQueryData<Me>(qk.me)!;
    expect(me).toMatchObject({ verificationStatus: 'PENDING', guideProfile: { universityId: 2 } });
    expect(returned).toEqual(me);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(patches).toEqual([]);
  });

  it('ALREADY_PROCESSED면 내 정보를 무효화한다(다른 오류는 아니다)', async () => {
    const { wrapper, invalidated } = await setup('waiting@demo.kr');
    const { result } = renderHook(() => useSubmitEnrollment(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(HS)).rejects.toMatchObject({
        code: 'ALREADY_PROCESSED',
        backendCode: 'E409_ALREADY_SUBMITTED',
      });
    });
    expect(invalidated(qk.me)).toBe(true);

    const other = await setup('newbie@demo.kr');
    const again = renderHook(() => useSubmitEnrollment(), { wrapper: other.wrapper });
    await act(async () => {
      await expect(
        again.result.current.mutateAsync({ ...HS, schoolName: '' }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });
    expect(other.invalidated(qk.me)).toBe(false);
  });
});

describe('useRequestGuardianConsent', () => {
  it('요청 → 새 Me(동의 대기), 시연 토큰을 다시 읽게 한다', async () => {
    const { queryClient, wrapper, invalidated } = await setup('newbie@demo.kr');
    const { result } = renderHook(() => useRequestGuardianConsent(), { wrapper });
    const returned = await act(() => result.current.mutateAsync(GUARDIAN));
    expect(queryClient.getQueryData<Me>(qk.me)!.guardianStatus).toBe('PENDING');
    expect(returned.guardianStatus).toBe('PENDING');
    expect(invalidated(qk.demoConsentToken)).toBe(true);
  });

  it('대기 중 다시 요청하면 ALREADY_PROCESSED(E409_CONSENT_EXISTS) + 내 정보 무효화', async () => {
    const { wrapper, invalidated } = await setup('waiting@demo.kr');
    const { result } = renderHook(() => useRequestGuardianConsent(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(GUARDIAN)).rejects.toMatchObject({
        code: 'ALREADY_PROCESSED',
        backendCode: 'E409_CONSENT_EXISTS',
      });
    });
    expect(invalidated(qk.me)).toBe(true);
  });
});

describe('useConsent · useDecideConsent', () => {
  it('useConsent: 로그인 없이 안내를 읽는다', async () => {
    configureHttp({ getToken: () => null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useConsent(DEMO_CONSENT_TOKENS.valid), { wrapper });
    await waitFor(() => expect(result.current.data?.studentName).toBe('강하린'));
    expect(queryClient.getQueryData(qk.consent(DEMO_CONSENT_TOKENS.valid))).toBe(
      result.current.data,
    );
  });

  it('성공하면 안내 · 내 정보 · 시연 토큰을 무효화한다', async () => {
    const { wrapper, invalidated } = await setup('waiting@demo.kr');
    const { result } = renderHook(() => useDecideConsent(DEMO_CONSENT_TOKENS.valid), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('AGREED')).resolves.toBe('AGREED');
    });
    expect(invalidated(qk.consent(DEMO_CONSENT_TOKENS.valid))).toBe(true);
    expect(invalidated(qk.me)).toBe(true);
    expect(invalidated(qk.demoConsentToken)).toBe(true);
  });

  it('실패하면 안내만 무효화한다', async () => {
    const { wrapper, invalidated } = await setup('waiting@demo.kr');
    const { result } = renderHook(() => useDecideConsent('bad'), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('AGREED')).rejects.toMatchObject({
        code: 'CONSENT_LINK_INVALID',
      });
    });
    expect(invalidated(qk.consent('bad'))).toBe(true);
    expect(invalidated(qk.me)).toBe(false);
    expect(invalidated(qk.demoConsentToken)).toBe(false);
  });
});

describe('useDemoConsentToken', () => {
  it('enabled가 아니면 읽지 않는다', async () => {
    const { wrapper } = await setup('waiting@demo.kr');
    const { result } = renderHook(() => useDemoConsentToken(false), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('enabled면 동의 대기 계정의 토큰, 아니면 null', async () => {
    const waiting = await setup('waiting@demo.kr');
    const a = renderHook(() => useDemoConsentToken(true), { wrapper: waiting.wrapper });
    await waitFor(() => expect(a.result.current.data).toBe(DEMO_CONSENT_TOKENS.valid));

    const student = await setup('student@demo.kr');
    const b = renderHook(() => useDemoConsentToken(true), { wrapper: student.wrapper });
    await waitFor(() => expect(b.result.current.data).toBeNull());
  });
});
