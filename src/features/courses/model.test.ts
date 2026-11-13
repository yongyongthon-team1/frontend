import { describe, expect, it } from 'vitest';
import {
  candidateStatus,
  courseKinds,
  isKoreaCoordinate,
  matchesPlace,
  partnerStopCount,
  PIN_SPREAD_PX,
  pinOffsets,
  pickTarget,
  slotTimes,
  stopDurations,
  stopKindLabel,
  studentCourseLabel,
  walkingLabel,
  walkingMinutes,
  MAX_COURSE_STOPS,
  type Course,
  type CourseStop,
} from './model';

describe('slotTimes', () => {
  it('슬롯 시간은 와이어프레임과 같다', () =>
    expect(slotTimes('2026-11-15T14:00:00+09:00', 3)).toEqual(['14:00', '15:10', '16:00']));

  it('6번째부터 50분 간격', () =>
    expect(slotTimes('2026-11-15T14:00:00+09:00', 6)).toEqual([
      '14:00',
      '15:10',
      '16:00',
      '16:50',
      '17:40',
      '18:30',
    ]));

  describe('투어 종료 시각(endsAt)을 알 때 (최종 리뷰 I2)', () => {
    const START = '2026-11-15T14:00:00+09:00';
    const END = '2026-11-15T16:30:00+09:00';

    it('3곳은 endsAt이 있어도 그대로다(골든 패스 · 스테이지 ②가 기대는 시각)', () =>
      expect(slotTimes(START, 3, END)).toEqual(['14:00', '15:10', '16:00']));

    it('4번째 곳은 투어 안(16:15)에 들어온다', () =>
      expect(slotTimes(START, 4, END)).toEqual(['14:00', '15:10', '16:00', '16:15']));

    it('5곳이면 넘친 두 곳을 16:00과 종료 사이에 고르게 5분 단위로 놓는다', () =>
      expect(slotTimes(START, 5, END)).toEqual(['14:00', '15:10', '16:00', '16:10', '16:20']));

    it('endsAt이 null이면 지금까지처럼 위치 슬롯 그대로다', () =>
      expect(slotTimes(START, 4, null)).toEqual(['14:00', '15:10', '16:00', '16:50']));

    it('창이 넓으면 슬롯을 그대로 쓰고 다섯 곳 넘게만 끝까지 나눈다', () => {
      const wide = '2026-11-15T19:00:00+09:00';
      expect(slotTimes(START, 5, wide)).toEqual(['14:00', '15:10', '16:00', '16:50', '17:40']);
      expect(slotTimes(START, 6, wide)).toEqual([
        '14:00',
        '15:10',
        '16:00',
        '16:50',
        '17:40',
        '18:20',
      ]);
    });
  });
});

describe('studentCourseLabel', () => {
  it('확정된 코스', () => expect(studentCourseLabel('CONFIRMED')).toBe('코스 확정'));
  it('초안이거나 아직 없으면 준비 중', () => {
    expect(studentCourseLabel('DRAFT')).toBe('코스 준비 중');
    expect(studentCourseLabel(null)).toBe('코스 준비 중');
  });
});

describe('stopKindLabel', () => {
  it('캠퍼스 지점은 업종과 상관없이 캠퍼스', () =>
    expect(stopKindLabel({ type: 'CAMPUS', category: '캠퍼스' })).toBe('캠퍼스'));

  it('식사 업종은 식사', () => {
    for (const category of ['한식', '분식', '중식', '일식', '양식', '식당']) {
      expect(stopKindLabel({ type: 'STORE', category })).toBe('식사');
    }
  });

  it('카페는 카페, 그 밖은 업종 그대로', () => {
    expect(stopKindLabel({ type: 'STORE', category: '카페' })).toBe('카페');
    expect(stopKindLabel({ type: 'STORE', category: '보드게임카페' })).toBe('보드게임카페');
    expect(stopKindLabel({ type: 'STORE', category: '노래방' })).toBe('노래방');
  });
});

describe('stopDurations (2A-R6)', () => {
  const at = (visitTime: string) => ({ visitTime });
  it('다음 지점 방문 시각까지, 마지막은 투어 종료까지 분 단위', () =>
    expect(
      stopDurations([at('14:00'), at('15:10'), at('16:00')], '2026-11-15T16:30:00+09:00'),
    ).toEqual([70, 50, 30]));

  it('종료 시각이 없으면 마지막은 null', () =>
    expect(stopDurations([at('14:00'), at('15:10')], null)).toEqual([70, null]));

  it('종료가 마지막 방문보다 이르거나 같으면 null', () =>
    expect(stopDurations([at('14:00'), at('15:10')], '2026-11-15T15:10:00+09:00')).toEqual([
      70,
      null,
    ]));

  it('지점이 없으면 빈 목록', () => expect(stopDurations([], null)).toEqual([]));
});

