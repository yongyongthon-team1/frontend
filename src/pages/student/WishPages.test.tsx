import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { useLastQuery } from '@/features/tours/lastQuery';
import { getDb } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';
import { errorMessage } from '@/shared/lib/errors';
import { wireFail } from '@/test/wire';

// T-07 내 희망 사항(목록 · 수정). 원문은 남긴 그대로(앞뒤 공백만 빠진 채 줄바꿈 포함)이고 이름은 어디에도 없다(Review Focus 5).

const field = (label: string) => screen.getByLabelText(label, { exact: true });
/** 수정 화면의 폼이 그려질 때까지(목록 캐시를 받은 뒤) 기다린다. */
const editReady = () => screen.findByRole('button', { name: '저장하기' });
const wishList = () => screen.getByRole('list', { name: '내 희망 사항' });
const saveButton = () => screen.getByRole('button', { name: '저장하기' });
const HAEUN = 'haeun@demo.kr';

/** 이하은의 시드 희망 사항 id(시드 첫 행 — `seed.test.ts`가 지킨다). */
const HAEUN_WISH = 1;
const idOf = (email: string) => getDb().users.find((u) => u.email === email)!.id;

/** 이 테스트 동안 나간 `PATCH /api/users/me/tour-wishes/:id` 본문. */
function watchPatches() {
  const bodies: unknown[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PATCH' && new URL(request.url).pathname.includes('/tour-wishes/')) {
      bodies.push(null);
      const at = bodies.length - 1;
      void request
        .clone()
        .json()
        .then((b: unknown) => (bodies[at] = b));
    }
  });
  return bodies;
}

