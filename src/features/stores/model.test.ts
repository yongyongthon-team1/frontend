import { describe, expect, it } from 'vitest';
import {
  businessNotice,
  diffStoreEdit,
  normalizeBusinessNumber,
  PARTNERSHIP_DISCOUNT_MAX,
  STORE_CATEGORIES,
  STORE_SEARCH_MIN,
  type MyStore,
} from './model';

describe('normalizeBusinessNumber', () => {
  it('숫자만 남긴다', () => {
    expect(normalizeBusinessNumber('123-45-67890')).toBe('1234567890');
    expect(normalizeBusinessNumber(' 123 45 67890 ')).toBe('1234567890');
    expect(normalizeBusinessNumber('abc')).toBe('');
  });
});

describe('businessNotice', () => {
  it('BIZ_MISMATCH · BIZ_CLOSED는 제목과 설명, 그 밖은 null', () => {
    expect(businessNotice('BIZ_MISMATCH')).toEqual({
      title: '사업자 정보가 일치하지 않아요',
      description:
        '사업자등록증에 적힌 등록번호 · 대표자명 · 개업일자를 그대로 다시 입력해 주세요.',
    });
    expect(businessNotice('BIZ_CLOSED')).toEqual({
      title: '휴업 또는 폐업한 사업자예요',
      description: '계속사업자(영업 중)인 사업자 정보로 다시 입력해 주세요.',
    });
    expect(businessNotice('NETWORK')).toBeNull();
    expect(businessNotice(undefined)).toBeNull();
  });
});

describe('diffStoreEdit', () => {
  const before: MyStore = {
    id: 1,
    name: '서천 밥상',
    address: '경기도 용인시 기흥구 서천동 서천로 21',
    category: '한식',
    partnership: null,
  };
  const same = { name: before.name, address: before.address, category: before.category };

  it('그대로면 빈 객체', () => {
    expect(diffStoreEdit(before, same)).toEqual({});
  });

  it('값이 다른 칸만', () => {
    expect(diffStoreEdit(before, { ...same, address: '새 주소' })).toEqual({ address: '새 주소' });
    expect(
      diffStoreEdit(before, { name: '새 이름', address: before.address, category: '분식' }),
    ).toEqual({
      name: '새 이름',
      category: '분식',
    });
  });
});

describe('상수', () => {
  it('검색 최소 2자 · 제휴 문구 50자 · 업종 열 가지', () => {
    expect(STORE_SEARCH_MIN).toBe(2);
    expect(PARTNERSHIP_DISCOUNT_MAX).toBe(50);
    expect(STORE_CATEGORIES).toEqual([
      '한식',
      '분식',
      '중식',
      '일식',
      '양식',
      '카페',
      '보드게임카페',
      '노래방',
      '공방',
      '기타',
    ]);
  });
});