describe('courseKinds (G03 히어로 · G08 요약)', () => {
  it('지점 분류를 처음 나온 순서대로 한 번씩', () =>
    expect(
      courseKinds([
        { type: 'CAMPUS', category: '캠퍼스' },
        { type: 'STORE', category: '한식' },
        { type: 'STORE', category: '카페' },
        { type: 'STORE', category: '분식' },
      ]),
    ).toEqual(['캠퍼스', '식사', '카페']));

  it('지점이 없으면 빈 목록', () => expect(courseKinds([])).toEqual([]));
});

describe('partnerStopCount', () => {
  it('제휴(partnership)가 있는 지점 수', () =>
    expect(
      partnerStopCount([
        { partnership: null },
        { partnership: { discount: '10% 할인' } },
        { partnership: { discount: '음료 1잔' } },
      ]),
    ).toBe(2));

  it('없으면 0', () => expect(partnerStopCount([{ partnership: null }])).toBe(0));
});

describe('도보 시간 (2B′-R15)', () => {
  it('80m에 1분, 올림, 최소 1분', () => {
    expect(walkingMinutes(72)).toBe(1);
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(480)).toBe(6);
    expect(walkingMinutes(481)).toBe(7);
  });

  it('라벨은 `도보 약 N분`', () => {
    expect(walkingLabel(321)).toBe('도보 약 5분');
    expect(walkingLabel(72)).toBe('도보 약 1분');
  });

  it('코스 지점은 최대 5곳', () => expect(MAX_COURSE_STOPS).toBe(5));
});

