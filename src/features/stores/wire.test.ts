import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { MY_STORE, MY_STORE_PATCHED, STORE_REPORT } from '@/test/fixtures/backend/stores';
import {
  fromWireMyStore,
  fromWireStoreReport,
  type WireMyStore,
  type WireStoreReport,
} from './wire';

const now = new Date('2026-11-07T12:00:00+09:00');

describe('fromWireMyStore', () => {
  it('S-01 보완 명세 예시를 MyStore로 읽는다(제휴 id 0 · 조건 null · 상태는 날짜로 계산)', () => {
    expect(fromWireMyStore(toCamel<WireMyStore>(MY_STORE.data), now)).toEqual({
      id: 201,
      name: '용인 분식',
      address: '경기 용인시 처인구 ...',
      category: '식당',
      partnership: {
        id: 0,
        discount: '음료 1,000원 할인',
        condition: null,
        startDate: '2027-01-01',
        endDate: '2027-02-28',
        state: 'SCHEDULED',
      },
    });
  });

  it('제휴 기간 안이면 ACTIVE, 종료일 다음 날부터 ENDED(서울 날짜)', () => {
    const wire = toCamel<WireMyStore>(MY_STORE.data);
    expect(fromWireMyStore(wire, new Date('2027-01-01T00:00:00+09:00')).partnership?.state).toBe(
      'ACTIVE',
    );
    expect(fromWireMyStore(wire, new Date('2027-02-28T23:59:00+09:00')).partnership?.state).toBe(
      'ACTIVE',
    );
    expect(fromWireMyStore(wire, new Date('2027-03-01T00:00:00+09:00')).partnership?.state).toBe(
      'ENDED',
    );
  });

  it('수정 응답 예시(partnership: null)는 partnership null', () => {
    expect(fromWireMyStore(toCamel<WireMyStore>(MY_STORE_PATCHED.data), now)).toEqual({
      id: 201,
      name: '용인 분식',
      address: '경기 용인시 처인구 ...',
      category: '식당',
      partnership: null,
    });
  });
});

describe('fromWireStoreReport', () => {
  it('S-07 명세 예시를 StoreReport로 읽는다', () => {
    expect(fromWireStoreReport(toCamel<WireStoreReport>(STORE_REPORT.data))).toEqual({
      from: '2027-01-01',
      to: '2027-01-31',
      visitCount: 18,
      reviewCount: 11,
      averageRating: 4.5,
    });
  });

  it('리뷰가 없으면 평균은 null 그대로', () => {
    const wire = {
      ...toCamel<WireStoreReport>(STORE_REPORT.data),
      reviewCount: 0,
      averageRating: null,
    };
    expect(fromWireStoreReport(wire).averageRating).toBeNull();
  });
});
