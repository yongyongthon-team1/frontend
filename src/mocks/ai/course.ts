import { slotTimes } from '@/features/courses/model';
import { distanceMeters } from '@/mocks/db/geo';
import type { CampusPlaceRow, CourseStopRow, DB, StoreRow } from '@/mocks/db/schema';
import { MockApiError } from '@/mocks/rules/errors';
import { seoulDateKey } from '@/shared/lib/date';
import {
  extractInterests,
  LIFESTYLE_CATEGORIES,
  LIFESTYLE_INTENTS,
  MAJOR_FAMILY,
  MAJOR_KEYWORDS,
  type LifestyleIntent,
} from './interests';

// C-01 코스 초안 흉내(결정 0008). 승인자들의 "하고 싶은 것"에서 생활 의도를 모아 캠퍼스 장소 + 관련 업종 상점으로
// 코스를 짜고, 관련 후보(반경 안 · 의도 업종) 중에 제휴 상점이 있으면 최소 1곳을 넣는다. 관련 업종에 제휴가 없으면
// 관련 없는 업종의 제휴 상점을 덧붙이지 않고 그대로 둔다(제휴 0곳 코스는 확정이 422 COURSE_PARTNER_REQUIRED). 거리는 모두 대학 중심에서 잰다.

/** 상점 후보 반경(대학 중심에서, 미터). */
export const COURSE_RADIUS_M = 1000;

export type DraftStop = Omit<CourseStopRow, 'id' | 'tourId'>;

export interface CourseDraft {
  stops: DraftStop[];
  /** "입력된 관심사" 라벨: `전공 수업` · `캠퍼스 시설` + 생활 의도. */
  interests: string[];
}

/** 승인자 동기에 생활 의도가 하나도 없을 때 쓰는 의도. */
const DEFAULT_INTENTS: LifestyleIntent[] = ['식사', '카페'];
const CAMPUS_INTERESTS = ['전공 수업', '캠퍼스 시설'];
const QUOTE_CHARS = 20;
const NO_SUMMARY = '학생들이 자주 찾는 곳이에요.';

/** 이름 → id 순서. 코드 단위로 비교해 실행 환경(로캘)에 상관없이 같다. */
function byNameThenId(a: StoreRow, b: StoreRow): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.id - b.id;
}

/** 가이드 학과가 포함하는 첫 학과 키의 계열 단어(예: `디자인`)가 이름에 든 첫 장소, 없으면 첫 장소. */
function campusPlace(
  db: DB,
  universityId: number,
  major: string | null,
): CampusPlaceRow | undefined {
  const places = db.campusPlaces
    .filter((p) => p.universityId === universityId)
    .sort((a, b) => a.campusBuildingId - b.campusBuildingId);
  const key =
    major === null ? undefined : Object.keys(MAJOR_KEYWORDS).find((k) => major.includes(k));
  const family = key === undefined ? undefined : MAJOR_FAMILY[key];
  return (
    (family === undefined ? undefined : places.find((p) => p.name.includes(family))) ?? places[0]
  );
}

/** 상점 리뷰 요약(가장 최근 것)의 첫 문장. 요약이 없으면 null. */
function summaryLead(db: DB, storeId: number): string | null {
  const [latest] = db.reviewSummaries
    .filter((s) => s.storeId === storeId)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt) || b.id - a.id);
  if (!latest) return null;
  const text = latest.summary.trim();
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

/**
 * 탐방의 코스 초안을 만든다(DB는 바꾸지 않는다). ① 승인자 동기(신청 id 순서)에서 생활 의도를 모으고(없으면 식사 ·
 * 카페) ② 캠퍼스 장소 하나를 첫 지점으로 ③ 의도 순서(식사 → 카페 → 놀거리)마다 반경 1km 안 해당 업종에서 가장
 * 가까운 상점(같으면 이름 · id 순)을 고른다 ④ 고른 상점이 탐방 날짜에 모두 비제휴면 고른 순서대로 같은 업종의 가장
 * 가까운 제휴 상점으로 하나를 바꾼다 ⑤ 시간은 위치 슬롯 ⑥ 지점마다 이유를 붙인다.
 */
export function generateCourseDraft(db: DB, tourId: number): CourseDraft {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  const university = db.universities.find((u) => u.id === tour.universityId)!;
  const center = { lat: university.latitude, lng: university.longitude };
  const tourDay = seoulDateKey(tour.startsAt);
  const major = db.guideProfiles.find((g) => g.id === tour.guideId)?.major ?? null;

  const askers = db.applications
    .filter((a) => a.tourId === tourId && a.status === 'APPROVED')
    .sort((a, b) => a.id - b.id)
    .map((a) => ({
      motivation: a.motivation.trim(),
      intents: extractInterests(a.motivation).lifestyle,
    }));
  const asked = LIFESTYLE_INTENTS.filter((i) => askers.some((a) => a.intents.includes(i)));
  const intents = asked.length > 0 ? asked : DEFAULT_INTENTS;

  const distance = new Map(
    db.stores.map((s) => [s.id, distanceMeters(center, { lat: s.latitude, lng: s.longitude })]),
  );
  const candidatesOf = (intent: LifestyleIntent) =>
    db.stores
      .filter(
        (s) =>
          LIFESTYLE_CATEGORIES[intent].includes(s.category) &&
          distance.get(s.id)! <= COURSE_RADIUS_M,
      )
      .sort((a, b) => distance.get(a.id)! - distance.get(b.id)! || byNameThenId(a, b));
  const partnershipOn = (storeId: number) =>
    db.partnerships.find(
      (p) => p.storeId === storeId && p.startDate <= tourDay && tourDay <= p.endDate,
    );

  const picks = intents.flatMap((intent) => {
    const [store] = candidatesOf(intent);
    return store ? [{ intent, store }] : [];
  });
  if (!picks.some((p) => partnershipOn(p.store.id))) {
    for (const pick of picks) {
      const partner = candidatesOf(pick.intent).find((s) => partnershipOn(s.id));
      if (partner) {
        pick.store = partner;
        break;
      }
    }
  }

  const stops: Omit<DraftStop, 'stopOrder' | 'visitTime'>[] = [];
  const place = campusPlace(db, university.id, major);
  if (place) {
    stops.push({
      stopType: 'CAMPUS',
      campusBuildingId: place.campusBuildingId,
      storeId: null,
      partnershipId: null,
      description: null,
      recommendationReason: `${major === null ? '' : `${major} `}전공 공간에서 실제 수업 이야기를 들어요.`,
    });
  }
  for (const { intent, store } of picks) {
    // 이 의도를 적은 승인자 수와 첫 동기(앞 20자). 기본 의도라 적은 사람이 없으면 리뷰 문장만 쓴다.
    const wanted = askers.filter((a) => a.intents.includes(intent));
    const lead = summaryLead(db, store.id) ?? NO_SUMMARY;
    const quote =
      wanted.length === 0
        ? null
        : Array.from(wanted[0].motivation).slice(0, QUOTE_CHARS).join('').trimEnd();
    stops.push({
      stopType: 'STORE',
      campusBuildingId: null,
      storeId: store.id,
      partnershipId: partnershipOn(store.id)?.id ?? null,
      description: null,
      recommendationReason:
        quote === null ? lead : `신청자 ${wanted.length}명이 "${quote}"를 궁금해했어요. ${lead}`,
    });
  }

  const times = slotTimes(tour.startsAt, stops.length);
  return {
    stops: stops.map((s, i) => ({ ...s, stopOrder: i + 1, visitTime: times[i] })),
    interests: [...CAMPUS_INTERESTS, ...intents],
  };
}
