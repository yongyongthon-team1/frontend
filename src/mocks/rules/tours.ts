import { isWithinVacation } from '@/features/campuses/model';
import {
  TOUR_CAPACITY_MAX,
  TOUR_INTRO_MAX,
  type ApplicationStatus,
} from '@/features/applications/model';
import { nextId } from '@/mocks/db/ids';
import type { DB, TourRow } from '@/mocks/db/schema';
import { seoulDateAt, seoulDateKey, toSeoulIso } from '@/shared/lib/date';
import { expireCouponsForApplication } from './coupons';
import { backendError, fieldError, MockApiError } from './errors';

// 탐방 개설(T-03) · 완료(T-06) · 취소(T-05) 규칙. 모두 `db`를 직접 고치고 행을 돌려준다(저장은 핸들러의 `mutate`).
// 위에서부터 차례로 검사해 처음 걸린 오류를 던지고, 검사를 모두 마친 뒤에만 행을 바꾼다 — 규칙에 걸리면 DB는 그대로다.

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `yyyy-MM-dd` 꼴이면서 달력에 있는 날짜인지(`2027-02-30`은 아니다). */
function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && TIME_PATTERN.test(value);

/** 가이드 본인의 탐방(없으면 404, 남의 탐방이면 403). */
function ownTour(db: DB, guideId: number, tourId: number): TourRow {
  const tour = db.tours.find((t) => t.id === tourId);
  if (!tour) throw new MockApiError(404, 'NOT_FOUND');
  if (tour.guideId !== guideId) throw new MockApiError(403, 'FORBIDDEN');
  return tour;
}

/**
 * 탐방 개설(T-03). 본문은 `readBody`가 camel로 되돌린 `{ date, startTime, endTime, capacity, intro, openChatUrl }`이다.
 * 검사 순서: 인증 APPROVED(없으면 403 NOT_VERIFIED) → 가이드 프로필 학과(비면 409 GUIDE_PROFILE_REQUIRED) → 칸 형식(위에서부터
 * 하나) → 날짜가 가이드 학교(인증 행 → 프로필 순)의 방학 안인지(명세 문장 그대로). "내일 이후" 규칙은 명세에 없어 두지 않는다
 * (2B′-R12). 제목은 null이라 카드 제목은 파생 제목이다.
 */
export function createTour(
  db: DB,
  guideId: number,
  body: Record<string, unknown>,
  now: Date,
): TourRow {
  const verification = db.verifications.find((v) => v.id === guideId);
  if (verification?.status !== 'APPROVED') throw new MockApiError(403, 'NOT_VERIFIED');
  const profile = db.guideProfiles.find((g) => g.id === guideId);
  const universityId = verification.universityId ?? profile?.universityId ?? null;
  if (!profile?.major?.trim() || universityId === null) {
    throw new MockApiError(409, 'GUIDE_PROFILE_REQUIRED');
  }

  const { date, startTime, endTime, capacity, intro, openChatUrl } = body;
  if (!isCalendarDay(date)) throw fieldError('date', '날짜를 골라 주세요.');
  if (!isTime(startTime)) throw fieldError('startTime', '시작 시간을 골라 주세요.');
  if (!isTime(endTime)) throw fieldError('endTime', '종료 시간을 골라 주세요.');
  if (endTime <= startTime) throw fieldError('endTime', '종료 시간은 시작 시간보다 늦어야 해요.');
  if (
    typeof capacity !== 'number' ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > TOUR_CAPACITY_MAX
  ) {
    throw fieldError('capacity', `모집 정원은 1~${TOUR_CAPACITY_MAX}명으로 적어 주세요.`);
  }
  const introduction = typeof intro === 'string' ? intro.trim() : '';
  if (introduction === '' || introduction.length > TOUR_INTRO_MAX) {
    throw fieldError('intro', `투어 소개는 1~${TOUR_INTRO_MAX}자로 적어 주세요.`);
  }
  const chatUrl = typeof openChatUrl === 'string' ? openChatUrl.trim() : '';
  if (chatUrl === '') throw fieldError('openChatUrl', '연락 링크를 넣어 주세요.');

  const vacations = db.vacations.filter((v) => v.universityId === universityId);
  if (!isWithinVacation(vacations, date)) {
    throw fieldError('date', '방학 기간 안의 날짜만 선택할 수 있어요');
  }

  const at = toSeoulIso(now);
  const tour: TourRow = {
    id: nextId(db),
    guideId,
    universityId,
    title: null,
    startsAt: seoulDateAt(date, startTime),
    endsAt: seoulDateAt(date, endTime),
    capacity,
    introduction,
    openChatUrl: chatUrl,
    status: 'RECRUITING',
    createdAt: at,
    updatedAt: at,
  };
  db.tours.push(tour);
  return tour;
}

/**
 * 탐방 완료(T-06). 이미 완료됐으면 `TOUR_ALREADY_COMPLETED`, 취소됐으면 명세 코드 `E409_INVALID_TOUR_STATUS`(내부 코드
 * `ALREADY_PROCESSED`), 오늘(서울)이 탐방 날짜 전이면 `COMPLETE_BEFORE_TOUR_DATE`다. 당일은 허용한다(9절 23번).
 */
export function completeTour(db: DB, guideId: number, tourId: number, now: Date): TourRow {
  const tour = ownTour(db, guideId, tourId);
  if (tour.status === 'COMPLETED') throw new MockApiError(409, 'TOUR_ALREADY_COMPLETED');
  if (tour.status === 'CANCELED') {
    throw backendError(409, 'E409_INVALID_TOUR_STATUS', 'ALREADY_PROCESSED');
  }
  if (seoulDateKey(now) < seoulDateKey(tour.startsAt)) {
    throw new MockApiError(409, 'COMPLETE_BEFORE_TOUR_DATE');
  }
  tour.status = 'COMPLETED';
  tour.updatedAt = toSeoulIso(now);
  return tour;
}

const isLive = (status: ApplicationStatus) => status === 'PENDING' || status === 'APPROVED';

/**
 * 탐방 취소(T-05). 대기 · 승인 신청은 CANCELED가 되고(`activeUserId` null) 그 신청의 ISSUED 쿠폰은 EXPIRED가 된다. 이미 사용한
 * 쿠폰(USED)과 거절된 신청은 그대로다(9절 25번). 이미 완료됐으면 `TOUR_ALREADY_COMPLETED`, 이미 취소됐으면
 * `E409_INVALID_TOUR_STATUS`(`ALREADY_PROCESSED`)다.
 */
export function cancelTour(db: DB, guideId: number, tourId: number, now: Date): TourRow {
  const tour = ownTour(db, guideId, tourId);
  if (tour.status === 'COMPLETED') throw new MockApiError(409, 'TOUR_ALREADY_COMPLETED');
  if (tour.status === 'CANCELED') {
    throw backendError(409, 'E409_INVALID_TOUR_STATUS', 'ALREADY_PROCESSED');
  }

  const at = toSeoulIso(now);
  for (const app of db.applications) {
    if (app.tourId !== tour.id || !isLive(app.status)) continue;
    app.status = 'CANCELED';
    app.activeUserId = null;
    app.updatedAt = at;
    expireCouponsForApplication(db, app.id);
  }
  tour.status = 'CANCELED';
  tour.updatedAt = at;
  return tour;
}
