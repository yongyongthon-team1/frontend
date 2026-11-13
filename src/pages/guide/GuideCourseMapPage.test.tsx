import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

const TITLE = '확정 코스 지도 보기';

describe('가이드 확정 코스 보기 (/guide/tours/:tourId/course)', () => {
  it('확정 코스: 단계 막대 · 시간표 3장 · 캡션, 지도는 닫혀 있고 하단 버튼은 신청자 관리', async () => {
    await renderApp('/guide/tours/1/course', { as: 'guide', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    expect(await screen.findByText('우리의 2시간 30분 코스')).toBeInTheDocument();
    expect(screen.getByText('3개 장소')).toBeInTheDocument();
    expect(screen.getByText('3개 장소 · 일정을 위아래로 스크롤해 확인하세요')).toBeInTheDocument();

    const steps = screen.getByTestId('course-step-bar');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    const timeline = screen.getByTestId('course-timeline');
    expect(within(timeline).getAllByRole('button')).toHaveLength(3);

    expect(screen.getByRole('button', { name: '지도로 보기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByTestId('schematic-map')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '신청자 관리로 이동' })).toHaveAttribute(
      'href',
      '/guide/tours/1/applicants',
    );
    // 쿠폰은 학생 몫 — 가이드 화면에는 쿠폰 확인 링크가 없다.
    expect(screen.queryByRole('link', { name: '내 쿠폰 확인하기' })).not.toBeInTheDocument();
  });

  it('지도로 보기를 펼치면 도식 지도 핀 3개, 접으면 사라진다', async () => {
    const { user } = await renderApp('/guide/tours/1/course', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    const toggle = await screen.findByRole('button', { name: '지도로 보기' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const map = await screen.findByTestId('schematic-map');
    expect(within(map).getAllByRole('button')).toHaveLength(3);
    await user.click(toggle);
    expect(screen.queryByTestId('schematic-map')).not.toBeInTheDocument();
  });

  it('카드를 누르면 상점 시트: 제휴 혜택은 있고 쿠폰 보기는 없고, 최근 리뷰 3개 (R-02)', async () => {
    const { user } = await renderApp('/guide/tours/1/course', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    await user.click(await screen.findByRole('button', { name: /렌토/ }));
    const sheet = await screen.findByRole('dialog', { name: '렌토' });
    expect(within(sheet).getByText('제휴 혜택 · 식사 금액 10% 할인')).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: '쿠폰 보기' })).not.toBeInTheDocument();
    expect(within(sheet).getByText('별점 4.6 · 리뷰 5개')).toBeInTheDocument();
    const toggle = await within(sheet).findByRole('button', { name: '최근 리뷰 3개' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(
      within(sheet).getByText('시험 기간엔 사람이 많지만 음식은 빨리 나와요.'),
    ).toBeInTheDocument();
  });

  it('하단 탭은 `코스 편집`이 활성', async () => {
    await renderApp('/guide/tours/1/course', { as: 'guide', checkpoint: 'CONFIRMED' });
    await screen.findByText('우리의 2시간 30분 코스');
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: '코스 편집' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: '내 투어' })).not.toHaveAttribute('aria-current');
  });

  it('코스가 없으면 신청자 관리로 replace', async () => {
    const { router } = await renderApp('/guide/tours/1/course', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/applicants'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('초안 코스면 코스 편집으로 replace', async () => {
    const { router } = await renderApp('/guide/tours/1/course/draft?generate=1', {
      as: 'guide',
      checkpoint: 'APPROVED',
    });
    await screen.findByRole('heading', { name: '코스를 완성해 볼까요?' });
    await router.navigate('/guide/tours/1/course');
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours/1/course/edit'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('뒤로는 이전 화면이고, 주소로 바로 열었으면 신청자 관리다', async () => {
    const direct = await renderApp('/guide/tours/1/course', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    await screen.findByText('우리의 2시간 30분 코스');
    await direct.user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    await waitFor(() =>
      expect(direct.router.state.location.pathname).toBe('/guide/tours/1/applicants'),
    );
  });

  it('확정 점검 화면에서 들어왔으면 뒤로는 그 화면으로 돌아간다', async () => {
    const { user, router } = await renderApp('/guide/tours/1/course/confirm', {
      as: 'guide',
      checkpoint: 'CONFIRMED',
    });
    await user.click(await screen.findByRole('link', { name: '확정 코스 지도 보기' }));
    await screen.findByText('우리의 2시간 30분 코스');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/guide/tours/1/course/confirm'),
    );
  });
});
