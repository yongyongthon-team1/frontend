import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

// C07 내 정보 · 인증 상태 — 고교생 `/me/status`.

const enrollmentRow = () => screen.findByRole('link', { name: /^학생증 인증/ });
const guardianRow = () => screen.getByRole('link', { name: /^보호자 참여 동의/ });

describe('C07 내 정보 · 인증 상태 (/me/status)', () => {
  it('student: 프로필 카드 · 상태 줄 둘(승인 완료 · 동의 완료) · 정보 수정하기, 설정 행 없음(A6), MY 탭 활성', async () => {
    await renderApp('/me/status', { as: 'student@demo.kr' });
    expect(await screen.findByRole('heading', { level: 1, name: '내 정보' })).toBeInTheDocument();
    expect(screen.getByText('계정과 인증 상태를 확인해요.')).toBeInTheDocument();
    expect(screen.getByText('고교생')).toBeInTheDocument();
    expect(screen.getByText('student@demo.kr')).toBeInTheDocument();
    expect(screen.getByText(/^관심 분야: /)).toBeInTheDocument();

    expect(await enrollmentRow()).toHaveAccessibleName('학생증 인증 승인 완료');
    expect(guardianRow()).toHaveAccessibleName('보호자 참여 동의 동의 완료');
    expect(screen.getByRole('link', { name: '정보 수정하기' })).toHaveAttribute('href', '/me/edit');
    expect(screen.queryByText(/계정 및 알림 설정/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
  });

  it('두 줄은 C03(/verify) · C04(/verify/guardian)로 이어진다', async () => {
    const { user, router } = await renderApp('/me/status', { as: 'student@demo.kr' });
    await user.click(await enrollmentRow());
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
    await user.click(await screen.findByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    await user.click(screen.getByRole('link', { name: /^인증 상태 확인/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/status'));
    await user.click(guardianRow());
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
  });

  it.each([
    ['newbie@demo.kr', '미제출', '미요청'],
    ['waiting@demo.kr', '심사 중', '동의 대기'],
    ['rejected@demo.kr', '반려', '거부'],
    ['expired@demo.kr', '승인 완료', '링크 만료'],
    ['pending@demo.kr', '심사 중', '동의 완료'],
  ])('%s: 학생증 인증 %s · 보호자 참여 동의 %s', async (email, enrollment, guardian) => {
    await renderApp('/me/status', { as: email });
    const first = await enrollmentRow();
    expect(within(first).getByRole('definition')).toHaveTextContent(enrollment);
    expect(within(guardianRow()).getByRole('definition')).toHaveTextContent(guardian);
  });

  it('고교생이 아닌 역할은 자기 첫 화면으로 돌아간다', async () => {
    const { router } = await renderApp('/me/status', { as: 'guide' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
  });
});
