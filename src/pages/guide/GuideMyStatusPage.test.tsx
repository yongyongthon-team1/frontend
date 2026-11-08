import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

// C07 내 정보 · 인증 상태 — 가이드 `/guide/me/status`(보호자 줄 없음).

describe('C07 내 정보 · 인증 상태 (/guide/me/status)', () => {
  it('guide: 프로필 카드(학교 · 학과) · 학생증 인증 줄 하나 · 정보 수정하기, 보호자 줄 · 설정 행 없음, MY 탭 활성', async () => {
    await renderApp('/guide/me/status', { as: 'guide' });
    expect(await screen.findByRole('heading', { level: 1, name: '내 정보' })).toBeInTheDocument();
    expect(screen.getByText('대학생 가이드')).toBeInTheDocument();
    expect(screen.getByText('guide@demo.kr')).toBeInTheDocument();
    expect(await screen.findByText(/경희대학교 국제캠퍼스 · /)).toBeInTheDocument();

    const row = screen.getByRole('link', { name: /^학생증 인증/ });
    expect(row).toHaveAccessibleName('학생증 인증 승인 완료');
    expect(row).toHaveAttribute('href', '/guide/verify');
    expect(screen.queryByText('보호자 참여 동의')).not.toBeInTheDocument();
    expect(screen.queryByText(/계정 및 알림 설정/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '정보 수정하기' })).toHaveAttribute(
      'href',
      '/guide/me/profile',
    );
    expect(screen.getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['guide-new@demo.kr', '미제출'],
    ['guide-pending@demo.kr', '심사 중'],
    ['guide-rejected@demo.kr', '반려'],
  ])('%s: 학생증 인증 %s', async (email, status) => {
    await renderApp('/guide/me/status', { as: email });
    const row = await screen.findByRole('link', { name: /^학생증 인증/ });
    expect(within(row).getByRole('definition')).toHaveTextContent(status);
  });

  it('학생증 인증 줄은 /guide/verify로 이어진다', async () => {
    const { user, router } = await renderApp('/guide/me/status', { as: 'guide-rejected@demo.kr' });
    await user.click(await screen.findByRole('link', { name: /^학생증 인증/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/verify'));
    expect(
      await screen.findByRole('heading', { level: 1, name: '인증 반려 · 재제출' }),
    ).toBeInTheDocument();
  });

  it('가이드가 아닌 역할은 자기 첫 화면으로 돌아간다', async () => {
    const { router } = await renderApp('/guide/me/status', { as: 'student' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
