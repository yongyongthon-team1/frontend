import { describe, expect, it } from 'vitest';
import {
  addDaysKey,
  circled,
  endOfSeoulDay,
  formatDuration,
  formatMonthDay,
  formatDotDate,
  formatDotDateTimeRange,
  formatDotDateWeekday,
  formatShortDate,
  formatTime,
  formatTimeRange,
  formatTourDate,
  seoulDateAt,
  seoulDateKey,
  toSeoulIso,
} from './date';

describe('date', () => {
  it('UTC 16:30은 서울 다음 날', () =>
    expect(seoulDateKey('2026-11-14T16:30:00Z')).toBe('2026-11-15'));
  it('탐방 날짜 표기', () =>
    expect(formatTourDate('2026-11-15T14:00:00+09:00')).toBe('11월 15일(일)'));
  it('월일 표기', () => expect(formatMonthDay('2026-11-15T14:00:00+09:00')).toBe('11월 15일'));
  it('점 날짜 (V2 목록 행)', () => {
    expect(formatDotDate('2026-11-12T14:00:00+09:00')).toBe('11.12');
    expect(formatDotDateWeekday('2026-11-12T14:00:00+09:00')).toBe('11.12 (목)');
  });
  it('점 날짜 + 시간 범위 (V2 탐방 상세)', () => {
    expect(formatDotDateTimeRange('2026-11-12T14:00:00+09:00', '2026-11-12T16:30:00+09:00')).toBe(
      '11.12 (목) 14:00~16:30',
    );
    expect(formatDotDateTimeRange('2026-11-12T14:00:00+09:00', null)).toBe('11.12 (목) 14:00');
  });
  it('짧은 날짜', () => expect(formatShortDate('2026-11-15T14:00:00+09:00')).toBe('11/15(일)'));
  it('시각', () => expect(formatTime('2026-11-15T05:00:00Z')).toBe('14:00'));
  it('시간 범위는 en dash', () =>
    expect(formatTimeRange('2026-11-15T14:00:00+09:00', '2026-11-15T16:30:00+09:00')).toBe(
      '14:00–16:30',
    ));
  it('종료가 없으면 시작만', () =>
    expect(formatTimeRange('2026-11-15T14:00:00+09:00', null)).toBe('14:00'));
  it('소요 시간', () => {
    expect(formatDuration('2026-11-15T14:00:00+09:00', '2026-11-15T16:30:00+09:00')).toBe(
      '2시간 30분',
    );
    expect(formatDuration('2026-11-15T14:00:00+09:00', '2026-11-15T16:00:00+09:00')).toBe('2시간');
    expect(formatDuration('2026-11-15T14:00:00+09:00', '2026-11-15T14:45:00+09:00')).toBe('45분');
  });
  it('서울 ISO', () =>
    expect(toSeoulIso(new Date('2026-11-15T05:00:00Z'))).toBe('2026-11-15T14:00:00+09:00'));
  it('날짜+시각', () =>
    expect(seoulDateAt('2026-11-15', '14:00')).toBe('2026-11-15T14:00:00+09:00'));
  it('날짜 더하기는 해를 넘긴다', () => expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01'));
  it('하루 끝', () => expect(endOfSeoulDay('2026-11-15')).toBe('2026-11-15T23:59:59+09:00'));
  it('원문자', () => expect([1, 2, 3].map(circled).join('')).toBe('①②③'));
});
