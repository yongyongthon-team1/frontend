import { describe, expect, it } from 'vitest';
import type { Course, CourseStop } from './model';
import { buildSpots } from './spots';

const stop = (patch: Partial<CourseStop> & Pick<CourseStop, 'id' | 'order'>): CourseStop => ({
  visitTime: '00:00',
  type: 'STORE',
  name: `지점 ${patch.id}`,
  category: '식당',
  lat: 0,
  lng: 0,
  description: null,
  recommendationReason: null,
  storeId: null,
  campusBuildingId: null,
  partnership: null,
  review: null,
  dataSource: null,
  ...patch,
});

/** 시작 14:00, 지점 1 캠퍼스(건물 3, 한줄평 없음) · 2 상점 201(한줄평 `a`) · 3 상점 202. 배열은 일부러 섞어 둔다. */
const COURSE: Course = {
  tourId: 31,
  status: 'DRAFT',
  tour: {
    id: 31,
    title: '단국대 죽전캠퍼스 컴퓨터공학과 탐방',
    universityId: 0,
    universityShortName: '단국대',
    campusName: '죽전캠퍼스',
    startsAt: '2027-01-15T14:00:00+09:00',
    endsAt: '2027-01-15T16:30:00+09:00',
  },
  stops: [
    stop({ id: 3, order: 3, storeId: 202 }),
    stop({ id: 1, order: 1, type: 'CAMPUS', category: '캠퍼스', campusBuildingId: 3 }),
    stop({ id: 2, order: 2, storeId: 201, description: 'a' }),
  ],
  interests: [],
  criteria: '',
  confirmedAt: null,
  issuedCouponCount: 0,
};

describe('buildSpots (2C-R13)', () => {
  it('reorder: 받은 순서대로 보내고 시각은 위치 슬롯(14:00 · 15:10 · 16:00)', () => {
    expect(buildSpots(COURSE, { kind: 'reorder', stopIds: [3, 1, 2] })).toEqual([
      { stopType: 'STORE', storeId: 202, startTime: '14:00' },
      { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '15:10' },
      { stopType: 'STORE', storeId: 201, startTime: '16:00', comment: 'a' },
    ]);
  });

  it('note: 그 지점의 한줄평만 앞뒤 공백을 떼어 바꾸고, 순서 · 시각은 그대로', () => {
    expect(buildSpots(COURSE, { kind: 'note', stopId: 3, description: '  학식 맛집  ' })).toEqual([
      { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '14:00' },
      { stopType: 'STORE', storeId: 201, startTime: '15:10', comment: 'a' },
      { stopType: 'STORE', storeId: 202, startTime: '16:00', comment: '학식 맛집' },
    ]);
  });

  it('note: 공백뿐이면 comment 키를 넣지 않는다(전체 교체라 한줄평이 지워진다)', () => {
    const spots = buildSpots(COURSE, { kind: 'note', stopId: 2, description: '   ' });
    expect(spots[1]).toEqual({ stopType: 'STORE', storeId: 201, startTime: '15:10' });
    expect(spots[1]).not.toHaveProperty('comment');
  });

  it('remove: 그 지점을 빼고 남은 지점의 시각을 앞에서부터 다시 매긴다', () => {
    expect(buildSpots(COURSE, { kind: 'remove', stopId: 1 })).toEqual([
      { stopType: 'STORE', storeId: 201, startTime: '14:00', comment: 'a' },
      { stopType: 'STORE', storeId: 202, startTime: '15:10' },
    ]);
  });

  it('reorder: 지금 지점 id들의 순열이 아니면 던진다', () => {
    for (const stopIds of [
      [1, 2],
      [1, 1, 2],
      [1, 2, 4],
      [1, 2, 3, 3],
    ]) {
      expect(() => buildSpots(COURSE, { kind: 'reorder', stopIds })).toThrow(
        'reorder: 지점 id가 맞지 않아요',
      );
    }
  });
});
