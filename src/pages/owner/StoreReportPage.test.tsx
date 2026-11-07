import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { addDaysKey, formatMonthDay, seoulDateKey } from '@/shared/lib/date';
import { demoCouponCode, renderApp } from '@/test/renderApp';
import { wireFail, wireOk } from '@/test/wire';

/**
 * 다른 화면에서 앱을 띄운 뒤 리포트로 이동한다 — 응답을 덮어쓰거나 DB를 고친 다음 그 값으로 그리려는 시험용이다
 * (`renderApp`은 DB를 새로 만든다).
 */
async function renderReport(
  email: string,
  patch?: Parameters<typeof mutate>[0],
  beforeNavigate?: () => void,
) {
  const app = await renderApp('/owner/coupons/redeem', { as: email });
  if (patch) mutate(patch);
  beforeNavigate?.();
  await app.router.navigate('/owner/report');
  return app;
}

const SEED_SUMMARY =
  '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.';

describe('사장님 방문 · 리뷰 리포트 (S-07, owner-s04)', () => {
  it('owner1: 제목 · 기간 · 숫자 카드 셋 · AI 요약 · 최근 리뷰 3개', async () => {
    await renderReport('owner1@demo.kr');
    expect(
      await screen.findByRole('heading', { level: 1, name: '방문 · 리뷰 리포트' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: /우리 가게를 찾은\s*학생들이에요\./ }),
    ).toBeInTheDocument();
    const today = seoulDateKey(new Date());
    const from = formatMonthDay(`${addDaysKey(today, -30)}T00:00:00+09:00`);
    const to = formatMonthDay(`${today}T00:00:00+09:00`);
    expect(screen.getByText(`${from} ~ ${to} 기준이에요.`)).toBeInTheDocument();

    expect(await screen.findByText('5명')).toBeInTheDocument();
    expect(screen.getByText('탐방으로 온 학생')).toBeInTheDocument();
    expect(screen.getByText('4.6')).toBeInTheDocument();
    expect(screen.getByText('평균 별점')).toBeInTheDocument();
    expect(screen.getByText('5개')).toBeInTheDocument();
    expect(screen.getByText('리뷰')).toBeInTheDocument();

    expect(screen.getByText('AI 리뷰 요약')).toBeInTheDocument();
    expect(screen.getByText(SEED_SUMMARY)).toBeInTheDocument();
    expect(screen.getByText('전체 리뷰 5개를 요약했어요.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: '최근 리뷰' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '최근 리뷰' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(
      within(list).getByText('시험 기간엔 사람이 많지만 음식은 빨리 나와요.'),
    ).toBeInTheDocument();
  });

  it('기간 안 방문이 0이어도 전체 리뷰가 있으면 빈 상태 대신 AI 요약과 최근 리뷰를 보인다', async () => {
    await renderReport('owner1@demo.kr', (db) => {
      for (const c of db.coupons) {
        if (c.storeId === 1 && c.status === 'USED') c.usedAt = '2000-01-01T10:00:00+09:00';
      }
    });
    expect(await screen.findByText('0명')).toBeInTheDocument();
    expect(screen.getByText('5개')).toBeInTheDocument();
    expect(screen.getByText(SEED_SUMMARY)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: '최근 리뷰' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.queryByText('아직 탐방으로 온 학생이 없어요')).not.toBeInTheDocument();
  });

  it('쿠폰을 사용 처리한 뒤 30초 안에 돌아와도 방문 수가 바로 늘어 있다', async () => {
    const { user, router } = await renderApp('/owner/report', {
      as: 'owner1@demo.kr',
      checkpoint: 'CONFIRMED',
    });
    expect(await screen.findByText('5명')).toBeInTheDocument();

    await act(() => router.navigate('/owner/coupons/redeem'));
    await user.type(await screen.findByLabelText('6자리 쿠폰 코드'), demoCouponCode(1));
    const button = await screen.findByRole('button', { name: '사용 처리하기' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    await screen.findByRole('heading', { name: '쿠폰 사용이 완료됐어요.' });

    await act(() => router.navigate('/owner/report'));
    expect(await screen.findByText('6명')).toBeInTheDocument();
  });

  it('요약이 아직 없으면 안내 문구만 보이고 캡션은 없다', async () => {
    await renderReport('owner1@demo.kr', (db) => {
      db.reviewSummaries = db.reviewSummaries.filter((s) => s.storeId !== 1);
    });
    expect(await screen.findByText('리뷰가 더 모이면 AI가 요약해 드려요.')).toBeInTheDocument();
    expect(screen.queryByText(/개를 요약했어요\./)).not.toBeInTheDocument();
    expect(screen.queryByText(SEED_SUMMARY)).not.toBeInTheDocument();
  });

  it('리뷰는 없고 방문만 있으면 평균은 -, 최근 리뷰는 빈 안내', async () => {
    await renderReport('owner1@demo.kr', (db) => {
      db.reviews = db.reviews.filter((r) => r.storeId !== 1);
    });
    expect(await screen.findByText('5명')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('0개')).toBeInTheDocument();
    expect(screen.getByText('아직 리뷰가 없어요.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '최근 리뷰' })).not.toBeInTheDocument();
  });

  it('owner3(방문도 리뷰도 없음): 숫자 카드 아래 대신 빈 상태와 쿠폰 사용 처리 행동', async () => {
    await renderReport('owner3@demo.kr');
    expect(await screen.findByText('아직 탐방으로 온 학생이 없어요')).toBeInTheDocument();
    expect(
      screen.getByText('학생들이 쿠폰을 쓰고 리뷰를 남기면 여기에 모여요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '쿠폰 사용 처리하기' })).toHaveAttribute(
      'href',
      '/owner/coupons/redeem',
    );
    expect(screen.getByText('0명')).toBeInTheDocument();
    expect(screen.queryByText('AI 리뷰 요약')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '최근 리뷰' })).not.toBeInTheDocument();
  });

  it('연결된 가게가 없으면 안내와 내 가게로', async () => {
    await renderReport('owner-nostore@demo.kr');
    expect(await screen.findByText('연결된 가게가 없어요')).toBeInTheDocument();
    expect(screen.getByText('가게를 연결하면 리포트를 볼 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 가게로' })).toHaveAttribute('href', '/owner/store');
  });

  it('불러오는 동안은 Skeleton, 숫자는 아직 없다', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderReport('owner1@demo.kr', undefined, () =>
      server.use(
        http.get('/api/users/me/store/report', async () => {
          await gate;
          return wireOk({
            from: '2026-10-01',
            to: '2026-10-31',
            visit_count: 7,
            review_count: 5,
            average_rating: 4.6,
          });
        }),
      ),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: '방문 · 리뷰 리포트' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('리포트를 불러오는 중')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('탐방으로 온 학생')).not.toBeInTheDocument();
    release();
    expect(await screen.findByText('7명')).toBeInTheDocument();
    expect(screen.getByText('10월 1일 ~ 10월 31일 기준이에요.')).toBeInTheDocument();
  });

  it('리포트 조회가 실패하고 데이터가 없으면 ErrorState, 다시 시도하면 숫자', async () => {
    const { user } = await renderReport('owner1@demo.kr', undefined, () =>
      server.use(http.get('/api/users/me/store/report', () => wireFail('E500'))),
    );
    // 5xx는 한 번 다시 시도한 뒤 오류를 보인다.
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('탐방으로 온 학생')).not.toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('5명')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('뒤로 가기는 내 가게로', async () => {
    const { user, router } = await renderReport('owner1@demo.kr');
    await screen.findByText('5명');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/owner/store'));
  });

  it('하단 탭은 내 가게가 활성', async () => {
    await renderReport('owner1@demo.kr');
    await screen.findByText('5명');
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: '내 가게' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: '쿠폰' })).not.toHaveAttribute('aria-current');
  });
});
