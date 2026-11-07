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
const AGREE = '안내 확인 후 동의하기';
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

const consentOf = (token: string) => getDb().guardianConsents.find((g) => g.tokenHash === token)!;

describe('보호자 동의 페이지 (/consent/:token)', () => {
  it('유효한 링크: 안내 · 동의 대상 · 기한 · 각주 · 두 버튼 (뒤로 가기도 돌아가기 링크도 없다)', async () => {
    await open(DEMO_CONSENT_TOKENS.valid);
    expect(
      await screen.findByRole('heading', { level: 1, name: '보호자 동의 페이지' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('고교생 보호자 전용 링크')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();

    expect(await screen.findByText('캠퍼스 탐방 참여 동의')).toBeInTheDocument();
    const guide = screen.getByText(CONSENT_GUIDE_TEXT);
    expect(guide).toHaveClass('whitespace-pre-wrap');
    expect(screen.getByText('탐방 방식 및 안전 안내')).toBeInTheDocument();
    expect(
      screen.getByText('참가 신청 후 가이드 승인 · 오픈채팅 연결 · 캠퍼스와 주변 상점 방문'),
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: '동의 대상' })).toBeInTheDocument();
    expect(screen.getByText('학생: 강하린 · 수원영통고등학교')).toBeInTheDocument();
    expect(screen.getByText('탐방 신청 및 관련 정보 제공에 동의합니다.')).toBeInTheDocument();

    const expiresAt = consentOf(DEMO_CONSENT_TOKENS.valid).expiresAt!;
    expect(
      screen.getByText(
        `${formatMonthDay(expiresAt)} ${formatTime(expiresAt)}까지 응답할 수 있어요.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('링크 만료 시 학생에게 재요청을 안내합니다.')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: AGREE })).toBeEnabled();
    expect(screen.getByRole('button', { name: REJECT })).toBeEnabled();
    expect(screen.queryByRole('link', { name: BACK })).not.toBeInTheDocument();
  });

  it('동의하기 → 동의를 마쳤어요 · 버튼이 사라지고 DB는 AGREED', async () => {
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    await user.click(await screen.findByRole('button', { name: AGREE }));

    expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
    expect(screen.getByText('학생이 탐방을 신청할 수 있어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REJECT })).not.toBeInTheDocument();
    expect(consentOf(DEMO_CONSENT_TOKENS.valid).status).toBe('AGREED');
    await waitFor(() => expect(patches).toEqual([{ agree: true }]));
    // 토큰 세션이 없으면 돌아가기 링크도 없다.
    expect(screen.queryByRole('link', { name: BACK })).not.toBeInTheDocument();
  });

  it('동의하지 않기 → 동의하지 않았어요 (확인 창 없이 바로)', async () => {
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

  it('동의하기를 연타해도 요청은 한 번 — 처리 중에는 두 버튼 모두 잠긴다', async () => {
    setMockLatency({ base: 60, ai: 0 });
    const patches = capturePatches();
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    const agree = await screen.findByRole('button', { name: AGREE });
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
    await user.click(await screen.findByRole('button', { name: AGREE }));
    expect(await screen.findByText(errorMessage('CONSENT_LINK_EXPIRED'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: AGREE })).not.toBeInTheDocument();
  });

  it('결정이 409(그 사이 처리됨)면 토스트 + 다시 조회해 결과 카드', async () => {
    const { user } = await open(DEMO_CONSENT_TOKENS.valid);
    const agree = await screen.findByRole('button', { name: AGREE });
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
    await user.click(await screen.findByRole('button', { name: AGREE }));
    expect(await screen.findByText(errorMessage('UNKNOWN'))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: AGREE })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: AGREE }));
    expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
  });

  describe('토큰 세션이 있을 때 (같은 탭 학생)', () => {
    it('결과 카드 아래에 학생 화면으로 돌아가기 링크(/verify)', async () => {
      const { user, queryClient } = await open(DEMO_CONSENT_TOKENS.valid, 'waiting@demo.kr');
      await user.click(await screen.findByRole('button', { name: AGREE }));
      expect(await screen.findByText('동의를 마쳤어요')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: BACK })).toHaveAttribute('href', '/verify');
      // 학생의 내 정보 · 시연 토큰이 낡았다고 표시돼 /verify가 새로고침 없이 새 상태를 읽는다.
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
