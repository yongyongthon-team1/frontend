import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { flushSync } from 'react-dom';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/app/providers';
import { useSession } from '@/features/auth/session';
import { createSession, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { configureHttp } from '@/shared/lib/http';
import { LogoutButton } from './LogoutButton';

/**
 * 기본 모양(secondary)을 그리는 라우트는 이제 없다(MY는 행 모양, 운영자는 ghost). 라우트 없이 버튼만 그리고 로그인한 세션으로
 * 로그아웃을 누른다.
 */
function renderStandalone() {
  const token = mutate((db) =>
    createSession(db, db.users.find((u) => u.email === 'student@demo.kr')!.id),
  );
  useSession.setState({ token });
  configureHttp({
    baseUrl: '/api',
    getToken: () => useSession.getState().token,
    onUnauthorized: () => {},
  });
  const router = createMemoryRouter(
    [
      { path: '/', element: <LogoutButton /> },
      { path: '/login', element: <p>로그인</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider
        router={router}
        flushSync={(fn) => {
          flushSync(fn);
          return undefined;
        }}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), router };
}

describe('LogoutButton', () => {
  it('기본 모양(secondary)은 로그아웃 버튼이고 누르면 /login으로 간다', async () => {
    const { user, router } = renderStandalone();
    const button = screen.getByRole('button', { name: '로그아웃' });
    expect(button).toHaveClass('bg-brand-soft');
    await user.click(button);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useSession.getState().token).toBeNull();
  });

  it('연타해도 로그아웃 요청은 한 번이다', async () => {
    let logouts = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/auth/logout')) logouts++;
    });
    try {
      const { user, router } = renderStandalone();
      const button = screen.getByRole('button', { name: '로그아웃' });
      await user.dblClick(button);
      expect(button).toBeDisabled();
      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(logouts).toBe(1);
    } finally {
      server.events.removeAllListeners('request:start');
    }
  });
});

describe('LogoutButton variant="row"', () => {
  it('ListRow 모양: 제목 로그아웃, 설명은 meta', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <LogoutButton variant="row" description="이 기기에서 나가요" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const row = screen.getByRole('button', { name: /로그아웃/ });
    expect(row).toHaveClass('rounded-[18px]', 'bg-surface');
    expect(row).toHaveTextContent('이 기기에서 나가요');
  });
});
