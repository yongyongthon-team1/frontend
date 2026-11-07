import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { createSeed } from '@/mocks/db/seed';
import { getDb } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { formatShortDate } from '@/shared/lib/date';
import { renderApp, switchAccount } from '@/test/renderApp';
import { ADMIN_VERIFICATION } from '@/test/fixtures/backend/admin';
import { wireFail, wireOk, wirePage } from '@/test/wire';

const LIST = '/admin/verifications';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

const WAITING = 'waiting@demo.kr'; // 강하린 · 고교생 · 심사 대기
const GUIDE_PENDING = 'guide-pending@demo.kr'; // 한도윤 · 대학생 · 심사 대기
const REJECTED = 'rejected@demo.kr'; // 윤서아 · 시드에서 이미 반려

/** 시드의 그 계정 id(`renderApp`이 DB를 다시 만들기 전에 주소를 정하려고 같은 시드로 찾는다). */
const idOf = (email: string) => createSeed(new Date()).users.find((u) => u.email === email)!.id;
const rowOf = (email: string) => getDb().verifications.find((v) => v.id === idOf(email))!;

/** `method` 요청 중 경로가 `path`로 끝나는 것의 개수와 JSON 본문을 모은다. */
function capture(method: string, path: string): { count: () => number; bodies: unknown[] } {
  const bodies: unknown[] = [];
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method !== method || !new URL(request.url).pathname.endsWith(path)) return;
    count += 1;
    void request
      .clone()
      .json()
      .then((body: unknown) => bodies.push(body))
      .catch(() => undefined);
  });
  return { count: () => count, bodies };
}

const step1 = () => screen.getByRole('region', { name: 'STEP 1 · 재학 인증' });

describe('A01 인증 심사 목록 (owner-s06)', () => {
  it('제목 · 소제목 `대기 3건` · 오래된 제출 순(한도윤이 첫 카드, `학교 확인`), 탭 · 처리 완료는 없다', async () => {
    await renderApp(LIST, { as: 'admin' });
    expect(await screen.findByRole('heading', { level: 1, name: '인증 심사' })).toBeVisible();
    expect(screen.getByText('제출된 인증 자료를 검토해 주세요.')).toBeVisible();
    expect(await screen.findByRole('heading', { level: 2, name: '대기 3건' })).toBeVisible();

    const cards = screen.getAllByRole('link', { name: /자료 확인하기/ });
    expect(cards.map((c) => within(c).getByText(/ · (고교생|대학생)$/).textContent)).toEqual([
      '한도윤 · 대학생',
      '오지호 · 고교생',
      '강하린 · 고교생',
    ]);
    const first = within(cards[0]!);
    expect(first.getByText('학생증 심사')).toBeVisible();
    expect(first.getByText(/ 제출 · 학교 확인$/)).toBeVisible();
    expect(first.getByText(/^자료 확인하기/)).toBeVisible();
    expect(cards[0]).toHaveAttribute('href', `${LIST}/${idOf(GUIDE_PENDING)}`);
    expect(within(cards[2]!).getByText(/ 제출 · 재학 확인$/)).toBeVisible();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('처리 완료')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });

  it('제출일은 `formatShortDate` 모양이다', async () => {
    await renderApp(LIST, { as: 'admin' });
    await screen.findByRole('heading', { name: '대기 3건' });
    expect(
      screen.getByText(`${formatShortDate(rowOf(GUIDE_PENDING).submittedAt)} 제출 · 학교 확인`),
    ).toBeInTheDocument();
  });

  it('카드를 누르면 상세로 간다', async () => {
    const { user, router } = await renderApp(LIST, { as: 'admin' });
    await user.click((await screen.findAllByRole('link', { name: /자료 확인하기/ }))[0]!);
    expect(router.state.location.pathname).toBe(`${LIST}/${idOf(GUIDE_PENDING)}`);
  });

  it('오른쪽 위 `로그아웃`은 발표 배지를 비켜 서고, 누르면 /login으로 간다', async () => {
    const { user, router } = await renderApp(LIST, { as: 'admin' });
    const logout = await screen.findByRole('button', { name: '로그아웃' });
    expect(logout.className).toContain('right-[var(--header-action-clear,0px)]');
    await user.click(logout);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('대기가 없으면 `대기 0건` + 빈 상태 문구', async () => {
    server.use(http.get('/api/admin/verifications', () => wirePage([])));
    await renderApp(LIST, { as: 'admin' });
    expect(await screen.findByRole('heading', { level: 2, name: '대기 0건' })).toBeVisible();
    expect(screen.getByText('심사할 요청이 없어요.')).toBeVisible();
    expect(screen.getByText('새 인증 요청이 오면 여기에 보여요.')).toBeVisible();
  });

  it('불러오는 동안 Skeleton, 오류는 안내 + 다시 시도(받은 데이터가 없을 때)', async () => {
    setMockLatency({ base: 50, ai: 0 });
    server.use(http.get('/api/admin/verifications', () => wireFail('E500', { status: 500 })));
    await renderApp(LIST, { as: 'admin' });
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toBeVisible();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /^대기/ })).not.toBeInTheDocument();
  });
});

