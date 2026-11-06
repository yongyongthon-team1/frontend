import type { QueryKey } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
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
    '경희대 국제캠퍼스 산업디자인학과 탐방',
    '/api/tours/:id',
    () => qk.tour(1),
  ],
  [
    '내 탐방 목록',
    'APPLIED',
    () => '/my-tours',
    '신청 접수 완료 · 가이드 승인 대기 중',
    '/api/me/applications',
    () => qk.myApplications,
  ],
  [
    '내 탐방 상세',
    'CONFIRMED',
    () => `/my-tours/${appId()}`,
    '가이드 승인 상태',
    '/api/me/applications/:id',
    () => qk.myApplication(appId()),
  ],
  [
    '코스 지도 — 신청 재조회',
    'CONFIRMED',
    () => `/my-tours/${appId()}/course`,
    '내 쿠폰 확인하기',
    '/api/me/applications/:id',
    () => qk.myApplication(appId()),
  ],
  [
    '코스 지도 — 코스 재조회',
    'CONFIRMED',
    () => `/my-tours/${appId()}/course`,
    '내 쿠폰 확인하기',
    '/api/tours/:id/course',
    () => qk.course(1),
  ],
];

describe('다시 불러오다 실패해도 받은 데이터는 그대로 보인다 (판정 24)', () => {
  it.each(ROWS)('%s', async (_, checkpoint, path, shown, failingApi, queryKey) => {
    const { router, queryClient } = await renderApp('/my-tours', { as: 'student', checkpoint });
    // 시작 화면(/my-tours)의 조회가 끝난 뒤에 옮겨 간다 — 진행 중인 조회와 겹치면 재시도(1초) 때문에 제한 시간을 넘길 수 있다.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // act 안에서 옮겨 도착 화면까지 그린 뒤 찾는다. 안 그러면 시작 화면에 같은 글(예: 내 탐방 목록의 탐방 제목)이 있을 때
    // 그 요소를 먼저 집었다가 화면이 바뀌면서 문서에서 떨어진다.
    await act(async () => {
      await router.navigate(path());
    });
    try {
      expect(await screen.findByText(shown, {}, { timeout: 3000 })).toBeInTheDocument();
    } catch (error) {
      // 실패 원인이 보이도록 그 시점의 화면을 남긴다.
      screen.debug(undefined, 20000);
      throw error;
    }

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
