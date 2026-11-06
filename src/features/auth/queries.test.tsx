import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, mutate } from '@/mocks/db/store';
import { qk } from '@/shared/api/queryKeys';
import { configureHttp } from '@/shared/lib/http';
import { loginAs } from '@/test/loginAs';
import { fetchMe } from './api';
import { refetchMe, useSaveGuideProfile, useSignup, useUpdateStudentProfile } from './queries';
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

describe('useSignup', () => {
  it('성공하면 이전 캐시를 비운 다음 토큰 · 내 정보를 넣는다 (useLogin과 같은 순서)', async () => {
    queryClient.setQueryData(qk.myApplications, ['이전 사용자']);
    const order: string[] = [];
    vi.spyOn(queryClient, 'clear').mockImplementation(() => order.push('clear'));
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

    expect(order).toEqual(['clear', 'setToken']);
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

describe('useSaveGuideProfile', () => {
  it('새 Me를 넣고 가이드 탐방 · 신청자 · 코스 · 탐방 조회를 무효화한다 (추천 · 가이드 탐방 상세 키는 건드리지 않는다)', async () => {
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

    await act(() => result.current.mutateAsync({ major: '컴퓨터공학과', introduction: null }));

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
      guideProfile: { major: '컴퓨터공학과', introduction: null },
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
