import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { renderApp } from '@/test/renderApp';

/** `renderApp`은 목업 DB를 새로 만들므로, DB를 고친 뒤에 목적지로 이동해 그 값으로 그린다. */
async function renderPatched(
  path: string,
  opts: Parameters<typeof renderApp>[1],
  patch: Parameters<typeof mutate>[0],
) {
  const app = await renderApp('/guide/tours/new', opts);
  mutate(patch);
  await app.router.navigate(path);
  return app;
}

describe('가이드 홈 (G01 · G11)', () => {
  it('APPLIED: 진행 예정 탐방 카드 · 승인 수 · 남은 자리 · 오늘 해야 할 일', async () => {
    await renderApp('/guide', { as: 'guide', checkpoint: 'APPLIED' });
    // 진행 예정 탐방이 둘(탐방 1 · 6)이라 `하나의`가 `2개의`가 된다.
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /이번 주, 2개의 탐방을\s*준비하고 있어요\./,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('학생들에게 특별한 대학 생활을 보여주세요.')).toBeInTheDocument();
    expect(
      screen.getByText(/^\d+월 \d+일 [월화수목금토일]요일 · 오[전후] \d+시( \d+분)?$/),
    ).toBeInTheDocument();
    expect(screen.getByText('2명').parentElement).toHaveTextContent('2명 승인했어요');
    expect(screen.getByText('3자리').parentElement).toHaveTextContent('3자리 남았어요');
    expect(screen.getByRole('heading', { name: '오늘 해야 할 일' })).toBeInTheDocument();
    expect(screen.getByText('대기 중인 신청자 2명 확인')).toBeInTheDocument();
    expect(screen.getByText('학생들의 관심사를 확인하고 승인해요.')).toBeInTheDocument();
    const toApplicants = screen.getAllByRole('link', { name: '신청자 확인하기' });
    expect(toApplicants[0]).toHaveAttribute('href', '/guide/tours/1/applicants');
    expect(screen.getByRole('link', { name: '코스 초안 만들기' })).toHaveAttribute(
      'href',
      '/guide/tours/1/course/draft?generate=1',
    );
  });

  it('진행 예정 탐방이 하나면 `하나의`', async () => {
    await renderPatched('/guide', { as: 'guide' }, (db) => {
      db.tours.find((t) => t.id === 6)!.status = 'CANCELED';
    });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /이번 주, 하나의 탐방을\s*준비하고 있어요\./,
      }),
    ).toBeInTheDocument();
  });

  it('CONFIRMED: 할 일이 확정 코스 보기로 바뀐다', async () => {
    await renderApp('/guide', { as: 'guide', checkpoint: 'CONFIRMED' });
    const link = await screen.findByRole('link', { name: '확정 코스 보기' });
    expect(link).toHaveAttribute('href', '/guide/tours/1/course/confirm');
  });

  it('맨 아래 `내가 개설한 탐방` 링크는 개설한 탐방 목록으로 간다 (›는 이름에 들지 않는다)', async () => {
    await renderApp('/guide', { as: 'guide' });
    const link = await screen.findByRole('link', { name: '내가 개설한 탐방' });
    expect(link).toHaveAttribute('href', '/guide/tours');
  });

  it('신청이 없으면 G11: 신청자 없음 안내 · 탐방 카드 · 탐방 상세 보기', async () => {
    // 탐방 1을 끝난 탐방으로 돌리면 가장 이른 진행 예정 탐방은 신청이 없는 탐방 6이다.
    await renderPatched('/guide', { as: 'guide' }, (db) => {
      db.tours.find((t) => t.id === 1)!.status = 'COMPLETED';
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: '아직 신청자가 없어요.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('학생들이 찾기 쉽도록 탐방 소개를 점검해 봐요.')).toBeInTheDocument();
    expect(screen.getByText('첫 신청을 기다리는 중')).toBeInTheDocument();
    expect(screen.getByText('모집 중인 탐방이 학생의 추천 화면에 노출돼요.')).toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}\.\d{2} \([월화수목금토일]\) · 정원 5명$/)).toBeInTheDocument();
    expect(
      screen.getByText('승인된 신청자가 1명 이상이면 코스 초안 생성을 진행할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '탐방 상세 보기' })).toHaveAttribute(
      'href',
      '/tours/6',
    );
    expect(screen.queryByRole('link', { name: '신청자 확인하기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toBeInTheDocument();
  });

  it('G11: 포커스 탐방이 마감이면 칩이 `모집 마감`', async () => {
    await renderPatched('/guide', { as: 'guide' }, (db) => {
      db.tours.find((t) => t.id === 1)!.status = 'COMPLETED';
      db.tours.find((t) => t.id === 6)!.status = 'CLOSED';
    });
    await screen.findByRole('heading', { level: 1, name: '아직 신청자가 없어요.' });
    expect(screen.getByText('모집 마감')).toBeInTheDocument();
    expect(screen.queryByText('모집 중')).not.toBeInTheDocument();
  });

  it('진행 예정 탐방이 없으면 빈 상태 + 새 탐방 개설하기', async () => {
    await renderPatched('/guide', { as: 'guide' }, (db) => {
      for (const t of db.tours) {
        if (t.status === 'RECRUITING' || t.status === 'CLOSED') t.status = 'COMPLETED';
      }
    });
    const empty = (await screen.findByText('아직 개설한 탐방이 없어요.')).parentElement!;
    expect(within(empty).getByRole('link', { name: '새 탐방 개설하기' })).toHaveAttribute(
      'href',
      '/guide/tours/new',
    );
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toBeInTheDocument();
  });
});
