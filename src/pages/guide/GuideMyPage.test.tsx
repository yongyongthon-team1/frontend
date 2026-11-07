import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { useSession } from '@/features/auth/session';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

/** 하단 탭을 뺀 화면 안의 링크. */
const screenLinks = () =>
  screen
    .getAllByRole('link')
    .filter((a) => !a.closest('nav'))
    .map((a) => [a.getAttribute('href'), a.textContent]);

describe('G12 /guide/me 가이드 MY', () => {
  it('guide: 제목 · 프로필 카드 · 숫자 카드 · 가이드 관리 행 넷 + 로그아웃 행', async () => {
    await renderApp('/guide/me', { as: 'guide' });
    expect(await screen.findByRole('heading', { level: 1, name: 'MY' })).toBeInTheDocument();
    expect(screen.getByText('내 가이드 활동과 프로필을 관리해요.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();

    expect(screen.getByText('정다은 가이드')).toBeInTheDocument();
    expect(await screen.findByText('경희대학교 국제캠퍼스 · 산업디자인학과')).toBeInTheDocument();
    expect(screen.getByText('재학 인증 완료')).toBeInTheDocument();

    // 시드: 정다은의 탐방 1 · 6 · 7 — 개설 3회, 진행 예정(모집 중 · 마감) 2회
    expect(await screen.findByText('3회')).toBeInTheDocument();
    expect(screen.getByText('개설한 탐방')).toBeInTheDocument();
    expect(screen.getByText('2회')).toBeInTheDocument();
    expect(screen.getByText('진행 예정')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: '가이드 관리' })).toBeInTheDocument();
    expect(screenLinks()).toEqual([
      ['/guide/me/profile', '가이드 프로필 수정전공·학교·소개를 관리해요.'],
      ['/guide/wishes', '고교생 희망 사항학생들이 남긴 희망 사항을 보고 탐방을 준비해요.'],
      ['/guide/tours', '내가 개설한 탐방모집 상태와 참가자를 확인해요.'],
      ['/guide/verify', '내 정보·인증 상태계정과 재학 인증 정보를 확인해요.'],
    ]);
    expect(screen.getByRole('button', { name: /^로그아웃/ })).toHaveTextContent(
      '다른 계정으로 UNIRO 사용하기',
    );
    expect(screen.queryByText('알림 및 설정')).not.toBeInTheDocument();
    // 프로필이 있으면 등록 안내가 없다
    expect(screen.queryByText('가이드 프로필을 먼저 등록해 주세요.')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
  });

  it('고교생 희망 사항 행 → /guide/wishes', async () => {
    const { user, router } = await renderApp('/guide/me', { as: 'guide' });
    await user.click(await screen.findByRole('link', { name: /^고교생 희망 사항/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/wishes'));
  });

  it('가이드 프로필 수정 · 내 정보·인증 상태 행의 도착지', async () => {
    const { user, router } = await renderApp('/guide/me', { as: 'guide' });
    await user.click(await screen.findByRole('link', { name: /^가이드 프로필 수정/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me/profile'));
    await router.navigate('/guide/me');
    await user.click(await screen.findByRole('link', { name: /^내 정보·인증 상태/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/verify'));
  });

  it('학과가 없는 계정은 등록 안내 카드와 프로필 등록 링크', async () => {
    const { user, router } = await renderApp('/guide/me', { as: 'guide-pending@demo.kr' });
    expect(await screen.findByText('한도윤 가이드')).toBeInTheDocument();
    expect(await screen.findByText('가이드 프로필을 등록해 주세요')).toBeInTheDocument();
    expect(screen.getByText('재학 인증 심사 중')).toBeInTheDocument();
    expect(screen.getByText('가이드 프로필을 먼저 등록해 주세요.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^프로필 등록하기/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me/profile'));
  });

  it('로그아웃 행 → /login, 토큰 비움', async () => {
    const { user, router } = await renderApp('/guide/me', { as: 'guide' });
    await user.click(await screen.findByRole('button', { name: /^로그아웃/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useSession.getState().token).toBeNull();
  });

  it('탐방 목록을 못 받아도 프로필과 행은 그리고 숫자 자리에 오류와 다시 시도', async () => {
    server.use(http.get('/api/users/me/tours', () => wireFail('E404')));
    await renderApp('/guide/me', { as: 'guide' });
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.getByText('정다은 가이드')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^가이드 프로필 수정/ })).toBeInTheDocument();
  });
});
