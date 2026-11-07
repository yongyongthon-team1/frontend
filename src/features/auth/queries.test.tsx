import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { loginAs } from '@/test/loginAs';
import { MY_STORE } from '@/test/fixtures/backend/stores';
import { wireFail, wireOk } from '@/test/wire';
import { fetchMe } from './api';
import {
  refetchMe,
  useLogin,
  useSaveGuideProfile,
  useSignup,
  useUpdateStudentProfile,
} from './queries';
import { useSession } from './session';

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useSession.setState({ token: null });
});
afterEach(() => configureHttp({ getToken: () => null }));

describe('useLogin', () => {
  it('사장님 로그인이 3단계(GET /users/me/store)에서 실패하면 토큰도 내 정보 캐시도 건드리지 않는다', async () => {
    queryClient.setQueryData(qk.me, { email: 'before@demo.kr' });
    queryClient.setQueryData(qk.myApplications, ['이전 사용자']);
    server.use(http.get('/api/users/me/store', () => wireFail('E500')));
    const clear = vi.spyOn(queryClient, 'clear');
    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ email: 'owner1@demo.kr', password: 'demo1234' })
        .catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 500 }));
    expect(useSession.getState().token).toBeNull();
    expect(queryClient.getQueryData(qk.me)).toEqual({ email: 'before@demo.kr' });
    expect(queryClient.getQueryData(qk.myApplications)).toEqual(['이전 사용자']);
    expect(clear).not.toHaveBeenCalled();
  });
});

describe('사장님 로그인 합성의 병렬성 (errata G6)', () => {
  it('로그인 응답의 역할을 쓰므로 GET /users/me와 GET /users/me/store가 서로 끝나기 전에 함께 시작한다', async () => {
    const events: string[] = [];
    const slow = async (name: string) => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 30));
      events.push(`${name}:end`);
    };
    server.use(
      http.get('/api/users/me', async () => {
        await slow('me');
        return wireOk({
          id: 7,
          email: 'owner1@demo.kr',
          name: '사장님',
          role: 'OWNER',
          verification_status: 'APPROVED',
          reject_reason: null,
          school_name: null,
          grade: null,
          interest_major: null,
          guardian_consent_status: null,
          guide_profile: null,
        });
      }),
      http.get('/api/users/me/store', async () => {
        await slow('store');
        return wireOk(MY_STORE.data);
      }),
    );
    const { result } = renderHook(() => useLogin(), { wrapper });
    await act(() => result.current.mutateAsync({ email: 'owner1@demo.kr', password: 'demo1234' }));
    expect(events.slice(0, 2).sort()).toEqual(['me:start', 'store:start']);
    expect(events.slice(2).sort()).toEqual(['me:end', 'store:end']);
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ role: 'OWNER', storeId: 201 });
  });
});

describe('useSignup', () => {
  it('성공하면 이전 캐시를 비운 다음 토큰 · 내 정보를 넣는다 (useLogin과 같은 순서: clear → setToken → setQueryData)', async () => {
    queryClient.setQueryData(qk.myApplications, ['이전 사용자']);
    const order: string[] = [];
    vi.spyOn(queryClient, 'clear').mockImplementation(() => order.push('clear'));
    const setQueryData = queryClient.setQueryData.bind(queryClient);
    const setQueryDataSpy = vi
      .spyOn(queryClient, 'setQueryData')
      .mockImplementation((...args: Parameters<typeof setQueryData>) => {
        order.push('setQueryData');
        return setQueryData(...args);
      });
    const stop = useSession.subscribe(() => order.push('setToken'));
    const { result } = renderHook(() => useSignup(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        email: 'fresh@demo.kr',
        password: 'demo1234',
        name: '한새봄',
        role: 'UNIVERSITY',
      }),
    );
    stop();

    expect(order).toEqual(['clear', 'setToken', 'setQueryData']);
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      qk.me,
      expect.objectContaining({ email: 'fresh@demo.kr' }),
    );
    expect(useSession.getState().token).not.toBeNull();
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      email: 'fresh@demo.kr',
      role: 'UNIVERSITY',
      guideProfile: { major: null },
    });
  });

  it('실패하면 토큰도 캐시도 건드리지 않고 칸 오류를 낸다', async () => {
    queryClient.setQueryData(qk.myApplications, ['이전 사용자']);
    const { result } = renderHook(() => useSignup(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ email: 'student@demo.kr', password: 'demo1234', name: 'x', role: 'OWNER' })
        .catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatchObject({
      code: 'EMAIL_DUPLICATE',
      fieldErrors: { email: expect.any(String) },
    });
    expect(useSession.getState().token).toBeNull();
    expect(queryClient.getQueryData(qk.myApplications)).toEqual(['이전 사용자']);
  });
});

