import { describe, expect, it } from 'vitest';
import { COURSE_NOTE_MAX, slotTimes, type Course, type CourseStop } from './model';
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

  describe('경계', () => {
    const only = (patch: Partial<CourseStop> = {}): Course => ({
      ...COURSE,
      stops: [stop({ id: 9, order: 1, storeId: 209, ...patch })],
    });

    it('지점이 하나뿐이면 reorder는 그대로이고 한줄평 편집은 된다', () => {
      expect(buildSpots(only(), { kind: 'reorder', stopIds: [9] })).toEqual([
        { stopType: 'STORE', storeId: 209, startTime: '14:00' },
      ]);
      expect(buildSpots(only(), { kind: 'note', stopId: 9, description: '혼자 있는 곳' })).toEqual([
        { stopType: 'STORE', storeId: 209, startTime: '14:00', comment: '혼자 있는 곳' },
      ]);
    });

    it('탐방 시간(14:00–16:30)을 넘기는 곳은 3번째 뒤로 종료까지 고르게 나눈다(slotTimes와 같다)', () => {
      const seven: Course = {
        ...COURSE,
        stops: Array.from({ length: 7 }, (_, i) =>
          stop({ id: i + 1, order: i + 1, storeId: 300 + i }),
        ),
      };
      const spots = buildSpots(seven, { kind: 'note', stopId: 1, description: '' });
      const times = spots.map((s) => s.startTime);
      expect(times).toEqual(['14:00', '15:10', '16:00', '16:05', '16:10', '16:15', '16:20']);
      expect(times).toEqual(slotTimes(seven.tour.startsAt, 7, seven.tour.endsAt));
    });

    it('이미 같은 순서면 reorder는 그대로, 첫 지점을 위로 · 마지막 지점을 아래로 옮기려는 id 목록은 던진다', () => {
      const same = buildSpots(COURSE, { kind: 'reorder', stopIds: [1, 2, 3] });
      expect(same).toEqual(buildSpots(COURSE, { kind: 'note', stopId: 1, description: '' }));
      expect(same.map((s) => s.startTime)).toEqual(['14:00', '15:10', '16:00']);
      // 화면의 `move`는 자리 바꿈이라 가장자리 밖은 undefined가 끼는데, 버튼이 막지만 빌더도 받지 않는다.
      for (const stopIds of [
        [undefined, 1, 2],
        [2, 3, undefined],
      ]) {
        expect(() =>
          buildSpots(COURSE, { kind: 'reorder', stopIds: stopIds as unknown as number[] }),
        ).toThrow('reorder: 지점 id가 맞지 않아요');
      }
    });

    it(`한줄평은 ${COURSE_NOTE_MAX}자까지 그대로 보내고, 비우면 comment 키가 없다`, () => {
      const exact = 'ㄱ'.repeat(COURSE_NOTE_MAX);
      const withNote = buildSpots(only(), { kind: 'note', stopId: 9, description: exact });
      expect(withNote[0]).toHaveProperty('comment', exact);
      const cleared = buildSpots(only({ description: exact }), {
        kind: 'note',
        stopId: 9,
        description: '',
      });
      expect(cleared[0]).toEqual({ stopType: 'STORE', storeId: 209, startTime: '14:00' });
      expect(cleared[0]).not.toHaveProperty('comment');
    });

    it('캠퍼스 지점은 다시 보낼 때도 campusBuildingId로 보낸다(storeId 없이)', () => {
      const spots = buildSpots(COURSE, { kind: 'reorder', stopIds: [2, 3, 1] });
      expect(spots[2]).toEqual({ stopType: 'CAMPUS', campusBuildingId: 3, startTime: '16:00' });
      expect(spots[2]).not.toHaveProperty('storeId');
    });
  });
});

