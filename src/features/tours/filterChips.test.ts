import { describe, expect, it } from 'vitest';
import { buildFilterChips, filterItems } from './filterChips';
import type { Recommendation, RecommendationResult, TourSummary } from './model';

function item(
  id: number,
  shortName: string,
  major: string | null,
  reason = `이유 ${id}`,
): Recommendation {
  const tour: TourSummary = {
    id,
    title: `탐방 ${id}`,
    universityId: id,
    universityName: `${shortName}학교`,
    universityShortName: shortName,
    campusName: '본교',
    major,
    guideName: '가이드',
    guideVerified: true,
    startsAt: '2026-11-12T14:00:00+09:00',
    endsAt: null,
    capacity: 5,
    approvedCount: 1,
    remainingSeats: 4,
    status: 'RECRUITING',
  };
  return { tour, reason };
}

const result = (items: Recommendation[], keywords: string[]): RecommendationResult => ({
  headline: '헤드라인',
  keywords,
  items,
  fallback: null,
});

describe('buildFilterChips (2A-R2)', () => {
  const items = [
    item(1, '경희대', '산업디자인학과'),
    item(2, '경희대', '시각디자인학과'),
    item(3, '강남대', '소프트웨어학과'),
  ];

  it('전체 · 학과에 든 키워드 1개 · 학교 짧은 이름', () => {
    const chips = buildFilterChips(result(items, ['제품', '디자인', '소프트웨어']));
    expect(chips.map((c) => [c.label, c.kind])).toEqual([
      ['전체', 'all'],
      ['디자인', 'keyword'],
      ['경희대', 'school'],
      ['강남대', 'school'],
    ]);
  });

  it('학과에 든 키워드가 없으면 키워드 칩이 없다', () => {
    const chips = buildFilterChips(result(items, ['제품', '카페']));
    expect(chips.map((c) => c.label)).toEqual(['전체', '경희대', '강남대']);
  });

  it('학교 칩은 최대 2개', () => {
    const many = [item(1, 'A대', null), item(2, 'B대', null), item(3, 'C대', null)];
    const chips = buildFilterChips(result(many, []));
    expect(chips.map((c) => c.label)).toEqual(['전체', 'A대', 'B대']);
  });

  it('값이 서로 다르다', () => {
    const chips = buildFilterChips(result(items, ['디자인']));
    expect(new Set(chips.map((c) => c.value)).size).toBe(chips.length);
  });
});

describe('filterItems', () => {
  const items = [
    item(1, '경희대', '산업디자인학과'),
    item(2, '경희대', '소프트웨어학과'),
    item(3, '강남대', '시각디자인학과'),
  ];
  const chips = buildFilterChips(result(items, ['디자인']));
  const valueOf = (label: string) => chips.find((c) => c.label === label)!.value;

  it('전체는 그대로', () => expect(filterItems(items, valueOf('전체'))).toEqual(items));

  it('학교 칩은 그 학교만', () => {
    expect(filterItems(items, valueOf('강남대')).map((i) => i.tour.id)).toEqual([3]);
    expect(filterItems(items, valueOf('경희대')).map((i) => i.tour.id)).toEqual([1, 2]);
  });

  it('키워드 칩은 학과에 그 키워드가 든 탐방만', () => {
    expect(filterItems(items, valueOf('디자인')).map((i) => i.tour.id)).toEqual([1, 3]);
  });

  it('모르는 값은 전체로 본다', () => expect(filterItems(items, 'nope')).toEqual(items));
});
