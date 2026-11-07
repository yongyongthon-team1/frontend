import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWithinVacation, tourDateBounds, tourDateBoundsNow, type Vacation } from './model';

// 시드 방학(겨울 2026-12-21~2027-02-28 · 여름 2027-06-21~2027-08-31).
const VACATIONS: Vacation[] = [
  { startDate: '2026-12-21', endDate: '2027-02-28', label: '2026 겨울방학' },
  { startDate: '2027-06-21', endDate: '2027-08-31', label: '2027 여름방학' },
];

describe('isWithinVacation', () => {
  it('시작일 · 종료일을 포함한다', () => {
    expect(isWithinVacation(VACATIONS, '2026-12-21')).toBe(true);
    expect(isWithinVacation(VACATIONS, '2027-02-28')).toBe(true);
    expect(isWithinVacation(VACATIONS, '2027-07-01')).toBe(true);
  });

  it('방학 밖이면 false(하루 전 · 하루 뒤 · 학기 중)', () => {
    expect(isWithinVacation(VACATIONS, '2026-12-20')).toBe(false);
    expect(isWithinVacation(VACATIONS, '2027-03-01')).toBe(false);
    expect(isWithinVacation(VACATIONS, '2027-05-01')).toBe(false);
  });

  it('방학이 없으면 false', () => {
    expect(isWithinVacation([], '2026-12-21')).toBe(false);
  });
});

describe('tourDateBounds', () => {
  it('내일 이후에 끝나는 방학만 본다: 첫 방학이 아직 시작 전이면 min은 그 시작일', () => {
    expect(tourDateBounds(VACATIONS, '2026-11-07')).toEqual({
      min: '2026-12-21',
      max: '2027-08-31',
    });
  });

  it('방학 중이면 min은 내일', () => {
    expect(tourDateBounds(VACATIONS, '2027-01-10')).toEqual({
      min: '2027-01-11',
      max: '2027-08-31',
    });
  });

  it('첫 방학이 끝났으면 다음 방학만 본다', () => {
    expect(tourDateBounds(VACATIONS, '2027-03-01')).toEqual({
      min: '2027-06-21',
      max: '2027-08-31',
    });
  });

  it('마지막 방학의 마지막 날이 오늘이면(내일이 없다) null', () => {
    expect(tourDateBounds(VACATIONS, '2027-08-31')).toBeNull();
  });

  it('모든 방학이 지났으면 null', () => {
    expect(tourDateBounds(VACATIONS, '2027-09-01')).toBeNull();
    expect(tourDateBounds([], '2026-11-07')).toBeNull();
  });

  it('방학 순서가 뒤섞여 있어도 같다', () => {
    expect(tourDateBounds([VACATIONS[1], VACATIONS[0]], '2026-11-07')).toEqual({
      min: '2026-12-21',
      max: '2027-08-31',
    });
  });
});

describe('tourDateBoundsNow', () => {
  afterEach(() => vi.useRealTimers());

  it('지금(서울 날짜)을 오늘로 쓴다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-10T03:00:00Z')); // KST 2027-01-10 12:00
    expect(tourDateBoundsNow(VACATIONS)).toEqual({ min: '2027-01-11', max: '2027-08-31' });
  });

  it('서울 자정을 넘긴 UTC 시각도 서울 날짜로 본다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-09T15:30:00Z')); // KST 2027-01-10 00:30
    expect(tourDateBoundsNow(VACATIONS)?.min).toBe('2027-01-11');
  });
});
