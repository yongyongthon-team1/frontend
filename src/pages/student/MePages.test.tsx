import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useSession } from '@/features/auth/session';
import { mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { errorMessage } from '@/shared/lib/errors';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** `PATCH /users/me`로 나간 요청 수와 JSON 본문. */
function capturePatches(): { count: () => number; bodies: unknown[] } {
  const bodies: unknown[] = [];
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'PATCH' || !new URL(request.url).pathname.endsWith('/users/me')) return;
    count += 1;
    void request
      .clone()
      .json()
      .then((body: unknown) => bodies.push(body));
  });
  return { count: () => count, bodies };
}

describe('H16 /me 고교생 MY', () => {
  it('student: 제목 · 프로필 카드 · 숫자 카드 · 나의 활동 행 넷 + 로그아웃 행', async () => {
    await renderApp('/me', { as: 'student' });
    expect(await screen.findByRole('heading', { level: 1, name: 'MY' })).toBeInTheDocument();
    expect(screen.getByText('내 정보와 탐방 기록을 한곳에서 관리해요.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();

    expect(screen.getByText('김민지')).toBeInTheDocument();
    expect(screen.getByText('고교생 · 탐방을 준비하는 중')).toBeInTheDocument();
    expect(screen.getByText('학생증 인증 완료')).toBeInTheDocument();

    // 신청이 없는 시작 상태: 참여한 탐방 0회 · 관심 전공 1개(산업디자인)
    expect(await screen.findByText('0회')).toBeInTheDocument();
    expect(screen.getByText('참여한 탐방')).toBeInTheDocument();
    expect(screen.getByText('1개')).toBeInTheDocument();
    expect(screen.getByText('관심 전공')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: '나의 활동' })).toBeInTheDocument();
    const links = screen.getAllByRole('link').filter((a) => !a.closest('nav'));
    expect(links.map((a) => [a.getAttribute('href'), a.textContent])).toEqual([
      ['/my-tours?tab=past', '지난 탐방완료한 캠퍼스 탐방과 후기를 확인해요.'],
      ['/me/wishes', '내 희망 사항남긴 희망 사항을 보고 고쳐요.'],
      ['/me/edit', '내 정보 수정이름·학교·관심 분야를 관리해요.'],
      ['/me/status', '인증 상태 확인학생증 인증 및 보호자 동의 현황'],
    ]);
    const logout = screen.getByRole('button', { name: /^로그아웃/ });
    expect(logout).toHaveTextContent('다른 계정으로 UNIRO 사용하기');
    expect(screen.queryByText('알림 및 설정')).not.toBeInTheDocument();
    // 인증이 끝났으면 이어하기 안내가 없다
    expect(screen.queryByText('인증을 마치면 탐방을 신청할 수 있어요.')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
  });

  it('승인되고 끝난 탐방은 참여한 탐방에 센다', async () => {
    const { router } = await renderApp('/explore', { as: 'student', checkpoint: 'CONFIRMED' });
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.status = 'COMPLETED';
    });
    await router.navigate('/me');
    expect(await screen.findByText('1회')).toBeInTheDocument();
  });

  it('탐방이 아직 끝나지 않았으면 승인된 신청이어도 세지 않는다', async () => {
    await renderApp('/me', { as: 'student', checkpoint: 'CONFIRMED' });
    expect(await screen.findByText('0회')).toBeInTheDocument();
  });

  it('newbie: 학생증 인증 전 + 인증 이어하기 안내 → /verify', async () => {
    const { user, router } = await renderApp('/me', { as: 'newbie@demo.kr' });
    expect(await screen.findByText('학생증 인증 전')).toBeInTheDocument();
    expect(screen.getByText('인증을 마치면 탐방을 신청할 수 있어요.')).toBeInTheDocument();
    expect(await screen.findByText('0개')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^인증 이어하기/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
  });

  it('인증 상태 확인 행 → /me/status(C07)', async () => {
    const { user, router } = await renderApp('/me', { as: 'student' });
    await user.click(await screen.findByRole('link', { name: /^인증 상태 확인/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/status'));
  });

  it('로그아웃 행 → /login, 토큰 비움', async () => {
    const { user, router } = await renderApp('/me', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: /^로그아웃/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useSession.getState().token).toBeNull();
  });

  it('신청 목록을 못 받아도 프로필과 행은 그리고 숫자 자리에 오류와 다시 시도', async () => {
    server.use(http.get('/api/users/me/tours', () => wireFail('E404')));
    await renderApp('/me', { as: 'student' });
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.getByText('김민지')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^내 정보 수정/ })).toBeInTheDocument();
  });
});

