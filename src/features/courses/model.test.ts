import { describe, expect, it } from 'vitest';
import { slotTimes, studentCourseLabel } from './model';

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