describe('내 희망 사항 목록 (T-07)', () => {
  beforeEach(() => {
    useLastQuery.setState({ search: null });
    act(() => useDemoStore.setState({ enabled: false }));
  });

  it('`/me`의 `내 희망 사항` 행 → 목록, MY 탭이 켜져 있다', async () => {
    const { user, router } = await renderApp('/me', { as: 'student' });
    const row = await screen.findByRole('link', { name: /^내 희망 사항/ });
    expect(row).toHaveTextContent('남긴 희망 사항을 보고 고쳐요.');
    expect(screen.getByRole('button', { name: /^로그아웃/ })).toBeInTheDocument();
    await user.click(row);
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
    expect(await screen.findByRole('heading', { level: 1, name: '내 희망 사항' })).toBeVisible();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: '탐색' })).not.toHaveAttribute('aria-current');
  });

  it('시드 글이 있으면 설명 · 카드(학교 · 학과, 원문, `{MM.DD} 남김`) · `고치기` 링크', async () => {
    await renderApp('/me/wishes', { as: HAEUN });
    expect(
      await screen.findByText('남긴 그대로 보여요. 고쳐도 이미 본 투어 결과는 바뀌지 않아요.'),
    ).toBeInTheDocument();
    const cards = within(await screen.findByRole('list', { name: '내 희망 사항' })).getAllByRole(
      'article',
    );
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(within(card).getByText('경희대학교 국제캠퍼스 · 시각디자인')).toBeInTheDocument();
    expect(within(card).getByTestId('wish-text')).toHaveTextContent(
      '디자인 작업실에서 선배들이 과제하는 모습을 보고, 학생 식당도 가 보고 싶어요.',
    );
    expect(within(card).getByText(/^\d\d\.\d\d 남김$/)).toBeInTheDocument();
    expect(card).not.toHaveTextContent('이하은');
    expect(within(card).getByRole('link', { name: '고치기' })).toHaveAttribute(
      'href',
      `/me/wishes/${HAEUN_WISH}/edit`,
    );
  });

  it('홈에서 남긴 글은 앞뒤 공백만 빠진 채 줄바꿈까지 목록 맨 앞에 보인다', async () => {
    const { user, router } = await renderApp('/', { as: 'student' });
    await screen.findByRole('option', { name: '경희대학교 국제캠퍼스' });
    await user.selectOptions(field('학교'), '2');
    await user.type(field('학과'), '산업디자인');
    fireEvent.change(field('투어 희망 사항'), { target: { value: '  첫 줄\n둘째 줄  ' } });
    await user.click(screen.getByRole('button', { name: '희망 사항 남기고 투어 찾기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/tours'));
    // 결과 화면 원문 카드의 링크로 목록에 들어간다.
    await user.click(await screen.findByRole('link', { name: '내 희망 사항' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
    await screen.findByRole('list', { name: '내 희망 사항' });
    const first = within(wishList()).getAllByTestId('wish-text')[0];
    expect(first.textContent).toBe('첫 줄\n둘째 줄');
    expect(first).toHaveClass('whitespace-pre-wrap', 'break-words');
  });

  it('글이 없으면 빈 상태와 `희망 사항 남기러 가기`(홈)', async () => {
    await renderApp('/me/wishes', { as: 'student' });
    expect(await screen.findByText('아직 남긴 희망 사항이 없어요')).toBeInTheDocument();
    expect(
      screen.getByText('홈에서 학교 · 학과와 하고 싶은 것을 남겨 보세요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '희망 사항 남기러 가기' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.queryByRole('list', { name: '내 희망 사항' })).toBeNull();
  });

  it('불러오지 못하면 오류 상태와 다시 시도', async () => {
    server.use(http.get('/api/users/me/tour-wishes', () => wireFail('E500')));
    await renderApp('/me/wishes', { as: 'student' });
    expect(
      await screen.findByRole('button', { name: '다시 시도' }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('뒤로 가기는 `/me`로', async () => {
    const { user, router } = await renderApp('/me/wishes', { as: 'student' });
    await user.click(await screen.findByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
  });
});

describe('내 희망 사항 고치기 (T-07)', () => {
  beforeEach(() => act(() => useDemoStore.setState({ enabled: false })));

  it('`고치기` → 수정 화면: 칸에 그 글의 값(학교 2 · 학과 · 희망 · 날짜), 캡션', async () => {
    const { user, router } = await renderApp('/me/wishes', { as: HAEUN });
    await user.click(await screen.findByRole('link', { name: '고치기' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/me/wishes/${HAEUN_WISH}/edit`),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: '희망 사항 고치기' }),
    ).toBeVisible();
    await screen.findByRole('option', { name: '경희대학교 국제캠퍼스' });
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    expect(field('학과')).toHaveValue('시각디자인');
    expect(field('투어 희망 사항')).toHaveValue(
      '디자인 작업실에서 선배들이 과제하는 모습을 보고, 학생 식당도 가 보고 싶어요.',
    );
    expect(field('희망 날짜 (선택)')).toHaveValue('');
    expect(
      screen.getByText(
        '고쳐도 이미 본 투어 결과는 바뀌지 않아요. 새로 찾으려면 홈에서 다시 남겨 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('그대로면 `저장하기`가 잠기고 사유가 보이며, 고치면 풀린다', async () => {
    await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('바뀐 내용이 없어요.')).toBeInTheDocument();
    expect(saveButton()).toHaveAccessibleDescription('바뀐 내용이 없어요.');
    fireEvent.change(field('학과'), { target: { value: '산업디자인' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.queryByText('바뀐 내용이 없어요.')).toBeNull();
  });

  it('희망만 고치면 PATCH 본문 키가 wish뿐 → 토스트 → 목록에 새 문구', async () => {
    const bodies = watchPatches();
    const { user, router } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    fireEvent.change(field('투어 희망 사항'), {
      target: { value: '  학식도 먹어 보고 싶어요.\n둘째 줄 ' },
    });
    await user.click(saveButton());
    expect(await screen.findByText('희망 사항을 고쳤어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0] as object)).toEqual(['wish']);
    expect(bodies[0]).toEqual({ wish: '학식도 먹어 보고 싶어요.\n둘째 줄' });
    const text = (
      await within(await screen.findByRole('list', { name: '내 희망 사항' })).findAllByTestId(
        'wish-text',
      )
    )[0];
    await waitFor(() => expect(text.textContent).toBe('학식도 먹어 보고 싶어요.\n둘째 줄'));
    // 수정 화면은 기록에서 바뀐다(뒤로 가도 수정 화면이 아니다).
    expect(router.state.location.pathname).not.toContain('/edit');
  });

  it('학교 · 날짜를 고치면 그 칸만 간다(날짜를 지우면 null)', async () => {
    const bodies = watchPatches();
    const { user } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await screen.findByRole('option', { name: '단국대학교 죽전캠퍼스' });
    await waitFor(() => expect(field('학교')).toHaveValue('2'));
    await user.selectOptions(field('학교'), '3');
    fireEvent.change(field('희망 날짜 (선택)'), { target: { value: '2027-01-20' } });
    await user.click(saveButton());
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ campus_id: 3, date: '2027-01-20' });
  });

  it('101자는 칸 오류로 막고 요청하지 않는다', async () => {
    const bodies = watchPatches();
    const { user } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    fireEvent.change(field('투어 희망 사항'), { target: { value: '가'.repeat(101) } });
    await user.click(saveButton());
    expect(await screen.findByText('100자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('서버가 칸 오류를 주면 그 칸 아래에 보이고 다시 저장할 수 있다', async () => {
    server.use(
      http.patch('/api/users/me/tour-wishes/:wishId', () =>
        wireFail('E400', { errors: [{ field: 'wish', reason: '서버가 거절한 희망 사항이에요.' }] }),
      ),
    );
    const { user } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    fireEvent.change(field('투어 희망 사항'), { target: { value: '다른 글' } });
    await user.click(saveButton());
    expect(await screen.findByText('서버가 거절한 희망 사항이에요.')).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('칸 오류가 없는 서버 오류는 errorMessage(code) 토스트로 알리고 이동하지 않으며 다시 저장할 수 있다', async () => {
    server.use(http.patch('/api/users/me/tour-wishes/:wishId', () => wireFail('E403')));
    const { user, router } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    fireEvent.change(field('투어 희망 사항'), { target: { value: '다른 글' } });
    await user.click(saveButton());
    expect(await screen.findByText(errorMessage('FORBIDDEN'))).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/me/wishes/${HAEUN_WISH}/edit`);
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('저장하기를 연달아 눌러도 PATCH는 한 번', async () => {
    const bodies = watchPatches();
    const { user, router } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    fireEvent.change(field('투어 희망 사항'), { target: { value: '연타 시험' } });
    await user.dblClick(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
    expect(bodies).toHaveLength(1);
  });

  it('없는 글이거나 남의 글이면 목록으로 돌려보낸다', async () => {
    const { router } = await renderApp('/me/wishes/99999/edit', { as: HAEUN });
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
    await act(() =>
      router.navigate(
        `/me/wishes/${getDb().tourWishes.find((w) => w.userId === idOf('seojun@demo.kr'))!.id}/edit`,
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
  });

  it('뒤로 가기는 목록으로', async () => {
    const { user, router } = await renderApp(`/me/wishes/${HAEUN_WISH}/edit`, { as: HAEUN });
    await editReady();
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me/wishes'));
  });
});
