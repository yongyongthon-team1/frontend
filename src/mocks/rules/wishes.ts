import type { DB, TourWishRow } from '@/mocks/db/schema';
import { nextId } from '@/mocks/db/ids';
import { toSeoulIso } from '@/shared/lib/date';
import { fieldError, MockApiError } from './errors';

// 탐방 희망 사항 규칙(T-01 등록 · T-07 내 목록과 수정 · T-08 가이드 조회). `db`를 직접 고치고 행을 돌려준다(저장은 핸들러의 `mutate`).
// 위에서부터 차례로 검사해 처음 걸린 오류를 던지고, 검사를 모두 마친 뒤에만 행을 더한다 — 규칙에 걸리면 DB는 그대로다.

/** 학과 · 희망 사항의 최대 길이(백엔드 T-01, 2C-R11). */
const MAJOR_MAX = 30;
const WISH_MAX = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** HTTP 본문에서 바로 넘어오므로 값의 타입을 믿지 않는다. */
export interface WishBody {
  campusId: unknown;
  major: unknown;
  wish: unknown;
  date?: unknown;
}

/** 고치는 칸(`PATCH`). 보낸 칸만 검사하고 저장한다. */
export type WishPatch = Partial<WishBody>;

/** 문자열이면 앞뒤 공백을 뺀 값, 아니면 빈 문자열(길이 검사에 걸리게). */
const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** 칸 검사 — 등록과 수정이 같이 쓴다. 통과한 값을 돌려주고, 걸리면 그 칸의 오류를 던진다. */
function checkCampus(db: DB, campusId: unknown): number {
  const university = db.universities.find((u) => u.id === campusId);
  if (!university) throw fieldError('campusId', '학교를 골라 주세요.');
  return university.id;
}

function checkMajor(value: unknown): string {
  const major = trimmed(value);
  if (major.length < 1 || major.length > MAJOR_MAX) {
    throw fieldError('major', `학과는 1~${MAJOR_MAX}자로 적어 주세요.`);
  }
  return major;
}

function checkWish(value: unknown): string {
  const content = trimmed(value);
  if (content.length < 1 || content.length > WISH_MAX) {
    throw fieldError('wish', `희망 사항은 1~${WISH_MAX}자로 적어 주세요.`);
  }
  return content;
}

function checkDate(value: unknown): string | null {
  const date = value ?? null;
  if (date !== null && (typeof date !== 'string' || !DATE_PATTERN.test(date))) {
    throw fieldError('date', '날짜를 다시 골라 주세요.');
  }
  return date;
}

/**
 * 고교생의 희망 사항 등록. 한 사람이 여러 개 등록할 수 있다. 학과 · 희망 사항은 앞뒤 공백만 빼서(안쪽 줄바꿈은 그대로)
 * 행의 `major` · `content`에, 희망 날짜는 `preferredDate`에 둔다.
 */
export function createWish(db: DB, userId: number, input: WishBody, now: Date): TourWishRow {
  if (db.users.find((u) => u.id === userId)?.role !== 'HIGH_SCHOOL') {
    throw new MockApiError(403, 'FORBIDDEN');
  }
  const universityId = checkCampus(db, input.campusId);
  const major = checkMajor(input.major);
  const content = checkWish(input.wish);
  const date = checkDate(input.date);

  const at = toSeoulIso(now);
  const row: TourWishRow = {
    id: nextId(db),
    userId,
    universityId,
    major,
    content,
    preferredDate: date,
    createdAt: at,
    updatedAt: at,
  };
  db.tourWishes.push(row);
  return row;
}

/**
 * T-07 희망 사항 수정(`PATCH`). 보낸 칸만 등록과 같은 검사를 거쳐 저장하고 `updatedAt`을 지금으로 한다(`createdAt`은 그대로).
 * 없는 id는 NOT_FOUND, 남의 것(또는 고교생이 아닌 사용자)은 FORBIDDEN이다. 검사를 모두 마친 뒤에만 행을 고친다.
 */
export function updateWish(
  db: DB,
  userId: number,
  wishId: number,
  patch: WishPatch,
  now: Date,
): TourWishRow {
  const row = db.tourWishes.find((w) => w.id === wishId);
  if (!row) throw new MockApiError(404, 'NOT_FOUND');
  if (row.userId !== userId || db.users.find((u) => u.id === userId)?.role !== 'HIGH_SCHOOL') {
    throw new MockApiError(403, 'FORBIDDEN');
  }
  const has = (key: keyof WishPatch) => Object.hasOwn(patch, key);
  const universityId = has('campusId') ? checkCampus(db, patch.campusId) : row.universityId;
  const major = has('major') ? checkMajor(patch.major) : row.major;
  const content = has('wish') ? checkWish(patch.wish) : row.content;
  const preferredDate = has('date') ? checkDate(patch.date) : row.preferredDate;

  Object.assign(row, { universityId, major, content, preferredDate, updatedAt: toSeoulIso(now) });
  return row;
}

/** 최신순(만든 시각 내림차순, 같으면 id 내림차순) — 희망 사항 목록의 순서다. */
function newestWishFirst(a: TourWishRow, b: TourWishRow): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
}

/** T-07 내 희망 사항(최신순). */
export function myWishes(db: DB, userId: number): TourWishRow[] {
  return db.tourWishes.filter((w) => w.userId === userId).sort(newestWishFirst);
}

/**
 * T-08 가이드가 보는 고교생 희망 사항(최신순). 대학생만, 재학 인증이 APPROVED인 사람만 본다. 학교를 생략하면 내 학교(인증 행의
 * 대학, 없으면 가이드 프로필의 대학)이고, 학과는 부분 일치다. 학생의 이름 같은 개인정보는 행에서 나가지 않는다(와이어가 가린다).
 */
export function wishesForGuide(
  db: DB,
  guideId: number,
  filter: { campusId?: number; major?: string },
): TourWishRow[] {
  if (db.users.find((u) => u.id === guideId)?.role !== 'UNIVERSITY') {
    throw new MockApiError(403, 'FORBIDDEN');
  }
  const verification = db.verifications.find((v) => v.id === guideId);
  if (verification?.status !== 'APPROVED') throw new MockApiError(403, 'NOT_VERIFIED');
  const campusId =
    filter.campusId ??
    verification.universityId ??
    db.guideProfiles.find((g) => g.id === guideId)?.universityId;
  const major = filter.major?.trim() ?? '';
  return db.tourWishes
    .filter((w) => w.universityId === campusId && (major === '' || w.major.includes(major)))
    .sort(newestWishFirst);
}
