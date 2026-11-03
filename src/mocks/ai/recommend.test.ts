import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed, DEMO_TOUR_ID } from '@/mocks/db/seed';
import {
  extractInterests,
  LIFESTYLE_CATEGORIES,
  LIFESTYLE_KEYWORDS,
  MAJOR_FAMILY,
  MAJOR_KEYWORDS,
} from './interests';
import { recommendTours } from './recommend';

const today = new Date('2026-11-15T01:00:00Z'); // 시연일 KST 10:00
const DEMO_QUERY = '산업디자인을 공부하고 싶고, 학생들이 주로 어디서 시간을 보내는지 궁금해요.';
const DEMO_REASON =
  '"산업디자인"에 관심이 있다고 해서, 산업디자인학과 재학생 정다은님이 직접 보여주는 탐방을 골랐어요. 학생들이 자주 가는 카페도 들러요.';

describe('관심사 사전', () => {
  it('학과 키워드 · 계열 · 생활 키워드 · 업종', () => {
    expect(MAJOR_KEYWORDS).toEqual({
      산업디자인: ['산업디자인', '제품', '디자인', '스케치', '포트폴리오', '실기'],
      커뮤니케이션디자인: ['시각', '그래픽', '브랜딩', '포스터', '디자인'],
      컴퓨터공학: ['코딩', '개발', '프로그래밍', '컴퓨터', '인공지능', '게임'],
      통번역: ['영어', '통역', '번역', '외국어', '언어'],
      사회복지: ['복지', '봉사', '상담', '사회'],
    });
    expect(MAJOR_FAMILY).toEqual({
      산업디자인: '디자인',
      커뮤니케이션디자인: '디자인',
      컴퓨터공학: '컴퓨터',
      통번역: '언어',
      사회복지: '사회복지',
    });
    expect(LIFESTYLE_KEYWORDS).toEqual({
      식사: ['밥', '맛집', '식사', '점심', '저녁', '먹'],
      카페: ['카페', '커피', '디저트', '과제', '시간을 보내'],
      놀거리: ['놀', '보드게임', '노래방', '산책'],
    });
    expect(LIFESTYLE_CATEGORIES).toEqual({
      식사: ['한식', '분식', '중식', '일식', '양식', '식당'],
      카페: ['카페'],
      놀거리: ['보드게임카페', '노래방', '공방'],
    });
  });
});

describe('extractInterests', () => {
  it('관심사 추출', () => {
    const r = extractInterests(
      '산업디자인을 공부하고 싶고, 학생들이 주로 어디서 밥 먹는지 궁금해요',
    );
    expect(r.majors).toContain('산업디자인');
    expect(r.lifestyle).toContain('식사');
    expect(r.keywords).toContain('산업디자인');
  });

  it('시연 문장: 디자인 두 학과 · 카페 의도, 키워드 칩은 학과 단어(나온 순서) + 생활 의도', () =>
    expect(extractInterests(DEMO_QUERY)).toEqual({
      majors: ['산업디자인', '커뮤니케이션디자인'],
      lifestyle: ['카페'],
      keywords: ['산업디자인', '디자인', '카페'],
    }));

  it('학과는 질의에 처음 나온 순서, 같은 자리면 사전 순서', () =>
    expect(extractInterests('코딩도 좋고 디자인도 좋아요')).toEqual({
      majors: ['컴퓨터공학', '산업디자인', '커뮤니케이션디자인'],
      lifestyle: [],
      keywords: ['코딩', '디자인'],
    }));

  it('관심 학과 입력칸이 있으면 문장보다 먼저 본다', () => {
    expect(extractInterests('디자인 공부가 하고 싶어요', '컴퓨터공학')).toEqual({
      majors: ['컴퓨터공학', '산업디자인', '커뮤니케이션디자인'],
      lifestyle: [],
      keywords: ['컴퓨터', '디자인'],
    });
    expect(extractInterests('수업 분위기가 궁금해요', '통번역').majors).toEqual(['통번역']);
    expect(extractInterests('수업 분위기가 궁금해요', '').majors).toEqual([]);
  });

  it('띄어쓰기가 달라도 찾는다', () =>
    expect(extractInterests('학생들이 어디서 시간을보내는지 궁금해요').lifestyle).toEqual([
      '카페',
    ]));

  it('생활 의도는 식사 → 카페 → 놀거리 순서이고 키워드는 한 번씩', () =>
    expect(extractInterests('노래방도 가고 카페도 가고 밥도 먹고 카페 또 가요')).toEqual({
      majors: [],
      lifestyle: ['식사', '카페', '놀거리'],
      keywords: ['식사', '카페', '놀거리'],
    }));

  it('사전에 없는 말이면 모두 빈 배열', () =>
    expect(extractInterests('우주항공 로켓')).toEqual({ majors: [], lifestyle: [], keywords: [] }));
});

