import type { DB, TourWishRow } from '@/mocks/db/schema';
import { nextId } from '@/mocks/db/ids';
import { toSeoulIso } from '@/shared/lib/date';
import { fieldError, MockApiError } from './errors';

// 탐방 희망 사항 규칙(T-01 `POST /tour-wishes`). `db`를 직접 고치고 행을 돌려준다(저장은 핸들러의 `mutate`).
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

/** 문자열이면 앞뒤 공백을 뺀 값, 아니면 빈 문자열(길이 검사에 걸리게). */
const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * 고교생의 희망 사항 등록. 한 사람이 여러 개 등록할 수 있다. 학과 · 희망 사항은 앞뒤 공백만 빼서(안쪽 줄바꿈은 그대로)
 * 행의 `major` · `content`에, 희망 날짜는 `preferredDate`에 둔다.
 */
export function createWish(db: DB, userId: number, input: WishBody, now: Date): TourWishRow {
  if (db.users.find((u) => u.id === userId)?.role !== 'HIGH_SCHOOL') {
    throw new MockApiError(403, 'FORBIDDEN');
  }
  const university = db.universities.find((u) => u.id === input.campusId);
  if (!university) throw fieldError('campusId', '학교를 골라 주세요.');
  const major = trimmed(input.major);
  if (major.length < 1 || major.length > MAJOR_MAX) {
    throw fieldError('major', `학과는 1~${MAJOR_MAX}자로 적어 주세요.`);
  }
  const content = trimmed(input.wish);
  if (content.length < 1 || content.length > WISH_MAX) {
    throw fieldError('wish', `희망 사항은 1~${WISH_MAX}자로 적어 주세요.`);
  }
  const date = input.date ?? null;
  if (date !== null && (typeof date !== 'string' || !DATE_PATTERN.test(date))) {
    throw fieldError('date', '날짜를 다시 골라 주세요.');
  }

  const at = toSeoulIso(now);
  const row: TourWishRow = {
    id: nextId(db),
    userId,
    universityId: university.id,
    major,
    content,
    preferredDate: date,
    createdAt: at,
    updatedAt: at,
  };
  db.tourWishes.push(row);
  return row;
}
