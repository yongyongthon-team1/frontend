// 목업 AI의 관심사 사전과 추출(설계 5.5 `mocks/ai`). 실서버의 LLM 대신 키워드 사전으로 흉내 낸다.
// 같은 입력이면 항상 같은 결과다(난수 없음).

export type LifestyleIntent = '식사' | '카페' | '놀거리';

/** 생활 의도의 순서. 코스 초안이 상점을 이 순서로 들른다. */
export const LIFESTYLE_INTENTS: readonly LifestyleIntent[] = ['식사', '카페', '놀거리'];

/** 학과 키 → 질의에서 찾을 단어. 학과 키는 가이드 학과(`산업디자인학과`)에 들어 있는지로 맞춘다. */
export const MAJOR_KEYWORDS: Record<string, string[]> = {
  산업디자인: ['산업디자인', '제품', '디자인', '스케치', '포트폴리오', '실기'],
  커뮤니케이션디자인: ['시각', '그래픽', '브랜딩', '포스터', '디자인'],
  컴퓨터공학: ['코딩', '개발', '프로그래밍', '컴퓨터', '인공지능', '게임'],
  통번역: ['영어', '통역', '번역', '외국어', '언어'],
  사회복지: ['복지', '봉사', '상담', '사회'],
};

/** 학과 키 → 계열. 코스 초안의 캠퍼스 장소 고르기에 쓴다. */
export const MAJOR_FAMILY: Record<string, string> = {
  산업디자인: '디자인',
  커뮤니케이션디자인: '디자인',
  컴퓨터공학: '컴퓨터',
  통번역: '언어',
  사회복지: '사회복지',
};

export const LIFESTYLE_KEYWORDS: Record<LifestyleIntent, string[]> = {
  식사: ['밥', '맛집', '식사', '점심', '저녁', '먹'],
  카페: ['카페', '커피', '디저트', '과제', '시간을 보내'],
  놀거리: ['놀', '보드게임', '노래방', '산책'],
};

/** 생활 의도 → 상점 업종(`stores.category` — 상가정보 업종을 앱 업종으로 옮긴 값, `docs/reference/store-data.md`). */
export const LIFESTYLE_CATEGORIES: Record<LifestyleIntent, string[]> = {
  식사: ['한식', '분식', '중식', '일식', '양식', '식당'],
  카페: ['카페'],
  놀거리: ['보드게임카페', '노래방', '공방'],
};

export interface Interests {
  /** 맞은 학과 키. 질의에 처음 나온 순서(같은 자리면 사전 순서). */
  majors: string[];
  /** 생활 의도. 항상 식사 → 카페 → 놀거리 순서. */
  lifestyle: LifestyleIntent[];
  /** 관심 키워드 칩: 질의에서 찾은 학과 단어(나온 순서) + 생활 의도. 겹치지 않는다. */
  keywords: string[];
}

/** 띄어쓰기에 상관없이 찾도록 공백을 모두 지운다(`시간을보내는지`도 `시간을 보내`로 찾는다). */
const compact = (s: string) => s.replace(/\s+/g, '');

/** `haystack`에 사전 단어 `word`가 있는지(공백 무시). */
export function includesWord(haystack: string, word: string): boolean {
  return compact(haystack).includes(compact(word));
}

/** 질의(와 관심 학과 입력칸)에서 학과 · 생활 의도 · 관심 키워드를 뽑는다. 관심 학과 칸이 있으면 문장보다 먼저 본다. */
export function extractInterests(text: string, major?: string): Interests {
  // `|`는 사전 단어에 없는 문자라 학과 칸과 문장 사이에 걸친 매칭이 생기지 않는다.
  const source = [major, text]
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .map(compact)
    .join('|');
  const indexOf = (word: string) => source.indexOf(compact(word));

  // `Array.prototype.sort`는 안정 정렬이라 같은 자리면 사전 순서가 남는다.
  const majors = Object.entries(MAJOR_KEYWORDS)
    .map(([key, words]) => ({ key, at: Math.min(...words.map(indexOf).filter((i) => i >= 0)) }))
    .filter((m) => Number.isFinite(m.at))
    .sort((a, b) => a.at - b.at)
    .map((m) => m.key);
  const majorWords = [...new Set(Object.values(MAJOR_KEYWORDS).flat())]
    .map((word) => ({ word, at: indexOf(word) }))
    .filter((w) => w.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((w) => w.word);
  const lifestyle = LIFESTYLE_INTENTS.filter((intent) =>
    LIFESTYLE_KEYWORDS[intent].some((word) => indexOf(word) >= 0),
  );
  return { majors, lifestyle, keywords: [...new Set([...majorWords, ...lifestyle])] };
}
