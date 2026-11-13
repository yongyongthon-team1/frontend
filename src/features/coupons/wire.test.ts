import { describe, expect, it } from 'vitest';
import { summaryOf } from '@/features/tours/wire';
import { toCamel } from '@/shared/lib/caseKeys';
import { COUPON_LOOKUP, MY_COUPONS } from '@/test/fixtures/backend/coupons';
import { TOUR_31 } from '@/test/fixtures/backend/tours';
import type { Coupon, CouponLookup } from './model';
import { fromWireCoupon, fromWireLookup, type WireCoupon, type WireCouponLookup } from './wire';

const DAY_OF = new Date('2027-01-15T10:00:00+09:00');
const EARLIER = new Date('2026-11-07T12:00:00+09:00');
const row = () => toCamel<WireCoupon>(MY_COUPONS.data.items[0]);
const lookup = () => toCamel<WireCouponLookup>(COUPON_LOOKUP.data);
const ctx = { applicationId: 77, tour: summaryOf(TOUR_31) };

describe('fromWireCoupon (명세 S-05 예시, 확장 없음)', () => {
  it('투어 요약과 신청 id를 합쳐 내 쿠폰으로 읽는다 — 상점 분류는 빈 문자열', () => {
    expect(fromWireCoupon(row(), ctx, DAY_OF)).toEqual({
      id: 501,
      code: '483920',
      status: 'ISSUED',
      state: 'USABLE',
      discount: '음료 1,000원 할인',
      storeId: 201,
      storeName: '용인 분식',
      storeCategory: '',
      applicationId: 77,
      tourId: 31,
      tourTitle: '단국대 죽전캠퍼스 컴퓨터공학과 투어',
      tourStartsAt: '2027-01-15T13:00:00+09:00',
      expiresAt: '2027-01-15T23:59:59+09:00',
      usedAt: null,
      reviewWritten: false,
    } satisfies Coupon);
  });

  it('투어 당일 전이면 BEFORE_DAY, 사용했으면 USED, 기한이 지났으면 EXPIRED — 상태는 어댑터가 계산한다', () => {
    expect(fromWireCoupon(row(), ctx, EARLIER).state).toBe('BEFORE_DAY');
    const used = { ...row(), status: 'USED' as const, usedAt: '2027-01-15T13:40:00+09:00' };
    expect(fromWireCoupon(used, ctx, DAY_OF)).toMatchObject({
      state: 'USED',
      usedAt: '2027-01-15T13:40:00+09:00',
    });
    expect(fromWireCoupon(row(), ctx, new Date('2027-01-16T00:00:01+09:00')).state).toBe('EXPIRED');
    expect(fromWireCoupon({ ...row(), status: 'EXPIRED' }, ctx, EARLIER).state).toBe('EXPIRED');
  });

  it('투어 당일 0시 경계: 전날 23:59:59는 BEFORE_DAY, 당일 00:00:00은 USABLE(서울)', () => {
    expect(fromWireCoupon(row(), ctx, new Date('2027-01-14T23:59:59+09:00')).state).toBe(
      'BEFORE_DAY',
    );
    expect(fromWireCoupon(row(), ctx, new Date('2027-01-15T00:00:00+09:00')).state).toBe('USABLE');
    const at = (iso: string) => fromWireLookup(lookup(), '용인 분식', new Date(iso)).state;
    expect(at('2027-01-14T23:59:59+09:00')).toBe('BEFORE_DAY');
    expect(at('2027-01-15T00:00:00+09:00')).toBe('USABLE');
  });

  it('usedAt · reviewed가 빠진 응답도 null · false로 읽는다', () => {
    const { usedAt: _u, reviewed: _r, ...rest } = row();
    void _u;
    void _r;
    expect(fromWireCoupon(rest as WireCoupon, ctx, DAY_OF)).toMatchObject({
      usedAt: null,
      reviewWritten: false,
    });
  });

  it('확장(store.category)이 있으면 그 값, 리뷰를 썼으면 reviewWritten', () => {
    const wire = { ...row(), store: { ...row().store, category: '식당' }, reviewed: true };
    expect(fromWireCoupon(wire, ctx, DAY_OF)).toMatchObject({
      storeCategory: '식당',
      reviewWritten: true,
    });
  });
});

describe('fromWireLookup (명세 S-06 예시, 확장 없음)', () => {
  it('확장이 없으면 투어 제목 `투어` · 학생 이름 빈 문자열 · 사용 시각 null, 투어 시작은 그날 0시', () => {
    expect(fromWireLookup(lookup(), '용인 분식', EARLIER)).toEqual({
      code: '483920',
      state: 'BEFORE_DAY',
      discount: '음료 1,000원 할인',
      storeName: '용인 분식',
      tourTitle: '투어',
      tourStartsAt: '2027-01-15T00:00:00+09:00',
      studentName: '',
      usedAt: null,
    } satisfies CouponLookup);
  });

  it('투어 당일이면 USABLE, 기한이 지났으면 EXPIRED, USED면 USED', () => {
    expect(fromWireLookup(lookup(), '용인 분식', DAY_OF).state).toBe('USABLE');
    expect(fromWireLookup(lookup(), '용인 분식', new Date('2027-01-16T00:00:01+09:00')).state).toBe(
      'EXPIRED',
    );
    expect(fromWireLookup({ ...lookup(), status: 'USED' }, '용인 분식', DAY_OF).state).toBe('USED');
  });

  it('확장(used_at · tour_title · student_name)이 있으면 그 값', () => {
    const wire = {
      ...lookup(),
      status: 'USED' as const,
      usedAt: '2027-01-15T13:40:00+09:00',
      tourTitle: '단국대 죽전캠퍼스 컴퓨터공학과 투어',
      studentName: '김민지',
    };
    expect(fromWireLookup(wire, '용인 분식', DAY_OF)).toMatchObject({
      state: 'USED',
      usedAt: '2027-01-15T13:40:00+09:00',
      tourTitle: '단국대 죽전캠퍼스 컴퓨터공학과 투어',
      studentName: '김민지',
    });
  });
});
