import { describe, expect, it } from 'vitest';
import { camelToSnake, snakeToCamel, toCamel, toSnake } from './caseKeys';

describe('snakeToCamel', () => {
  it.each([
    ['access_token', 'accessToken'],
    ['consent_token', 'consentToken'],
    ['review_average', 'reviewAverage'],
    ['address_line_2', 'addressLine2'],
    ['_meta', '_meta'],
    ['tourId', 'tourId'],
  ])('%s -> %s', (from, to) => expect(snakeToCamel(from)).toBe(to));
});

describe('camelToSnake', () => {
  it.each([
    ['accessToken', 'access_token'],
    ['campusBuildingId', 'campus_building_id'],
    ['addressLine2', 'address_line2'],
    ['store_id', 'store_id'],
  ])('%s -> %s', (from, to) => expect(camelToSnake(from)).toBe(to));

  it('전부 대문자인 키(열거형 값을 키로 쓴 맵)는 건드리지 않는다', () =>
    expect(camelToSnake('STORE')).toBe('STORE'));
});

describe('toCamel', () => {
  it('중첩 객체와 배열 원소의 키를 바꾸고 값은 그대로 둔다', () =>
    expect(
      toCamel({ user: { verification_status: 'HIGH_SCHOOL' }, items: [{ tour_id: 1 }] }),
    ).toEqual({ user: { verificationStatus: 'HIGH_SCHOOL' }, items: [{ tourId: 1 }] }));

  it('FormData · Blob · Date · URLSearchParams는 같은 참조', () => {
    const values = [new FormData(), new Blob(['x']), new Date(), new URLSearchParams('a=1')];
    for (const v of values) expect(toCamel(v)).toBe(v);
  });

  it('null · 숫자 · 문자열은 그대로', () => {
    expect(toCamel(null)).toBeNull();
    expect(toCamel(3)).toBe(3);
    expect(toCamel('a_b')).toBe('a_b');
  });

  it('프로토타입이 null인 객체도 바꾼다', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { a_b: 1 });
    expect(toCamel(bare)).toEqual({ aB: 1 });
  });
});

describe('toSnake', () => {
  it('중첩 객체와 배열 원소의 키를 바꾸고 값은 그대로 둔다', () =>
    expect(
      toSnake({ campusId: 1, spots: [{ stopType: 'STORE', storeId: 2 }], note: 'fooBar' }),
    ).toEqual({ campus_id: 1, spots: [{ stop_type: 'STORE', store_id: 2 }], note: 'fooBar' }));

  it('FormData · Blob · Date · URLSearchParams는 같은 참조', () => {
    const values = [new FormData(), new Blob(['x']), new Date(), new URLSearchParams('a=1')];
    for (const v of values) expect(toSnake(v)).toBe(v);
  });

  it('null · 숫자 · 문자열은 그대로', () => {
    expect(toSnake(null)).toBeNull();
    expect(toSnake(3)).toBe(3);
    expect(toSnake('aB')).toBe('aB');
  });

  it('toCamel(toSnake(x))는 x (왕복)', () => {
    const x = { interestMajor: 'a', addressLine2: 'b', list: [{ stopIds: [1, 2] }] };
    expect(toCamel(toSnake(x))).toEqual(x);
  });
});
