import { act, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { getDb } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { errorMessage } from '@/shared/lib/errors';
import { testImage } from '@/test/files';
import { renderApp, switchAccount } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

// 재학 인증(C03) · 반려 재제출(C08) · 심사 중 · 승인 상태 — 고교생 `/verify`. 보호자 동의 요청은 GuardianRequestPage.test.tsx.

const FILE_LABEL = '학생증 사진 올리기';
const RESUBMIT_FILE_LABEL = '학생증 다시 올리기';
const SUBMIT = '인증 요청하기';
const RESUBMIT = '재제출하기';
const MB = 1024 * 1024;

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** 업로드 시험은 accept 걸러내기를 끈다(PDF 같은 틀린 파일이 칸에 들어와야 우리 검사를 볼 수 있다). */
const uploader = () => userEvent.setup({ applyAccept: false });

/** 나간 요청 중 이 메서드 · 경로(접두)의 수와 JSON 본문을 모은다. */
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

const schoolField = () => screen.findByLabelText('학교 이름');
const gradeField = () => screen.getByRole('combobox', { name: '학년' });

describe('C03 재학 인증 · 학생증 업로드 (/verify, 미제출)', () => {
  it('newbie: 상단 바 · 제목 · 안내 · 칸 · 업로드 카드 · 단계 · 하단 버튼, 하단 탭 없음', async () => {
    await renderApp('/verify', { as: 'newbie@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '재학 인증 · 학생증 업로드' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '학생증을 인증해 주세요.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('안전한 투어를 위해 재학 여부를 확인해요.')).toBeInTheDocument();
    expect(
      screen.getByText('고교생·대학생 모두 학생증 또는 재학증명서를 제출해요.'),
    ).toBeInTheDocument();
    // 판정 A1: 학교 이름 · 학년 칸은 남는다(지금 프로필 값으로 시작, 학년 · 사진은 비어 있다).
    expect(screen.getByLabelText('학교 이름')).toHaveValue('수원영통고등학교');
    expect(gradeField()).toHaveValue('');
    expect(screen.getByLabelText(FILE_LABEL)).toBeInTheDocument();
    expect(screen.getByText('이름·학교명·재학 여부를 확인할 수 있게 촬영해 주세요.')).toBeVisible();
    expect(screen.getByText('jpg · png, 5MB 이하')).toBeInTheDocument();
    expect(screen.getByText('사진 확인 후 운영자가 심사해요')).toBeInTheDocument();
    expect(screen.getByText('승인 전에는 투어 신청·개설이 제한돼요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    // 판정 A8: 하단 탭이 없다. 이전의 STEP 칩 · 두 카드도 없다.
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^STEP /)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
  });

  it('뒤로 가기는 MY(/me)로 간다', async () => {
    const { user, router } = await renderApp('/verify', { as: 'newbie@demo.kr' });
    await user.click(await screen.findByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
  });

  it('첫 화면이라(로그인 직후 도착) 로그아웃 버튼이 있고, 누르면 /login', async () => {
    const { user, router } = await renderApp('/verify', { as: 'newbie@demo.kr' });
    await user.click(await screen.findByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  describe('제출', () => {
    it('학교 · 학년 · 사진을 내면 C04(/verify/guardian)로 가고, PATCH 본문과 내 정보에 새 학교 · 학년', async () => {
      const patches = capture('PATCH', '/api/users/me');
      const { user, router, queryClient } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      const school = await schoolField();
      await user.clear(school);
      await user.type(school, '용인고등학교');
      await user.selectOptions(gradeField(), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      expect(await screen.findByText(/student-id\.jpg · /)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: SUBMIT }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
      expect(router.state.historyAction).toBe('REPLACE');
      await waitFor(() =>
        expect(patches.bodies).toEqual([
          expect.objectContaining({ school_name: '용인고등학교', grade: 1 }),
        ]),
      );
      expect(queryClient.getQueryData(qk.me)).toMatchObject({
        verificationStatus: 'PENDING',
        studentProfile: { highSchoolName: '용인고등학교', grade: 1 },
      });
      // 학교 이름은 DB의 인증 행에도 들어갔다.
      const db = getDb();
      const id = db.users.find((u) => u.email === 'newbie@demo.kr')!.id;
      expect(db.verifications.find((v) => v.id === id)).toMatchObject({
        status: 'PENDING',
        highSchoolName: '용인고등학교',
      });
    });

    it('빈 칸을 내면 칸마다 문구, 요청은 나가지 않는다', async () => {
      const posts = capture('POST', '/api/verifications/enrollment');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await user.clear(await schoolField());
      await user.click(screen.getByRole('button', { name: SUBMIT }));
      expect(await screen.findByText('학교 이름을 입력해 주세요.')).toBeInTheDocument();
      expect(screen.getByText('학년을 골라 주세요.')).toBeInTheDocument();
      expect(screen.getByText('학생증 사진을 올려 주세요.')).toBeInTheDocument();

      await user.type(screen.getByLabelText('학교 이름'), 'ㅎ'.repeat(51));
      await user.click(screen.getByRole('button', { name: SUBMIT }));
      expect(await screen.findByText('50자 이내로 적어 주세요.')).toBeInTheDocument();
      expect(posts.count()).toBe(0);
    });

    it('PDF는 형식 오류, 5MB+1은 용량 오류, 정확히 5MB는 통과', async () => {
      await renderApp('/verify', { as: 'newbie@demo.kr' });
      const input = await screen.findByLabelText(FILE_LABEL);
      const pick = uploader();

      await pick.upload(input, testImage('scan.pdf', { type: 'application/pdf' }));
      expect(await screen.findByText('jpg, png 이미지만 올릴 수 있어요.')).toBeInTheDocument();
      expect(screen.queryByText(/scan\.pdf/)).not.toBeInTheDocument();

      await pick.upload(input, testImage('big.jpg', { size: 5 * MB + 1 }));
      expect(await screen.findByText('5MB 이하 이미지만 올릴 수 있어요.')).toBeInTheDocument();
      expect(screen.queryByText('jpg, png 이미지만 올릴 수 있어요.')).not.toBeInTheDocument();

      await pick.upload(input, testImage('exact.png', { type: 'image/png', size: 5 * MB }));
      expect(await screen.findByText(/exact\.png · 5\.0MB/)).toBeInTheDocument();
      expect(screen.queryByText('5MB 이하 이미지만 올릴 수 있어요.')).not.toBeInTheDocument();
    });

    it('인증 요청하기를 연타해도 요청은 한 번', async () => {
      setMockLatency({ base: 60, ai: 0 });
      const posts = capture('POST', '/api/verifications/enrollment');
      const { user, router } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await schoolField();
      await user.selectOptions(gradeField(), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      await user.dblClick(screen.getByRole('button', { name: SUBMIT }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
      expect(posts.count()).toBe(1);
    });

    it('서버가 사진을 거절하면(400 document) 칸 아래에 그 문장을 보이고 고른 파일은 비운다', async () => {
      server.use(
        http.post('/api/verifications/enrollment', () =>
          wireFail('E400', {
            errors: [{ field: 'document', reason: '이미지 파일만 올릴 수 있습니다' }],
          }),
        ),
      );
      const { user, router } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await schoolField();
      await user.selectOptions(gradeField(), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      await user.click(screen.getByRole('button', { name: SUBMIT }));
      expect(await screen.findByText('이미지 파일만 올릴 수 있습니다')).toBeInTheDocument();
      expect(screen.queryByText(/student-id\.jpg/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
      expect(router.state.location.pathname).toBe('/verify');
    });

    it('이미 처리된 제출(409)이면 토스트 + 내 정보를 다시 읽는다', async () => {
      const reads = capture('GET', '/api/users/me');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await schoolField();
      await user.selectOptions(gradeField(), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      // 화면을 연 뒤 다른 곳에서 먼저 제출해 버린 상황.
      server.use(
        http.post('/api/verifications/enrollment', () => wireFail('E409_ALREADY_SUBMITTED')),
      );
      const before = reads.count();
      await user.click(screen.getByRole('button', { name: SUBMIT }));
      expect(await screen.findByText(errorMessage('ALREADY_PROCESSED'))).toBeInTheDocument();
      await waitFor(() => expect(reads.count()).toBeGreaterThan(before));
    });
  });
});

describe('C08 인증 반려 · 재제출 (/verify, 반려)', () => {
  it('rejected: danger 반려 사유 상자 · 다시 올리기 카드 · 단계 · 재제출하기, 학교는 프로필 값', async () => {
    await renderApp('/verify', { as: 'rejected@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '인증 반려 · 재제출' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '인증을 다시 요청해 주세요.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('입력 정보가 확인되지 않았어요.')).toBeInTheDocument();
    const reason = screen.getByText('반려 사유: 학생증 사진이 흐려서 학교 이름을 읽을 수 없어요.');
    expect(reason).toHaveClass('bg-danger-soft');
    // 안내 상자 `고교생·대학생 모두 …`는 C03에만 있다.
    expect(
      screen.queryByText('고교생·대학생 모두 학생증 또는 재학증명서를 제출해요.'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(RESUBMIT_FILE_LABEL)).toBeInTheDocument();
    expect(
      screen.getByText('빛 반사 없이 글자가 선명하게 보이도록 촬영해 주세요.'),
    ).toBeInTheDocument();
    // 판정 A5: `대체돼요`가 아니라 새 사진으로 다시 제출하라는 안내.
    expect(screen.getByText('새 사진으로 다시 제출해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(/대체돼요/)).not.toBeInTheDocument();
    expect(screen.getByText('재제출 후 인증 상태를 다시 확인할 수 있어요')).toBeInTheDocument();
    expect(screen.getByLabelText('학교 이름')).toHaveValue('수원영통고등학교');
    expect(screen.getByRole('button', { name: RESUBMIT })).toBeEnabled();
    expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });

  it('재제출하면 보호자 쪽이 거부 상태라 C04로 간다(심사 중으로 바뀐다)', async () => {
    const { user, router, queryClient } = await renderApp('/verify', { as: 'rejected@demo.kr' });
    await schoolField();
    await user.selectOptions(gradeField(), '2학년');
    await uploader().upload(screen.getByLabelText(RESUBMIT_FILE_LABEL), testImage());
    await user.click(screen.getByRole('button', { name: RESUBMIT }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ verificationStatus: 'PENDING' });
  });

  it('재제출을 연타해도 요청은 한 번', async () => {
    setMockLatency({ base: 60, ai: 0 });
    const posts = capture('POST', '/api/verifications/enrollment');
    const { user, router } = await renderApp('/verify', { as: 'rejected@demo.kr' });
    await schoolField();
    await user.selectOptions(gradeField(), '2학년');
    await uploader().upload(screen.getByLabelText(RESUBMIT_FILE_LABEL), testImage());
    await user.dblClick(screen.getByRole('button', { name: RESUBMIT }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
    expect(posts.count()).toBe(1);
  });
});

describe('심사 중 · 승인 상태 (/verify)', () => {
  it('waiting: 심사 중 상태 줄 · 안내, 폼 없음 · 로그아웃 없음, 다음 행동은 보호자 동의 현황', async () => {
    await renderApp('/verify', { as: 'waiting@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 2, name: '학생증을 심사하고 있어요.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('term')).toHaveTextContent('학생증 인증');
    expect(screen.getByRole('definition')).toHaveTextContent('심사 중');
    expect(
      screen.getByText(
        '운영자가 학생증을 확인하고 있어요. 결과는 여기와 내 정보에서 볼 수 있어요.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('학교 이름')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '보호자 동의 현황 보기' })).toHaveAttribute(
      'href',
      '/verify/guardian',
    );
  });

  it('pending(심사 중 · 동의 완료): 다음 행동은 인증 상태(/me/status)', async () => {
    await renderApp('/verify', { as: 'pending@demo.kr' });
    expect(await screen.findByRole('definition')).toHaveTextContent('심사 중');
    expect(screen.getByRole('link', { name: '인증 상태 보기' })).toHaveAttribute(
      'href',
      '/me/status',
    );
  });

  it('expired(승인 · 링크 만료): 승인 완료 + 보호자 동의 요청하기', async () => {
    await renderApp('/verify', { as: 'expired@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 2, name: '재학 인증이 끝났어요.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('definition')).toHaveTextContent('승인 완료');
    expect(screen.getByText('학생증 심사 완료')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '보호자 동의 요청하기' })).toHaveAttribute(
      'href',
      '/verify/guardian',
    );
  });

  it('student(둘 다 끝): 승인 완료 + 투어 찾아보기 → /', async () => {
    await renderApp('/verify', { as: 'student@demo.kr' });
    expect(await screen.findByRole('definition')).toHaveTextContent('승인 완료');
    expect(screen.getByRole('link', { name: '투어 찾아보기' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
  });

  it('계정을 바꾸면 새 계정의 모습으로 그린다', async () => {
    const { router, queryClient } = await renderApp('/verify', { as: 'newbie@demo.kr' });
    expect(await screen.findByRole('button', { name: SUBMIT })).toBeInTheDocument();
    await switchAccount(queryClient, 'pending@demo.kr');
    await act(() => router.navigate('/verify'));
    expect(await within(document.body).findByRole('definition')).toHaveTextContent('심사 중');
    expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
  });
});
