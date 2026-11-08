import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { DEMO_CONSENT_TOKENS } from '@/shared/config/demoAccounts';
import { errorMessage } from '@/shared/lib/errors';
import { ME_HIGH_SCHOOL } from '@/test/fixtures/backend/auth';
import { renderApp } from '@/test/renderApp';
import { wireFail, wireOk } from '@/test/wire';

// 보호자 동의 요청(C04, `/verify/guardian`) — 예전 `/verify`의 STEP 2를 떼어 낸 화면.

const SEND = '동의 링크 보내기';
const OPEN_PAGE = '보호자 페이지 열기';
const SKIP = '동의 완료로 건너뛰기';
const WAITING_TEXT = '보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
  useDemoStore.setState({ enabled: false });
});

const demoOn = () => useDemoStore.setState({ enabled: true });
const progress = () => screen.getByRole('region', { name: '진행 상태' });
/** 진행 상태 카드의 제목이 이것이 될 때까지 기다린다(요청 · 건너뛰기로 화면이 바뀌면 카드 요소가 새로 그려진다). */
const expectProgress = (title: string) =>
  waitFor(() => expect(within(progress()).getByText(title)).toBeInTheDocument());

/** 나간 요청 중 이 메서드 · 경로(접두)의 본문을 모은다. */
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

