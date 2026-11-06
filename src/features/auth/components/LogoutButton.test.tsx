import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useSession } from '@/features/auth/session';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';
import { LogoutButton } from './LogoutButton';

describe('LogoutButton', () => {
  it('기본 모양(secondary)은 로그아웃 버튼이고 누르면 /login으로 간다', async () => {
    const { user, router } = await renderApp('/me', { as: 'student' });
    const button = await screen.findByRole('button', { name: '로그아웃' });
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
      const { user, router } = await renderApp('/me', { as: 'student' });
      const button = await screen.findByRole('button', { name: '로그아웃' });
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
