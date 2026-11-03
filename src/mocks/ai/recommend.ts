import type {
  Recommendation,
  RecommendationQuery,
  RecommendationResult,
  TourSummary,
} from '@/features/tours/model';
import type { DB, TourRow } from '@/mocks/db/schema';
import { remainingSeats } from '@/mocks/rules/applications';
import { MockApiError } from '@/mocks/rules/errors';
import { buildTourSummary } from '@/mocks/rules/summaries';
import { seoulDateKey } from '@/shared/lib/date';
import {
  extractInterests,
  includesWord,
  MAJOR_FAMILY,
  MAJOR_KEYWORDS,
  type Interests,
  type LifestyleIntent,
} from './interests';

// T-01 탐방 추천 흉내. 대상은 모집 중 · 남은 자리 있음 · 지난 날짜가 아닌 탐방이고, 학교 · 날짜를 고르면 그 안에서만
// 찾는다. 점수 = 가이드 학과가 추출한 학과 키를 포함하면 +3, 소개문에 질의 키워드가 있으면 키워드마다 +1.
// 점수 > 0인 탐방을 점수 내림차순 → 날짜 오름차순으로 주고, 하나도 없으면 조건을 넓힌 대체 목록을 준다.

const MAJOR_MATCH_SCORE = 3;
/** 추천 이유 끝 문장 `학생들이 자주 가는 {장소}도 들러요.`의 장소(첫 생활 의도). */
const PLACE_OF: Record<LifestyleIntent, string> = { 식사: '식당', 카페: '카페', 놀거리: '놀 곳' };
const HEADLINE_SCHOOL = '같은 학교의 모집 중 탐방을 보여 드려요';
const HEADLINE_ALL = '조건을 넓혀서 보여 드려요';

interface Scored {
  tour: TourRow;
  score: number;
  /** 가이드 학과가 포함한 추출 학과 키(+3의 근거). */
  majorKey: string | null;
  /** 소개문에 있는 질의 키워드(키워드마다 +1). */
  introWords: string[];
}

function scoreTour(db: DB, tour: TourRow, interests: Interests): Scored {
  const major = db.guideProfiles.find((g) => g.id === tour.guideId)?.major ?? '';
  const majorKey = interests.majors.find((key) => major.includes(key)) ?? null;
  const introWords = interests.keywords.filter((k) => includesWord(tour.introduction, k));
  const score = (majorKey ? MAJOR_MATCH_SCORE : 0) + introWords.length;
  return { tour, score, majorKey, introWords };
}

/** `{학과} 재학생 {가이드}` — 가이드 학과가 없으면 학교 이름. */
const guideLabel = (t: TourSummary) => `${t.major ?? t.universityShortName} 재학생 ${t.guideName}`;

function matchReason(s: Scored, summary: TourSummary, interests: Interests): string {
  // 학과가 맞았으면 그 학과 사전에서 찾은 단어를, 아니면 소개문에서 찾은 단어를 인용한다.
  const majorWords = s.majorKey === null ? [] : MAJOR_KEYWORDS[s.majorKey];
  const keyword = interests.keywords.find((k) => majorWords.includes(k)) ?? s.introWords[0];
  const reason = `"${keyword}"에 관심이 있다고 해서, ${guideLabel(summary)}님이 직접 보여주는 탐방을 골랐어요.`;
  const [intent] = interests.lifestyle;
  return intent ? `${reason} 학생들이 자주 가는 ${PLACE_OF[intent]}도 들러요.` : reason;
}

/** 질의에서 처음 추출한 학과의 계열. 학과 없이 소개문 키워드만 맞았으면 첫 키워드. */
function headlineOf(interests: Interests): string {
  const [major] = interests.majors;
  return major
    ? `${MAJOR_FAMILY[major]} 분야에 관심이 많군요!`
    : `${interests.keywords[0]}에 관심이 많군요!`;
}

const startsMs = (t: { startsAt: string }) => Date.parse(t.startsAt);

/** 관심사 문장으로 모집 중 탐방을 추천한다. `now`(서울 날짜)보다 전 날짜의 탐방은 고르지 않는다. */
export function recommendTours(
  db: DB,
  query: RecommendationQuery,
  now: Date,
): RecommendationResult {
  // HTTP 본문에서 바로 넘어오면 질의가 문자열이 아닐 수도 있다.
  const q = typeof query?.q === 'string' ? query.q.trim() : '';
  if (q === '') throw new MockApiError(400, 'VALIDATION');
  const interests = extractInterests(q, query.major);
  const schoolId = query.universityId ? Number(query.universityId) : null;
  const date = query.date || null;
  const today = seoulDateKey(now);

  const open = db.tours.filter(
    (t) =>
      t.status === 'RECRUITING' &&
      remainingSeats(db, t.id) > 0 &&
      seoulDateKey(t.startsAt) >= today,
  );
  const inSchool = (t: TourRow) => schoolId === null || t.universityId === schoolId;

  const matched = open
    .filter((t) => inSchool(t) && (date === null || seoulDateKey(t.startsAt) === date))
    .map((t) => scoreTour(db, t, interests))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) => b.score - a.score || startsMs(a.tour) - startsMs(b.tour) || a.tour.id - b.tour.id,
    );
  if (matched.length > 0) {
    return {
      headline: headlineOf(interests),
      keywords: interests.keywords,
      items: matched.map((s): Recommendation => {
        const summary = buildTourSummary(db, s.tour);
        return { tour: summary, reason: matchReason(s, summary, interests) };
      }),
      fallback: null,
    };
  }

  // 대체 목록은 키워드 · 날짜 조건을 푼다. 학교를 골랐으면 그 학교의 모집 중 탐방, 그마저 없으면 전체.
  const school = schoolId === null ? [] : open.filter(inSchool);
  const fallback = school.length > 0 ? 'SCHOOL' : 'ALL';
  const items = (fallback === 'SCHOOL' ? school : open)
    .map((t) => buildTourSummary(db, t))
    .sort((a, b) => startsMs(a) - startsMs(b) || b.remainingSeats - a.remainingSeats || a.id - b.id)
    .map((tour): Recommendation => ({
      tour,
      reason: `${guideLabel(tour)}님이 직접 보여주는 탐방이에요.`,
    }));
  return {
    headline: fallback === 'SCHOOL' ? HEADLINE_SCHOOL : HEADLINE_ALL,
    keywords: interests.keywords,
    items,
    fallback,
  };
}
