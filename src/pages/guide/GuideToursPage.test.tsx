import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { toWireGuideTourRow } from '@/mocks/wire/applications';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { renderApp } from '@/test/renderApp';
import { wirePage } from '@/test/wire';

const cardOf = async (title: string | RegExp, index = 0) =>
  (await screen.findAllByRole('heading', { name: title }))[index]!.closest('article')!;

/** `renderApp`은 목업 DB를 새로 만들므로, DB를 고친 뒤에 목적지로 이동해 그 값으로 그린다. */
async function renderPatched(
  path: string,
  opts: Parameters<typeof renderApp>[1],
  patch: Parameters<typeof mutate>[0],
) {
  const app = await renderApp('/explore', opts);
  mutate(patch);
  await app.router.navigate(path);
  return app;
}

describe('내가 개설한 탐방 (G06 · guide-a02)', () => {
  it('제목 · 탭 · 진행 예정 카드(칩 · 날짜 · 승인 수 · 신청자 관리하기 · 탐방 취소)', async () => {
    await renderApp('/guide/tours', { as: 'guide' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '내가 개설한 탐방' }),
    ).toBeVisible();
    expect(screen.getByText('모집 상태와 참가자를 한곳에서 관리해요.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '진행 예정' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    const first = await cardOf('경희대 국제캠퍼스 산업디자인학과 탐방', 0);
    expect(within(first).getByText('신청 접수 중')).toBeInTheDocument();
    expect(
      within(first).getByText(/^\d{2}\.\d{2} \([월화수목금토일]\) · 2\/5명 승인$/),
    ).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: '신청자 관리하기' })).toHaveAttribute(
      'href',
      '/guide/tours/1/applicants',
    );
    expect(within(first).getByRole('link', { name: '탐방 취소' })).toHaveAttribute(
      'href',
      '/guide/tours/1/cancel',
    );
    expect(within(first).getByRole('link', { name: '탐방 완료' })).toHaveAttribute(
      'href',
      '/guide/tours/1/complete',
    );
    // 새 탐방 개설하기 카드
    expect(screen.getByRole('link', { name: /새 탐방 개설하기/ })).toHaveAttribute(
      'href',
      '/guide/tours/new',
    );
    expect(screen.getByText('학생들과 나누고 싶은 하루를 등록해요.')).toBeInTheDocument();
  });

  it('탭 패널이 선택된 탭과 이어진다', async () => {
    await renderApp('/guide/tours', { as: 'guide' });
    const tab = await screen.findByRole('tab', { name: '진행 예정' });
    expect(tab).toHaveAttribute(
      'aria-controls',
      screen.getByRole('tabpanel', { name: '진행 예정' }).id,
    );
  });

  it('코스가 확정되면 칩이 `코스 확정`, 버튼이 `코스 확인하기`(→ 확정 점검)', async () => {
    await renderApp('/guide/tours', { as: 'guide', checkpoint: 'CONFIRMED' });
    await screen.findByRole('heading', { name: '내가 개설한 탐방' });
    const card = await cardOf('경희대 국제캠퍼스 산업디자인학과 탐방', 0);
    expect(within(card).getByText('코스 확정')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '코스 확인하기' })).toHaveAttribute(
      'href',
      '/guide/tours/1/course/confirm',
    );
    expect(within(card).queryByRole('link', { name: '신청자 관리하기' })).not.toBeInTheDocument();
  });

  it('마감된 탐방의 칩은 `모집 마감`', async () => {
    await renderPatched('/guide/tours', { as: 'guide' }, (db) => {
      db.tours.find((t) => t.id === 6)!.status = 'CLOSED';
    });
    expect(await screen.findByText('모집 마감')).toBeInTheDocument();
  });

  it('진행 중 탐방은 API 순서와 상관없이 시작 시각이 이른 것부터 (판정 35)', async () => {
    const { router } = await renderApp('/explore', { as: 'guide' });
    // 탐방 1을 탐방 6(60일 뒤)보다 하루 늦게 옮기고, API는 id 순서(탐방 1이 맨 앞)로 준다.
    mutate((db) => {
      const tour1 = db.tours.find((t) => t.id === 1)!;
      const tour6 = db.tours.find((t) => t.id === 6)!;
      tour1.startsAt = new Date(Date.parse(tour6.startsAt) + 24 * 60 * 60 * 1000).toISOString();
    });
    server.use(
      http.get('/api/users/me/tours', () => {
        const db = getDb();
        const guide = db.users.find((u) => u.email === DEMO_EMAILS.guide)!;
        const tours = db.tours.filter((t) => t.guideId === guide.id).sort((a, b) => a.id - b.id);
        return wirePage(tours.map((t) => toWireGuideTourRow(db, t)));
      }),
    );

    await router.navigate('/guide/tours');
    const links = await screen.findAllByRole('link', { name: '신청자 관리하기' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/guide/tours/6/applicants',
      '/guide/tours/1/applicants',
    ]);
  });

  it('진행 예정 탐방이 없고 지난 탐방만 있으면 `진행 예정인 탐방이 없어요.`', async () => {
    await renderPatched('/guide/tours', { as: 'guide' }, (db) => {
      for (const t of db.tours) {
        if (t.status === 'RECRUITING' || t.status === 'CLOSED') t.status = 'COMPLETED';
      }
    });
    expect(await screen.findByText('진행 예정인 탐방이 없어요.')).toBeInTheDocument();
    expect(screen.queryByText('아직 개설한 탐방이 없어요.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '새 탐방 개설하기' })).toHaveAttribute(
      'href',
      '/guide/tours/new',
    );
  });

  it('개설한 탐방이 하나도 없으면 `아직 개설한 탐방이 없어요.`', async () => {
    await renderPatched('/guide/tours', { as: 'guide' }, (db) => {
      db.tours.length = 0;
    });
    expect(await screen.findByText('아직 개설한 탐방이 없어요.')).toBeInTheDocument();
    expect(screen.queryByText('진행 예정인 탐방이 없어요.')).not.toBeInTheDocument();
  });

  describe('지난 탐방 탭', () => {
    it('?tab=past: 끝난 · 취소된 탐방만, 탐방 취소 링크 없음, 확정 코스가 없으면 버튼 없음', async () => {
      const { user, router } = await renderApp('/guide/tours', { as: 'guide' });
      await screen.findByRole('heading', { name: '내가 개설한 탐방' });
      await user.click(screen.getByRole('tab', { name: '지난 탐방' }));
      expect(router.state.location.search).toBe('?tab=past');
      expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const panel = screen.getByRole('tabpanel', { name: '지난 탐방' });
      expect(within(panel).getAllByRole('article')).toHaveLength(1); // 탐방 7(완료)
      expect(within(panel).getByText('완료')).toBeInTheDocument();
      expect(within(panel).queryByRole('link', { name: '탐방 취소' })).not.toBeInTheDocument();
      expect(within(panel).queryByRole('link', { name: '탐방 완료' })).not.toBeInTheDocument();
      expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /새 탐방 개설하기/ })).not.toBeInTheDocument();
    });

    it('주소로 바로 들어와도 지난 탐방 탭이고, 지난 탐방이 없으면 빈 상태', async () => {
      await renderPatched('/guide/tours?tab=past', { as: 'guide' }, (db) => {
        db.tours.find((t) => t.id === 7)!.status = 'RECRUITING';
      });
      expect(await screen.findByText('아직 지난 탐방이 없어요.')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('끝난 탐방에 확정 코스가 있으면 코스 확인하기가 있다', async () => {
      await renderPatched('/guide/tours?tab=past', { as: 'guide' }, (db) => {
        db.courses.push({
          tourId: 7,
          status: 'CONFIRMED',
          createdAt: '2026-10-01T10:00:00+09:00',
          updatedAt: '2026-10-01T10:00:00+09:00',
          confirmedAt: '2026-10-01T10:00:00+09:00',
          interests: [],
        });
      });
      const panel = await screen.findByRole('tabpanel', { name: '지난 탐방' });
      expect(await within(panel).findByRole('link', { name: '코스 확인하기' })).toHaveAttribute(
        'href',
        '/guide/tours/7/course/confirm',
      );
      expect(within(panel).getByText('완료')).toBeInTheDocument();
    });
  });
});
