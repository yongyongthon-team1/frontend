import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { mutate } from '@/mocks/db/store';
import { setMockLatency } from '@/mocks/latency';
import { server } from '@/mocks/node';
import { redeemCoupon as redeemCouponRule } from '@/mocks/rules/coupons';
import { qk } from '@/shared/api/queryKeys';
import { DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { demoCouponCode, renderApp } from '@/test/renderApp';

beforeEach(() => {
  // setup.ts는 목업 DB와 localStorage만 비운다 — zustand의 메모리 상태는 직접 되돌린다.
  useDemoStore.setState({ enabled: false, lastCoupon: null });
});

afterEach(() => {
  server.events.removeAllListeners('request:start');
  setMockLatency({ base: 0, ai: 0 }); // 테스트 setup의 값으로 되돌린다
});

const CODE_LABEL = '6자리 쿠폰 코드';

describe('사장님 쿠폰 사용 처리 (owner-s03 · owner-a03)', () => {
  it('조회 → 사용 처리 → 방문 1명', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    expect(screen.getByText('6자리 번호 입력')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '사용 처리' });
    expect(button).toBeDisabled();
    expect(screen.getByText('6자리 코드를 조회하면 사용 처리할 수 있어요.')).toBeInTheDocument();

    await user.type(await screen.findByLabelText(CODE_LABEL), demoCouponCode(1));
    expect(await screen.findByText('쿠폰 확인 결과')).toBeInTheDocument();
    expect(screen.getByText(/^탐방일 \d+월 \d+일\(.\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^혜택 .+/)).toBeInTheDocument();
    expect(screen.getByText('학생 김민지')).toBeInTheDocument();
    expect(screen.getByText('내 가게 쿠폰')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: '사용 처리' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '사용 처리' }));
    expect(await screen.findByText('이번 탐방으로 온 학생 1명')).toBeInTheDocument();
    expect(screen.getByText('사용 완료')).toBeInTheDocument();
    expect(screen.getByText(/^사용 시각 \d\d:\d\d 기록 · 중복 사용 불가$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용 처리' })).not.toBeInTheDocument();
  });

  it('다른 가게 쿠폰', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    await user.type(await screen.findByLabelText(CODE_LABEL), demoCouponCode(2));
    expect(await screen.findByText('만료되었거나 다른 가게 쿠폰')).toBeInTheDocument();
    expect(screen.getByText('코드를 다시 확인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('쿠폰 확인 결과')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사용 처리' })).toBeDisabled();
  });

  it('없는 코드', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    await user.type(await screen.findByLabelText(CODE_LABEL), '000000');
    expect(await screen.findByText('존재하지 않는 6자리 코드')).toBeInTheDocument();
    expect(screen.getByText('입력값을 다시 확인해 주세요.')).toBeInTheDocument();
  });

  it('이미 사용된 쿠폰은 사용 시각', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const code = demoCouponCode(1);
    mutate((db) => {
      const owner = db.users.find((u) => u.email === DEMO_STORE_OWNERS[1])!;
      redeemCouponRule(db, owner.id, code, new Date());
    });
    await user.type(await screen.findByLabelText(CODE_LABEL), code);
    expect(await screen.findByText('이미 사용된 쿠폰')).toBeInTheDocument();
    expect(screen.getByText(/재사용 불가 · 사용 시각 \d\d:\d\d/)).toBeInTheDocument();
  });

  it('조회 뒤 다른 곳에서 먼저 쓰인 쿠폰을 사용 처리하면 이미 사용된 쿠폰', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const code = demoCouponCode(1);
    await user.type(await screen.findByLabelText(CODE_LABEL), code);
    await screen.findByText('쿠폰 확인 결과');
    mutate((db) => {
      const owner = db.users.find((u) => u.email === DEMO_STORE_OWNERS[1])!;
      redeemCouponRule(db, owner.id, code, new Date());
    });
    await user.click(screen.getByRole('button', { name: '사용 처리' }));
    expect(await screen.findByText('이미 사용된 쿠폰')).toBeInTheDocument();
    expect(screen.getByText(/재사용 불가 · 사용 시각 \d\d:\d\d/)).toBeInTheDocument();
    expect(screen.queryByText(/이번 탐방으로 온 학생/)).not.toBeInTheDocument();
  });

  it('?code=로 미리 채운다', async () => {
    await renderApp('/owner/coupons/redeem?code=123456', { as: 'owner' });
    expect(await screen.findByLabelText(CODE_LABEL)).toHaveValue('123456');
    expect(await screen.findByText('존재하지 않는 6자리 코드')).toBeInTheDocument();
  });

  it('?code=의 숫자가 아닌 글자는 지우고 채운다', async () => {
    await renderApp('/owner/coupons/redeem?code=12ab', { as: 'owner' });
    expect(await screen.findByLabelText(CODE_LABEL)).toHaveValue('12');
  });

  it('열린 화면에 ?code=가 다시 들어오면 그 코드로 바꿔 조회한다(쿠폰 가게 사장님 전환을 또 누름)', async () => {
    const { user, router } = await renderApp('/owner/coupons/redeem?code=111111', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const input = await screen.findByLabelText(CODE_LABEL);
    expect(input).toHaveValue('111111');

    const code = demoCouponCode(1);
    await act(() => router.navigate(`/owner/coupons/redeem?code=${code}`));
    expect(input).toHaveValue(code);
    expect(await screen.findByText('쿠폰 확인 결과')).toBeInTheDocument();

    // 같은 주소로 다시 와도(입력을 지운 뒤) 그 코드로 채운다.
    await user.click(screen.getByRole('button', { name: '다른 코드 입력' }));
    expect(input).toHaveValue('');
    await act(() => router.navigate(`/owner/coupons/redeem?code=${code}`));
    expect(input).toHaveValue(code);
  });

  it('사용 처리 연타는 요청 1번 (Review Focus 6)', async () => {
    // 응답이 늦어야 첫 클릭의 요청이 진행 중인 채로 두 번째 클릭이 들어온다.
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    await user.type(await screen.findByLabelText(CODE_LABEL), demoCouponCode(1));
    await screen.findByText('쿠폰 확인 결과');
    setMockLatency({ base: 150, ai: 0 });
    let count = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/redeem')) count++;
    });
    await user.dblClick(screen.getByRole('button', { name: '사용 처리' }));
    expect(await screen.findByText('이번 탐방으로 온 학생 1명')).toBeInTheDocument();
    expect(count).toBe(1);
  });

  it('다른 코드 입력은 입력과 결과 카드를 모두 지운다', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const input = await screen.findByLabelText(CODE_LABEL);
    await user.type(input, demoCouponCode(1));
    await screen.findByText('쿠폰 확인 결과');
    await user.click(screen.getByRole('button', { name: '사용 처리' }));
    await screen.findByText('이번 탐방으로 온 학생 1명');

    await user.click(screen.getByRole('button', { name: '다른 코드 입력' }));
    expect(input).toHaveValue('');
    expect(screen.queryByText('사용 완료')).not.toBeInTheDocument();
    expect(screen.queryByText('쿠폰 확인 결과')).not.toBeInTheDocument();

    await user.type(input, '000000');
    expect(await screen.findByText('존재하지 않는 6자리 코드')).toBeInTheDocument();
    expect(screen.queryByText('사용 완료')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다른 코드 입력' }));
    expect(screen.queryByText('존재하지 않는 6자리 코드')).not.toBeInTheDocument();
  });

  it('도메인 오류가 아닌 조회 실패는 ErrorState와 다시 시도', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const code = demoCouponCode(1);
    server.use(
      http.get('/api/owner/coupons/:code', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    await user.type(await screen.findByLabelText(CODE_LABEL), code);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('만료되었거나 다른 가게 쿠폰')).not.toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('쿠폰 확인 결과')).toBeInTheDocument();
  });

  it('다시 불러오다 실패해도 받은 조회 결과는 그대로 보인다', async () => {
    const { user, queryClient } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const code = demoCouponCode(1);
    await user.type(await screen.findByLabelText(CODE_LABEL), code);
    await screen.findByText('쿠폰 확인 결과');
    server.use(
      http.get('/api/owner/coupons/:code', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'x' }, { status: 403 }),
      ),
    );
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: qk.couponLookup(code) });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(queryClient.getQueryState(qk.couponLookup(code))?.status).toBe('error');
    expect(screen.getByText('쿠폰 확인 결과')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사용 처리' })).toBeEnabled();
  });

  it('시연 도구가 꺼져 있으면 최근 쿠폰 채우기가 없다', async () => {
    useDemoStore.setState({ lastCoupon: { code: '123456', storeId: 1 } });
    await renderApp('/owner/coupons/redeem', { as: 'owner' });
    await screen.findByLabelText(CODE_LABEL);
    expect(screen.queryByRole('button', { name: '최근 쿠폰 채우기' })).not.toBeInTheDocument();
  });

  it('시연 도구가 켜져 있고 최근 쿠폰이 있으면 최근 쿠폰 채우기가 코드를 채운다', async () => {
    const { user } = await renderApp('/owner/coupons/redeem', {
      as: 'owner',
      checkpoint: 'CONFIRMED',
    });
    const code = demoCouponCode(1);
    await screen.findByLabelText(CODE_LABEL);
    expect(screen.queryByRole('button', { name: '최근 쿠폰 채우기' })).not.toBeInTheDocument();
    act(() => {
      useDemoStore.setState({ enabled: true, lastCoupon: { code, storeId: 1 } });
    });
    await user.click(await screen.findByRole('button', { name: '최근 쿠폰 채우기' }));
    expect(screen.getByLabelText(CODE_LABEL)).toHaveValue(code);
    expect(await screen.findByText('쿠폰 확인 결과')).toBeInTheDocument();
  });

  it('최근 쿠폰이 내 가게 쿠폰일 때만 최근 쿠폰 채우기를 보여 준다 (판정 32)', async () => {
    await renderApp('/owner/coupons/redeem', { as: 'owner', checkpoint: 'CONFIRMED' }); // owner1 = 상점 1
    await screen.findByLabelText(CODE_LABEL);
    act(() => {
      useDemoStore.setState({ enabled: true, lastCoupon: { code: demoCouponCode(1), storeId: 1 } });
    });
    expect(await screen.findByRole('button', { name: '최근 쿠폰 채우기' })).toBeInTheDocument();

    // 학생이 마지막으로 본 쿠폰이 다른 가게(상점 2) 것이면 채워도 "다른 가게 쿠폰"이라 버튼을 숨긴다.
    act(() => {
      useDemoStore.setState({ lastCoupon: { code: demoCouponCode(2), storeId: 2 } });
    });
    expect(screen.queryByRole('button', { name: '최근 쿠폰 채우기' })).not.toBeInTheDocument();
  });

  it('저장된 최근 쿠폰이 6자리 숫자가 아니면 채우기 버튼을 숨긴다', async () => {
    useDemoStore.setState({ enabled: true, lastCoupon: { code: 'abc', storeId: 1 } });
    await renderApp('/owner/coupons/redeem', { as: 'owner' });
    await screen.findByLabelText(CODE_LABEL);
    expect(screen.queryByRole('button', { name: '최근 쿠폰 채우기' })).not.toBeInTheDocument();
  });
});