describe('A02 학생증 상세 심사 (owner-a02)', () => {
  it('강하린: 제목 · 카드 · 사진(alt) · 안내 · 두 버튼, 뒤로 가기는 목록', async () => {
    const { user, router } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '인증 상세 · 승인/반려' }),
    ).toBeVisible();
    expect(await screen.findByRole('heading', { level: 2, name: '제출 자료 확인' })).toBeVisible();
    expect(screen.getByText('이름과 재학 정보를 확인해 주세요.')).toBeVisible();
    expect(screen.getByText('학생증 심사')).toBeVisible();
    expect(screen.getByText('강하린 · 고교생')).toBeVisible();
    expect(screen.getByText('수원영통고등학교')).toBeVisible();
    expect(
      screen.getByText(
        `제출 일시 ${formatShortDate(rowOf(WAITING).submittedAt)} · 학교명·이름 확인 필요`,
      ),
    ).toBeVisible();
    expect(screen.getByText('제출된 증빙 자료')).toBeVisible();
    expect(screen.getByRole('img', { name: '강하린 님이 올린 학생증 사진' })).toHaveAttribute(
      'src',
      '/mock-docs/student-id-hs.svg',
    );
    expect(
      screen.getByText('인증 완료 후에는 원본 증빙 사진을 삭제하도록 처리해요.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '승인 처리하기' })).toBeEnabled();
    expect(screen.getByRole('link', { name: '반려 사유 입력' })).toHaveAttribute(
      'href',
      `${LIST}/${idOf(WAITING)}/reject`,
    );

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.pathname).toBe(LIST);
  });

  it('승인: 확인 창 문구 → 승인하기 → 토스트 + 목록(replace)에 `대기 2건`, PATCH는 { decision }', async () => {
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user, router } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('강하린 님의 재학 인증을 승인할까요?')).toBeVisible();
    expect(
      within(dialog).getByText('승인하면 인증 배지가 표시되고 사진 파일은 바로 삭제돼요.'),
    ).toBeVisible();
    expect(patch.count()).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: '승인하기' }));
    expect(await screen.findByText('강하린 님을 승인했어요.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByRole('heading', { level: 2, name: '대기 2건' })).toBeVisible();
    expect(screen.queryByText('강하린 · 고교생')).not.toBeInTheDocument();
    expect(patch.count()).toBe(1);
    await waitFor(() => expect(patch.bodies).toEqual([{ decision: 'APPROVED' }]));
  });

  it('확인 창에서 돌아가기를 누르면 요청 없이 닫힌다', async () => {
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '돌아가기' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(patch.count()).toBe(0);
    expect(rowOf(WAITING).status).toBe('PENDING');
  });

  it('승인 연타는 요청 1번이고 처리 중에는 돌아가기도 잠긴다', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user, router } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));
    const confirm = await screen.findByRole('button', { name: '승인하기' });
    await user.dblClick(confirm);
    expect(screen.getByRole('button', { name: '돌아가기' })).toBeDisabled();
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(patch.count()).toBe(1);
  });

  it('사진이 안 열려도(onError) 승인은 잠기지 않고, 다시 불러오기로 사진을 다시 건다', async () => {
    const { user } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    fireEvent.error(await screen.findByRole('img', { name: '강하린 님이 올린 학생증 사진' }));
    expect(await screen.findByText('사진을 불러오지 못했어요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '승인 처리하기' })).toBeEnabled();
    expect(screen.queryByRole('img', { name: /학생증 사진/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(screen.getByRole('img', { name: '강하린 님이 올린 학생증 사진' })).toBeVisible();
    expect(screen.queryByText('사진을 불러오지 못했어요.')).not.toBeInTheDocument();
  });

  it('사진이 없으면 `제출된 사진이 없어요.`이고 승인은 그대로 켜져 있다', async () => {
    server.use(
      http.get('/api/admin/verifications/:verificationId', () =>
        wireOk({ ...ADMIN_VERIFICATION.data, verification_id: idOf(WAITING), document_url: null }),
      ),
    );
    await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    expect(await screen.findByText('제출된 사진이 없어요.')).toBeVisible();
    expect(screen.queryByRole('img', { name: /학생증 사진/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '승인 처리하기' })).toBeEnabled();
  });

  it('처리된 건(주소로): `심사 완료` + 결과 칩 + `파일 삭제됨` + `목록으로`, 처리 버튼 · 시각 · 사유 줄은 없다', async () => {
    await renderApp(`${LIST}/${idOf(REJECTED)}`, { as: 'admin' });
    expect(await screen.findByText('심사 완료')).toBeVisible();
    expect(screen.getByText('반려')).toBeVisible();
    expect(screen.getByText('윤서아 · 고교생')).toBeVisible();
    expect(screen.getByText('파일 삭제됨')).toBeVisible();
    expect(screen.queryByRole('img', { name: /학생증 사진/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute('href', LIST);
    expect(screen.queryByRole('button', { name: '승인 처리하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '반려 사유 입력' })).not.toBeInTheDocument();
    expect(screen.queryByText(/반려 사유:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/처리$/)).not.toBeInTheDocument();
    expect(screen.queryByText('학생증 심사')).not.toBeInTheDocument();
  });

  it('승인한 건을 주소로 다시 열면 승인 칩', async () => {
    const { user, router } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '승인하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    await act(() => router.navigate(`${LIST}/${idOf(WAITING)}`));
    expect(await screen.findByText('심사 완료')).toBeVisible();
    expect(screen.getByText('승인')).toBeVisible();
    expect(screen.getByText('파일 삭제됨')).toBeVisible();
    expect(screen.queryByRole('button', { name: '승인 처리하기' })).not.toBeInTheDocument();
  });

  it('다른 곳에서 먼저 처리했으면(409) 토스트 + 목록으로 돌아간다', async () => {
    const { user, router } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    server.use(
      http.patch('/api/admin/verifications/:verificationId', () =>
        wireFail('E409_ALREADY_REVIEWED'),
      ),
    );
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '승인하기' }));
    expect(await screen.findByText('이미 처리된 요청이에요.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('승인이 실패하면(500) 확인 창이 닫히고 토스트, 다시 누를 수 있다', async () => {
    const { user, router } = await renderApp(`${LIST}/${idOf(WAITING)}`, { as: 'admin' });
    server.use(
      http.patch('/api/admin/verifications/:verificationId', () =>
        wireFail('E500', { status: 500 }),
      ),
    );
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '승인하기' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe(`${LIST}/${idOf(WAITING)}`);
    expect(screen.getByRole('button', { name: '승인 처리하기' })).toBeEnabled();
  });

  it('없는 id는 안내 + `목록으로`', async () => {
    await renderApp(`${LIST}/9999`, { as: 'admin' });
    expect(await screen.findByText('찾을 수 없어요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute('href', LIST);
  });

  it('승인 뒤 그 고교생의 /verify STEP 1 배지가 `승인`이다(전파)', async () => {
    const { user, router, queryClient } = await renderApp(`${LIST}/${idOf(WAITING)}`, {
      as: 'admin',
    });
    await user.click(await screen.findByRole('button', { name: '승인 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '승인하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));

    await switchAccount(queryClient, WAITING);
    await act(() => router.navigate('/verify'));
    await screen.findByText('STEP 1 · 재학 인증');
    expect(within(step1()).getByText('승인')).toBeInTheDocument();
  });

  it('승인 뒤 그 가이드의 /guide/verify가 `재학 인증 상태 · 승인`이다(전파)', async () => {
    const { user, router, queryClient } = await renderApp(`${LIST}/${idOf(GUIDE_PENDING)}`, {
      as: 'admin',
    });
    expect(await screen.findByText('한도윤 · 대학생')).toBeVisible();
    expect(screen.getByText('단국대학교 죽전캠퍼스')).toBeVisible();
    expect(screen.getByRole('img', { name: '한도윤 님이 올린 학생증 사진' })).toHaveAttribute(
      'src',
      '/mock-docs/student-id-univ.svg',
    );
    await user.click(screen.getByRole('button', { name: '승인 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '승인하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));

    await switchAccount(queryClient, GUIDE_PENDING);
    await act(() => router.navigate('/guide/verify'));
    expect(await screen.findByText('재학 인증 상태 · 승인')).toBeVisible();
  });
});

describe('A03 반려 사유 입력 (owner-a02 · 반려)', () => {
  const rejectPath = (email: string) => `${LIST}/${idOf(email)}/reject`;
  const reason = () => screen.getByRole('textbox', { name: '반려 사유' });

  it('강하린: 제목 · 심사 대상 카드 · 사유 칸 · 안내 · 반려 처리하기, 뒤로 가기는 상세', async () => {
    const { user, router } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '인증 반려 사유 입력' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', { level: 2, name: '반려 사유를 입력해 주세요.' }),
    ).toBeVisible();
    expect(screen.getByText('사용자가 수정해 재제출할 수 있도록 안내해요.')).toBeVisible();
    expect(screen.getByText('심사 대상')).toBeVisible();
    expect(screen.getByText('강하린 · 고교생')).toBeVisible();
    expect(screen.getByText('학생증 사진 · 재학 확인')).toBeVisible();
    expect(reason()).toHaveAttribute(
      'placeholder',
      '학교명과 이름이 선명하게 보이도록 다시 올려 주세요.',
    );
    expect(
      screen.getByText('반려 사유가 내 정보 화면에 표시되고, 사용자는 재제출할 수 있어요.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '반려 처리하기' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.pathname).toBe(`${LIST}/${idOf(WAITING)}`);
  });

  it('빈 사유 · 공백만 · 101자는 제출 때 칸 아래 오류이고 확인 창도 요청도 없다', async () => {
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    await screen.findByRole('textbox', { name: '반려 사유' });

    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    // 제목과 같은 문구라 칸 아래 오류(role=alert)로 찾는다.
    expect(await screen.findByRole('alert')).toHaveTextContent('반려 사유를 입력해 주세요.');
    expect(reason()).toHaveAttribute('aria-invalid', 'true');

    await user.type(reason(), '   ');
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('반려 사유를 입력해 주세요.');

    await user.clear(reason());
    await user.click(reason());
    await user.paste('가'.repeat(101));
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    expect(await screen.findByText('100자 이내로 적어 주세요.')).toBeVisible();
    expect(screen.queryByRole('alert')).toHaveTextContent('100자 이내로 적어 주세요.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(patch.count()).toBe(0);

    // 고치면 오류가 사라진다.
    await user.clear(reason());
    await user.type(reason(), '흐려요');
    expect(screen.queryByText('100자 이내로 적어 주세요.')).not.toBeInTheDocument();
  });

  it('반려: 확인 창 문구 → 반려하기 → 토스트 + 목록(replace), 본문은 공백을 뺀 사유', async () => {
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user, router } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    await user.type(
      await screen.findByRole('textbox', { name: '반려 사유' }),
      ' 학교명이 보이지 않습니다 ',
    );
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('재학 인증을 반려할까요?')).toBeVisible();
    expect(
      within(dialog).getByText('반려 사유가 학생에게 보이고 사진 파일은 바로 삭제돼요.'),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '반려하기' }));

    expect(await screen.findByText('강하린 님의 인증을 반려했어요.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByRole('heading', { level: 2, name: '대기 2건' })).toBeVisible();
    expect(patch.count()).toBe(1);
    await waitFor(() =>
      expect(patch.bodies).toEqual([
        { decision: 'REJECTED', reject_reason: '학교명이 보이지 않습니다' },
      ]),
    );
    expect(rowOf(WAITING)).toMatchObject({ status: 'REJECTED', documentUrl: null });
  });

  it('반려 연타는 요청 1번', async () => {
    setMockLatency({ base: 150, ai: 0 });
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user, router } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    await user.type(await screen.findByRole('textbox', { name: '반려 사유' }), '흐려요');
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    await user.dblClick(await screen.findByRole('button', { name: '반려하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(patch.count()).toBe(1);
  });

  it('돌아가기로 확인 창을 닫으면 요청이 없고 쓴 사유가 남는다', async () => {
    const patch = capture('PATCH', `${LIST}/${idOf(WAITING)}`);
    const { user } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    await user.type(await screen.findByRole('textbox', { name: '반려 사유' }), '흐려요');
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '돌아가기' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(reason()).toHaveValue('흐려요');
    expect(patch.count()).toBe(0);
  });

  it('서버가 사유 칸을 거절하면(400 reject_reason) 확인 창이 닫히고 칸 아래에 문구', async () => {
    const { user, router } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    server.use(
      http.patch('/api/admin/verifications/:verificationId', () =>
        wireFail('E400', {
          errors: [{ field: 'reject_reason', reason: '반려 사유는 1~100자로 적어 주세요.' }],
        }),
      ),
    );
    await user.type(await screen.findByRole('textbox', { name: '반려 사유' }), '흐려요');
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '반려하기' }));
    expect(await screen.findByText('반려 사유는 1~100자로 적어 주세요.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(rejectPath(WAITING));
  });

  it('다른 곳에서 먼저 처리했으면(409) 토스트 + 목록으로 돌아간다', async () => {
    const { user, router } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    server.use(
      http.patch('/api/admin/verifications/:verificationId', () =>
        wireFail('E409_ALREADY_REVIEWED'),
      ),
    );
    await user.type(await screen.findByRole('textbox', { name: '반려 사유' }), '흐려요');
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '반려하기' }));
    expect(await screen.findByText('이미 처리된 요청이에요.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
  });

  it('이미 처리된 건의 반려 주소는 상세로 replace한다', async () => {
    const { router } = await renderApp(rejectPath(REJECTED), { as: 'admin' });
    expect(await screen.findByText('심사 완료')).toBeVisible();
    expect(router.state.location.pathname).toBe(`${LIST}/${idOf(REJECTED)}`);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('없는 id는 안내 + `목록으로`', async () => {
    await renderApp(`${LIST}/9999/reject`, { as: 'admin' });
    expect(await screen.findByText('찾을 수 없어요.')).toBeVisible();
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute('href', LIST);
  });

  it('반려 뒤 그 고교생의 /verify에 `반려`와 사유가 보인다(전파)', async () => {
    const { user, router, queryClient } = await renderApp(rejectPath(WAITING), { as: 'admin' });
    await user.type(
      await screen.findByRole('textbox', { name: '반려 사유' }),
      '학교명이 보이지 않습니다',
    );
    await user.click(screen.getByRole('button', { name: '반려 처리하기' }));
    await user.click(await screen.findByRole('button', { name: '반려하기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));

    await switchAccount(queryClient, WAITING);
    await act(() => router.navigate('/verify'));
    await screen.findByText('STEP 1 · 재학 인증');
    expect(within(step1()).getByText('반려')).toBeInTheDocument();
    expect(within(step1()).getByText('반려 사유: 학교명이 보이지 않습니다')).toBeInTheDocument();
  });
});
