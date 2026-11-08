import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { PASSWORD_PATTERN } from '@/features/auth/model';
import { useSession } from '@/features/auth/session';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

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

type User = Awaited<ReturnType<typeof renderApp>>['user'];

const NEXT = '가입하고 역할 선택하기';
const CONTINUE = '선택하고 계속하기';
const TERMS = '[필수] 이용약관 동의';
const PRIVACY = '[필수] 개인정보 처리 동의';

async function fill(
  user: User,
  values: { email?: string; password?: string; confirm?: string; name?: string },
) {
  if (values.email !== undefined) await user.type(screen.getByLabelText('이메일'), values.email);
  if (values.password !== undefined)
    await user.type(screen.getByLabelText('비밀번호'), values.password);
  if (values.confirm !== undefined)
    await user.type(screen.getByLabelText('비밀번호 확인'), values.confirm);
  if (values.name !== undefined) await user.type(screen.getByLabelText('이름'), values.name);
}

async function agree(user: User) {
  await user.click(screen.getByRole('checkbox', { name: TERMS }));
  await user.click(screen.getByRole('checkbox', { name: PRIVACY }));
}

/** 1단계를 끝까지 채우고 2단계(역할 선택)로 넘어간다. */
async function toRoleStep(user: User, email = 'brand-new@demo.kr', name = '새로운') {
  await fill(user, { email, password: 'abcd1234', confirm: 'abcd1234', name });
  await agree(user);
  await user.click(screen.getByRole('button', { name: NEXT }));
  await screen.findByRole('heading', { level: 1, name: '어떤 분이신가요?' });
}

