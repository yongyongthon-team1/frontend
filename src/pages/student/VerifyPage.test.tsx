import { act, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { qk } from '@/shared/api/queryKeys';
import { DEMO_CONSENT_TOKENS } from '@/shared/config/demoAccounts';
import { errorMessage } from '@/shared/lib/errors';
import { testImage } from '@/test/files';
import { ME_HIGH_SCHOOL } from '@/test/fixtures/backend/auth';
import { renderApp, switchAccount } from '@/test/renderApp';
import { wireFail, wireOk } from '@/test/wire';

const FILE_LABEL = '학생증 / 재학증명서 업로드';
const SUBMIT = '재학 인증 제출하기';
const SEND = '동의 링크 보내기';
const OPEN_PAGE = '보호자 페이지 열기';
const SKIP = '동의 완료로 건너뛰기';
const MB = 1024 * 1024;

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
  useDemoStore.setState({ enabled: false });
});

const demoOn = () => useDemoStore.setState({ enabled: true });

/** 업로드 시험은 accept 걸러내기를 끈다(PDF 같은 틀린 파일이 칸에 들어와야 우리 검사를 볼 수 있다). */
const uploader = () => userEvent.setup({ applyAccept: false });

const step1 = () => screen.getByRole('region', { name: 'STEP 1 · 재학 인증' });
const step2 = () => screen.getByRole('region', { name: 'STEP 2 · 보호자 동의 요청' });

/** 나간 요청 중 이 메서드 · 경로(접두)의 본문을 모은다(JSON이면 파싱, multipart면 칸 이름 목록). */
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

