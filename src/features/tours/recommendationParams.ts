import type { RecommendationQuery } from './model';

// 추천 검색 조건 ↔ 주소 검색 파라미터. 홈 → 추천 목록 → (다시 추천받기) → 홈으로 돌아와도 입력이 유지된다.
// `universityId`는 주소에서 `school` 키를 쓴다. 빈 값은 싣지 않는다.

export function toSearch(q: RecommendationQuery): string {
  const params = new URLSearchParams({ q: q.q });
  if (q.major) params.set('major', q.major);
  if (q.universityId !== undefined) params.set('school', String(q.universityId));
  if (q.date) params.set('date', q.date);
  return params.toString();
}

/** 앞의 `?`는 있어도 된다. `q`가 비어 있으면 `null`(추천할 조건이 없다). 모르는 값은 버린다. */
export function fromSearch(search: string): RecommendationQuery | null {
  const params = new URLSearchParams(search);
  const q = params.get('q')?.trim();
  if (!q) return null;
  const result: RecommendationQuery = { q };
  const major = params.get('major')?.trim();
  if (major) result.major = major;
  const school = params.get('school');
  if (school !== null && /^[1-9]\d*$/.test(school)) result.universityId = Number(school);
  const date = params.get('date')?.trim();
  if (date) result.date = date;
  return result;
}
