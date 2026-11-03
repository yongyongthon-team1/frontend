import { describe, expect, it } from 'vitest';
import { DEMO_TOUR_ID } from '@/mocks/db/seed';
import { getDb, resetDb } from '@/mocks/db/store';
import { qk } from '@/shared/api/queryKeys';
import { demoCouponCode, findApplicationId, renderApp } from './renderApp';

describe('renderApp', () => {
  it('as: 내 정보를 불러온 뒤에 끝난다(공개 화면이어도)', async () => {
    const { queryClient, router } = await renderApp('/nope', { as: 'guide' });
    expect(queryClient.getQueryState(qk.me)?.status).toBe('success');
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ email: 'guide@demo.kr' });
    expect(router.state.location.pathname).toBe('/nope');
  });

  it('as에 이메일을 그대로 줄 수 있다', async () => {
    const { queryClient } = await renderApp('/nope', { as: 'newbie@demo.kr' });
    expect(queryClient.getQueryData(qk.me)).toMatchObject({ role: 'HIGH_SCHOOL', name: '최하늘' });
  });
});

describe('테스트 도우미', () => {
  it('findApplicationId: 그 학생의 그 탐방 신청 id', () => {
    resetDb({ today: new Date(), checkpoint: 'APPLIED' });
    const id = findApplicationId('student@demo.kr', DEMO_TOUR_ID);
    expect(getDb().applications.find((a) => a.id === id)).toMatchObject({
      tourId: DEMO_TOUR_ID,
      status: 'PENDING',
    });
  });

  it('findApplicationId: 없으면 알려 준다', () => {
    expect(() => findApplicationId('student@demo.kr', DEMO_TOUR_ID)).toThrow(/student@demo.kr/);
  });

  it('demoCouponCode: 김민지의 탐방 1 신청에 발급된 그 상점 ISSUED 쿠폰', () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const appId = findApplicationId('student@demo.kr', DEMO_TOUR_ID);
    for (const storeId of [1, 2]) {
      const code = demoCouponCode(storeId);
      expect(code).toMatch(/^\d{6}$/);
      expect(getDb().coupons.find((c) => c.code === code)).toMatchObject({
        applicationId: appId,
        storeId,
        status: 'ISSUED',
      });
    }
  });
});