describe('재학 인증 · 보호자 동의 (/verify)', () => {
  it('newbie: 제목 · 칩 · 두 카드(미제출 · 미요청) · 두 폼, 뒤로 가기 없음 · MY 탭 활성', async () => {
    await renderApp('/verify', { as: 'newbie@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '인증하고 탐방 신청하기' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MY' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('STEP 1 · 재학 인증 / STEP 2 · 보호자')).toBeInTheDocument();

    expect(within(step1()).getByText('미제출')).toBeInTheDocument();
    expect(within(step2()).getByText('미요청')).toBeInTheDocument();
    expect(screen.queryByText('인증이 끝났어요')).not.toBeInTheDocument();

    // STEP 1 폼: 학교는 지금 값으로 시작하고, 학년 · 사진은 비어 있다.
    expect(screen.getByRole('heading', { level: 2, name: '학교 · 학년' })).toBeInTheDocument();
    expect(screen.getByLabelText('학교 이름')).toHaveValue('수원영통고등학교');
    expect(screen.getByText('예: 수원영통고등학교')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '학년 선택' })).toHaveValue('');
    expect(screen.getByLabelText(FILE_LABEL)).toBeInTheDocument();
    expect(screen.getByText('사진 업로드 후 심사 중 상태로 전환')).toBeInTheDocument();
    expect(screen.getByText('jpg · png, 5MB 이하')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();

    // STEP 2 폼은 빈칸에서 시작한다.
    expect(screen.getByLabelText('보호자 성함')).toHaveValue('');
    expect(screen.getByLabelText('보호자 이메일')).toHaveValue('');
    expect(screen.getByRole('button', { name: SEND })).toBeEnabled();

    expect(screen.getByText('인증 전에도 홈과 탐방 목록은 둘러볼 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈 둘러보기' })).toHaveAttribute('href', '/');
  });

  describe('STEP 1 제출', () => {
    it('학교 · 학년 · 사진을 내면 심사 중 · 폼이 사라지고, PATCH 본문과 내 정보에 새 학교 · 학년', async () => {
      const patches = capture('PATCH', '/api/users/me');
      const { user, queryClient } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      const school = await screen.findByLabelText('학교 이름');
      await user.clear(school);
      await user.type(school, '용인고등학교');
      await user.selectOptions(screen.getByRole('combobox', { name: '학년 선택' }), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      expect(await screen.findByText(/student-id\.jpg · /)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: SUBMIT }));

      expect(await within(step1()).findByText('심사 중')).toBeInTheDocument();
      expect(
        screen.getByText(
          '운영자가 학생증을 확인하고 있어요. 결과는 여기와 내 정보에서 볼 수 있어요.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('학교 이름')).not.toBeInTheDocument();
      expect(screen.queryByText(/^제출 \d/)).not.toBeInTheDocument();

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
      await user.clear(await screen.findByLabelText('학교 이름'));
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

    it('제출하기를 연타해도 요청은 한 번', async () => {
      setMockLatency({ base: 60, ai: 0 });
      const posts = capture('POST', '/api/verifications/enrollment');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await screen.findByLabelText('학교 이름');
      await user.selectOptions(screen.getByRole('combobox', { name: '학년 선택' }), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      await user.dblClick(screen.getByRole('button', { name: SUBMIT }));
      expect(await within(step1()).findByText('심사 중')).toBeInTheDocument();
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
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await screen.findByLabelText('학교 이름');
      await user.selectOptions(screen.getByRole('combobox', { name: '학년 선택' }), '1학년');
      await uploader().upload(screen.getByLabelText(FILE_LABEL), testImage());
      await user.click(screen.getByRole('button', { name: SUBMIT }));
      expect(await screen.findByText('이미지 파일만 올릴 수 있습니다')).toBeInTheDocument();
      expect(screen.queryByText(/student-id\.jpg/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
    });

    it('이미 처리된 제출(409)이면 토스트 + 내 정보를 다시 읽는다', async () => {
      const reads = capture('GET', '/api/users/me');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await screen.findByLabelText('학교 이름');
      await user.selectOptions(screen.getByRole('combobox', { name: '학년 선택' }), '1학년');
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

  describe('계정별 첫 모습', () => {
    it('rejected: 반려 사유 줄 · 다시 제출 폼, 보호자 폼은 빈칸에 거부 안내', async () => {
      await renderApp('/verify', { as: 'rejected@demo.kr' });
      expect(
        await screen.findByText('반려 사유: 학생증 사진이 흐려서 학교 이름을 읽을 수 없어요.'),
      ).toBeInTheDocument();
      expect(within(step1()).getByText('반려')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: SUBMIT })).toBeEnabled();
      expect(within(step2()).getByText('거부')).toBeInTheDocument();
      expect(
        screen.getByText('보호자가 동의하지 않았어요. 이야기를 나눈 뒤 다시 요청해 주세요.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('보호자 성함')).toHaveValue('');
      expect(screen.getByLabelText('보호자 이메일')).toHaveValue('');
      expect(screen.queryByText('인증이 끝났어요')).not.toBeInTheDocument();
    });

    it('expired: 학생증 심사 완료 · 링크 만료 안내와 빈 폼', async () => {
      await renderApp('/verify', { as: 'expired@demo.kr' });
      expect(await screen.findByText('학생증 심사 완료')).toBeInTheDocument();
      expect(within(step1()).getByText('승인')).toBeInTheDocument();
      expect(within(step2()).getByText('링크 만료')).toBeInTheDocument();
      expect(screen.getByText('동의 링크가 만료됐어요. 다시 보내 주세요.')).toBeInTheDocument();
      expect(screen.getByLabelText('보호자 성함')).toHaveValue('');
      expect(screen.queryByRole('button', { name: SUBMIT })).not.toBeInTheDocument();
    });

    it('waiting: 심사 중 안내 · 동의 대기 문구, 폼 · 다시 보내기 없음, 시연 도구가 꺼져 있으면 시연 조작 없음', async () => {
      await renderApp('/verify', { as: 'waiting@demo.kr' });
      expect(await within(step1()).findByText('심사 중')).toBeInTheDocument();
      expect(screen.queryByLabelText('학교 이름')).not.toBeInTheDocument();
      expect(within(step2()).getByText('동의 대기')).toBeInTheDocument();
      expect(
        screen.getByText('보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.'),
      ).toBeInTheDocument();
      expect(screen.getByText('링크는 보낸 때부터 7일 동안 열 수 있어요.')).toBeInTheDocument();
      expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('보호자 이메일')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '동의 링크 다시 보내기' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SEND })).not.toBeInTheDocument();
      expect(screen.queryByText(/까지 열 수 있어요/)).not.toBeInTheDocument();
      // 시연 도구 꺼짐 — 시연 조작 없음(확장 토큰을 읽지도 않는다).
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('pending: 심사 중 · 동의 완료, 폼 없음, 완료 카드 없음', async () => {
      await renderApp('/verify', { as: 'pending@demo.kr' });
      expect(await within(step1()).findByText('심사 중')).toBeInTheDocument();
      expect(within(step2()).getByText('동의 완료')).toBeInTheDocument();
      expect(screen.getByText('보호자가 동의했어요.')).toBeInTheDocument();
      expect(screen.queryByLabelText('학교 이름')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
      expect(screen.queryByText('인증이 끝났어요')).not.toBeInTheDocument();
    });

    it('student: 둘 다 끝 — 완료 카드와 탐방 찾아보기 링크', async () => {
      await renderApp('/verify', { as: 'student@demo.kr' });
      expect(await screen.findByText('인증이 끝났어요')).toBeInTheDocument();
      expect(screen.getByText('이제 탐방을 신청할 수 있어요.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '탐방 찾아보기' })).toHaveAttribute('href', '/');
      expect(within(step1()).getByText('승인')).toBeInTheDocument();
      expect(within(step2()).getByText('동의 완료')).toBeInTheDocument();
      expect(screen.getByText('학생증 심사 완료')).toBeInTheDocument();
    });
  });

  describe('STEP 2 동의 요청', () => {
    it('rejected 재요청: 빈칸을 채워 보내면 동의 대기, 보호자 폼이 사라진다', async () => {
      const { user } = await renderApp('/verify', { as: 'rejected@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '윤보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      await user.click(screen.getByRole('button', { name: SEND }));

      expect(await within(step2()).findByText('동의 대기')).toBeInTheDocument();
      expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
      expect(
        screen.getByText('보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '동의 링크 다시 보내기' }),
      ).not.toBeInTheDocument();
    });

    it('빈 칸 · 긴 이름 · 틀린 이메일은 문구가 나오고 요청은 나가지 않는다', async () => {
      const posts = capture('POST', '/api/guardian-consents');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await user.click(await screen.findByRole('button', { name: SEND }));
      expect(await screen.findByText('보호자 성함을 입력해 주세요.')).toBeInTheDocument();
      expect(screen.getByText('보호자 이메일을 입력해 주세요.')).toBeInTheDocument();

      await user.type(screen.getByLabelText('보호자 성함'), '가'.repeat(21));
      await user.type(screen.getByLabelText('보호자 이메일'), 'not-an-email');
      await user.click(screen.getByRole('button', { name: SEND }));
      expect(await screen.findByText('20자 이내로 적어 주세요.')).toBeInTheDocument();
      expect(screen.getByText('이메일 주소 형식을 확인해 주세요.')).toBeInTheDocument();
      expect(posts.count()).toBe(0);
    });

    it('동의 링크 보내기를 연타해도 요청은 한 번', async () => {
      setMockLatency({ base: 60, ai: 0 });
      const posts = capture('POST', '/api/guardian-consents');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '최보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      await user.dblClick(screen.getByRole('button', { name: SEND }));
      expect(await within(step2()).findByText('동의 대기')).toBeInTheDocument();
      expect(posts.count()).toBe(1);
    });

    it('이미 처리된 요청(409)이면 토스트 + 내 정보를 다시 읽는다', async () => {
      const reads = capture('GET', '/api/users/me');
      const { user } = await renderApp('/verify', { as: 'newbie@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '최보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      // 화면을 연 뒤 다른 곳에서 먼저 요청해 버린 상황.
      server.use(http.post('/api/guardian-consents', () => wireFail('E409_CONSENT_EXISTS')));
      const before = reads.count();
      await user.click(screen.getByRole('button', { name: SEND }));
      expect(await screen.findByText(errorMessage('ALREADY_PROCESSED'))).toBeInTheDocument();
      await waitFor(() => expect(reads.count()).toBeGreaterThan(before));
      expect(screen.getByRole('button', { name: SEND })).toBeEnabled();
    });
  });

  describe('시연 조작 (시연 도구가 켜졌을 때만)', () => {
    it('waiting: 보호자 페이지 열기(시연 배지) · 동의 완료로 건너뛰기가 보인다', async () => {
      demoOn();
      await renderApp('/verify', { as: 'waiting@demo.kr' });
      const open = await screen.findByRole('link', { name: OPEN_PAGE });
      expect(open).toHaveAttribute('href', `/consent/${DEMO_CONSENT_TOKENS.valid}`);
      expect(within(step2()).getByText('시연')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: SKIP })).toBeEnabled();
    });

    it('실서버처럼 내 정보에 확장이 없으면 두 조작을 그리지 않는다', async () => {
      demoOn();
      server.use(
        http.get('/api/users/me', () =>
          wireOk({
            ...ME_HIGH_SCHOOL.data,
            verification_status: 'PENDING',
            guardian_consent_status: 'PENDING',
          }),
        ),
      );
      await renderApp('/verify', { as: 'waiting@demo.kr' });
      expect(
        await screen.findByText(
          '보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.',
        ),
      ).toBeInTheDocument();
      // 확장 토큰을 읽는 요청이 끝난 뒤에도 없다.
      await waitFor(() => expect(screen.queryByRole('link', { name: OPEN_PAGE })).toBeNull());
      await new Promise((r) => setTimeout(r, 80));
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('같은 탭 동의 (Review Focus 2): 보호자 페이지에서 동의하고 돌아오면 새로고침 없이 동의 완료', async () => {
      demoOn();
      const { user, router } = await renderApp('/verify', { as: 'waiting@demo.kr' });
      await user.click(await screen.findByRole('link', { name: OPEN_PAGE }));
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(`/consent/${DEMO_CONSENT_TOKENS.valid}`),
      );
      await user.click(await screen.findByRole('button', { name: '안내 확인 후 동의하기' }));
      expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: '학생 화면으로 돌아가기' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
      expect(await within(step2()).findByText('동의 완료')).toBeInTheDocument();
      expect(screen.getByText('보호자가 동의했어요.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('같은 탭 동의 뒤 돌아오면 내 정보를 다시 읽는 동안 동의 완료로 건너뛰기는 잠겨 있다 (최종 리뷰 Minor 3)', async () => {
      demoOn();
      const { user, router } = await renderApp('/verify', { as: 'waiting@demo.kr' });
      await user.click(await screen.findByRole('link', { name: OPEN_PAGE }));
      await user.click(await screen.findByRole('button', { name: '안내 확인 후 동의하기' }));
      expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
      setMockLatency({ base: 250, ai: 0 }); // 돌아온 /verify의 내 정보 다시 읽기를 느리게 한다
      await user.click(screen.getByRole('link', { name: '학생 화면으로 돌아가기' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/verify'));
      // 캐시된 대기 카드가 보이지만, 다시 읽는 동안에는 누를 수 없다.
      const skip = await screen.findByRole('button', { name: SKIP });
      expect(skip).toBeDisabled();
      // 다시 읽기가 끝나면 동의 완료로 바뀌고 건너뛰기는 사라진다.
      expect(await within(step2()).findByText('동의 완료')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('rejected 재요청 뒤 동의 완료로 건너뛰기(Review Focus 2): 새로고침 없이 동의 완료 · 요청은 한 번(연타 포함)', async () => {
      demoOn();
      setMockLatency({ base: 60, ai: 0 });
      const patches = capture('PATCH', '/api/guardian-consents/');
      const { user } = await renderApp('/verify', { as: 'rejected@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '윤보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      await user.click(screen.getByRole('button', { name: SEND }));
      expect(await within(step2()).findByText('동의 대기')).toBeInTheDocument();

      const skip = await screen.findByRole('button', { name: SKIP });
      await user.dblClick(skip);
      expect(await screen.findByText('시연용으로 보호자 동의를 마쳤어요.')).toBeInTheDocument();
      expect(await within(step2()).findByText('동의 완료')).toBeInTheDocument();
      expect(screen.getByText('보호자가 동의했어요.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(patches.count()).toBe(1);
      expect(patches.bodies).toEqual([{ agree: true }]);
    });

    it('건너뛰는 사이 이미 처리됐다면(409) 토스트 + 내 정보를 다시 읽는다', async () => {
      demoOn();
      const { user } = await renderApp('/verify', { as: 'waiting@demo.kr' });
      const skip = await screen.findByRole('button', { name: SKIP });
      mutate((db) => {
        db.guardianConsents.find((g) => g.tokenHash === DEMO_CONSENT_TOKENS.valid)!.status =
          'REJECTED';
      });
      await user.click(skip);
      expect(await screen.findByText(errorMessage('ALREADY_PROCESSED'))).toBeInTheDocument();
      // 다시 읽은 내 정보 — 거부로 바뀌어 다시 요청 폼이 나온다.
      expect(await within(step2()).findByText('거부')).toBeInTheDocument();
      expect(screen.getByLabelText('보호자 성함')).toBeInTheDocument();
    });
  });

  it('계정을 바꾸면 새 계정의 모습으로 그린다', async () => {
    const { router, queryClient } = await renderApp('/verify', { as: 'newbie@demo.kr' });
    expect(await within(step1()).findByText('미제출')).toBeInTheDocument();
    await switchAccount(queryClient, 'pending@demo.kr');
    await act(() => router.navigate('/verify'));
    expect(await within(step1()).findByText('심사 중')).toBeInTheDocument();
    expect(within(step2()).getByText('동의 완료')).toBeInTheDocument();
  });
});
