import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { toGuideTourSummary } from '@/mocks/rules/views';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { renderApp } from '@/test/renderApp';

describe('내가 개설한 탐방 (guide-a02)', () => {
  it('가이드 목록에 탐방 1이 먼저 보인다', async () => {
    await renderApp('/guide/tours', { as: 'guide' });
    expect(
      (await screen.findAllByText('경희대 국제캠퍼스 산업디자인학과 탐방'))[0],
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: '신청자 보기' });
    expect(links[0]).toHaveAttribute('href', '/guide/tours/1/applicants');
  });

  it('진행 중 탐방은 API 순서와 상관없이 시작 시각이 이른 것부터 (판정 35)', async () => {
    const { router } = await renderApp('/guide/tours/new', { as: 'guide' });
    // 탐방 1을 탐방 6(60일 뒤)보다 하루 늦게 옮기고, API는 id 순서(탐방 1이 맨 앞)로 준다.
    mutate((db) => {
      const tour1 = db.tours.find((t) => t.id === 1)!;
      const tour6 = db.tours.find((t) => t.id === 6)!;
      tour1.startsAt = new Date(Date.parse(tour6.startsAt) + 24 * 60 * 60 * 1000).toISOString();
    });
    server.use(
      http.get('/api/guide/tours', () => {
        const db = getDb();
        const guide = db.users.find((u) => u.email === DEMO_EMAILS.guide)!;
        const tours = db.tours.filter((t) => t.guideId === guide.id).sort((a, b) => a.id - b.id);
        return HttpResponse.json(tours.map((t) => toGuideTourSummary(db, t)));
      }),
    );

    await router.navigate('/guide/tours');
    const links = await screen.findAllByRole('link', { name: '신청자 보기' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/guide/tours/6/applicants',
      '/guide/tours/1/applicants',
    ]);
  });
});
