import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { qk } from '@/shared/api/queryKeys';
import type { GuideTourSummary } from '@/features/applications/model';
import { mutate } from '@/mocks/db/store';
import { renderApp } from '@/test/renderApp';

describe('코스 편집 탭 → GuideCourseRedirect', () => {
  it('승인 2명 · 코스 없음 → 코스 초안 생성 화면', async () => {
    const { router } = await renderApp('/guide/course', { as: 'guide', checkpoint: 'APPROVED' });
    await waitFor(() =>
      expect(router.state.location.pathname + router.state.location.search).toBe(
        '/guide/tours/1/course/draft?generate=1',
      ),
    );
  });

  it('코스 확정 → 확정 점검 화면', async () => {
    const { router } = await renderApp('/guide/course', { as: 'guide', checkpoint: 'CONFIRMED' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm'),
    );
  });

  it('승인 0명 → 신청자 보기', async () => {
    const { router } = await renderApp('/guide/me', { as: 'guide' });
    mutate((db) => {
      db.applications.forEach((a) => {
        if (a.status === 'APPROVED') a.status = 'PENDING';
      });
    });
    await act(() => router.navigate('/guide/course'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/applicants'));
  });

  it('replace로 이동한다(뒤로 가기가 리다이렉트로 돌아오지 않는다)', async () => {
    const { router } = await renderApp('/guide/course', { as: 'guide', checkpoint: 'CONFIRMED' });
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/guide/course'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('다가오는 탐방이 없으면 /guide/tours', async () => {
    const { router } = await renderApp('/guide/me', { as: 'guide' });
    mutate((db) => {
      db.tours.forEach((t) => (t.status = 'COMPLETED'));
    });
    await act(() => router.navigate('/guide/course'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
  });

  it('캐시에 옛 목록이 신선하게 남아 있어도 새로 받은 목록으로 이동한다', async () => {
    const { router, queryClient } = await renderApp('/guide/me', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    // 승인 0명 · 코스 없음 시절의 옛 목록이 캐시에 있다(staleTime 안이라 그냥 쓰면 /applicants로 간다).
    queryClient.setQueryData<GuideTourSummary[]>(qk.guideTours, [
      {
        id: 1,
        title: '옛 목록',
        universityId: 1,
        universityName: '경희대학교',
        universityShortName: '경희대',
        campusName: '국제캠퍼스',
        major: null,
        guideName: '가이드',
        guideVerified: true,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        endsAt: null,
        capacity: 5,
        approvedCount: 0,
        remainingSeats: 5,
        status: 'RECRUITING',
        counts: { total: 0, pending: 0, approved: 0 },
        courseStatus: null,
      },
    ]);
    await act(() => router.navigate('/guide/course'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm'),
    );
    expect(router.state.location.pathname).not.toBe('/guide/tours/1/applicants');
  });
});
