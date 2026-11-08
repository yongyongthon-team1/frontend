import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSession } from '@/features/auth/session';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';

describe('로그인 (C01)', () => {
  it('워드마크 · 제목 · 설명 · 보이는 라벨 + placeholder · 안내 상자 · 하단 버튼 · 회원가입 링크', async () => {
    await renderApp('/login');
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '다시 만나 반가워요.' })).toBeVisible();
    expect(screen.getByText('UNIRO에서 나에게 맞는 캠퍼스를 발견해요.')).toBeInTheDocument();
    const email = screen.getByLabelText('이메일');
    expect(email).toHaveAttribute('placeholder', '이메일 주소를 입력해 주세요');
    expect(email).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password');
    expect(screen.getByText('계정이 없다면 아래 회원가입에서 시작해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: '아직 계정이 없나요? 회원가입' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('옛 머리 · 역할 안내 카드 · 보조 버튼은 없다', async () => {
    await renderApp('/login');
    expect(screen.queryByText('이메일로 시작하기')).not.toBeInTheDocument();
    expect(screen.queryByText('고등학생 · 대학생 · 사장님')).not.toBeInTheDocument();
    expect(screen.queryByText('“ 대학으로, 동네로, 유니로. ”')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '새 계정 만들기' })).not.toBeInTheDocument();
  });

  it('데모 계정 로그인 → 첫 화면', async () => {
    const { user, router } = await renderApp('/login');
    await user.type(screen.getByLabelText('이메일'), 'student@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(useSession.getState().token).not.toBeNull();
  });

  it('틀리면 안내 문구', async () => {
    const { user, router } = await renderApp('/login');
    await user.type(screen.getByLabelText('이메일'), 'student@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'x');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('이메일 또는 비밀번호가 맞지 않아요.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(useSession.getState().token).toBeNull();
  });

  it('next로 돌아간다', async () => {
    const { user, router } = await renderApp('/login?next=%2Fmy-tours');
    await user.type(screen.getByLabelText('이메일'), 'student@demo.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-tours'));
  });

  it.each(['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', '%2F'])(
    'next=%s는 무시하고 첫 화면으로',
    async (next) => {
      const { user, router } = await renderApp(`/login?next=${next}`);
      await user.type(screen.getByLabelText('이메일'), 'newbie@demo.kr');
      await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
      await user.click(screen.getByRole('button', { name: '로그인' }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
    },
  );

  it('다른 역할은 그 역할의 첫 화면으로', async () => {
    const { user, router } = await renderApp('/login');
    await user.type(screen.getByLabelText('이메일'), 'guide@demo.kr');
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
      await user.type(screen.getByLabelText('이메일'), 'student');
      await user.click(screen.getByRole('button', { name: '로그인' }));
      expect(await screen.findByText('이메일 주소 형식을 확인해 주세요.')).toBeInTheDocument();
      expect(requests).toBe(0);
    } finally {
      server.events.removeListener('request:start', count);
    }
  });

  it('한글 조합 중 Enter는 막는다 (Review Focus 1)', async () => {
    await renderApp('/login');
    const input = screen.getByLabelText('비밀번호');
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
