import { describe, expect, it } from 'vitest';
import { slotTimes, stopKindLabel, studentCourseLabel } from './model';

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