describe('/signup 1단계 · 계정 만들기 (C01A)', () => {
  it('워드마크 · 제목 · 설명 · 네 칸(보이는 라벨 + placeholder) · 필수 약관 둘 · 안내 상자 · 로그인 링크', async () => {
    await renderApp('/signup');
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'UNIRO에 가입해요.' })).toBeVisible();
    expect(screen.getByText('계정을 만들고 나에게 맞는 역할을 선택해요.')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveAttribute(
      'placeholder',
      '이메일 주소를 입력해 주세요',
    );
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute(
      'placeholder',
      '영문·숫자 포함 8자 이상',
    );
    expect(screen.getByLabelText('비밀번호 확인')).toHaveAttribute(
      'placeholder',
      '비밀번호를 한 번 더 입력해 주세요',
    );
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: TERMS })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: PRIVACY })).not.toBeChecked();
    expect(screen.queryByText(/\[선택\]/)).not.toBeInTheDocument();
    expect(screen.getByText('고교생은 탐방 신청 전 보호자 동의가 필요해요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이미 계정이 있나요? 로그인' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.queryByText('가입 유형을 선택해 주세요')).not.toBeInTheDocument();
  });

  it('/login의 `회원가입` 링크로 들어온다', async () => {
    const { user, router } = await renderApp('/login');
    await user.click(screen.getByRole('link', { name: '아직 계정이 없나요? 회원가입' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/signup'));
    expect(router.state.location.search).toBe('');
  });

  it('필수 약관 둘을 모두 체크해야 다음 단계 버튼이 열린다(사유 문구 포함)', async () => {
    const { user } = await renderApp('/signup');
    // 사유 줄이 사라지면 버튼 요소가 새로 그려지므로 그때마다 다시 찾는다.
    const next = () => screen.getByRole('button', { name: NEXT });
    expect(next()).toBeDisabled();
    expect(screen.getByText('필수 약관에 모두 동의하면 다음으로 갈 수 있어요.')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: TERMS }));
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: PRIVACY }));
    expect(next()).toBeEnabled();
    expect(
      screen.queryByText('필수 약관에 모두 동의하면 다음으로 갈 수 있어요.'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: TERMS }));
    expect(next()).toBeDisabled();
  });

  it('빈 칸으로 다음 → 네 칸 오류, 2단계로 가지 않고 요청도 없다', async () => {
    const signups = countRequests('POST', '/auth/signup');
    const { user, router } = await renderApp('/signup');
    await agree(user);
    await user.click(screen.getByRole('button', { name: NEXT }));
    expect(await screen.findByText('이메일 주소를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 한 번 더 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(signups()).toBe(0);
  });

  it('이메일 형식 · 255자 초과', async () => {
    const { user } = await renderApp('/signup');
    await fill(user, {
      email: 'student',
      password: 'abcd1234',
      confirm: 'abcd1234',
      name: '가나다',
    });
    await agree(user);
    await user.click(screen.getByRole('button', { name: NEXT }));
    expect(await screen.findByText('이메일 주소 형식을 확인해 주세요.')).toBeInTheDocument();

    const email = screen.getByLabelText('이메일');
    await user.clear(email);
    fireEvent.change(email, { target: { value: `${'a'.repeat(250)}@demo.kr` } });
    await user.click(screen.getByRole('button', { name: NEXT }));
    expect(await screen.findByText('이메일 주소가 너무 길어요.')).toBeInTheDocument();
  });

  it('비밀번호가 영문 · 숫자를 섞은 8자 이상이 아니면 형식 문구', async () => {
    expect(PASSWORD_PATTERN.test('abcdefgh')).toBe(false);
    const signups = countRequests('POST', '/auth/signup');
    const { user } = await renderApp('/signup');
    await fill(user, {
      email: 'new@demo.kr',
      password: 'abcdefgh',
      confirm: 'abcdefgh',
      name: '가나다',
    });
    await agree(user);
    await user.click(screen.getByRole('button', { name: NEXT }));
    expect(
      await screen.findByText('비밀번호는 영문과 숫자를 섞어 8자 이상으로 정해 주세요.'),
    ).toBeInTheDocument();
    expect(signups()).toBe(0);
  });

  it('비밀번호 확인이 다르면 그 칸 아래에 알린다(다른 칸 오류와 함께도)', async () => {
    const { user, router } = await renderApp('/signup');
    await fill(user, {
      email: 'student',
      password: 'abcd1234',
      confirm: 'abcd12345',
      name: '가나다',
    });
    await agree(user);
    await user.click(screen.getByRole('button', { name: NEXT }));
    expect(await screen.findByText('비밀번호가 서로 달라요.')).toBeInTheDocument();
    expect(screen.getByText('이메일 주소 형식을 확인해 주세요.')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('이름 21자 → 20자 이내 문구', async () => {
    const { user } = await renderApp('/signup');
    await fill(user, { email: 'new@demo.kr', password: 'abcd1234', confirm: 'abcd1234' });
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가'.repeat(21) } });
    await agree(user);
    await user.click(screen.getByRole('button', { name: NEXT }));
    expect(await screen.findByText('이름은 20자 이내로 적어 주세요.')).toBeInTheDocument();
  });

  it('이름 칸 한글 조합 중 Enter는 다음 단계로 넘기지 않는다', async () => {
    const signups = countRequests('POST', '/auth/signup');
    const { router } = await renderApp('/signup');
    const input = screen.getByLabelText('이름');
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(router.state.location.search).toBe('');
    expect(signups()).toBe(0);
  });
});

describe('/signup 2단계 · 역할 선택 (C02)', () => {
  it('1단계를 통과하면 ?step=role로 가고, 이때는 가입 요청을 보내지 않는다', async () => {
    const signups = countRequests('POST', '/auth/signup');
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user);
    expect(router.state.location.pathname).toBe('/signup');
    expect(router.state.location.search).toBe('?step=role');
    expect(router.state.historyAction).toBe('PUSH');
    expect(signups()).toBe(0);
    expect(useSession.getState().token).toBeNull();
  });

  it('제목 · 설명 · 역할 카드 셋(배지 · 제목 · 기능 줄) · 아무것도 안 골라 CTA는 잠겨 있다', async () => {
    const { user } = await renderApp('/signup');
    await toRoleStep(user);
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByText('역할에 따라 필요한 기능을 안내해 드려요.')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: '가입 역할' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('name'))).toEqual(['role', 'role', 'role']);
    for (const radio of radios) expect(radio).not.toBeChecked();
    expect(within(group).getByRole('radio', { name: /^고교생/ })).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: /^대학생 가이드/ })).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: /^동네 가게 사장님/ })).toBeInTheDocument();
    expect(screen.getByText('미래의 대학을 만나고 싶어요')).toBeInTheDocument();
    expect(screen.getByText('학교와 전공을 소개할게요')).toBeInTheDocument();
    expect(screen.getByText('탐방객을 가게로 맞이할게요')).toBeInTheDocument();
    expect(screen.getByText('탐방 개설 · 신청 관리 · 코스 설계')).toBeInTheDocument();
    expect(screen.getByText('가게 연결 · 제휴 할인 · 쿠폰 사용')).toBeInTheDocument();
    // A4: AI 매칭이 없으니 `진로 기반 추천` 대신 희망 사항 문구
    expect(screen.queryByText(/진로 기반 추천/)).not.toBeInTheDocument();
    expect(
      screen.getByText('학교 · 학과와 희망 사항으로 탐방 찾기 · 탐방 신청 · 쿠폰'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: CONTINUE })).toBeDisabled();
    expect(screen.getByText('역할을 하나 골라 주세요.')).toBeVisible();
    await user.click(within(group).getByRole('radio', { name: /^고교생/ }));
    expect(screen.getByRole('button', { name: CONTINUE })).toBeEnabled();
  });

  it('브라우저 뒤로 가기 → 1단계, 입력한 값과 체크가 그대로다 · 앞으로 가기로 2단계에 돌아온다', async () => {
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user);
    await user.click(screen.getByRole('radio', { name: /^대학생 가이드/ }));
    await waitFor(() => router.navigate(-1));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'UNIRO에 가입해요.' }),
    ).toBeVisible();
    expect(router.state.location.search).toBe('');
    expect(screen.getByLabelText('이메일')).toHaveValue('brand-new@demo.kr');
    expect(screen.getByLabelText('비밀번호')).toHaveValue('abcd1234');
    expect(screen.getByLabelText('비밀번호 확인')).toHaveValue('abcd1234');
    expect(screen.getByLabelText('이름')).toHaveValue('새로운');
    expect(screen.getByRole('checkbox', { name: TERMS })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: PRIVACY })).toBeChecked();
    // 다시 다음 단계 → 고른 역할도 그대로
    await user.click(screen.getByRole('button', { name: NEXT }));
    await screen.findByRole('heading', { level: 1, name: '어떤 분이신가요?' });
    expect(screen.getByRole('radio', { name: /^대학생 가이드/ })).toBeChecked();
  });

  it('1단계 값 없이 ?step=role을 바로 열면 1단계로 되돌린다', async () => {
    const { router } = await renderApp('/signup?step=role');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'UNIRO에 가입해요.' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/signup');
    expect(router.state.location.search).toBe('');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('뒤로 갔다가 1단계 값을 고치면 앞으로 가기로 옛 값 2단계에 닿지 않는다', async () => {
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user);
    await waitFor(() => router.navigate(-1));
    await screen.findByRole('heading', { level: 1, name: 'UNIRO에 가입해요.' });
    await user.type(screen.getByLabelText('이름'), '고침');
    await waitFor(() => router.navigate(1));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'UNIRO에 가입해요.' }),
    ).toBeVisible();
    expect(router.state.location.search).toBe('');
    expect(screen.getByLabelText('이름')).toHaveValue('새로운고침');
  });

  it.each([
    ['고교생', '/verify'],
    ['대학생 가이드', '/guide/verify'],
    ['동네 가게 사장님', '/owner/verify'],
  ])('%s로 가입하면 가입 요청 한 번, 첫 화면 %s', async (role, landing) => {
    const signups = countRequests('POST', '/auth/signup');
    const { user, router, queryClient } = await renderApp('/signup');
    await toRoleStep(user);
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${role}`) }));
    await user.click(screen.getByRole('button', { name: CONTINUE }));
    await waitFor(() => expect(router.state.location.pathname).toBe(landing));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(useSession.getState().token).not.toBeNull();
    expect(signups()).toBe(1);
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      email: 'brand-new@demo.kr',
      name: '새로운',
    });
  });

  it('가입 요청에는 비밀번호 확인 · 약관 값이 실리지 않는다', async () => {
    let body: unknown = null;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/auth/signup'))
        body = await request.clone().json();
    });
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user);
    await user.click(screen.getByRole('radio', { name: /^고교생/ }));
    await user.click(screen.getByRole('button', { name: CONTINUE }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
    expect(Object.keys(body as object).sort()).toEqual(['email', 'name', 'password', 'role']);
  });

  it('연타해도 가입 요청은 한 번이고, 처리 중에는 버튼과 카드가 잠긴다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const signups = countRequests('POST', '/auth/signup');
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user, 'double@demo.kr', '연타');
    await user.click(screen.getByRole('radio', { name: /^고교생/ }));
    const cta = screen.getByRole('button', { name: CONTINUE });
    await user.dblClick(cta);
    expect(cta).toBeDisabled();
    expect(screen.getByRole('radio', { name: /^대학생 가이드/ })).toBeDisabled();
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
    expect(signups()).toBe(1);
  });

  it('이미 가입된 이메일 → 1단계로 돌아가 이메일 칸 아래 문구 + 로그인하기 링크', async () => {
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user, 'student@demo.kr', '가나다');
    await user.click(screen.getByRole('radio', { name: /^고교생/ }));
    await user.click(screen.getByRole('button', { name: CONTINUE }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'UNIRO에 가입해요.' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/signup');
    expect(router.state.location.search).toBe('');
    expect(screen.getByText('이미 가입된 이메일이에요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute('href', '/login');
    expect(screen.getByLabelText('이메일')).toHaveValue('student@demo.kr');
    expect(useSession.getState().token).toBeNull();
    // 다시 입력하기 시작하면 서버 오류를 지운다
    await user.type(screen.getByLabelText('이메일'), 'x');
    expect(screen.queryByText('이미 가입된 이메일이에요.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인하기' })).not.toBeInTheDocument();
  });

  it('칸에 붙지 않는 서버 오류는 2단계에 알리고 잠금을 풀어 다시 보낼 수 있다', async () => {
    server.use(http.post('/api/auth/signup', () => wireFail('E500')));
    const { user, router } = await renderApp('/signup');
    await toRoleStep(user);
    await user.click(screen.getByRole('radio', { name: /^고교생/ }));
    await user.click(screen.getByRole('button', { name: CONTINUE }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?step=role');
    expect(screen.getByRole('button', { name: CONTINUE })).toBeEnabled();
  });
});
