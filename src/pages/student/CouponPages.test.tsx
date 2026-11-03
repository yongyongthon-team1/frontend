import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDemoStore } from '@/demo/demoStore';
import { getDb, mutate } from '@/mocks/db/store';
import { redeemCoupon as redeemCouponRule } from '@/mocks/rules/coupons';
import { DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { formatMonthDay } from '@/shared/lib/date';
import { findApplicationId, renderApp } from '@/test/renderApp';

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
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}/coupons`);
    const items = await screen.findAllByRole('link', { name: /할인/ });
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('사용 가능')).toBeInTheDocument();

    await user.click(items[0]!);
    expect(await screen.findByTestId('coupon-code')).toHaveTextContent(/^\d( \d){5}$/);
    expect(screen.getByText('사용 가능')).toBeInTheDocument();
    expect(screen.getByText('탐방 당일에만 사용 가능')).toBeInTheDocument();
    expect(screen.getByText('오늘의 로컬 혜택')).toBeInTheDocument();
    expect(screen.getByText('사장님께 아래 번호를 보여주세요.')).toBeInTheDocument();
    expect(screen.getByText('사장님이 코드를 입력하면 사용 완료로 바뀌어요.')).toBeInTheDocument();
    expect(screen.getByText('탐방 취소 시 해당 쿠폰은 자동 만료됩니다.')).toBeInTheDocument();
    const startsAt = getDb().tours.find((t) => t.id === 1)!.startsAt;
    expect(
      screen.getByText(`쿠폰 1회 사용 / ${formatMonthDay(startsAt)} 당일 만료`),
    ).toBeInTheDocument();
    expect(useDemoStore.getState().lastCoupon?.code).toMatch(/^\d{6}$/);
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
    expect(screen.getByTestId('coupon-code')).toHaveTextContent(/^\d( \d){5}$/);
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
      await screen.findByText(/사용 완료 · \d\d:\d\d/, {}, { timeout: 7000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('리뷰를 남기면 가게 AI 요약에 반영돼요.')).toBeInTheDocument();
  }, 10_000);
});
