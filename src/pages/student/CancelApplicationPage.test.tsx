import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { applyToTour as applyToTourRule } from '@/mocks/rules/applications';
import { findApplicationId, renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const STUDENT = 'student@demo.kr';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
});

function applyFuture() {
  mutate((db) =>
    applyToTourRule(
      db,
      db.users.find((u) => u.email === STUDENT)!.id,
      6,
      '수업이 궁금해요',
      new Date(),
    ),
  );
}

/** 홈에서 시작해 미래 신청을 만든 뒤 취소 확인 화면으로 들어간다. */
async function openCancelPage() {
  const rendered = await renderApp('/', { as: 'student' });
  applyFuture();
  const id = findApplicationId(STUDENT, 6);
  await rendered.router.navigate(`/my-tours/${id}/cancel`);
  return { ...rendered, id };
}

describe('신청 취소 확인 (H11)', () => {
  it('V2 문구: 제목 · 안내 카드 · 취소 대상 카드 · 캡션 · 확정 버튼', async () => {
    await openCancelPage();
    expect(
      await screen.findByRole('heading', { name: '정말 신청을 취소할까요?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('취소 후에는 다시 신청해야 해요.')).toBeInTheDocument();
    expect(screen.getByText('참여 일정이 취소돼요')).toBeInTheDocument();
    expect(screen.getByText('이미 승인된 신청과 연결된 쿠폰도 무효화돼요.')).toBeInTheDocument();
    expect(screen.getByText('취소 대상')).toBeInTheDocument();
    expect(screen.getByText('정원 마감 시 다시 신청하지 못할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신청 취소 확정' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
  });

  it('확정하면 토스트 + 신청 상세(취소됨)로 replace', async () => {
    const { user, router, id } = await openCancelPage();
    await user.click(await screen.findByRole('button', { name: '신청 취소 확정' }));
    expect(await screen.findByText('신청을 취소했어요.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/my-tours/${id}`));
    expect(await screen.findAllByText('취소됨')).toHaveLength(2); // 카드 칩 + 승인 상태 행
    expect(screen.queryByRole('button', { name: '신청 취소하기' })).not.toBeInTheDocument();
    expect(screen.queryByText(/진행 상태/)).not.toBeInTheDocument();
  });

  it('두 번 눌러도 취소 요청은 한 번', async () => {
    const { user } = await openCancelPage();
    let posts = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/cancel')) posts++;
    });
    const confirm = await screen.findByRole('button', { name: '신청 취소 확정' });
    await user.dblClick(confirm);
    await screen.findByText('신청을 취소했어요.');
    expect(posts).toBe(1);
  });

  it('오늘 탐방처럼 취소할 수 없는 신청이면 상세로 replace', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'APPLIED' });
    const id = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${id}/cancel`);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/my-tours/${id}`));
    expect(await screen.findByRole('heading', { name: '신청 내역' })).toBeInTheDocument();
  });

  it('이미 끝난 신청이면 상세로 replace', async () => {
    const { router } = await renderApp('/', { as: 'student' });
    applyFuture();
    const id = findApplicationId(STUDENT, 6);
    mutate((db) => {
      db.applications.find((a) => a.id === id)!.status = 'REJECTED';
    });
    await router.navigate(`/my-tours/${id}/cancel`);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/my-tours/${id}`));
  });

  it('취소가 실패하면 토스트를 보이고 신청을 다시 불러온다(상세로 돌아가 사유 확인)', async () => {
    const { user, router, id } = await openCancelPage();
    // 신청 상세는 내 탐방 행(GET /users/me/tours) + 그 탐방 상세(GET /tours/6)의 합성이다 — 둘 다 센다.
    let rowGets = 0;
    let tourGets = 0;
    server.use(
      http.post('/api/applications/:applicationId/cancel', () =>
        wireFail('E409_INVALID_APPLICATION_STATUS'),
      ),
      http.get('/api/users/me/tours', () => {
        rowGets += 1;
        return undefined; // 기본 핸들러로 넘긴다
      }),
      http.get('/api/tours/6', () => {
        tourGets += 1;
        return undefined;
      }),
    );
    // 기본 핸들러 서버 값은 아직 cancellable=true라 이 화면에 머문다.
    await screen.findByRole('button', { name: '신청 취소 확정' });
    expect([rowGets, tourGets]).toEqual([1, 1]);
    await user.click(screen.getByRole('button', { name: '신청 취소 확정' }));
    // 신청이 아직 대기라 E409_INVALID_APPLICATION_STATUS는 탐방 날짜 사유로 세분된다(2C-R15).
    expect(await screen.findByText('탐방 날짜가 되어 취소할 수 없어요.')).toBeInTheDocument();
    // 상세를 다시 불러온다: 행은 세분용 재조회 1번 + 다시 불러오기 1번, 탐방 상세는 다시 불러오기 1번.
    await waitFor(() => expect([rowGets, tourGets]).toEqual([3, 2]));
    expect(router.state.location.pathname).toBe(`/my-tours/${id}/cancel`);
    // 실패 뒤에도 버튼이 다시 눌린다(처리 중에 갇히지 않는다).
    expect(screen.getByRole('button', { name: '신청 취소 확정' })).toBeEnabled();
  });

  it('취소하면 그 신청의 쿠폰도 다시 불러온다(취소하면 발급된 쿠폰이 만료된다)', async () => {
    const { user, router, id } = await openCancelPage();
    let couponGets = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'GET' && new URL(request.url).pathname === '/api/me/coupons') {
        couponGets++;
      }
    });
    await router.navigate(`/my-tours/${id}/coupons`);
    await waitFor(() => expect(couponGets).toBe(1));

    await router.navigate(`/my-tours/${id}/cancel`);
    await user.click(await screen.findByRole('button', { name: '신청 취소 확정' }));
    expect(await screen.findAllByText('취소됨')).toHaveLength(2); // 카드 칩 + 승인 상태 행

    await router.navigate(`/my-tours/${id}/coupons`);
    await waitFor(() => expect(couponGets).toBe(2));
  });
});
