import { act, createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { GUIDE_INTRO_MAX, GUIDE_MAJOR_MAX } from '@/features/auth/model';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { errorMessage } from '@/shared/lib/errors';
import { testImage } from '@/test/files';
import { renderApp, switchAccount } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const FILE_LABEL = '학생증 사진 올리기';
const SUBMIT = '인증 요청하기';
const SAVE = '프로필 저장';
const MB = 1024 * 1024;

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** 업로드 시험은 accept 걸러내기를 끈다(PDF 같은 틀린 파일이 칸에 들어와야 우리 검사를 볼 수 있다). */
const uploader = () => userEvent.setup({ applyAccept: false });

/** 이 메서드 · 경로(접두)로 나간 요청 수와 JSON 본문을 모은다. */
function capture(method: string, pathPrefix: string): { count: () => number; bodies: unknown[] } {
  const bodies: unknown[] = [];
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.method !== method || !new URL(request.url).pathname.startsWith(pathPrefix)) return;
    count += 1;
    if (request.headers.get('content-type')?.includes('application/json')) {
      void request
        .clone()
        .json()
        .then((body: unknown) => bodies.push(body));
    }
  });
  return { count: () => count, bodies };
}

const univSelect = () => screen.getByRole('combobox', { name: '용용톤 참여 대학' });