describe('C04 보호자 동의 요청 (/verify/guardian)', () => {
  it('expired(첫 화면): 상단 바 · 제목 · 칸 · 안내 · 진행 상태 카드(링크 만료) · 하단 버튼 · 로그아웃, 하단 탭 없음', async () => {
    await renderApp('/verify/guardian', { as: 'expired@demo.kr' });
    expect(
      await screen.findByRole('heading', { level: 1, name: '보호자 동의 요청' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '보호자 동의가 필요해요.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('고교생은 신청 전 보호자 동의를 받아야 해요.')).toBeInTheDocument();
    // 판정 A1: 보호자 성함 칸은 남는다. 칸은 모두 빈칸에서 시작한다.
    expect(screen.getByLabelText('보호자 성함')).toHaveValue('');
    expect(screen.getByLabelText('보호자 이메일')).toHaveValue('');
    expect(screen.getByLabelText('보호자 이메일')).toHaveAttribute(
      'placeholder',
      'guardian@example.com',
    );
    expect(
      screen.getByText(
        '입력한 이메일로 동의 링크가 전송돼요. 링크에서 탐방 참여 동의를 완료해 주세요.',
      ),
    ).toBeInTheDocument();
    expect(within(progress()).getByText('진행 상태')).toBeInTheDocument();
    expect(within(progress()).getByText('링크 만료')).toBeInTheDocument();
    expect(screen.getByText('동의 링크가 만료됐어요. 다시 보내 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SEND })).toBeEnabled();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });

  it('뒤로 가기는 MY(/me)로 간다', async () => {
    const { user, router } = await renderApp('/verify/guardian', { as: 'expired@demo.kr' });
    await user.click(await screen.findByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
  });

  it('첫 화면이 아니면(rejected는 C03부터) 로그아웃 버튼이 없다', async () => {
    await renderApp('/verify/guardian', { as: 'rejected@demo.kr' });
    expect(await screen.findByLabelText('보호자 성함')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('newbie(미요청): 진행 상태 카드가 미요청 · 동의 완료 안내', async () => {
    await renderApp('/verify/guardian', { as: 'newbie@demo.kr' });
    await expectProgress('미요청');
    expect(screen.getByText('동의가 완료되면 탐방을 신청할 수 있어요.')).toBeInTheDocument();
  });

  it('rejected(거부): 거부 안내 · 빈 폼', async () => {
    await renderApp('/verify/guardian', { as: 'rejected@demo.kr' });
    await expectProgress('거부');
    expect(
      screen.getByText('보호자가 동의하지 않았어요. 이야기를 나눈 뒤 다시 요청해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('보호자 성함')).toHaveValue('');
  });

  it('waiting(동의 대기): 폼 · 버튼 · 로그아웃 없음, 대기 카드 · 7일 안내, 시연 도구가 꺼져 있으면 시연 조작 없음', async () => {
    await renderApp('/verify/guardian', { as: 'waiting@demo.kr' });
    expect(
      await within(await screen.findByRole('region', { name: '진행 상태' })).findByText(
        '동의 요청 대기',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(WAITING_TEXT)).toBeInTheDocument();
    expect(screen.getByText('링크는 보낸 때부터 7일 동안 열 수 있어요.')).toBeInTheDocument();
    expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('보호자 이메일')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SEND })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '동의 링크 다시 보내기' })).not.toBeInTheDocument();
    expect(screen.queryByText(/까지 열 수 있어요/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    // 시연 도구 꺼짐 — 시연 조작 없음(확장 토큰을 읽지도 않는다).
    expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
  });

  it('student(동의 완료): 완료 카드 · 폼 없음 · 탐방 찾아보기', async () => {
    await renderApp('/verify/guardian', { as: 'student@demo.kr' });
    expect(
      await within(await screen.findByRole('region', { name: '진행 상태' })).findByText(
        '동의 완료',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('보호자가 동의했어요.')).toBeInTheDocument();
    expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '탐방 찾아보기' })).toHaveAttribute('href', '/');
  });

  it('pending(심사 중 · 동의 완료): 다음 행동은 인증 상태(/me/status)', async () => {
    await renderApp('/verify/guardian', { as: 'pending@demo.kr' });
    expect(await screen.findByText('보호자가 동의했어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '인증 상태 보기' })).toHaveAttribute(
      'href',
      '/me/status',
    );
  });

  describe('동의 요청', () => {
    it('rejected 재요청: 칸을 채워 보내면 동의 대기, 폼이 사라진다', async () => {
      const { user } = await renderApp('/verify/guardian', { as: 'rejected@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '윤보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      await user.click(screen.getByRole('button', { name: SEND }));

      await expectProgress('동의 요청 대기');
      expect(screen.queryByLabelText('보호자 성함')).not.toBeInTheDocument();
      expect(screen.getByText(WAITING_TEXT)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SEND })).not.toBeInTheDocument();
    });

    it('빈 칸 · 긴 이름 · 틀린 이메일은 문구가 나오고 요청은 나가지 않는다', async () => {
      const posts = capture('POST', '/api/guardian-consents');
      const { user } = await renderApp('/verify/guardian', { as: 'newbie@demo.kr' });
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
      const { user } = await renderApp('/verify/guardian', { as: 'newbie@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '최보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      await user.dblClick(screen.getByRole('button', { name: SEND }));
      await expectProgress('동의 요청 대기');
      expect(posts.count()).toBe(1);
    });

    it('이미 처리된 요청(409)이면 토스트 + 내 정보를 다시 읽는다', async () => {
      const reads = capture('GET', '/api/users/me');
      const { user } = await renderApp('/verify/guardian', { as: 'newbie@demo.kr' });
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

  describe('시연 조작 (시연 도구가 켜졌을 때만, 판정 A9)', () => {
    it('waiting: 보호자 페이지 열기(시연 배지) · 동의 완료로 건너뛰기가 보인다', async () => {
      demoOn();
      await renderApp('/verify/guardian', { as: 'waiting@demo.kr' });
      const open = await screen.findByRole('link', { name: OPEN_PAGE });
      expect(open).toHaveAttribute('href', `/consent/${DEMO_CONSENT_TOKENS.valid}`);
      expect(screen.getByText('시연')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: SKIP })).toBeEnabled();
    });

    it('동의 대기가 아니면 시연 조작이 없다(미요청 · 동의 완료)', async () => {
      demoOn();
      await renderApp('/verify/guardian', { as: 'newbie@demo.kr' });
      await screen.findByLabelText('보호자 성함');
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
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
      await renderApp('/verify/guardian', { as: 'waiting@demo.kr' });
      expect(await screen.findByText(WAITING_TEXT)).toBeInTheDocument();
      // 확장 토큰을 읽는 요청이 끝난 뒤에도 없다.
      await waitFor(() => expect(screen.queryByRole('link', { name: OPEN_PAGE })).toBeNull());
      await new Promise((r) => setTimeout(r, 80));
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('같은 탭 동의 (Review Focus 2): 보호자 페이지에서 동의하고 돌아오면 새로고침 없이 동의 완료', async () => {
      demoOn();
      const { user, router } = await renderApp('/verify/guardian', { as: 'waiting@demo.kr' });
      await user.click(await screen.findByRole('link', { name: OPEN_PAGE }));
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(`/consent/${DEMO_CONSENT_TOKENS.valid}`),
      );
      await user.click(await screen.findByRole('button', { name: '안내 확인 후 동의하기' }));
      expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: '학생 화면으로 돌아가기' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
      await expectProgress('동의 완료');
      expect(screen.getByText('보호자가 동의했어요.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('같은 탭 동의 뒤 돌아오면 내 정보를 다시 읽는 동안 동의 완료로 건너뛰기는 잠겨 있다', async () => {
      demoOn();
      const { user, router } = await renderApp('/verify/guardian', { as: 'waiting@demo.kr' });
      await user.click(await screen.findByRole('link', { name: OPEN_PAGE }));
      await user.click(await screen.findByRole('button', { name: '안내 확인 후 동의하기' }));
      expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
      setMockLatency({ base: 250, ai: 0 }); // 돌아온 화면의 내 정보 다시 읽기를 느리게 한다
      await user.click(screen.getByRole('link', { name: '학생 화면으로 돌아가기' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/verify/guardian'));
      // 캐시된 대기 카드가 보이지만, 다시 읽는 동안에는 누를 수 없다.
      const skip = await screen.findByRole('button', { name: SKIP });
      expect(skip).toBeDisabled();
      // 다시 읽기가 끝나면 동의 완료로 바뀌고 건너뛰기는 사라진다.
      await expectProgress('동의 완료');
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
    });

    it('rejected 재요청 뒤 동의 완료로 건너뛰기: 새로고침 없이 동의 완료 · 요청은 한 번(연타 포함)', async () => {
      demoOn();
      setMockLatency({ base: 60, ai: 0 });
      const patches = capture('PATCH', '/api/guardian-consents/');
      const { user } = await renderApp('/verify/guardian', { as: 'rejected@demo.kr' });
      await user.type(await screen.findByLabelText('보호자 성함'), '윤보호');
      await user.type(screen.getByLabelText('보호자 이메일'), 'parent@example.com');
      await user.click(screen.getByRole('button', { name: SEND }));
      await expectProgress('동의 요청 대기');

      const skip = await screen.findByRole('button', { name: SKIP });
      await user.dblClick(skip);
      expect(await screen.findByText('시연용으로 보호자 동의를 마쳤어요.')).toBeInTheDocument();
      await expectProgress('동의 완료');
      expect(screen.getByText('보호자가 동의했어요.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: SKIP })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: OPEN_PAGE })).not.toBeInTheDocument();
      expect(patches.count()).toBe(1);
      expect(patches.bodies).toEqual([{ agree: true }]);
    });

    it('건너뛰는 사이 이미 처리됐다면(409) 토스트 + 내 정보를 다시 읽는다', async () => {
      demoOn();
      const { user } = await renderApp('/verify/guardian', { as: 'waiting@demo.kr' });
      const skip = await screen.findByRole('button', { name: SKIP });
      mutate((db) => {
        db.guardianConsents.find((g) => g.tokenHash === DEMO_CONSENT_TOKENS.valid)!.status =
          'REJECTED';
      });
      await user.click(skip);
      expect(await screen.findByText(errorMessage('ALREADY_PROCESSED'))).toBeInTheDocument();
      // 다시 읽은 내 정보 — 거부로 바뀌어 다시 요청 폼이 나온다.
      await expectProgress('거부');
      expect(screen.getByLabelText('보호자 성함')).toBeInTheDocument();
    });
  });
});