const pickStop = (patch: Partial<CourseStop> & Pick<CourseStop, 'id' | 'order'>): CourseStop => ({
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

/** 지점 10 캠퍼스(건물 3) · 11 상점 1 · 12 상점 2. */
const PICK_COURSE: Course = {
  tourId: 1,
  status: 'DRAFT',
  tour: {
    id: 1,
    title: '',
    universityId: 2,
    universityShortName: '경희대',
    campusName: '국제캠퍼스',
    startsAt: '2027-01-15T14:00:00+09:00',
    endsAt: '2027-01-15T16:30:00+09:00',
  },
  stops: [
    pickStop({ id: 10, order: 1, type: 'CAMPUS', category: '캠퍼스', campusBuildingId: 3 }),
    pickStop({ id: 11, order: 2, storeId: 1 }),
    pickStop({ id: 12, order: 3, storeId: 2 }),
  ],
  interests: [],
  criteria: '',
  confirmedAt: null,
  issuedCouponCount: 0,
};

describe('pickTarget (G07, 2B′-R14)', () => {
  it('replace + 코스의 상점 지점 id → 그 지점을 바꾼다', () =>
    expect(pickTarget(PICK_COURSE, 'replace', '11')).toEqual({
      kind: 'replace',
      stop: PICK_COURSE.stops[1],
    }));

  it('replace + 캠퍼스 지점 id도 replace다(옛 2B-R12의 STORE만을 넓힘)', () =>
    expect(pickTarget(PICK_COURSE, 'replace', '10')).toEqual({
      kind: 'replace',
      stop: PICK_COURSE.stops[0],
    }));

  it('replace인데 코스에 없는 id면 invalid', () => {
    expect(pickTarget(PICK_COURSE, 'replace', '99')).toEqual({ kind: 'invalid' });
    expect(pickTarget(PICK_COURSE, 'replace', 'abc')).toEqual({ kind: 'invalid' });
  });

  it('replace인데 stopId가 없으면 invalid', () => {
    expect(pickTarget(PICK_COURSE, 'replace', null)).toEqual({ kind: 'invalid' });
    expect(pickTarget(PICK_COURSE, 'replace', '')).toEqual({ kind: 'invalid' });
  });

  it('그 밖(add · mode 없음 · 모르는 mode)은 add', () => {
    expect(pickTarget(PICK_COURSE, 'add', null)).toEqual({ kind: 'add' });
    expect(pickTarget(PICK_COURSE, null, '11')).toEqual({ kind: 'add' });
    expect(pickTarget(PICK_COURSE, 'swap', '11')).toEqual({ kind: 'add' });
  });
});

describe('candidateStatus (G07)', () => {
  const replaceStore = { kind: 'replace', stop: PICK_COURSE.stops[1] } as const;

  it('코스에 없는 장소는 SELECTABLE', () => {
    expect(candidateStatus({ type: 'STORE', storeId: 3 }, PICK_COURSE, { kind: 'add' })).toBe(
      'SELECTABLE',
    );
    expect(
      candidateStatus({ type: 'CAMPUS', campusBuildingId: 4 }, PICK_COURSE, replaceStore),
    ).toBe('SELECTABLE');
  });

  it('코스에 있는 장소는 IN_COURSE — 상점 id와 건물 id는 서로 다른 장소다', () => {
    expect(candidateStatus({ type: 'STORE', storeId: 2 }, PICK_COURSE, { kind: 'add' })).toBe(
      'IN_COURSE',
    );
    expect(
      candidateStatus({ type: 'CAMPUS', campusBuildingId: 3 }, PICK_COURSE, { kind: 'add' }),
    ).toBe('IN_COURSE');
    // 상점 3과 건물 3은 다르다
    expect(candidateStatus({ type: 'STORE', storeId: 3 }, PICK_COURSE, { kind: 'add' })).toBe(
      'SELECTABLE',
    );
    expect(candidateStatus({ type: 'STORE', storeId: 2 }, PICK_COURSE, replaceStore)).toBe(
      'IN_COURSE',
    );
  });

  it('바꾸려는 지점의 장소는 CURRENT', () =>
    expect(candidateStatus({ type: 'STORE', storeId: 1 }, PICK_COURSE, replaceStore)).toBe(
      'CURRENT',
    ));
});

describe('matchesPlace (G07 검색)', () => {
  it('공백 · 대소문자를 무시한 부분 일치', () => {
    expect(matchesPlace(['타임리스커피', '카페'], ' 카페 ')).toBe(true);
    expect(matchesPlace(['타임리스커피', '카페'], '타임 리스')).toBe(true);
    expect(matchesPlace(['Cafe Sand', null], 'cafe s')).toBe(true);
    expect(matchesPlace(['모모식당', '한식'], '한식')).toBe(true);
  });

  it('어느 글에도 없으면 false, null은 건너뛴다', () => {
    expect(matchesPlace(['학생회관', null], '도서')).toBe(false);
    expect(matchesPlace([null, null], '도서')).toBe(false);
  });

  it('빈 검색어(공백뿐 포함)는 모두 맞는다', () => {
    expect(matchesPlace(['학생회관', null], '')).toBe(true);
    expect(matchesPlace([null], '   ')).toBe(true);
  });
});

describe('isKoreaCoordinate (지도 핀 방어)', () => {
  it('한국 범위(위도 33~39, 경도 124~132) 안이면 참', () => {
    expect(isKoreaCoordinate(37.2417, 127.0848)).toBe(true);
    expect(isKoreaCoordinate(33, 124)).toBe(true);
    expect(isKoreaCoordinate(39, 132)).toBe(true);
  });

  it('0 · 범위 밖 · 중부원점 TM(미터) 값 · 숫자가 아닌 값은 거짓', () => {
    expect(isKoreaCoordinate(0, 0)).toBe(false);
    expect(isKoreaCoordinate(32.9, 127)).toBe(false);
    expect(isKoreaCoordinate(37.5, 132.1)).toBe(false);
    expect(isKoreaCoordinate(455123.4, 205678.9)).toBe(false);
    expect(isKoreaCoordinate(Number.NaN, 127)).toBe(false);
    expect(isKoreaCoordinate(null as unknown as number, 127)).toBe(false);
  });
});

describe('pinOffsets (지도 핀 겹침 벌리기)', () => {
  const campus = { lat: 37.2411, lng: 127.0815 };
  const rento = { lat: 37.237045, lng: 127.077422 };
  const timeless = { lat: 37.236829, lng: 127.077963 }; // 렌토에서 약 50m

  it('멀리 떨어진 지점은 그대로, 가까운 두 지점은 순서대로 좌우로 반 간격씩 벌린다', () => {
    expect(pinOffsets([campus, rento, timeless])).toEqual([
      0,
      -PIN_SPREAD_PX / 2,
      PIN_SPREAD_PX / 2,
    ]);
    expect(pinOffsets([rento, campus, timeless])).toEqual([
      -PIN_SPREAD_PX / 2,
      0,
      PIN_SPREAD_PX / 2,
    ]);
  });

  it('같은 자리의 세 지점은 가운데를 기준으로 한 간격씩, 한 지점뿐이면 0', () => {
    expect(pinOffsets([rento, rento, rento])).toEqual([-PIN_SPREAD_PX, 0, PIN_SPREAD_PX]);
    expect(pinOffsets([campus])).toEqual([0]);
    expect(pinOffsets([])).toEqual([]);
  });

  it('두 묶음을 잇는 지점이 오면 한 묶음으로 합친다', () => {
    const a = { lat: 37.2, lng: 127.0 };
    const c = { lat: 37.2, lng: 127.0009 }; // a에서 약 80m — 혼자서는 안 겹친다
    const b = { lat: 37.2, lng: 127.00045 }; // a · c 모두에서 약 40m
    expect(pinOffsets([a, c, b])).toEqual([-PIN_SPREAD_PX, 0, PIN_SPREAD_PX]);
  });
});
