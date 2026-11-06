import type { Recommendation, RecommendationResult } from './model';

// 추천 목록(H02)의 필터 칩(판정 2A-R2). `전체` + 결과 키워드 중 탐방 학과에 든 것 최대 1개 + 결과 탐방의 학교 짧은 이름
// 최대 2개. 칩은 받은 결과를 클라이언트에서 거른다 — 서버에 다시 묻지 않는다.

export interface FilterChipItem {
  value: string;
  label: string;
  kind: 'all' | 'keyword' | 'school';
}

export const ALL_CHIP = 'all';
const KEYWORD_PREFIX = 'keyword:';
const SCHOOL_PREFIX = 'school:';
const MAX_SCHOOL_CHIPS = 2;

export function buildFilterChips(result: RecommendationResult): FilterChipItem[] {
  const chips: FilterChipItem[] = [{ value: ALL_CHIP, label: '전체', kind: 'all' }];

  const keyword = result.keywords.find((k) =>
    result.items.some(({ tour }) => tour.major?.includes(k)),
  );
  if (keyword !== undefined) {
    chips.push({ value: `${KEYWORD_PREFIX}${keyword}`, label: keyword, kind: 'keyword' });
  }

  const schools = [...new Set(result.items.map(({ tour }) => tour.universityShortName))];
  for (const name of schools.slice(0, MAX_SCHOOL_CHIPS)) {
    chips.push({ value: `${SCHOOL_PREFIX}${name}`, label: name, kind: 'school' });
  }
  return chips;
}

/** 칩 값으로 거른다. `전체` · 모르는 값은 그대로 돌려준다. */
export function filterItems(items: Recommendation[], chipValue: string): Recommendation[] {
  if (chipValue.startsWith(KEYWORD_PREFIX)) {
    const keyword = chipValue.slice(KEYWORD_PREFIX.length);
    return items.filter(({ tour }) => tour.major?.includes(keyword));
  }
  if (chipValue.startsWith(SCHOOL_PREFIX)) {
    const name = chipValue.slice(SCHOOL_PREFIX.length);
    return items.filter(({ tour }) => tour.universityShortName === name);
  }
  return items;
}
