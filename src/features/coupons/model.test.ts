import { describe, expect, it } from 'vitest';
import { computeCouponState, couponNotice, couponStateLabel, formatCouponCode } from './model';

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

describe('couponNotice (사장님 쿠폰 오류 카드)', () => {
  const USED_AT = '2026-11-15T15:07:00+09:00';
  const used = { title: '이미 사용된 쿠폰', description: '재사용 불가 · 사용 시각 15:07' };
  const expired = {
    title: '만료되었거나 다른 가게 쿠폰',
    description: '코드를 다시 확인해 주세요.',
  };
  const notFound = {
    title: '존재하지 않는 6자리 코드',
    description: '입력값을 다시 확인해 주세요.',
  };
  const notYet = {
    title: '아직 사용할 수 없는 쿠폰',
    description: '탐방 당일에만 사용할 수 있어요.',
  };

  it.each([
    ['COUPON_ALREADY_USED', used],
    ['COUPON_EXPIRED', expired],
    ['COUPON_OTHER_STORE', expired],
    ['COUPON_NOT_FOUND', notFound],
    ['COUPON_NOT_YET', notYet],
  ])('오류 코드 %s', (code, notice) =>
    expect(couponNotice({ errorCode: code, usedAt: USED_AT })).toEqual(notice),
  );

  it.each([
    ['USED', used],
    ['EXPIRED', expired],
    ['BEFORE_DAY', notYet],
  ] as const)('조회 상태 %s', (state, notice) =>
    expect(couponNotice({ state, usedAt: USED_AT })).toEqual(notice),
  );

  it('사용 가능(USABLE)이거나 아무것도 없으면 카드가 없다', () => {
    expect(couponNotice({ state: 'USABLE' })).toBeNull();
    expect(couponNotice({})).toBeNull();
  });

  it('모르는 오류 코드는 카드가 없다(화면이 ErrorState로 보여 준다)', () =>
    expect(couponNotice({ errorCode: 'INTERNAL' })).toBeNull());

  it('이미 사용된 쿠폰인데 사용 시각을 모르면 시각 없이 보여 준다', () =>
    expect(couponNotice({ errorCode: 'COUPON_ALREADY_USED', usedAt: null })).toEqual({
      title: '이미 사용된 쿠폰',
      description: '재사용 불가',
    }));

  it('오류 코드가 조회 상태보다 먼저다', () =>
    expect(couponNotice({ errorCode: 'COUPON_NOT_FOUND', state: 'USED' })).toEqual(notFound));
});

describe('formatCouponCode', () => {
  it('6자리는 3자리씩 끊는다', () => expect(formatCouponCode('824193')).toBe('824 193'));
  it.each(['', '12345', '1234567', 'abcdef', '824 193'])(
    '6자리 숫자가 아니면(%j) 그대로 둔다',
    (code) => expect(formatCouponCode(code)).toBe(code),
  );
});
