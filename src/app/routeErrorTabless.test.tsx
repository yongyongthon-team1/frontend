import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { renderApp } from '@/test/renderApp';

// 이 파일에서만 재학 인증 화면(C03)이 렌더 중에 깨진다 — 하단 탭이 없는 인증 화면의 에러 경계에 출구가 있어야 한다.
vi.mock('@/pages/student/VerifyPage', () => ({
  VerifyPage: () => {
    throw new Error('재학 인증 화면을 그리다 깨졌다');
  },
}));

beforeEach(() => {
  useDemoStore.setState({ enabled: false, presentMode: false });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('탭 없는 인증 화면의 에러 경계', () => {
  it('첫 진입 화면이 깨져도 로그아웃으로 빠져나갈 수 있다', async () => {
    const { user, router } = await renderApp('/verify', { as: 'unverified' });

    expect(await screen.findByRole('alert')).toHaveTextContent('문제가 생겼어요');
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
