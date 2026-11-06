import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSession } from '@/features/auth/session';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

describe('로그인 (hs-s01)', () => {
  it('브랜드 표식 · 슬로건 · 기존 안내 문구를 보인다', async () => {
    await renderApp('/login');
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /유니로\s*UNIRO/ })).toBeInTheDocument();
    expect(screen.getByText('“ 대학으로, 동네로, 유니로. ”')).toBeInTheDocument();
    expect(screen.getByText('이메일로 시작하기')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '새 계정 만들기' })).toBeInTheDocument();
  });

  it('데모 계정 로그인 → 첫 화면', async () => {
    const { user, router } = await renderApp('/login');
    await user.type(screen.getByLabelText('이메일 주소'), 'student@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(useSession.getState().token).not.toBeNull();
  });

  it('틀리면 안내 문구', async () => {
    const { user, router } = await renderApp('/login');
    await user.type(screen.getByLabelText('이메일 주소'), 'student@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'x');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('이메일 또는 비밀번호가 맞지 않아요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(useSession.getState().token).toBeNull();
  });

  it('next로 돌아간다', async () => {
    const { user, router } = await renderApp('/login?next=%2Fmy-tours');
    await user.type(screen.getByLabelText('이메일 주소'), 'student@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-tours'));
  });

  it.each(['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', '%2F'])(
    'next=%s는 무시하고 첫 화면으로',
    async (next) => {
      const { user, router } = await renderApp(`/login?next=${next}`);
      await user.type(screen.getByLabelText('이메일 주소'), 'newbie@demo.kr');
      await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
      await user.click(screen.getByRole('button', { name: '로그인' }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
    },
  );

  it('다른 역할은 그 역할의 첫 화면으로', async () => {
    const { user, router } = await renderApp('/login');
    await user.type(screen.getByLabelText('이메일 주소'), 'guide@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
  });

  it('빈 칸 · 이메일 형식은 필드 아래에 안내하고 요청하지 않는다', async () => {
    let requests = 0;
    const count = () => (requests += 1);
    server.events.on('request:start', count);
    try {
      const { user } = await renderApp('/login');
      await user.click(screen.getByRole('button', { name: '로그인' }));
      expect(await screen.findByText('이메일 주소를 입력해 주세요.')).toBeInTheDocument();
      expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument();
      await user.type(screen.getByLabelText('이메일 주소'), 'student');
      await user.click(screen.getByRole('button', { name: '로그인' }));
      expect(await screen.findByText('이메일 주소 형식을 확인해 주세요.')).toBeInTheDocument();
      expect(requests).toBe(0);
    } finally {
      server.events.removeListener('request:start', count);
    }
  });

  it('새 계정 만들기는 회원가입으로', async () => {
    await renderApp('/login');
    expect(screen.getByRole('link', { name: '새 계정 만들기' })).toHaveAttribute('href', '/signup');
  });

  it('한글 조합 중 Enter는 막는다 (Review Focus 1)', async () => {
    await renderApp('/login');
    const input = screen.getByLabelText('비밀번호');
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