describe('recommendTours', () => {
  let db: DB;
  beforeEach(() => {
    db = createSeed(today);
  });
  const tour = (id: number) => db.tours.find((t) => t.id === id)!;
  const ids = (r: { items: { tour: { id: number } }[] }) => r.items.map((i) => i.tour.id);

  it('디자인 문장이면 경희대 산업디자인 탐방이 첫 번째', () => {
    const r = recommendTours(db, { q: DEMO_QUERY }, today);
    expect(r.headline).toBe('디자인 분야에 관심이 많군요!');
    expect(r.items[0].tour.id).toBe(DEMO_TOUR_ID);
    expect(r.items.some((i) => i.tour.status !== 'RECRUITING')).toBe(false); // 마감 탐방 제외
  });

  it('시연 문장의 결과 전체: 키워드 · 순서 · 이유 · 탐방 요약', () => {
    const r = recommendTours(db, { q: DEMO_QUERY }, today);
    expect(r.fallback).toBeNull();
    expect(r.keywords).toEqual(['산업디자인', '디자인', '카페']);
    // 탐방 1: 학과 +3, 소개문 '산업디자인' · '디자인' · '카페' +3 / 탐방 6: 학과 +3(소개문에 키워드 없음)
    expect(ids(r)).toEqual([1, 6]);
    expect(r.items.map((i) => i.reason)).toEqual([DEMO_REASON, DEMO_REASON]);
    expect(r.items[0].tour).toMatchObject({
      title: '경희대 국제캠퍼스 산업디자인학과 탐방',
      universityName: '경희대학교',
      campusName: '국제캠퍼스',
      guideName: '정다은',
      remainingSeats: 3,
    });
  });

  it('점수 내림차순: 학과가 맞는 탐방이 소개문만 맞는 탐방보다 앞', () => {
    const r = recommendTours(
      db,
      { q: '컴퓨터공학과 수업이 궁금하고, 캠퍼스 카페에서 공부해 보고 싶어요.' },
      today,
    );
    expect(r.headline).toBe('컴퓨터 분야에 관심이 많군요!');
    expect(r.keywords).toEqual(['컴퓨터', '카페']);
    expect(ids(r)).toEqual([3, 1]); // 탐방 3: 학과 +3 · 소개문 '컴퓨터' +1 / 탐방 1: 소개문 '카페' +1
    expect(r.items.map((i) => i.reason)).toEqual([
      '"컴퓨터"에 관심이 있다고 해서, 컴퓨터공학과 재학생 김서연님이 직접 보여주는 탐방을 골랐어요. 학생들이 자주 가는 카페도 들러요.',
      '"카페"에 관심이 있다고 해서, 산업디자인학과 재학생 정다은님이 직접 보여주는 탐방을 골랐어요. 학생들이 자주 가는 카페도 들러요.',
    ]);
  });

  it('생활 키워드가 없으면 이유에 상점 문장을 붙이지 않는다', () => {
    const r = recommendTours(
      db,
      { q: '통번역을 배우고 싶은데 외국어 수업 분위기가 궁금해요.' },
      today,
    );
    expect(r.headline).toBe('언어 분야에 관심이 많군요!');
    expect(ids(r)).toEqual([4]);
    expect(r.items[0].reason).toBe(
      '"번역"에 관심이 있다고 해서, 통번역학과 재학생 박지우님이 직접 보여주는 탐방을 골랐어요.',
    );
  });

  it('생활 문장은 첫 의도의 장소: 식사 → 식당, 놀거리 → 놀 곳', () => {
    const meal = recommendTours(db, { q: '산업디자인 학생들은 어디서 밥 먹어요?' }, today);
    expect(meal.items[0].reason).toMatch(/ 학생들이 자주 가는 식당도 들러요\.$/);
    const play = recommendTours(db, { q: '산업디자인 학생들은 어디서 놀아요?' }, today);
    expect(play.items[0].reason).toMatch(/ 학생들이 자주 가는 놀 곳도 들러요\.$/);
  });

  it('학과 없이 소개문만 맞으면 제목은 첫 키워드', () => {
    const r = recommendTours(db, { q: '카페에서 공부해 보고 싶어요' }, today);
    expect(r).toMatchObject({ headline: '카페에 관심이 많군요!', fallback: null });
    expect(ids(r)).toEqual([1]);
  });

  it('관심 학과 입력칸도 추천에 쓴다', () => {
    const r = recommendTours(db, { q: '수업 분위기가 궁금해요', major: '컴퓨터공학' }, today);
    expect(r.headline).toBe('컴퓨터 분야에 관심이 많군요!');
    expect(ids(r)).toEqual([3]);
  });

  it('동점이면 날짜 오름차순', () => {
    expect(ids(recommendTours(db, { q: '실기' }, today))).toEqual([1, 6]); // 둘 다 학과 +3
    tour(1).startsAt = '2027-02-01T14:00:00+09:00';
    expect(ids(recommendTours(db, { q: '실기' }, today))).toEqual([6, 1]);
  });

  it('학교 · 날짜를 고르면 그 안에서만 찾는다', () => {
    expect(ids(recommendTours(db, { q: DEMO_QUERY, universityId: 2 }, today))).toEqual([1, 6]);
    expect(ids(recommendTours(db, { q: DEMO_QUERY, date: '2027-01-14' }, today))).toEqual([6]);
  });

  it('남은 자리가 없거나 지난 날짜의 탐방은 빼고 고른다', () => {
    tour(1).capacity = 2; // 모집 중이지만 승인 2명으로 자리가 없다
    expect(ids(recommendTours(db, { q: DEMO_QUERY }, today))).toEqual([6]);
    tour(1).capacity = 5;
    tour(6).startsAt = '2026-11-14T14:00:00+09:00'; // 어제
    expect(ids(recommendTours(db, { q: DEMO_QUERY }, today))).toEqual([1]);
    expect(ids(recommendTours(db, { q: '우주항공' }, today))).toEqual([1, 3, 4, 5]);
  });

  it('매칭 0 + 학교 미선택이면 전체로 넓힌다', () =>
    expect(recommendTours(db, { q: '우주항공 로켓' }, today)).toMatchObject({
      fallback: 'ALL',
      headline: '조건을 넓혀서 보여 드려요',
    }));

  it('넓힌 결과는 모집 중 탐방 전체를 날짜 → 남은 자리 많은 순, 날짜 조건도 푼다', () => {
    const r = recommendTours(db, { q: '우주항공 로켓', date: '2027-01-14' }, today);
    expect(r).toMatchObject({ fallback: 'ALL', keywords: [] });
    expect(ids(r)).toEqual([1, 3, 4, 5, 6]);
    expect(r.items[0].reason).toBe('산업디자인학과 재학생 정다은님이 직접 보여주는 탐방이에요.');

    tour(6).startsAt = tour(3).startsAt; // 같은 날짜: 남은 자리 5(탐방 6) > 2(탐방 3)
    tour(3).capacity = 2;
    expect(ids(recommendTours(db, { q: '우주항공' }, today))).toEqual([1, 6, 3, 4, 5]);
  });

  it('매칭 0 + 학교 선택이면 그 학교', () =>
    expect(recommendTours(db, { q: '우주항공', universityId: 4 }, today).fallback).toBe('SCHOOL'));

  it('학교 대체 결과는 그 학교의 모집 중 탐방(날짜 조건은 푼다)', () => {
    const r = recommendTours(db, { q: '코딩', universityId: 2, date: '2026-12-01' }, today);
    expect(r).toMatchObject({
      fallback: 'SCHOOL',
      headline: '같은 학교의 모집 중 탐방을 보여 드려요',
      keywords: ['코딩'],
    });
    expect(ids(r)).toEqual([1, 6]);
  });

  it('고른 학교에 모집 중 탐방이 없으면 전체로 넓힌다', () => {
    const r = recommendTours(db, { q: '우주항공', universityId: 3 }, today); // 단국대 탐방 2는 마감
    expect(r.fallback).toBe('ALL');
    expect(ids(r)).toEqual([1, 3, 4, 5, 6]);
  });

  it('질의가 비어 있으면 VALIDATION', () => {
    const rejects = (q: unknown) =>
      expect(() => recommendTours(db, { q: q as string }, today)).toThrow(
        expect.objectContaining({ status: 400, code: 'VALIDATION' }),
      );
    rejects('');
    rejects('  \n ');
    rejects(undefined);
  });

  it('같은 입력이면 같은 결과', () =>
    expect(recommendTours(db, { q: DEMO_QUERY }, today)).toEqual(
      recommendTours(createSeed(today), { q: DEMO_QUERY }, today),
    ));
});
