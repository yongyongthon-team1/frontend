import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { qk } from '@/shared/api/queryKeys';
import { useSession } from '@/features/auth/session';
import { mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

/**
 * `renderApp`은 목업 DB를 새로 만들므로, DB를 고친 뒤에 내 가게로 이동해 그 값으로 그린다. `beforeNavigate`는 앱이 뜬 뒤
 * 이동하기 전에 돈다 — 내 정보(`GET /users/me`) 합성이 `GET /users/me/store`를 부르므로 그 응답을 덮어쓰는 시험은 여기서 덮어쓴다.
 */
async function renderStore(patch?: Parameters<typeof mutate>[0], beforeNavigate?: () => void) {
  const app = await renderApp('/owner/coupons/redeem', { as: 'owner' });
  if (patch) mutate(patch);
  beforeNavigate?.();
  await app.router.navigate('/owner/store');
  return app;
}

/** owner1의 가게 연결을 끊는다(연결된 가게 없음). */
function unlink(db: Parameters<Parameters<typeof mutate>[0]>[0]): void {
  db.stores.find((s) => s.id === 1)!.ownerId = null;
}

describe('사장님 내 가게 (O01 · O01-E, owner-s02)', () => {
  it('O01: 머리 · 가게 카드 · 제휴 칩 · 쿠폰 코드 입력 · 사용 방법', async () => {
    await renderStore();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /학생들이 가게를\s*더 쉽게 찾고 있어요\./,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('동네 탐방과 함께 새로운 손님을 맞이해요.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'UNIRO' })).toBeInTheDocument();
    expect(screen.getByText('MY LOCAL SHOP')).toBeInTheDocument();
    expect(screen.getByText('서천 밥상')).toBeInTheDocument();
    expect(screen.getByText('식사 금액 10% 할인 운영 중')).toBeInTheDocument();
    expect(screen.getByText('제휴 운영 중')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '쿠폰 코드 입력하기' })).toHaveAttribute(
      'href',
      '/owner/coupons/redeem',
    );
    expect(screen.getByRole('heading', { name: '쿠폰 사용 방법' })).toBeInTheDocument();
    expect(screen.getByText('학생이 쿠폰 제시')).toBeInTheDocument();
    expect(screen.getByText('코드 입력 후 처리')).toBeInTheDocument();
    // 가게가 연결돼 있으니 O01-E 문구는 없다.
    expect(screen.queryByText('아직 연결된 가게가 없어요.')).not.toBeInTheDocument();
  });

  it.each([
    ['2099-01-01', '2099-12-31', '제휴 예정'],
    ['2000-01-01', '2000-12-31', '제휴 종료'],
  ])('제휴 기간 %s ~ %s 이면 칩 %s', async (startDate, endDate, chip) => {
    await renderStore((db) => {
      const p = db.partnerships.find((x) => x.storeId === 1)!;
      p.startDate = startDate;
      p.endDate = endDate;
    });
    expect(await screen.findByText(chip)).toBeInTheDocument();
    expect(screen.queryByText('제휴 운영 중')).not.toBeInTheDocument();
  });

  it('제휴가 없으면 제휴 혜택을 설정해 달라는 안내(링크 없음 — 설정 화면은 2B)', async () => {
    await renderStore((db) => {
      db.partnerships = db.partnerships.filter((p) => p.storeId !== 1);
    });
    expect(await screen.findByText('제휴 혜택을 설정해 주세요')).toBeInTheDocument();
    expect(screen.queryByText(/운영 중$/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '제휴 혜택을 설정해 주세요' }),
    ).not.toBeInTheDocument();
  });

  it('O01-E: 연결된 가게가 없으면(404 STORE_NOT_LINKED) 연결 안내와 내 가게 연결하기', async () => {
    const { user, router } = await renderStore((db) => {
      unlink(db);
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: /아직 연결된 가게가\s*없어요\./ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('내 가게를 연결하고 학생들에게 제휴 혜택을 소개해 보세요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('MY LOCAL SHOP')).toBeInTheDocument();
    expect(screen.getByText('가게 연결을 시작해 볼까요?')).toBeInTheDocument();
    expect(
      screen.getByText('연결 후에는 제휴 할인과 쿠폰 사용을 관리할 수 있어요.'),
    ).toBeInTheDocument();
    // 404는 오류 화면이 아니다.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 가게 연결하기' })).toHaveAttribute(
      'href',
      '/owner/store/connect',
    );
    // 도착지는 막다른 곳이 아니다 — 누르면 가게 연결 화면(자리)이 열린다.
    await user.click(screen.getByRole('link', { name: '내 가게 연결하기' }));
    expect(router.state.location.pathname).toBe('/owner/store/connect');
    expect(await screen.findByText('와이어프레임: owner-a01')).toBeInTheDocument();
  });

  it('불러오는 동안은 Skeleton, 로그아웃은 그때도 보인다', async () => {
    await renderStore(undefined, () =>
      server.use(http.get('/api/users/me/store', () => new Promise<never>(() => {}))),
    );
    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    // 화면 낭독기용 h1만 있고(눈에 보이는 제목은 데이터가 온 뒤에), 가게 제목은 아직 없다.
    expect(screen.getByRole('heading', { level: 1, name: '내 가게' })).toHaveClass('sr-only');
    expect(screen.queryByRole('heading', { name: /학생들이 가게를/ })).not.toBeInTheDocument();
    expect(screen.queryByText('아직 연결된 가게가 없어요.')).not.toBeInTheDocument();
  });

  it('조회가 실패하고 받은 데이터가 없으면 ErrorState와 다시 시도', async () => {
    const { user } = await renderStore(undefined, () =>
      server.use(http.get('/api/users/me/store', () => wireFail('E400'))),
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '내 가게' })).toBeInTheDocument();
    expect(screen.queryByText('아직 연결된 가게가 없어요.')).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('서천 밥상')).toBeInTheDocument();
  });

  it('다시 불러오다 실패해도 받은 가게는 그대로 보인다', async () => {
    const { queryClient } = await renderStore();
    await screen.findByText('서천 밥상');
    server.use(http.get('/api/users/me/store', () => wireFail('E400')));
    await queryClient.refetchQueries({ queryKey: qk.myStore });
    expect(queryClient.getQueryState(qk.myStore)?.status).toBe('error');
    expect(screen.getByText('서천 밥상')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['O01', undefined, /학생들이 가게를/],
    ['O01-E', unlink, /아직 연결된 가게가/],
  ])('%s 오른쪽 위 로그아웃 → /login', async (_name, patch, heading) => {
    const { user, router } = await renderStore(patch);
    await screen.findByRole('heading', { level: 1, name: heading });
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useSession.getState().token).toBeNull();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('로그아웃을 연타해도 로그아웃 요청은 한 번이고, 진행 중에는 버튼이 잠긴다', async () => {
    let logouts = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/auth/logout')) logouts++;
    });
    try {
      const { user, router } = await renderStore();
      await screen.findByText('서천 밥상');
      const button = screen.getByRole('button', { name: '로그아웃' });
      await user.dblClick(button);
      expect(button).toBeDisabled();
      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(logouts).toBe(1);
    } finally {
      server.events.removeAllListeners('request:start');
    }
  });

  it('하단 탭: 내 가게가 현재 탭', async () => {
    await renderStore();
    await screen.findByText('서천 밥상');
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: '내 가게' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
