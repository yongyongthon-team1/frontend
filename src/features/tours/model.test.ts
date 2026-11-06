import { describe, expect, it } from 'vitest';
import { campusLabel, tourHighlights, tourTitle } from './model';

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

describe('tourHighlights', () => {
  it('줄 3개는 3개로 나눈다', () =>
    expect(
      tourHighlights('캠퍼스 둘러보기\n전공 수업·학교생활 이야기\n동네 카페에서 질문하기'),
    ).toEqual(['캠퍼스 둘러보기', '전공 수업', '학교생활 이야기']));

  it('한 문장은 한 개 — 끝의 마침표는 뗀다', () =>
    expect(tourHighlights('산업디자인 작업실과 수업 이야기, 식당과 카페까지 둘러봐요.')).toEqual([
      '산업디자인 작업실과 수업 이야기, 식당과 카페까지 둘러봐요',
    ]));

  it('빈 줄과 빈 조각은 무시하고 최대 3개', () =>
    expect(tourHighlights('\n 가 \n\n나. 다 .라\n마\n')).toEqual(['가', '나', '다']));

  it('마침표로도 나눈다', () =>
    expect(tourHighlights('작업실을 봐요. 학생 식당에서 밥을 먹어요.')).toEqual([
      '작업실을 봐요',
      '학생 식당에서 밥을 먹어요',
    ]));

  it('내용이 없으면 빈 목록', () => expect(tourHighlights(' \n ')).toEqual([]));
});
