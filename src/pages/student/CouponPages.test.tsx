import { act, screen, within } from '@testing-library/react';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { getDb, mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { redeemCoupon as redeemCouponRule } from '@/mocks/rules/coupons';
import { DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { formatDotDate } from '@/shared/lib/date';
import { findApplicationId, redeemDemoCoupon, renderApp } from '@/test/renderApp';
import { wireFail } from '@/test/wire';

const STUDENT = 'student@demo.kr';

beforeEach(() => {
  // setup.ts는 목업 DB와 localStorage만 비운다 — zustand의 메모리 상태는 직접 되돌린다.
  useDemoStore.setState({ lastCoupon: null });
});

describe('쿠폰 목록 · 상세 (hs-s09)', () => {
  it('쿠폰 목록 2장 → 상세 코드와 상태', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    const applicationId = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${applicationId}/coupons`);
    const items = await screen.findAllByRole('link', { name: /할인/ });
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('사용 가능')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/my-tours/${applicationId}/coupons`);

    await user.click(items[0]!);
    expect(await screen.findByTestId('coupon-code')).toHaveTextContent(/^\d{3} \d{3}$/);
    expect(screen.getByRole('heading', { name: '탐방의 작은 혜택' })).toBeInTheDocument();
    expect(screen.getByText('함께 둘러볼 동네 가게에서 사용해요.')).toBeInTheDocument();
    expect(screen.getByText('사용 가능')).toBeInTheDocument();
    expect(screen.getByText('쿠폰 코드')).toBeInTheDocument();
    expect(
      screen.getByText('사장님에게 코드를 보여 주세요. 사용 완료 후 리뷰를 쓸 수 있어요.'),
    ).toBeInTheDocument();
    const startsAt = getDb().tours.find((t) => t.id === 1)!.startsAt;
    expect(
      screen.getByText(`${formatDotDate(startsAt)} 탐방 당일에만 사용할 수 있어요.`),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '코스 지도로 돌아가기' })).toHaveAttribute(
      'href',
      `/my-tours/${applicationId}/course`,
    );
    expect(useDemoStore.getState().lastCoupon?.code).toMatch(/^\d{6}$/);
  });

  it('상점 이름이 쿠폰 코드보다 앞에 나온다 (판정 23)', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    const coupon = getDb().coupons.find((c) => c.applicationId === findApplicationId(STUDENT, 1))!;
    await router.navigate(`/coupons/${coupon.id}`);
    const code = await screen.findByTestId('coupon-code');
    const store = screen.getByRole('heading', { level: 3 });
    expect(store.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('쿠폰이 1장이면 목록에서 바로 상세로 가고, 뒤로 가면 목록이 아니라 그 앞 화면이다', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    const applicationId = findApplicationId(STUDENT, 1);
    mutate((db) => {
      const mine = db.coupons.filter((c) => c.applicationId === applicationId);
      db.coupons = db.coupons.filter((c) => c !== mine[1]);
    });
    const only = getDb().coupons.find((c) => c.applicationId === applicationId)!;
    await router.navigate(`/my-tours/${applicationId}/course`);
    await router.navigate(`/my-tours/${applicationId}/coupons`);

    expect(await screen.findByTestId('coupon-code')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/coupons/${only.id}`);

    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.pathname).toBe(`/my-tours/${applicationId}/course`);
  });

  it('발급된 쿠폰이 없으면 안내를 보인다', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'APPROVED' });
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}/coupons`);
    expect(await screen.findByText('발급된 쿠폰이 없어요.')).toBeInTheDocument();
    expect(
      screen.getByText('코스에 제휴 상점이 있으면 코스 확정 때 쿠폰이 발급돼요.'),
    ).toBeInTheDocument();
  });

  it('만료된 쿠폰은 만료 안내를 보인다', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    const coupon = mutate((db) => {
      const c = db.coupons.find((x) => x.applicationId === findApplicationId(STUDENT, 1))!;
      c.status = 'EXPIRED';
      return { ...c };
    });
    await router.navigate(`/coupons/${coupon.id}`);
    expect(await screen.findByText('만료')).toBeInTheDocument();
    expect(screen.getByText('이 쿠폰은 더 이상 쓸 수 없어요.')).toBeInTheDocument();
    expect(screen.getByTestId('coupon-code')).toHaveTextContent(/^\d{3} \d{3}$/);
  });

  it('사장님이 사용하면 5초 안에 사용 완료로 바뀐다', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}/coupons`);
    const items = await screen.findAllByRole('link', { name: /할인/ });
    await user.click(items[0]!);
    await screen.findByTestId('coupon-code');
    expect(screen.getByText('사용 가능')).toBeInTheDocument();

    const last = useDemoStore.getState().lastCoupon!;
    mutate((db) => {
      const ownerEmail = DEMO_STORE_OWNERS[last.storeId]!;
      const owner = db.users.find((u) => u.email === ownerEmail)!;
      redeemCouponRule(db, owner.id, last.code, new Date());
    });
    expect(
      await screen.findByRole('heading', { name: '쿠폰을 사용했어요!' }, { timeout: 7000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('방문한 가게의 경험을 남겨주세요.')).toBeInTheDocument();
    expect(screen.getByText(/사장님 확인 완료/)).toBeInTheDocument();
    expect(screen.getByText(/^쿠폰 번호/)).toBeInTheDocument();
    expect(screen.getByTestId('coupon-code')).toHaveTextContent(/^\d{3} \d{3}$/);
    expect(screen.getByText('쿠폰은 한 번만 사용할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '방문 리뷰 작성하기' })).toHaveAttribute(
      'href',
      `/reviews/new?couponId=${router.state.location.pathname.split('/').pop()}`,
    );
  }, 10_000);

  it('다시 불러오기가 실패해도 받은 쿠폰 코드는 그대로 보인다', async () => {
    const { router, queryClient } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    const id = getDb().coupons.find((c) => c.applicationId === findApplicationId(STUDENT, 1))!.id;
    await router.navigate(`/coupons/${id}`);
    const shown = (await screen.findByTestId('coupon-code')).textContent;

    server.use(http.get('/api/users/me/coupons', () => wireFail('E403')));
    // 쿼리 관찰자는 상태 변화를 한 틱 뒤에 화면에 알린다 — act 안에서 그 틱까지 기다린 뒤 확인한다.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['myCoupons', 'detail', id] });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(queryClient.getQueryState(['myCoupons', 'detail', id])?.status).toBe('error');
    expect(screen.getByTestId('coupon-code')).toHaveTextContent(shown!);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('리뷰 진입점 (R-01)', () => {
  it('H15 사용 완료의 방문 리뷰 작성하기가 H12로 이어진다', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    const couponId = redeemDemoCoupon(1);
    await router.navigate(`/coupons/${couponId}`);
    await user.click(await screen.findByRole('link', { name: '방문 리뷰 작성하기' }));
    expect(
      await screen.findByRole('heading', { name: '오늘 탐방은 어땠나요?' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      `/reviews/new?couponId=${couponId}`,
    );
  });

  it('쿠폰 목록: 사용한 쿠폰 행에만 리뷰 쓰기, 작성하면 리뷰 작성 완료로 바뀐다', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    const couponId = redeemDemoCoupon(1);
    const applicationId = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${applicationId}/coupons`);

    // 행 전체 링크 두 개는 그대로, 리뷰 쓰기는 사용한 쿠폰의 형제 링크 하나뿐
    expect(await screen.findAllByRole('link', { name: /할인/ })).toHaveLength(2);
    const write = screen.getAllByRole('link', { name: '리뷰 쓰기' });
    expect(write).toHaveLength(1);
    expect(write[0]).toHaveAttribute('href', `/reviews/new?couponId=${couponId}`);
    expect(screen.queryByText('리뷰 작성 완료')).not.toBeInTheDocument();

    await user.click(write[0]!);
    await user.click(await screen.findByRole('radio', { name: '별점 5점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '친절해요');
    await user.click(screen.getByRole('button', { name: '리뷰 등록하기' }));
    // 신청이 승인 상태라 코스 지도(상점 시트가 열린 채)로 착지한다 — 거기서 쿠폰 목록으로 돌아간다.
    await screen.findByRole('dialog', { name: '렌토' });
    await router.navigate(`/my-tours/${applicationId}/coupons`);
    // 사라지는 시트에도 같은 글이 있으니, 쿠폰 목록이 그려진 뒤에 센다.
    await screen.findAllByRole('link', { name: /할인/ });
    expect(await screen.findByText('리뷰 작성 완료')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '리뷰 쓰기' })).not.toBeInTheDocument();
  });

  it('H15: 리뷰를 쓴 쿠폰은 방문 리뷰 작성하기 대신 리뷰 작성 완료', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    const couponId = redeemDemoCoupon(1);
    await router.navigate(`/reviews/new?couponId=${couponId}`);
    await user.click(await screen.findByRole('radio', { name: '별점 4점' }));
    await user.type(screen.getByLabelText('좋았던 점과 아쉬웠던 점'), '좋아요');
    await user.click(screen.getByRole('button', { name: '리뷰 등록하기' }));
    await screen.findByRole('dialog', { name: '렌토' });
    await router.navigate(`/coupons/${couponId}`);
    await screen.findByRole('heading', { name: '쿠폰을 사용했어요!' });
    expect(await screen.findByText('리뷰 작성 완료')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '방문 리뷰 작성하기' })).not.toBeInTheDocument();
  });
});
