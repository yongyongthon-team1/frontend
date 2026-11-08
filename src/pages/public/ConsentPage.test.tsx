import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { useSession } from '@/features/auth/session';
import { getDb, mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { CONSENT_GUIDE_TEXT } from '@/mocks/rules/verification';
import { qk } from '@/shared/api/queryKeys';
import { DEMO_CONSENT_TOKENS } from '@/shared/config/demoAccounts';
import { formatMonthDay, formatTime } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const open = (token: string, as?: string) => renderApp(`/consent/${token}`, as ? { as } : {});
const AGREE = '보호자 동의 완료';
const CHECK = '내용에 동의합니다';
const REJECT = '동의하지 않기';
const BACK = '학생 화면으로 돌아가기';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

/** 이 테스트 동안 나간 `PATCH /api/guardian-consents/…` 본문을 모은다. */
function capturePatches(): unknown[] {
  const bodies: unknown[] = [];
  server.events.on('request:start', ({ request }) => {
    if (
      request.method === 'PATCH' &&
      new URL(request.url).pathname.startsWith('/api/guardian-consents/')
    ) {
      void request
        .clone()
        .json()
        .then((body: unknown) => bodies.push(body));
    }
  });
  return bodies;
}

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** 동의 선택 줄을 체크하고 `보호자 동의 완료`를 누른다(체크 전에는 버튼이 잠겨 있다). */
async function agreeWithCheck(user: User) {
  await user.click(await screen.findByRole('checkbox', { name: CHECK }));
  await user.click(screen.getByRole('button', { name: AGREE }));
}

const consentOf = (token: string) => getDb().guardianConsents.find((g) => g.tokenHash === token)!;

describe('보호자 동의 페이지 (/consent/:token)', () => {
  it('유효한 링크: 브랜드 머리 · 학생 카드(이름 가림) · 단계 목록(guide_text) · 동의 줄 · 기한 · 두 버튼 (뒤로 가기도 돌아가기 링크도 없다)', async () => {
    await open(DEMO_CONSENT_TOKENS.valid);
    expect(
      await screen.findByRole('heading', { level: 1, name: '탐방 참여 동의' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByText('보호자께서 확인하는 페이지예요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
    // 예전 머리(상단 바 제목 · 칩)와 안내 카드 둘 · 동의 대상 소제목은 없다.
    expect(screen.queryByText('고교생 보호자 전용 링크')).not.toBeInTheDocument();
    expect(screen.queryByText('캠퍼스 탐방 참여 동의')).not.toBeInTheDocument();
    expect(screen.queryByText('탐방 방식 및 안전 안내')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: '동의 대상' })).not.toBeInTheDocument();

    // 학생 카드: 이름은 성만 남기고 가리고(강하린 → 강○○) 학교는 보이지 않는다.
    const student = await screen.findByRole('region', { name: '학생 정보' });
    expect(within(student).getByText('학생 정보')).toBeInTheDocument();
    expect(within(student).getByText('강○○ · 고교생')).toBeInTheDocument();
    expect(within(student).getByText('UNIRO 캠퍼스 탐방 서비스')).toBeInTheDocument();
    expect(
      within(student).getByText('대학생 가이드가 개설한 비공식 탐방에 참여합니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/강하린/)).not.toBeInTheDocument();
    expect(screen.queryByText(/수원영통고등학교/)).not.toBeInTheDocument();

    // 단계 목록: 01 · 03은 시안, 02 자리(참여 일시 · 연락처)는 API에 없어 서버 안내문(guide_text)이 대신한다.
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('01 탐방은 학교 공식 프로그램이 아니에요.');
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(steps[1]).toHaveTextContent(`02 ${CONSENT_GUIDE_TEXT}`);
    expect(screen.getByText(CONSENT_GUIDE_TEXT)).toHaveClass('whitespace-pre-wrap');
    expect(steps[2]).toHaveTextContent('03 미성년자 참여에 동의해 주세요.');
    expect(screen.queryByText(/참여 일시/)).not.toBeInTheDocument();

    const expiresAt = consentOf(DEMO_CONSENT_TOKENS.valid).expiresAt!;
    expect(
      screen.getByText(
        `${formatMonthDay(expiresAt)} ${formatTime(expiresAt)}까지 응답할 수 있어요.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('링크 만료 시 학생에게 재요청을 안내합니다.')).toBeInTheDocument();

    // 동의 선택 줄은 비어 있고, 체크 전에는 `보호자 동의 완료`가 잠긴다. `동의하지 않기`는 항상 열려 있다.
    expect(screen.getByRole('checkbox', { name: CHECK })).not.toBeChecked();
    expect(screen.getByRole('button', { name: AGREE })).toBeDisabled();
    expect(screen.getByRole('button', { name: REJECT })).toBeEnabled();
    expect(screen.queryByRole('link', { name: BACK })).not.toBeInTheDocument();
  });

  it('동의 선택을 체크하면 보호자 동의 완료가 열리고, 다시 풀면 잠긴다', async () => {
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    const box = await screen.findByRole('checkbox', { name: CHECK });
    await user.click(box);
    expect(screen.getByRole('button', { name: AGREE })).toBeEnabled();
    await user.click(box);
    expect(screen.getByRole('button', { name: AGREE })).toBeDisabled();
  });

  it('체크 전에는 보호자 동의 완료를 눌러도 요청이 나가지 않는다', async () => {
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await user.click(await screen.findByRole('button', { name: AGREE }));
    expect(patches).toEqual([]);
    expect(consentOf(DEMO_CONSENT_TOKENS.valid).status).toBe('PENDING');
  });

  it('체크하고 보호자 동의 완료 → 동의를 마쳤어요 · 버튼이 사라지고 DB는 AGREED', async () => {
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await agreeWithCheck(user);

    expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
    expect(screen.getByText('학생이 탐방을 신청할 수 있어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument();
    expect(consentOf(DEMO_CONSENT_TOKENS.valid).status).toBe('AGREED');
    await waitFor(() => expect(patches).toEqual([{ agree: true }]));
    // 토큰 세션이 없으면 돌아가기 링크도 없다.
    expect(screen.queryByRole('link', { name: BACK })).not.toBeInTheDocument();
  });

  it('동의하지 않기 → 동의하지 않았어요 (체크 없이도, 확인 창 없이 바로)', async () => {
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await user.click(await screen.findByRole('button', { name: REJECT }));

    expect(await screen.findByText('동의하지 않았어요')).toBeInTheDocument();
    expect(
      screen.getByText('마음이 바뀌면 학생에게 다시 요청해 달라고 해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(consentOf(DEMO_CONSENT_TOKENS.valid).status).toBe('REJECTED');
    await waitFor(() => expect(patches).toEqual([{ agree: false }]));
  });

  it('보호자 동의 완료를 연타해도 요청은 한 번 — 처리 중에는 두 버튼 모두 잠긴다', async () => {
    setMockLatency({ base: 60, ai: 0 });
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await user.click(await screen.findByRole('checkbox', { name: CHECK }));
    const agree = screen.getByRole('button', { name: AGREE });
    await user.dblClick(agree);
    await waitFor(() => expect(screen.getByRole('button', { name: REJECT })).toBeDisabled());
    expect(screen.getByRole('button', { name: AGREE })).toBeDisabled();
    expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
    expect(patches).toEqual([{ agree: true }]);
    expect(consentOf(DEMO_CONSENT_TOKENS.valid).status).toBe('AGREED');
  });

  it('동의하지 않기를 연타해도 요청은 한 번', async () => {
    setMockLatency({ base: 60, ai: 0 });
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await user.dblClick(await screen.findByRole('button', { name: REJECT }));
    expect(await screen.findByText('동의하지 않았어요')).toBeInTheDocument();
    expect(patches).toEqual([{ agree: false }]);
  });

  it('만료된 링크: 만료 카드만 있고 버튼이 없다', async () => {
    await open(DEMO_CONSENT_TOKENS.expired);
    expect(await screen.findByText(errorMessage('CONSENT_LINK_EXPIRED'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument();
  });

  it('이미 동의한 링크: 처리 완료 카드(버튼 없음)', async () => {
    await open(DEMO_CONSENT_TOKENS.agreed);
    expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument();
  });

  it('이미 거부한 링크: 처리 완료 카드(버튼 없음)', async () => {
    await open(DEMO_CONSENT_TOKENS.rejected);
    expect(await screen.findByText('동의하지 않았어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument();
  });

  it('잘못된 링크: 안내 카드 + 다음 행동 문구, 버튼 없음', async () => {
    await open('bad-token');
    expect(await screen.findByText(errorMessage('CONSENT_LINK_INVALID'))).toBeInTheDocument();
    expect(
      screen.getByText('메일의 링크를 다시 눌러 보거나, 학생에게 새 링크를 요청해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
  });

  it('그 밖의 조회 오류(5xx): 다시 시도 버튼이 있는 오류 상태, 누르면 불러온다', async () => {
    let first = true;
    server.use(
      http.get('/api/guardian-consents/:token', () => {
        if (first) {
          first = false;
          return wireFail('E500');
        }
        return undefined;
      }),
    );
    // 5xx는 한 번 더 시도한다(retryOnce) — 두 번째에 성공하면 그대로 보인다.
    await open(DEMO_CONSENT_TOKENS.valid);
    expect(
      await screen.findByRole('button', { name: AGREE }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('조회가 계속 실패하면 오류 상태 + 다시 시도', async () => {
    server.use(http.get('/api/guardian-consents/:token', () => wireFail('E500')));
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(within(alert).getByText(errorMessage('UNKNOWN'))).toBeInTheDocument();
    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('button', { name: AGREE })).toBeInTheDocument();
  });

  it('결정이 410이면 만료 카드로 바뀐다', async () => {
    server.use(http.patch('/api/guardian-consents/:token', () => wireFail('E410_EXPIRED')));
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await agreeWithCheck(user);
    expect(await screen.findByText(errorMessage('CONSENT_LINK_EXPIRED'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
  });

  it('결정이 409(그 사이 처리됨)면 토스트 + 다시 조회해 결과 카드', async () => {
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await user.click(await screen.findByRole('checkbox', { name: CHECK }));
    const agree = screen.getByRole('button', { name: AGREE });
    // 화면을 연 뒤 다른 곳에서 먼저 거부해 버린 상황.
    mutate((db) => {
      db.guardianConsents.find((g) => g.tokenHash === DEMO_CONSENT_TOKENS.valid)!.status =
        'REJECTED';
    });
    await user.click(agree);
    expect(await screen.findByText(errorMessage('ALREADY_PROCESSED'))).toBeInTheDocument();
    expect(await screen.findByText('동의하지 않았어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
  });

  it('그 밖의 결정 오류(5xx): 토스트 + 버튼이 다시 열려 다시 누를 수 있다', async () => {
    server.use(http.patch('/api/guardian-consents/:token', () => wireFail('E500'), { once: true }));
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await agreeWithCheck(user);
    expect(await screen.findByText(errorMessage('UNKNOWN'))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: AGREE })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: AGREE }));
    expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
  });

  describe('토큰 세션이 있을 때 (같은 탭 학생)', () => {
    it('결과 카드 아래에 학생 화면으로 돌아가기 링크(/verify/guardian)', async () => {
      const { user, queryClient } = await open(DEMO_CONSENT_TOKENS.valid, 'waiting@demo.kr');
      await agreeWithCheck(user);
      expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: BACK })).toHaveAttribute('href', '/verify/guardian');
      // 학생의 내 정보 · 시연 토큰이 낡았다고 표시돼 /verify/guardian이 새로고침 없이 새 상태를 읽는다.
      expect(queryClient.getQueryState(qk.me)?.isInvalidated).toBe(true);
    });

    it('링크가 만료됐어도 돌아가기 링크는 결과 카드에만 있다', async () => {
      await open(DEMO_CONSENT_TOKENS.expired, 'expired@demo.kr');
      expect(await screen.findByText(errorMessage('CONSENT_LINK_EXPIRED'))).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: BACK })).not.toBeInTheDocument();
    });

    it('이 공개 화면의 401은 지금 세션을 로그아웃시키지 않는다', async () => {
      server.use(http.get('/api/guardian-consents/:token', () => wireFail('E401')));
      const { router } = await open(DEMO_CONSENT_TOKENS.valid, 'waiting@demo.kr');
      const before = useSession.getState().token;
      expect(before).not.toBeNull();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(useSession.getState().token).toBe(before);
      expect(router.state.location.pathname).toBe(`/consent/${DEMO_CONSENT_TOKENS.valid}`);
    });
  });
});
