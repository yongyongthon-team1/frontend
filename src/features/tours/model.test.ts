import { describe, expect, it } from 'vitest';
import { campusLabel, tourTitle } from './model';

describe('campusLabel', () => {
  it('학교 + 캠퍼스, 본교는 학교만', () => {
    expect(campusLabel('경희대학교', '국제캠퍼스')).toBe('경희대학교 국제캠퍼스');
    expect(campusLabel('강남대학교', '본교')).toBe('강남대학교');
  });
});

describe('tourTitle', () => {
  it('제목: 대학 줄임 + 캠퍼스 + 학과', () =>
    expect(tourTitle('경희대학교', '국제캠퍼스', '산업디자인학과')).toBe(
      '경희대 국제캠퍼스 산업디자인학과 탐방',
    ));

  it('제목: 본교는 생략, 한국외대 줄임', () => {
    expect(tourTitle('강남대학교', '본교', '사회복지학부')).toBe('강남대 사회복지학부 탐방');
    expect(tourTitle('한국외국어대학교', '글로벌캠퍼스', null)).toBe(
      '한국외대 글로벌캠퍼스 캠퍼스 탐방',
    );
  });
});
