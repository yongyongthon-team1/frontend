import { describe, expect, it } from 'vitest';
import { getDb } from '@/mocks/db/store';
import { toWireCampus } from '@/mocks/wire/campuses';
import { toCamel } from '@/shared/lib/caseKeys';
import { CAMPUSES_LIST, D01 } from '@/test/fixtures/backend/campuses';
import {
  findCampus,
  fromWireCampus,
  fromWireInsight,
  splitCampusName,
  type WireCampus,
} from './wire';
import type { University } from './model';

describe('fromWireCampus', () => {
  it('D-01 명세 예시(확장 없음)를 University로 읽는다', () => {
    expect(D01[0]).toEqual({
      id: 1,
      name: '단국대학교',
      shortName: '단국대',
      campusName: '주전캠퍼스',
      address: '경기 용인시 수지구 주전로 152',
      lat: 37.3219,
      lng: 127.1268,
      administrativeDong: null,
      vacations: [
        { startDate: '2027-01-01', endDate: '2027-02-28', label: null },
        { startDate: '2027-06-21', endDate: '2027-08-31', label: null },
      ],
    });
  });

  it('방학 기간이 비어 있으면 vacations는 빈 배열', () => {
    const wire = toCamel<WireCampus>({ ...CAMPUSES_LIST.data.items[0], vacation_periods: [] });
    expect(fromWireCampus(wire).vacations).toEqual([]);
  });

  it('주소가 null이면 그대로 null', () => {
    const wire = toCamel<WireCampus>({ ...CAMPUSES_LIST.data.items[0], address: null });
    expect(fromWireCampus(wire).address).toBeNull();
  });
});

describe('fromWireInsight', () => {
  it('campusId를 universityId로 옮긴다', () => {
    expect(
      fromWireInsight({
        campusId: 3,
        title: '방학 상권 인사이트',
        text: '본문',
        source: '출처',
        isPlaceholder: false,
      }),
    ).toEqual({
      universityId: 3,
      title: '방학 상권 인사이트',
      text: '본문',
      source: '출처',
      isPlaceholder: false,
    });
  });
});

describe('findCampus · splitCampusName', () => {
  // 목업 시드 5곳(id 순). 전역 setup이 매 테스트 전에 DB를 시드로 되돌린다.
  const seedCampuses = (): University[] =>
    getDb()
      .universities.slice()
      .sort((a, b) => a.id - b.id)
      .map((u) => fromWireCampus(toWireCampus(getDb(), u)));

  it('campusId로 찾는다', () => {
    expect(findCampus(seedCampuses(), { campusId: 2, campusName: '아무 이름' })?.shortName).toBe(
      '경희대',
    );
  });

  it('campusId가 없거나 null이면 이름으로: 학교 + 캠퍼스', () => {
    expect(findCampus(seedCampuses(), { campusName: '경희대학교 국제캠퍼스' })?.shortName).toBe(
      '경희대',
    );
    expect(
      findCampus(seedCampuses(), { campusId: null, campusName: '경희대학교 국제캠퍼스' })?.id,
    ).toBe(2);
  });

  it('캠퍼스명이 본교면 학교 이름만으로', () => {
    expect(findCampus(seedCampuses(), { campusName: '강남대학교' })).toMatchObject({
      shortName: '강남대',
      campusName: '본교',
    });
  });

  it('목록에 없는 캠퍼스(주전 · 죽전 철자 불일치)는 null', () => {
    expect(findCampus(D01, { campusName: '단국대학교 죽전캠퍼스' })).toBeNull();
    expect(findCampus(D01, { campusName: '단국대학교 주전캠퍼스' })?.id).toBe(1);
  });

  it('없는 campusId는 이름으로 다시 찾는다', () => {
    expect(
      findCampus(seedCampuses(), { campusId: 99, campusName: '명지대학교 인문캠퍼스' }),
    ).toBeNull();
    expect(
      findCampus(seedCampuses(), { campusId: 99, campusName: '경희대학교 국제캠퍼스' })?.id,
    ).toBe(2);
  });

  it('splitCampusName: 첫 공백에서 나눈다', () => {
    expect(splitCampusName('단국대학교 죽전캠퍼스')).toEqual({
      universityName: '단국대학교',
      campusName: '죽전캠퍼스',
    });
    expect(splitCampusName('한국외국어대학교 글로벌 캠퍼스')).toEqual({
      universityName: '한국외국어대학교',
      campusName: '글로벌 캠퍼스',
    });
  });

  it('splitCampusName: 앞뒤 공백을 빼고, 공백이 여러 개여도 캠퍼스 이름만 남긴다', () => {
    expect(splitCampusName('단국대학교  죽전캠퍼스 ')).toEqual({
      universityName: '단국대학교',
      campusName: '죽전캠퍼스',
    });
    expect(splitCampusName(' 단국대학교 죽전캠퍼스')).toEqual({
      universityName: '단국대학교',
      campusName: '죽전캠퍼스',
    });
  });

  it('splitCampusName: 첫 공백 뒤에 남는 것이 없으면(끝 공백) 캠퍼스는 본교', () => {
    expect(splitCampusName('강남대학교 ')).toEqual({
      universityName: '강남대학교',
      campusName: '본교',
    });
    expect(splitCampusName('강남대학교   ')).toEqual({
      universityName: '강남대학교',
      campusName: '본교',
    });
  });

  it('splitCampusName: 공백이 없으면 캠퍼스는 본교', () => {
    expect(splitCampusName('강남대학교')).toEqual({
      universityName: '강남대학교',
      campusName: '본교',
    });
  });
});
