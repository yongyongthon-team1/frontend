import { describe, expect, it } from 'vitest';
import { computeCouponState, couponStateLabel } from './model';

const issued = {
  status: 'ISSUED' as const,
  tourStartsAt: '2026-11-15T14:00:00+09:00',
  expiresAt: '2026-11-15T23:59:59+09:00',
};

describe('computeCouponState', () => {
  it.each([
    ['2026-11-14T12:00:00+09:00', 'BEFORE_DAY'],
    ['2026-11-15T09:00:00+09:00', 'USABLE'],
    ['2026-11-15T23:59:59+09:00', 'USABLE'],
    ['2026-11-16T00:00:01+09:00', 'EXPIRED'],
  ])('쿠폰 상태 now=%s → %s', (now, state) =>
    expect(computeCouponState(issued, new Date(now))).toBe(state),
  );

  it('사용 완료는 시간과 상관없이 USED', () =>
    expect(
      computeCouponState({ ...issued, status: 'USED' }, new Date('2026-11-20T00:00:00+09:00')),
    ).toBe('USED'));

  it('상태가 EXPIRED면 기한 전이어도 EXPIRED', () =>
    expect(
      computeCouponState({ ...issued, status: 'EXPIRED' }, new Date('2026-11-14T12:00:00+09:00')),
    ).toBe('EXPIRED'));
});

describe('couponStateLabel', () => {
  it.each([
    ['BEFORE_DAY', '탐방 당일 사용 가능'],
    ['USABLE', '사용 가능'],
    ['EXPIRED', '만료'],
  ] as const)('%s → %s', (state, label) => expect(couponStateLabel(state, null)).toBe(label));

  it('사용 완료 라벨', () =>
    expect(couponStateLabel('USED', '2026-11-15T15:12:00+09:00')).toBe('사용 완료 · 15:12'));

  it('사용 시각이 없으면 시각 없이', () =>
    expect(couponStateLabel('USED', null)).toBe('사용 완료'));
});
