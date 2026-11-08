import { formatTime, toSeoulIso } from '@/shared/lib/date';

export type CourseStatus = 'DRAFT' | 'CONFIRMED';
export type StopType = 'CAMPUS' | 'STORE';

/**
 * 코스에 넣을 장소 한 곳(2B′-R14). 상점과 캠퍼스 건물을 같은 모양으로 다뤄 `buildSpots`의 추가 · 교체와 장소 고르기 화면이 함께 쓴다.
 */
export type PlaceRef =
  { type: 'STORE'; storeId: number } | { type: 'CAMPUS'; campusBuildingId: number };

/** S-02 주변 상점. 와이어에 거리 칸이 없어 `distanceM`은 프론트가 캠퍼스 중심에서 잰 미터다(2B′-R15). */
export interface NearbyStore {
  storeId: number;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  isPartner: boolean;
  /** AI 리뷰 요약. 리뷰가 없으면 null. */
  reviewSummary: string | null;
  distanceM: number;
}

/** C-02 보완 캠퍼스 장소(건물). */
export interface CampusPlace {
  campusBuildingId: number;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
}

/** 코스 지점 상한(2B′-R14). 명세에 없어 프론트만 막는다. */
export const MAX_COURSE_STOPS = 5;

/** 걸음 속도: 분당 80m. */
const WALKING_METERS_PER_MIN = 80;

/** 도보 분(올림, 최소 1분). */
export function walkingMinutes(distanceM: number): number {
  return Math.max(1, Math.ceil(distanceM / WALKING_METERS_PER_MIN));
}

/** `도보 약 N분`. */
export function walkingLabel(distanceM: number): string {
  return `도보 약 ${walkingMinutes(distanceM)}분`;
}

/**
 * 지도에 핀으로 찍을 수 있는 좌표인지(대략 한국 범위: 위도 33~39, 경도 124~132). 백엔드가 0 · null을 주거나
 * 인허가 원본의 중부원점 TM(미터) 값을 그대로 주면 지도가 바다로 가므로 그 지점은 핀에서 뺀다.
 */
export function isKoreaCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 33 &&
    lat <= 39 &&
    lng >= 124 &&
    lng <= 132
  );
}

export interface CourseStop {
  id: number;
  order: number;
  visitTime: string;
  type: StopType;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description: string | null;
  recommendationReason: string | null;
  storeId: number | null;
  /** 캠퍼스 지점의 건물 id(2C-R12 ①). 스팟 PUT은 전체 교체라 캠퍼스 지점을 다시 보낼 때 쓴다. 상점 지점은 null. */
  campusBuildingId: number | null;
  partnership: { discount: string } | null;
  review: { average: number | null; count: number; summary: string | null } | null;
  dataSource: string | null;
}

/** 지점의 장소. 응답이 지점 유형에 맞는 id를 채워 주므로 null이면 장소를 모르는 지점이다. */
function placeOfStop(stop: CourseStop): PlaceRef | null {
  if (stop.type === 'STORE') {
    return stop.storeId === null ? null : { type: 'STORE', storeId: stop.storeId };
  }
  return stop.campusBuildingId === null
    ? null
    : { type: 'CAMPUS', campusBuildingId: stop.campusBuildingId };
}

/** 같은 장소인지. 상점 id와 캠퍼스 건물 id는 서로 다른 번호 체계다. */
export function samePlace(a: PlaceRef, b: PlaceRef | null): boolean {
  if (b === null) return false;
  return a.type === 'STORE'
    ? b.type === 'STORE' && a.storeId === b.storeId
    : b.type === 'CAMPUS' && a.campusBuildingId === b.campusBuildingId;
}

export interface CourseTourInfo {
  id: number;
  title: string;
  universityId: number;
  universityShortName: string;
  campusName: string;
  startsAt: string;
  endsAt: string | null;
}

export interface Course {
  tourId: number;
  status: CourseStatus;
  tour: CourseTourInfo;
  stops: CourseStop[];
  interests: string[];
  criteria: string;
  confirmedAt: string | null;
  issuedCouponCount: number;
}

