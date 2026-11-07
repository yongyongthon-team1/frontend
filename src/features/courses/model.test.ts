import { describe, expect, it } from 'vitest';
import {
  courseKinds,
  partnerStopCount,
  slotTimes,
  stopDurations,
  stopKindLabel,
  studentCourseLabel,
  walkingLabel,
  walkingMinutes,
  MAX_COURSE_STOPS,
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
  it('다음 지점 방문 시각까지, 마지막은 탐방 종료까지 분 단위', () =>
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