describe('H17 /me/edit 내 정보 수정', () => {
  const SAVE = '변경사항 저장';

  it('MY의 내 정보 수정 행으로 들어오고 현재 값이 채워져 있다', async () => {
    const { user, router } = await renderApp('/me', { as: 'student' });
    await user.click(await screen.findByRole('link', { name: /^내 정보 수정/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/edit'));
    expect(screen.getByRole('heading', { level: 1, name: '내 정보 수정' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '내 정보를 업데이트해요.' }),
    ).toBeVisible();
    expect(screen.getByText('탐방 신청에 사용하는 기본 프로필이에요.')).toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toHaveValue('김민지');
    expect(screen.getByLabelText('학교')).toHaveValue('수원영통고등학교');
    expect(screen.getByLabelText('학교')).toHaveAttribute('placeholder', '재학 중인 고등학교');
    expect(screen.getByLabelText('이메일')).toHaveValue('student@demo.kr');
    expect(screen.getByLabelText('이메일')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('관심 전공')).toHaveValue('산업디자인');
    expect(screen.getByLabelText('관심 전공')).toHaveAttribute(
      'placeholder',
      '예: 디자인 · 산업디자인',
    );
    expect(
      screen.getByText('코스 추천은 각 탐방 신청서에 작성한 ‘하고 싶은 것’을 기준으로 생성돼요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAVE })).toBeEnabled();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
  });

  it('이름을 지우고 저장하면 오류이고 요청하지 않는다', async () => {
    const patches = capturePatches();
    const { user, router } = await renderApp('/me/edit', { as: 'student' });
    await user.clear(await screen.findByLabelText('이름'));
    await user.click(screen.getByRole('button', { name: SAVE }));
    expect(await screen.findByText('이름을 입력해 주세요.')).toBeInTheDocument();
    expect(patches.count()).toBe(0);
    expect(router.state.location.pathname).toBe('/me/edit');
  });

  it('이름 21자 · 학교 51자 · 관심 전공 31자는 칸 오류', async () => {
    const patches = capturePatches();
    const { user } = await renderApp('/me/edit', { as: 'student' });
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '가'.repeat(21) } });
    fireEvent.change(screen.getByLabelText('학교'), { target: { value: '나'.repeat(51) } });
    fireEvent.change(screen.getByLabelText('관심 전공'), { target: { value: '다'.repeat(31) } });
    await user.click(screen.getByRole('button', { name: SAVE }));
    expect(await screen.findByText('20자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(screen.getByText('50자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(screen.getByText('30자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(patches.count()).toBe(0);
  });

  it('저장하면 /me로 가서 새 이름을 보이고, PATCH 본문의 grade는 기존 값(2)', async () => {
    const patches = capturePatches();
    const { user, router } = await renderApp('/me/edit', { as: 'student' });
    const name = await screen.findByLabelText('이름');
    await user.clear(name);
    await user.type(name, '김새봄');
    await user.clear(screen.getByLabelText('관심 전공'));
    await user.type(screen.getByLabelText('관심 전공'), '디자인 · 건축');
    await user.click(screen.getByRole('button', { name: SAVE }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await screen.findByText('김새봄')).toBeInTheDocument();
    expect(await screen.findByText('2개')).toBeInTheDocument();
    expect(await screen.findByText('내 정보를 저장했어요.')).toBeInTheDocument();
    await waitFor(() => expect(patches.bodies).toHaveLength(1));
    expect(patches.bodies[0]).toEqual({
      name: '김새봄',
      school_name: '수원영통고등학교',
      grade: 2,
      interest_major: '디자인 · 건축',
    });
  });

  it('학교를 비우면 지움(null)으로 보낸다', async () => {
    const patches = capturePatches();
    const { user, router } = await renderApp('/me/edit', { as: 'student' });
    await user.clear(await screen.findByLabelText('학교'));
    await user.click(screen.getByRole('button', { name: SAVE }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    await waitFor(() => expect(patches.bodies).toHaveLength(1));
    expect(patches.bodies[0]).toMatchObject({ school_name: null, grade: 2 });
  });

  it('서버 칸 오류(name · school_name · interest_major)는 칸 아래이고 다시 저장할 수 있다', async () => {
    server.use(
      http.patch('/api/users/me', () =>
        wireFail('E400', {
          errors: [
            { field: 'name', reason: '이름 서버 오류' },
            { field: 'school_name', reason: '학교 서버 오류' },
            { field: 'interest_major', reason: '전공 서버 오류' },
          ],
        }),
      ),
    );
    const { user, router } = await renderApp('/me/edit', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: SAVE }));
    expect(await screen.findByText('이름 서버 오류')).toBeInTheDocument();
    expect(screen.getByText('학교 서버 오류')).toBeInTheDocument();
    expect(screen.getByText('전공 서버 오류')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAVE })).toBeEnabled();
    expect(router.state.location.pathname).toBe('/me/edit');
  });

  it('칸 오류가 아닌 실패는 토스트이고 다시 저장할 수 있다', async () => {
    server.use(http.patch('/api/users/me', () => wireFail('E500')));
    const { user } = await renderApp('/me/edit', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: SAVE }));
    await waitFor(() =>
      expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(
        errorMessage('UNKNOWN'),
      ),
    );
    expect(screen.getByRole('button', { name: SAVE })).toBeEnabled();
  });

  it('이름 칸 한글 조합 중 Enter는 제출하지 않는다', async () => {
    const patches = capturePatches();
    await renderApp('/me/edit', { as: 'student' });
    const input = await screen.findByLabelText('이름');
    const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(patches.count()).toBe(0);
  });

  it('저장을 연타해도 요청은 한 번이다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const patches = capturePatches();
    const { user, router } = await renderApp('/me/edit', { as: 'student' });
    await user.dblClick(await screen.findByRole('button', { name: SAVE }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(patches.count()).toBe(1);
  });

  it('가이드는 /me/edit에 들어올 수 없다(고교생 전용)', async () => {
    const { router } = await renderApp('/me/edit', { as: 'guide' });
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/me/edit'));
  });
});
