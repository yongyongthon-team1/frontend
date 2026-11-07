import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PASSWORD_PATTERN } from '@/features/auth/model';
import { useSession } from '@/features/auth/session';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { renderApp } from '@/test/renderApp';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** 이 메서드 · 경로로 나간 요청 수. */
function countRequests(method: string, pathSuffix: string): () => number {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method === method && new URL(request.url).pathname.endsWith(pathSuffix)) count += 1;
  });
  return () => count;
}

const SUBMIT = '계정 생성하고 인증하기';

async function fill(
  user: Awaited<ReturnType<typeof renderApp>>['user'],
  values: { email?: string; password?: string; name?: string },
) {
  if (values.email !== undefined)
    await user.type(screen.getByLabelText('이메일 주소'), values.email);
  if (values.password !== undefined)
    await user.type(screen.getByLabelText('비밀번호'), values.password);
  if (values.name !== undefined) await user.type(screen.getByLabelText('이름'), values.name);
}

describe('/signup 회원가입 (hs-a01)', () => {
  it('제목 · 칩 · 세 칸 · 역할 카드(기본 고등학생) · 제출 버튼 · 로그인 링크', async () => {
    await renderApp('/signup');
    expect(
      screen.getByRole('heading', { level: 1, name: '회원가입 · 역할 선택' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
    expect(screen.getByText('신규 회원가입 · 역할 1개 선택')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일 주소')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toBeInTheDocument();

    const group = screen.getByRole('group', { name: '가입 유형을 선택해 주세요' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('name'))).toEqual(['role', 'role', 'role']);
    expect(within(group).getByRole('radio', { name: /^고등학생/ })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /^대학생 가이드/ })).not.toBeChecked();
    expect(within(group).getByRole('radio', { name: /^사장님/ })).not.toBeChecked();
    expect(screen.getByText('캠퍼스 탐방을 추천받고 신청해요.')).toBeInTheDocument();
    expect(screen.getByText('개인 자율 탐방을 개설하고 관리해요.')).toBeInTheDocument();
    expect(screen.getByText('상점을 연결하고 방문 쿠폰을 처리해요.')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(screen.getByRole('link', { name: '이미 계정이 있다면 로그인하기' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('/login의 `새 계정 만들기`로 들어온다', async () => {
    const { user, router } = await renderApp('/login');
    await user.click(screen.getByRole('link', { name: '새 계정 만들기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/signup'));
  });

  it('빈 제출 → 세 칸 오류, 요청 없음', async () => {
    const signups = countRequests('POST', '/auth/signup');
    const { user } = await renderApp('/signup');
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('이메일 주소를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
    expect(signups()).toBe(0);
  });

  it('이메일 형식 · 255자 초과', async () => {
    const { user } = await renderApp('/signup');
    await fill(user, { email: 'student', password: 'abcd1234', name: '가나다' });
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('이메일 주소 형식을 확인해 주세요.')).toBeInTheDocument();

    const email = screen.getByLabelText('이메일 주소');
    await user.clear(email);
    fireEvent.change(email, { target: { value: `${'a'.repeat(250)}@demo.kr` } });
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('이메일 주소가 너무 길어요.')).toBeInTheDocument();
  });

  it('비밀번호가 영문 · 숫자를 섞은 8자 이상이 아니면 형식 문구', async () => {
    expect(PASSWORD_PATTERN.test('abcdefgh')).toBe(false);
    const signups = countRequests('POST', '/auth/signup');
    const { user } = await renderApp('/signup');
    await fill(user, { email: 'new@demo.kr', password: 'abcdefgh', name: '가나다' });
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(
      await screen.findByText('비밀번호는 영문과 숫자를 섞어 8자 이상으로 정해 주세요.'),
    ).toBeInTheDocument();
    expect(signups()).toBe(0);
  });

  it('이름 21자 → 20자 이내 문구', async () => {
    const { user } = await renderApp('/signup');
    await fill(user, { email: 'new@demo.kr', password: 'abcd1234' });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가'.repeat(21) } });
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('이름은 20자 이내로 적어 주세요.')).toBeInTheDocument();
  });

  it('이미 가입된 이메일 → 칸 아래 문구 + 로그인하기 링크, 이동하지 않는다', async () => {
    const { user, router } = await renderApp('/signup');
    await fill(user, { email: 'student@demo.kr', password: 'abcd1234', name: '가나다' });
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('이미 가입된 이메일이에요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute('href', '/login');
    expect(router.state.location.pathname).toBe('/signup');
    expect(useSession.getState().token).toBeNull();
    // 다시 입력하기 시작하면 서버 오류를 지운다
    await user.type(screen.getByLabelText('이메일 주소'), 'x');
    expect(screen.queryByText('이미 가입된 이메일이에요.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인하기' })).not.toBeInTheDocument();
  });

  it.each([
    ['고등학생', '/verify'],
    ['대학생 가이드', '/guide/verify'],
    ['사장님', '/owner/verify'],
  ])('%s로 가입하면 첫 화면 %s', async (role, landing) => {
    const { user, router, queryClient } = await renderApp('/signup');
    await fill(user, { email: 'brand-new@demo.kr', password: 'abcd1234', name: '새로운' });
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${role}`) }));
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    await waitFor(() => expect(router.state.location.pathname).toBe(landing));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(useSession.getState().token).not.toBeNull();
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      email: 'brand-new@demo.kr',
      name: '새로운',
    });
  });

  it('이름 칸 한글 조합 중 Enter는 제출하지 않는다', async () => {
    const signups = countRequests('POST', '/auth/signup');
    await renderApp('/signup');
    const input = screen.getByLabelText('이름');
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(signups()).toBe(0);
  });

  it('연타해도 가입 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const signups = countRequests('POST', '/auth/signup');
    const { user, router } = await renderApp('/signup');
    await fill(user, { email: 'double@demo.kr', password: 'abcd1234', name: '연타' });
    await user.dblClick(screen.getByRole('button', { name: SUBMIT }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
    expect(signups()).toBe(1);
  });
});
