import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { D01 } from '@/test/fixtures/backend/campuses';
import { MY_WISHES, WISH_CREATED, WISH_UPDATED } from '@/test/fixtures/backend/wishes';
import {
  fromWireCreatedWish,
  fromWireUpdatedWish,
  fromWireWishItem,
  type WireCreatedWish,
  type WireUpdatedWish,
  type WireWishItem,
} from './wire';

// 명세 예시(확장 없음 — 실서버 경로)를 어댑터로 읽는다(2C-R25 ①).

describe('희망 사항 어댑터', () => {
  it('fromWireCreatedWish: 등록 응답은 campus_id로 캠퍼스를 찾아 학교 줄을 만든다', () => {
    expect(fromWireCreatedWish(toCamel<WireCreatedWish>(WISH_CREATED.data), D01)).toEqual({
      id: 5,
      universityId: 1,
      campusLabel: '단국대학교 주전캠퍼스',
      major: '컴퓨터공학',
      wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
      date: '2027-01-15',
      createdAt: '2026-11-06T10:14:00+09:00',
    });
  });

  it('fromWireCreatedWish: 목록에 없는 캠퍼스면 학교 줄은 빈 문자열', () => {
    const wire = toCamel<WireCreatedWish>({ ...WISH_CREATED.data, campus_id: 999 });
    expect(fromWireCreatedWish(wire, D01)).toMatchObject({ universityId: 999, campusLabel: '' });
  });

  it('fromWireWishItem: 확장이 없으면 학교는 이름 조인(`죽전`은 D-01의 `주전`과 달라 null), 날짜 null', () => {
    expect(fromWireWishItem(toCamel<WireWishItem>(MY_WISHES.data.items[0]), D01)).toEqual({
      id: 5,
      universityId: null,
      campusLabel: '단국대학교 죽전캠퍼스',
      major: '컴퓨터공학',
      wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
      date: null,
      createdAt: '2026-11-04T21:00:00+09:00',
    });
  });

  it('fromWireWishItem: 확장 campus_id · date가 있으면 그 값', () => {
    const wire = toCamel<WireWishItem>({
      ...MY_WISHES.data.items[0],
      campus_id: 1,
      date: '2027-01-15',
    });
    expect(fromWireWishItem(wire, D01)).toMatchObject({ universityId: 1, date: '2027-01-15' });
  });

  it('fromWireWishItem: 확장 없이 이름이 맞으면 조인한 캠퍼스 id', () => {
    const wire = toCamel<WireWishItem>({
      ...MY_WISHES.data.items[0],
      campus_name: '단국대학교 주전캠퍼스',
    });
    expect(fromWireWishItem(wire, D01).universityId).toBe(1);
  });

  it('fromWireUpdatedWish: 수정 응답은 확장이 없으면 등록 시각 null', () => {
    expect(fromWireUpdatedWish(toCamel<WireUpdatedWish>(WISH_UPDATED.data), D01)).toEqual({
      id: 5,
      universityId: null,
      campusLabel: '단국대학교 죽전캠퍼스',
      major: '컴퓨터공학',
      wish: '동아리 구경하고 학식도 먹어보고 싶어요',
      date: '2027-01-16',
      createdAt: null,
    });
  });

  it('fromWireUpdatedWish: 확장 campus_id · created_at이 있으면 그 값', () => {
    const wire = toCamel<WireUpdatedWish>({
      ...WISH_UPDATED.data,
      campus_id: 1,
      created_at: '2026-11-04T21:00:00+09:00',
    });
    expect(fromWireUpdatedWish(wire, D01)).toMatchObject({
      universityId: 1,
      createdAt: '2026-11-04T21:00:00+09:00',
    });
  });
});
