import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDb } from '@/mocks/db/store';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { loginAs } from '@/test/loginAs';
import { getCouponLookup, getMyCoupon, getMyCoupons, postRedeem } from './api';

describe('쿠폰 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
  });

  it('학생: 내 쿠폰 목록(신청으로 거르기) · 상세', async () => {
    loginAs(DEMO_EMAILS.student);
    const all = await getMyCoupons();
    expect(all.map((c) => c.storeName)).toEqual(['서천 밥상', '카페 모래시계']);
    expect(await getMyCoupons(all[0].applicationId)).toEqual(all);
    expect(await getMyCoupons(999999)).toEqual([]);
    expect(await getMyCoupon(all[1].id)).toEqual(all[1]);
  });

  it('사장님: 코드 조회 → 사용 처리 → 다시 쓰면 COUPON_ALREADY_USED', async () => {
    // 사장님 1 = 서천 밥상(상점 1). 확정 때 발급된 아직 안 쓴 쿠폰 하나.
    const { code } = getDb().coupons.find((c) => c.storeId === 1 && c.status === 'ISSUED')!;

    loginAs(DEMO_EMAILS.owner);
    expect(await getCouponLookup(code)).toMatchObject({
      code,
      state: 'USABLE',
      storeName: '서천 밥상',
    });
    const result = await postRedeem(code);
    expect(result.coupon).toMatchObject({ code, state: 'USED' });
    await expect(postRedeem(code)).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_ALREADY_USED',
    });
  });
});