/** 코스 초안 화면의 "추천 상점 기준" 문구(설계 5.6 — 와이어프레임의 옛 기준 문구 대신 쓴다). 백엔드가 주지 않아 프론트가 둔다. */
export const COURSE_CRITERIA =
  '신청자들이 적은 하고 싶은 것 → 관련 업종 상점 매칭(인허가 공공데이터) · 제휴 상점 1곳 이상 포함';

/** 상점 지점의 데이터 출처 라벨(설계 5.6). */
export const STORE_DATA_SOURCE = '공공데이터(인허가) 기반';

/** 지점 한줄평 최대 길이(백엔드 C-02 `comment` 100자 이내, 2C-R12 ③). */
export const COURSE_NOTE_MAX = 100;

/** 제휴 지점인데 할인 문구가 없을 때(실서버 — 스팟에 `discount_text` 확장이 없다, 2C-R8). */
export const PARTNER_DISCOUNT_FALLBACK = '쿠폰 사용 가능';

/** 시작 시각으로부터 각 지점까지의 분 단위 간격. 5번째 뒤로는 50분씩 늘어난다. */
export const SLOT_OFFSETS_MIN = [0, 70, 120, 170, 220] as const;

const EXTRA_SLOT_STEP_MIN = 50;

const OVERFLOW_ROUND_MIN = 5;

/**
 * 방문 시간은 위치 슬롯에 고정된다. 탐방 시작 시각에서 `count`개 지점의 `HH:mm`(Asia/Seoul)을 돌려준다.
 * `endsAt`(탐방 종료)을 알면 탐방 시간(종료 − 시작)보다 작은 슬롯 간격만 그대로 쓰고, 넘치는 지점은 마지막으로 쓴 슬롯과
 * 종료 사이를 고르게 나눠 5분 단위로 내린 시각에 둔다(데모 탐방 14:00–16:30의 4번째 지점은 16:15). `endsAt`이 없거나 시작보다
 * 늦지 않으면 위치 슬롯 그대로이고, 다섯 곳 넘게는 50분씩 늘어난다.
 */
export function slotTimes(startsAt: string, count: number, endsAt?: string | null): string[] {
  const startMs = Date.parse(startsAt);
  const last = SLOT_OFFSETS_MIN[SLOT_OFFSETS_MIN.length - 1];
  const positional = (i: number): number =>
    i < SLOT_OFFSETS_MIN.length
      ? SLOT_OFFSETS_MIN[i]
      : last + (i - (SLOT_OFFSETS_MIN.length - 1)) * EXTRA_SLOT_STEP_MIN;
  const windowMin = endsAt ? (Date.parse(endsAt) - startMs) / 60_000 : NaN;
  const bounded = Number.isFinite(windowMin) && windowMin > 0;

  let offsets: number[];
  if (!bounded) {
    offsets = Array.from({ length: count }, (_, i) => positional(i));
  } else {
    const fits = SLOT_OFFSETS_MIN.filter((offset) => offset < windowMin).length;
    const kept = Math.min(count, fits);
    const overflow = count - kept;
    const from = SLOT_OFFSETS_MIN[Math.max(kept, 1) - 1];
    offsets = Array.from({ length: count }, (_, i) => {
      if (i < kept) return SLOT_OFFSETS_MIN[i];
      const share = ((windowMin - from) * (i - kept + 1)) / (overflow + 1);
      return Math.floor((from + share) / OVERFLOW_ROUND_MIN) * OVERFLOW_ROUND_MIN;
    });
  }
  return offsets.map((offset) => formatTime(toSeoulIso(new Date(startMs + offset * 60_000))));
}

/** 식사로 묶는 상점 업종. */
const MEAL_CATEGORIES = new Set(['한식', '분식', '중식', '일식', '양식', '식당']);

/**
 * 지점 분류(H04 단계 막대 라벨 · G03 · G08 요약 줄). 캠퍼스 지점은 `캠퍼스`, 식사 업종은 `식사`이고,
 * 그 밖(`카페` 포함)은 업종 그대로다 — `보드게임카페`는 카페가 아니다.
 */
