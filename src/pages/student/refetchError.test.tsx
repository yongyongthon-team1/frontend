import type { QueryKey } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { SeedCheckpoint } from '@/mocks/db/seed';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { findApplicationId, renderApp } from '@/test/renderApp';

// 판정 24: 창 포커스 · 30초 뒤 재조회가 실패해도 이미 받은 데이터는 그대로 보인다. ErrorState는 데이터가 없을 때만이다.
// 골든 패스 학생 화면마다 데이터를 받은 뒤 그 쿼리의 재조회를 4xx로 실패시킨다.

/** 김민지의 탐방 1 신청 id(체크포인트를 시드한 뒤에 부른다). */
const appId = () => findApplicationId(DEMO_EMAILS.student, 1);

const ROWS: Array<
  [
    screenName: string,
    checkpoint: SeedCheckpoint,
    path: () => string,
    shown: string,
    failingApi: string,
    queryKey: () => QueryKey,
  ]
> = [
  ['탐방 상세', 'START', () => '/tours/1', '이런 경험을 해요', '/api/tours/:id', () => qk.tour(1)],
  [
    '탐방 신청서',
    'START',
    () => '/tours/1/apply',
    '탐방에서 하고 싶은 것',
    '/api/tours/:id',
    () => qk.tour(1),
  ],
  [
    '신청 완료',
    'APPLIED',
    () => '/tours/1/apply/done',
    '승인 대기 중',
    '/api/tours/:id',
    () => qk.tour(1),
  ],
  [
    '내 탐방 목록',
    'APPLIED',
    () => '/my-tours',
    '신청 · 가이드 승인 대기',
    '/api/me/applications',
    () => qk.myApplications,
  ],
  [
    '내 탐방 상세',
    'CONFIRMED',
    () => `/my-tours/${appId()}`,
    '✓ 신청 승인 완료',
    '/api/me/applications/:id',
    () => qk.myApplication(appId()),
  ],
  [
    '코스 지도 — 신청 재조회',
    'CONFIRMED',
    () => `/my-tours/${appId()}/course`,
    '제휴 상점 쿠폰 확인',
    '/api/me/applications/:id',
    () => qk.myApplication(appId()),
  ],
  [
    '코스 지도 — 코스 재조회',
    'CONFIRMED',
    () => `/my-tours/${appId()}/course`,
    '제휴 상점 쿠폰 확인',
    '/api/tours/:id/course',
    () => qk.course(1),
  ],
];

describe('다시 불러오다 실패해도 받은 데이터는 그대로 보인다 (판정 24)', () => {
  it.each(ROWS)('%s', async (_, checkpoint, path, shown, failingApi, queryKey) => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student', checkpoint });
    await router.navigate(path());
    expect(await screen.findByText(shown)).toBeInTheDocument();

    server.use(
      http.get(failingApi, () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    // 쿼리 관찰자는 상태 변화를 한 틱 뒤에 화면에 알린다 — act 안에서 그 틱까지 기다린 뒤 확인한다.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: queryKey() });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(queryClient.getQueryState(queryKey())?.status).toBe('error');
    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