describe('buildSpots add · replace (2B′-R14, Review Focus 4)', () => {
  /** 시작 14:00, 지점 1 캠퍼스(건물 3, 한줄평 없음) · 2 상점 201(`a`) · 3 상점 202(`b`). 전체 PUT이라 빠지면 조용히 사라진다. */
  const NOTED: Course = {
    ...COURSE,
    stops: [
      stop({ id: 1, order: 1, type: 'CAMPUS', category: '캠퍼스', campusBuildingId: 3 }),
      stop({ id: 2, order: 2, storeId: 201, description: 'a' }),
      stop({ id: 3, order: 3, storeId: 202, description: 'b' }),
    ],
  };

  it('add: 맨 끝에 한줄평 없이 붙고, 앞 지점의 캠퍼스 건물 · 한줄평 · 시각은 그대로다', () => {
    const spots = buildSpots(NOTED, { kind: 'add', place: { type: 'STORE', storeId: 205 } });
    expect(spots).toEqual([
      { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '14:00' },
      { stopType: 'STORE', storeId: 201, startTime: '15:10', comment: 'a' },
      { stopType: 'STORE', storeId: 202, startTime: '16:00', comment: 'b' },
      { stopType: 'STORE', storeId: 205, startTime: '16:15' },
    ]);
    expect(spots[3]).not.toHaveProperty('comment');
  });

  it('add: 캠퍼스 장소도 같은 모양으로 붙는다(storeId 없이)', () => {
    const spots = buildSpots(NOTED, {
      kind: 'add',
      place: { type: 'CAMPUS', campusBuildingId: 4 },
    });
    expect(spots[3]).toEqual({ stopType: 'CAMPUS', campusBuildingId: 4, startTime: '16:15' });
    expect(spots[3]).not.toHaveProperty('storeId');
  });

  it('add: 섞인 배열에서도 order 순서의 맨 끝에 붙는다', () => {
    const spots = buildSpots(COURSE, { kind: 'add', place: { type: 'STORE', storeId: 205 } });
    expect(spots.map((s) => s.startTime)).toEqual(['14:00', '15:10', '16:00', '16:15']);
    expect(spots[0]).toMatchObject({ stopType: 'CAMPUS', campusBuildingId: 3 });
    expect(spots[3]).toMatchObject({ stopType: 'STORE', storeId: 205 });
  });

  it('replace: 같은 자리 · 같은 시각에 새 상점이 한줄평 없이 들어가고 다른 지점은 그대로다', () => {
    const spots = buildSpots(NOTED, {
      kind: 'replace',
      stopId: 2,
      place: { type: 'STORE', storeId: 205 },
    });
    expect(spots).toEqual([
      { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '14:00' },
      { stopType: 'STORE', storeId: 205, startTime: '15:10' },
      { stopType: 'STORE', storeId: 202, startTime: '16:00', comment: 'b' },
    ]);
    expect(spots[1]).not.toHaveProperty('comment');
  });

  it('replace: 캠퍼스 지점을 다른 캠퍼스 장소로 바꿀 수 있고 나머지 한줄평은 그대로다', () => {
    expect(
      buildSpots(NOTED, {
        kind: 'replace',
        stopId: 1,
        place: { type: 'CAMPUS', campusBuildingId: 4 },
      }),
    ).toEqual([
      { stopType: 'CAMPUS', campusBuildingId: 4, startTime: '14:00' },
      { stopType: 'STORE', storeId: 201, startTime: '15:10', comment: 'a' },
      { stopType: 'STORE', storeId: 202, startTime: '16:00', comment: 'b' },
    ]);
  });

  it('replace: 상점 지점을 캠퍼스 장소로(또 그 반대로) 바꿀 수 있다', () => {
    const toCampus = buildSpots(NOTED, {
      kind: 'replace',
      stopId: 3,
      place: { type: 'CAMPUS', campusBuildingId: 4 },
    });
    expect(toCampus[2]).toEqual({ stopType: 'CAMPUS', campusBuildingId: 4, startTime: '16:00' });
    const toStore = buildSpots(NOTED, {
      kind: 'replace',
      stopId: 1,
      place: { type: 'STORE', storeId: 205 },
    });
    expect(toStore[0]).toEqual({ stopType: 'STORE', storeId: 205, startTime: '14:00' });
  });

  it('replace: 없는 지점 id면 던진다', () => {
    expect(() =>
      buildSpots(NOTED, { kind: 'replace', stopId: 9, place: { type: 'STORE', storeId: 205 } }),
    ).toThrow('replace: 지점 id가 맞지 않아요');
  });

  it('상한 · 같은 장소 중복은 빌더가 보지 않는다(화면 몫, 2B′-R14)', () => {
    const dup = buildSpots(NOTED, { kind: 'add', place: { type: 'STORE', storeId: 201 } });
    expect(dup.filter((s) => s.storeId === 201)).toHaveLength(2);
    const five: Course = {
      ...NOTED,
      stops: Array.from({ length: 5 }, (_, i) =>
        stop({ id: i + 1, order: i + 1, storeId: 300 + i }),
      ),
    };
    expect(buildSpots(five, { kind: 'add', place: { type: 'STORE', storeId: 205 } })).toHaveLength(
      6,
    );
  });

  it('장소 id가 비어 있는 코스를 읽은 채 편집하면 던진다(add도 기존 지점을 다시 보낸다)', () => {
    const broken: Course = { ...NOTED, stops: [stop({ id: 1, order: 1, storeId: null })] };
    expect(() =>
      buildSpots(broken, { kind: 'add', place: { type: 'STORE', storeId: 205 } }),
    ).toThrow('지점 1에 장소 id가 없어요');
  });
});
