import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { renderApp } from '@/test/renderApp';

// 이 파일에서만 내 탐방 목록 화면이 렌더 중에 깨진다 — 화면 단위 에러 경계(설계 5.10)를 실제 라우트로 확인한다.
vi.mock('@/pages/student/MyToursPage', () => ({
  MyToursPage: () => {
    throw new Error('내 탐방 목록을 그리다 깨졌다');
  },
}));

beforeEach(() => {
  useDemoStore.setState({ enabled: true, presentMode: false });
  // React · React Router가 잡은 렌더 오류를 콘솔에 남긴다 — 일부러 낸 오류라 출력만 막는다.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  useDemoStore.setState({ enabled: false });
});

describe('화면 단위 에러 경계 (설계 5.10)', () => {
  it('화면이 렌더 중에 깨져도 하단 탭 · 시연 패널은 남고, 처음 화면으로 돌아갈 수 있다', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });

    expect(await screen.findByRole('alert')).toHaveTextContent('문제가 생겼어요');
    const tabs = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(tabs).getByRole('link', { name: '내 탐방' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const panel = screen.getByRole('region', { name: '시연 패널' });
    expect(within(panel).getByRole('button', { name: '가이드' })).toBeEnabled();

    await user.click(screen.getByRole('link', { name: '처음 화면으로' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: /직접 만나보세요/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('하단 탭으로 다른 화면에 가도 오류에서 벗어난다', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });
    await screen.findByRole('alert');
    await user.click(screen.getByRole('link', { name: '탐색' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: /직접 만나보세요/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