export function stopKindLabel(stop: Pick<CourseStop, 'type' | 'category'>): string {
  if (stop.type === 'CAMPUS') return '캠퍼스';
  return MEAL_CATEGORIES.has(stop.category) ? '식사' : stop.category;
}

/** 코스를 이루는 지점 분류(`stopKindLabel`)를 처음 나온 순서대로 한 번씩 — 코스 완성(G03) · 확정 점검(G08)의 요약 줄. */
export function courseKinds(stops: Pick<CourseStop, 'type' | 'category'>[]): string[] {
  return [...new Set(stops.map(stopKindLabel))];
}

/** 제휴 지점 수. `partnership`은 서버가 탐방 날짜에 유효한 제휴로 채운다(쿠폰 발급과 같은 기준). */
export function partnerStopCount(stops: Pick<CourseStop, 'partnership'>[]): number {
  return stops.filter((stop) => stop.partnership !== null).length;
}

/** 학생에게 보이는 코스 상태. 코스가 없거나 초안이면 아직 준비 중이다. */
export function studentCourseLabel(status: CourseStatus | null): '코스 준비 중' | '코스 확정' {
  return status === 'CONFIRMED' ? '코스 확정' : '코스 준비 중';
}

const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * 지점마다 머무는 분(2A-R6). 다음 지점 방문 시각까지이고, 마지막 지점은 탐방 종료 시각까지다. 종료 시각이 없거나
 * 마지막 방문 시각보다 이르면(음수 · 0분) 그 지점은 `null`이다 — 화면은 `· N분`을 생략한다.
 */
export function stopDurations(
  stops: Pick<CourseStop, 'visitTime'>[],
  endsAt: string | null,
): (number | null)[] {
  return stops.map((stop, i) => {
    const next = stops[i + 1]?.visitTime ?? (endsAt === null ? null : formatTime(endsAt));
    if (next === null) return null;
    const minutes = hhmmToMinutes(next) - hhmmToMinutes(stop.visitTime);
    return minutes > 0 ? minutes : null;
  });
}

/** 장소 고르기(G07)가 하는 일: 맨 끝에 더하기, 그 지점 바꾸기, 또는 주소가 가리키는 지점이 없음. */
export type PickTarget =
  { kind: 'add' } | { kind: 'replace'; stop: CourseStop } | { kind: 'invalid' };

/**
 * 주소(`?mode=replace&stopId=`)에서 고르기 대상을 정한다. 교체는 지점 유형과 상관없이 코스에 있는 지점이면 된다(2B′-R14 —
 * 옛 2B-R12의 "상점만"을 넓힘). 교체인데 id가 없거나 코스에 없으면 invalid, 그 밖은 추가다.
 */
export function pickTarget(course: Course, mode: string | null, stopId: string | null): PickTarget {
  if (mode !== 'replace') return { kind: 'add' };
  const stop = stopId === null ? undefined : course.stops.find((s) => String(s.id) === stopId);
  return stop === undefined ? { kind: 'invalid' } : { kind: 'replace', stop };
}

/** 후보 카드 상태: 고를 수 있음 · 이미 코스에 있음 · 바꾸려는 지금 지점. */
export type CandidateStatus = 'SELECTABLE' | 'IN_COURSE' | 'CURRENT';

/** 같은 장소 중복은 명세에 없어 프론트만 막는다(2B′-R14, 9절 7번). */
export function candidateStatus(
  place: PlaceRef,
  course: Course,
  target: PickTarget,
): CandidateStatus {
  if (target.kind === 'replace' && samePlace(place, placeOfStop(target.stop))) return 'CURRENT';
  return course.stops.some((stop) => samePlace(place, placeOfStop(stop)))
    ? 'IN_COURSE'
    : 'SELECTABLE';
}

const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase();

/** 검색: 공백 · 대소문자를 무시한 부분 일치. 빈 검색어는 모두 맞는다. null 글은 건너뛴다. */
export function matchesPlace(texts: (string | null)[], query: string): boolean {
  const q = normalize(query);
  return q === '' || texts.some((text) => text !== null && normalize(text).includes(q));
}