describe('/guide/verify 대학생 재학 인증 (C03 · C08 · 상태)', () => {
  it('guide-new(C03): 상단 바 · 제목 · 안내 · 대학 선택 · 사진 카드 · 단계 · 버튼, 하단 탭 없음 · 첫 화면이라 로그아웃', async () => {
    await renderApp('/guide/verify', { as: 'guide-new@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '재학 인증 · 학생증 업로드' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '학생증을 인증해 주세요.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('고교생·대학생 모두 학생증 또는 재학증명서를 제출해요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^반려 사유/)).not.toBeInTheDocument();

    await screen.findByRole('option', { name: '경희대 국제캠퍼스' });
    expect(univSelect()).toHaveValue('');
    expect(
      within(univSelect())
        .getAllByRole('option')
        .map((o) => [o.getAttribute('value'), o.textContent]),
    ).toEqual([
      ['', '용용톤 참여 대학 선택'],
      ['1', '강남대 본교'],
      ['2', '경희대 국제캠퍼스'],
      ['3', '단국대 죽전캠퍼스'],
      ['4', '명지대 자연캠퍼스'],
      ['5', '한국외대 글로벌캠퍼스'],
    ]);
    expect(screen.getByLabelText(FILE_LABEL)).toBeInTheDocument();
    expect(screen.getByText('이름·학교명·재학 여부를 확인할 수 있게 촬영해 주세요.')).toBeVisible();
    expect(screen.getByText('jpg · png, 5MB 이하')).toBeInTheDocument();
    expect(screen.getByText('사진 확인 후 운영자가 심사해요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('뒤로 가기는 가이드 MY(/guide/me)로 간다', async () => {
    const { user, router } = await renderApp('/guide/verify', { as: 'guide-new@demo.kr' });
    await user.click(await screen.findByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me'));
  });

  it('빈 칸을 내면 칸마다 문구, 요청은 나가지 않는다', async () => {
    const posts = capture('POST', '/api/verifications/enrollment');
    const { user } = await renderApp('/guide/verify', { as: 'guide-new@demo.kr' });
    await screen.findByRole('option', { name: '경희대 국제캠퍼스' });
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('용용톤 참여 대학을 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('학생증 또는 재학증명서 사진을 올려 주세요.')).toBeInTheDocument();
    expect(posts.count()).toBe(0);
  });

  it('PDF · 5MB+1 파일은 칸 아래 오류를 내고 고르지 않은 것으로 둔다', async () => {
    const posts = capture('POST', '/api/verifications/enrollment');
    const { router } = await renderApp('/guide/verify', { as: 'guide-new@demo.kr' });
    const input = await screen.findByLabelText(FILE_LABEL);
    const up = uploader();
    await up.upload(input, testImage('id.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(errorMessage('FILE_TYPE'))).toBeInTheDocument();
    await up.upload(input, testImage('big.png', { type: 'image/png', size: 5 * MB + 1 }));
    expect(await screen.findByText(errorMessage('FILE_TOO_LARGE'))).toBeInTheDocument();
    expect(screen.queryByText(/big\.png · /)).not.toBeInTheDocument();
    await up.selectOptions(univSelect(), '3');
    await up.click(screen.getByRole('button', { name: SUBMIT }));
    // 틀린 파일을 막 버렸으면 그 오류 문구를 그대로 둔다(사진을 올려 달라는 문구로 덮지 않는다).
    expect(await screen.findByText(errorMessage('FILE_TOO_LARGE'))).toBeInTheDocument();
    expect(posts.count()).toBe(0);
    expect(router.state.location.pathname).toBe('/guide/verify');
  });

  it('guide-new: 대학 · 사진을 내면 토스트 + 인증 상태(C07)로 간다(replace)', async () => {
    const posts = capture('POST', '/api/verifications/enrollment');
    const { user, router, queryClient } = await renderApp('/guide/verify', {
      as: 'guide-new@demo.kr',
    });
    await screen.findByRole('option', { name: '단국대 죽전캠퍼스' });
    await user.selectOptions(univSelect(), '3');
    await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
    expect(await screen.findByText(/student-id\.jpg · /)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: SUBMIT }));

    expect(await screen.findByText('재학 인증을 제출했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me/status'));
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      verificationStatus: 'PENDING',
      guideProfile: { universityId: 3 },
    });
    expect(posts.count()).toBe(1);
    // replace 이동이라 뒤로 가도 폼으로 돌아오지 않는다.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('인증 요청하기를 연타해도 요청은 한 번', async () => {
    setMockLatency({ base: 60, ai: 0 });
    const posts = capture('POST', '/api/verifications/enrollment');
    const { user, router } = await renderApp('/guide/verify', { as: 'guide-new@demo.kr' });
    await screen.findByRole('option', { name: '단국대 죽전캠퍼스' });
    await user.selectOptions(univSelect(), '3');
    await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
    await user.dblClick(screen.getByRole('button', { name: SUBMIT }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me/status'));
    expect(posts.count()).toBe(1);
  });

  it('서버가 사진을 거절하면(400 document) 그 문장을 칸 아래에 보이고 고른 파일은 비운다', async () => {
    server.use(
      http.post('/api/verifications/enrollment', () =>
        wireFail('E400', {
          errors: [{ field: 'document', reason: '이미지 파일만 올릴 수 있습니다' }],
        }),
      ),
    );
    const { user, router } = await renderApp('/guide/verify', { as: 'guide-new@demo.kr' });
    await screen.findByRole('option', { name: '단국대 죽전캠퍼스' });
    await user.selectOptions(univSelect(), '3');
    await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
    await user.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByText('이미지 파일만 올릴 수 있습니다')).toBeInTheDocument();
    expect(screen.queryByText(/student-id\.jpg/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    expect(router.state.location.pathname).toBe('/guide/verify');
  });

  it('guide-rejected(C08): danger 반려 사유 · 직전 대학(명지) 미리 선택 · A5 안내 · 재제출하면 인증 상태로', async () => {
    const { user, router } = await renderApp('/guide/verify', { as: 'guide-rejected@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '인증 반려 · 재제출' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '인증을 다시 요청해 주세요.' }),
    ).toBeInTheDocument();
    const reason = screen.getByText(
      '반려 사유: 학생증 사진이 흐려 학교 이름을 확인할 수 없어요. 밝은 곳에서 다시 찍어 올려 주세요.',
    );
    expect(reason).toHaveClass('bg-danger-soft');
    expect(screen.getByText('새 사진으로 다시 제출해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('재제출 후 인증 상태를 다시 확인할 수 있어요')).toBeInTheDocument();
    expect(
      screen.queryByText('고교생·대학생 모두 학생증 또는 재학증명서를 제출해요.'),
    ).not.toBeInTheDocument();
    await screen.findByRole('option', { name: '명지대 자연캠퍼스' });
    await waitFor(() => expect(univSelect()).toHaveValue('4'));

    await uploader().upload(screen.getByLabelText('학생증 다시 올리기'), testImage());
    await user.click(screen.getByRole('button', { name: '재제출하기' }));
    expect(await screen.findByText('재학 인증을 제출했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me/status'));
    const userId = getDb().users.find((u) => u.email === 'guide-rejected@demo.kr')!.id;
    expect(getDb().verifications.find((v) => v.id === userId)).toMatchObject({
      status: 'PENDING',
      universityId: 4,
    });
  });

  it('guide-pending: 폼 없음 · 심사 중 상태 줄 + 참여 대학 + 안내, 학과가 없으니 가이드 프로필 작성하기, 로그아웃 없음', async () => {
    await renderApp('/guide/verify', { as: 'guide-pending@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 2, name: '학생증을 심사하고 있어요.' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('단국대학교 죽전캠퍼스')).toBeInTheDocument();
    expect(screen.getByText('학생증 인증').nextSibling).toHaveTextContent('심사 중');
    expect(screen.getByText('승인 전에는 탐방을 개설할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(FILE_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가이드 프로필 작성하기' })).toHaveAttribute(
      'href',
      '/guide/me/profile',
    );
  });

  it('심사 중 + 학과 있음: 내가 개설한 탐방 → /guide/tours', async () => {
    const { router, queryClient } = await renderApp('/explore', { as: 'guide-pending@demo.kr' });
    mutate((db) => {
      const user = db.users.find((u) => u.email === 'guide-pending@demo.kr')!;
      db.guideProfiles.find((p) => p.id === user.id)!.major = '컴퓨터공학과';
    });
    await switchAccount(queryClient, 'guide-pending@demo.kr'); // 내 정보를 새로 받는다
    await act(() => router.navigate('/guide/verify'));
    expect(await screen.findByText('학생증을 심사하고 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내가 개설한 탐방' })).toHaveAttribute(
      'href',
      '/guide/tours',
    );
  });

  it('정다은(승인 · 학과 있음): 승인 완료 상태 줄 + 참여 대학 + 새 탐방 개설하기 → /guide/tours/new', async () => {
    await renderApp('/guide/verify', { as: 'guide' });
    expect(
      await screen.findByRole('heading', { level: 2, name: '재학 인증이 끝났어요.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('학생증 인증').nextSibling).toHaveTextContent('승인 완료');
    expect(await screen.findByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
    expect(screen.getByText('학생증 심사 완료 · 인증 배지 노출')).toBeInTheDocument();
    expect(screen.queryByText('승인 전에는 탐방을 개설할 수 없습니다.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '새 탐방 개설하기' })).toHaveAttribute(
      'href',
      '/guide/tours/new',
    );
    expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
  });

  it('인증한 대학을 5개교 목록에서 못 찾으면 참여 대학 줄이 없다', async () => {
    const { router, queryClient } = await renderApp('/explore', { as: 'guide-pending@demo.kr' });
    mutate((db) => {
      const user = db.users.find((u) => u.email === 'guide-pending@demo.kr')!;
      db.guideProfiles.find((p) => p.id === user.id)!.universityId = 99;
    });
    await switchAccount(queryClient, 'guide-pending@demo.kr');
    await act(() => router.navigate('/guide/verify'));
    expect(await screen.findByText('학생증을 심사하고 있어요.')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(qk.universities)).toBeDefined());
    expect(screen.queryByText('참여 대학')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가이드 프로필 작성하기' })).toBeInTheDocument();
  });
});

describe('G05 가이드 프로필 (/guide/me/profile)', () => {
  const major = () => screen.getByLabelText('전공');
  const intro = () => screen.getByLabelText('소개 한마디');
  const school = () => screen.getByLabelText('학교 · 캠퍼스');

  it('guide-pending: 제목 · 문구 · 학교 칸 readOnly(단국대) · 뒤로 → /guide/me · MY 탭 활성', async () => {
    const { user, router } = await renderApp('/guide/me/profile', {
      as: 'guide-pending@demo.kr',
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: '가이드 프로필 등록' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '내 이야기를 소개해 주세요.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('탐방 참가자에게 보여줄 가이드 정보예요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(school()).toHaveValue('단국대학교 죽전캠퍼스'));
    expect(school()).toHaveAttribute('readonly');
    expect(major()).toHaveValue('');
    expect(intro()).toHaveAttribute('placeholder', '디자인 전공의 실제 하루를 함께 보여드릴게요.');
    expect(screen.getByRole('button', { name: SAVE })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.pathname).toBe('/guide/me');
  });

  it('정다은: 지금 값으로 채워지고 학교 칸은 경희대학교 국제캠퍼스(readOnly)', async () => {
    await renderApp('/guide/me/profile', { as: 'guide' });
    await waitFor(() => expect(major()).toHaveValue('산업디자인학과'));
    expect(intro()).toHaveValue(
      '디자인 공부와 캠퍼스 생활이 궁금한 학생들에게 실제 작업실과 수업 이야기를 들려줄게요.',
    );
    await waitFor(() => expect(school()).toHaveValue('경희대학교 국제캠퍼스'));
    expect(school()).toHaveAttribute('readonly');
  });

  it('guide-new: 학교를 모르면 placeholder 재학 인증 후 채워져요', async () => {
    await renderApp('/guide/me/profile', { as: 'guide-new@demo.kr' });
    await screen.findByLabelText('학교 · 캠퍼스');
    expect(school()).toHaveValue('');
    expect(school()).toHaveAttribute('placeholder', '재학 인증 후 채워져요');
    expect(school()).toHaveAttribute('readonly');
  });

  it('빈 칸 · 길이 초과는 칸마다 문구, 요청은 나가지 않는다', async () => {
    const puts = capture('PUT', '/api/users/me/guide-profile');
    const { user } = await renderApp('/guide/me/profile', { as: 'guide-pending@demo.kr' });
    await screen.findByLabelText('전공');
    await user.click(screen.getByRole('button', { name: SAVE }));
    expect(await screen.findByText('전공 / 학과를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('소개 한마디를 입력해 주세요.')).toBeInTheDocument();

    await user.type(major(), 'ㄱ'.repeat(GUIDE_MAJOR_MAX + 1));
    await user.click(intro());
    await user.paste('ㅎ'.repeat(GUIDE_INTRO_MAX + 1));
    await user.click(screen.getByRole('button', { name: SAVE }));
    expect(await screen.findByText('30자 이내로 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('200자 이내로 적어 주세요.')).toBeInTheDocument();
    expect(puts.count()).toBe(0);

    // 고치기 시작하면 그 칸의 오류는 사라진다.
    await user.clear(major());
    await user.type(major(), '컴퓨터공학과');
    expect(screen.queryByText('30자 이내로 입력해 주세요.')).not.toBeInTheDocument();
  });

  it('전공 칸에서 한글 조합 중 Enter는 제출하지 않는다', async () => {
    const puts = capture('PUT', '/api/users/me/guide-profile');
    const { user } = await renderApp('/guide/me/profile', { as: 'guide-pending@demo.kr' });
    await user.type(await screen.findByLabelText('전공'), '컴퓨터공학과');
    await user.type(intro(), '소개예요.');
    const composing = createEvent.keyDown(major(), { key: 'Enter', isComposing: true });
    fireEvent(major(), composing);
    expect(composing.defaultPrevented).toBe(true);
    expect(puts.count()).toBe(0);
    // 조합 중이 아닌 Enter는 제출한다(대조)
    await user.type(major(), '{Enter}');
    await waitFor(() => expect(puts.count()).toBe(1));
  });

  it('처음 저장(학과 없음): 토스트 + 내 정보에 반영 + 학과가 생겼으니 /guide로 간다', async () => {
    const puts = capture('PUT', '/api/users/me/guide-profile');
    const { user, router, queryClient } = await renderApp('/guide/me/profile', {
      as: 'guide-pending@demo.kr',
    });
    await user.type(await screen.findByLabelText('전공'), '  컴퓨터공학과 ');
    await user.type(intro(), '코딩 수업과 동아리를 알려 드릴게요.');
    await user.click(screen.getByRole('button', { name: SAVE }));

    expect(await screen.findByText('가이드 프로필을 저장했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
    expect(puts.bodies).toEqual([
      { major: '컴퓨터공학과', intro: '코딩 수업과 동아리를 알려 드릴게요.' },
    ]);
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      guideProfile: { universityId: 3, major: '컴퓨터공학과' },
    });
  });

  it('수정 저장(학과 있음): 토스트 + /guide/me로 간다', async () => {
    const { user, router, queryClient } = await renderApp('/guide/me/profile', { as: 'guide' });
    await waitFor(() => expect(major()).toHaveValue('산업디자인학과'));
    await user.clear(major());
    await user.type(major(), '시각디자인학과');
    await user.click(screen.getByRole('button', { name: SAVE }));

    expect(await screen.findByText('가이드 프로필을 저장했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide/me'));
    expect(queryClient.getQueryData(qk.me)).toMatchObject({
      guideProfile: { major: '시각디자인학과' },
    });
  });

  it('프로필 저장을 연타해도 요청은 한 번', async () => {
    setMockLatency({ base: 60, ai: 0 });
    const puts = capture('PUT', '/api/users/me/guide-profile');
    const { user, router } = await renderApp('/guide/me/profile', { as: 'guide-pending@demo.kr' });
    await user.type(await screen.findByLabelText('전공'), '컴퓨터공학과');
    await user.type(intro(), '소개예요.');
    await user.dblClick(screen.getByRole('button', { name: SAVE }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/guide'));
    expect(puts.count()).toBe(1);
  });

  it('서버 칸 오류(major · introduction)는 그 칸 아래에 문장 그대로, 저장 버튼은 다시 눌린다', async () => {
    server.use(
      http.put('/api/users/me/guide-profile', () =>
        wireFail('E400', {
          errors: [
            { field: 'major', reason: '전공은 30자 이하여야 합니다' },
            { field: 'intro', reason: '소개는 200자 이하여야 합니다' },
          ],
        }),
      ),
    );
    const { user, router } = await renderApp('/guide/me/profile', { as: 'guide-pending@demo.kr' });
    await user.type(await screen.findByLabelText('전공'), '컴퓨터공학과');
    await user.type(intro(), '소개예요.');
    await user.click(screen.getByRole('button', { name: SAVE }));
    expect(await screen.findByText('전공은 30자 이하여야 합니다')).toBeInTheDocument();
    expect(screen.getByText('소개는 200자 이하여야 합니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAVE })).toBeEnabled();
    expect(router.state.location.pathname).toBe('/guide/me/profile');
  });

  it('칸 오류가 아닌 실패는 토스트이고 다시 저장할 수 있다', async () => {
    server.use(
      http.put('/api/users/me/guide-profile', () => wireFail('E409_GUIDE_PROFILE_REQUIRED')),
    );
    const { user } = await renderApp('/guide/me/profile', { as: 'guide-pending@demo.kr' });
    await user.type(await screen.findByLabelText('전공'), '컴퓨터공학과');
    await user.type(intro(), '소개예요.');
    await user.click(screen.getByRole('button', { name: SAVE }));
    expect(await screen.findByText(errorMessage('GUIDE_PROFILE_REQUIRED'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAVE })).toBeEnabled();
  });
});
