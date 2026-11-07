// 탐방 찾기 검색(T-01) ↔ 주소 검색 파라미터. 홈 제출 → 결과 화면 `/tours?{search}` → (`조건 바꾸기` · 뒤로 가기) → 홈 `/?{search}`로
// 돌아와도 입력이 유지된다. 학교는 `school` 키다. 희망 사항은 받은 그대로 둔다 — 결과 화면이 원문을 줄바꿈까지 그대로 보인다(2C-R16).

export interface WishSearch {
  universityId: number;
  major: string;
  wish: string;
  /** 희망 날짜 `YYYY-MM-DD`. */
  date: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 키 순서는 `school` · `major` · `wish` · (있으면) `date`. */
export function toWishSearch(s: WishSearch): string {
  const params = new URLSearchParams();
  params.set('school', String(s.universityId));
  params.set('major', s.major);
  params.set('wish', s.wish);
  if (s.date) params.set('date', s.date);
  return params.toString();
}

/**
 * 앞의 `?`는 있어도 된다. `school`이 1 이상의 정수가 아니거나 학과 · 희망 사항이 비면(공백뿐 포함) null(옛 추천 검색 `q=`도 null).
 * 학과는 앞뒤 공백을 빼고, 희망 사항은 받은 그대로다. 날짜가 `YYYY-MM-DD`가 아니면 날짜만 null.
 */
export function fromWishSearch(search: string): WishSearch | null {
  const params = new URLSearchParams(search);
  const school = params.get('school');
  const major = params.get('major')?.trim();
  const wish = params.get('wish');
  if (school === null || !/^[1-9]\d*$/.test(school)) return null;
  if (!major || wish === null || wish.trim() === '') return null;
  const date = params.get('date');
  return {
    universityId: Number(school),
    major,
    wish,
    date: date !== null && DATE_PATTERN.test(date) ? date : null,
  };
}