describe('useUpdateStudentProfile', () => {
  it('새 Me를 내 정보 캐시에 넣는다', async () => {
    loginAs('student@demo.kr');
    const { result } = renderHook(() => useUpdateStudentProfile(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        name: '새이름',
        highSchoolName: null,
        grade: 1,
        interestedMajor: null,
      }),
    );
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      name: '새이름',
      studentProfile: { highSchoolName: null, grade: 1 },
    });
  });
});

describe('patchMe 요청 본문 (최종 리뷰 I1)', () => {
  async function patchBody(grade: 1 | 2 | 3 | null): Promise<Record<string, unknown>> {
    loginAs('newbie@demo.kr');
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch('/api/users/me', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return wireOk(null);
      }),
    );
    const { result } = renderHook(() => useUpdateStudentProfile(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        name: '새이름',
        highSchoolName: null,
        grade,
        interestedMajor: null,
      }),
    );
    expect(body).not.toBeNull();
    return body as unknown as Record<string, unknown>;
  }

  it('학년이 없는 학생(newbie)의 H17 저장은 grade 키를 보내지 않는다', async () => {
    const body = await patchBody(null);
    expect(body).not.toHaveProperty('grade');
    // 학교 · 관심 학과의 null은 "지움"이라 그대로 보낸다.
    expect(body).toMatchObject({ name: '새이름', school_name: null, interest_major: null });
  });

  it('학년이 있으면 그대로 보낸다', async () => {
    expect(await patchBody(2)).toMatchObject({ grade: 2 });
  });
});

describe('useSaveGuideProfile', () => {
  it('새 Me를 넣고 가이드 탐방 · 신청자 · 코스 · 탐방 조회를 무효화한다 (가이드 탐방 상세 키는 건드리지 않는다)', async () => {
    loginAs('guide@demo.kr');
    const keys = {
      guideTours: qk.guideTours,
      applicants: qk.applicants(1),
      guideCourse: qk.guideCourse(1),
      tourList: qk.tours({}),
      tourDetail: qk.tour(1),
      // 별도 뿌리 키(Task 13 `qk.guideTour(id)` = ['guideTour', id])는 `guideTours` 무효화에 걸리지 않아야 한다.
      guideTourDetail: ['guideTour', 1],
      myApplications: qk.myApplications,
    };
    for (const key of Object.values(keys)) queryClient.setQueryData(key, 'cached');
    const { result } = renderHook(() => useSaveGuideProfile(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ major: '컴퓨터공학과', introduction: '안녕하세요.' }),
    );

    const invalidated = (key: readonly unknown[]) =>
      queryClient.getQueryState(key)?.isInvalidated ?? false;
    expect(invalidated(keys.guideTours)).toBe(true);
    expect(invalidated(keys.applicants)).toBe(true);
    expect(invalidated(keys.guideCourse)).toBe(true);
    expect(invalidated(keys.tourList)).toBe(true);
    expect(invalidated(keys.tourDetail)).toBe(true);
    expect(invalidated(keys.guideTourDetail)).toBe(false);
    expect(invalidated(keys.myApplications)).toBe(false);
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      guideProfile: { major: '컴퓨터공학과', introduction: '안녕하세요.' },
    });
  });
});

describe('refetchMe', () => {
  it('캐시가 신선해도 서버에서 다시 받아 내 정보를 갱신한다', async () => {
    loginAs('student@demo.kr');
    await queryClient.fetchQuery({
      queryKey: qk.me,
      queryFn: () => fetchMe(),
      staleTime: 60_000,
    });
    mutate((db) => {
      db.users.find((u) => u.email === 'student@demo.kr')!.name = '바뀐 이름';
    });
    // 그냥 fetchQuery는 신선한 캐시를 돌려준다 — refetchMe는 건너뛴다.
    const me = await refetchMe(queryClient);
    expect(me.name).toBe('바뀐 이름');
    expect(queryClient.getQueryData(qk.me)).toEqual(me);
    expect(getDb().users.find((u) => u.email === 'student@demo.kr')!.name).toBe('바뀐 이름');
  });
});
