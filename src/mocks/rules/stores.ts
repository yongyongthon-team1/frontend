import { fromWireMyStore } from '@/features/stores/wire';
import { COURSE_RADIUS_M } from '@/mocks/ai/course';
import type { MyStore } from '@/features/stores/model';
import { nextId } from '@/mocks/db/ids';
import type { DB, PartnershipRow, StoreRow } from '@/mocks/db/schema';
import type { WireStoreReport } from '@/features/stores/wire';
import { averageRating } from '@/mocks/wire/reviews';
import { toWireMyStore } from '@/mocks/wire/stores';
import { DEMO_BUSINESS } from '@/shared/config/demoAccounts';
import { addDaysKey, seoulDateKey, toSeoulIso } from '@/shared/lib/date';
import { distanceMeters } from '@/shared/lib/geo';
import { fieldError, MockApiError } from './errors';

// 사장님의 가게 조회 · 리포트 규칙과 주변 상점 조회(DB를 고치지 않는다), 그리고 사업자 인증 · 상점 검색 · 가게 연결 · 수정 · 제휴 설정.
// 쓰기 규칙은 위에서부터 검사해 처음 걸린 오류를 던지고, 다 통과한 뒤에만 DB를 고친다.

/** 이 사장님의 가게(계정당 1개). 연결된 가게가 없으면 404 STORE_NOT_LINKED. */
export function ownerStoreOf(db: DB, ownerId: number): StoreRow {
  const store = db.stores.find((s) => s.ownerId === ownerId);
  if (!store) throw new MockApiError(404, 'STORE_NOT_LINKED');
  return store;
}

/**
 * 이 사장님의 가게와 지금 쓰는 제휴(도메인 객체). 와이어 객체를 도메인으로 읽는 합성이라(2C-R26) 명세에 없는
 * 제휴 id · 조건은 0 · null이다.
 */
export function myStoreOf(db: DB, ownerId: number, now: Date): MyStore {
  return fromWireMyStore(toWireMyStore(db, ownerStoreOf(db, ownerId), now), now);
}

/** 리포트 기본 기간 일수: 오늘 −30일 ~ 오늘, 양 끝 포함(2B′-R19 — 명세는 "기본 최근 30일"만 말한다, 9절 44번). */
const REPORT_DEFAULT_DAYS = 30;

/** 실제로 있는 날의 `YYYY-MM-DD`인가(`2026-13-01`은 아니다). */
function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDaysKey(value, 0) === value;
}

/**
 * S-07 방문 · 리뷰 리포트. 순서: 가게 없음 404 → `from` · `to` 형식 → `from > to`. 기간은 `YYYY-MM-DD` 양 끝 포함(서울 날짜):
 * `visitCount` = 이 가게의 `USED` 쿠폰 중 `usedAt`이 기간 안인 수, 리뷰 수 · 평균은 `createdAt`이 기간 안인 리뷰(평균은 리뷰가 없으면 null).
 */
export function storeReport(
  db: DB,
  ownerId: number,
  query: { from: string | null; to: string | null },
  now: Date,
): WireStoreReport {
  const store = ownerStoreOf(db, ownerId);
  const today = seoulDateKey(now);
  const from = query.from ?? addDaysKey(today, -REPORT_DEFAULT_DAYS);
  const to = query.to ?? today;
  if (!isDateKey(from)) throw fieldError('from', '날짜를 다시 확인해 주세요.');
  if (!isDateKey(to)) throw fieldError('to', '날짜를 다시 확인해 주세요.');
  if (from > to) throw fieldError('to', '기간을 다시 확인해 주세요.');
  const inRange = (iso: string) => {
    const day = seoulDateKey(iso);
    return from <= day && day <= to;
  };
  const visitCount = db.coupons.filter(
    (c) => c.storeId === store.id && c.status === 'USED' && c.usedAt !== null && inRange(c.usedAt),
  ).length;
  const ratings = db.reviews
    .filter((r) => r.storeId === store.id && inRange(r.createdAt))
    .map((r) => r.rating);
  return {
    from,
    to,
    visitCount,
    reviewCount: ratings.length,
    averageRating: averageRating(ratings),
  };
}

/**
 * S-02 주변 상점. 캠퍼스 중심에서 `COURSE_RADIUS_M`(코스 초안과 같은 반경) 안의 상점을 id 순으로 돌려준다 — 거리 · 가까운 순은
 * 프론트가 계산한다(2B′-R15). `category`가 있으면 같은 업종만. 없는 캠퍼스는 404 NOT_FOUND.
 */
export function nearbyStores(db: DB, campusId: number, category: string | null): StoreRow[] {
  const campus = db.universities.find((u) => u.id === campusId);
  if (!campus) throw new MockApiError(404, 'NOT_FOUND');
  const center = { lat: campus.latitude, lng: campus.longitude };
  return db.stores
    .filter(
      (s) =>
        (category === null || s.category === category) &&
        distanceMeters(center, { lat: s.latitude, lng: s.longitude }) <= COURSE_RADIUS_M,
    )
    .sort((a, b) => a.id - b.id);
}

/** 숫자만 남긴다(`123-45-67890` → `1234567890`). 사업자등록번호 비교용. */
const digitsOf = (value: string) => value.replace(/\D/g, '');

/** 문자열이면 앞뒤 공백을 뗀 값, 아니면 빈 문자열. */
const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * U-07 사업자 인증. 순서: 번호(숫자만 10자리) → 대표자명 비어 있음 → 개업일 형식 → 폐업 번호(`DEMO_BUSINESS.closed`, 422 reason `CLOSED`)
 * → `DEMO_BUSINESS.match`의 번호 · 대표자명 · 개업일과 다름(422 reason `MISMATCH`). 통과하면 사업자 행을 만들거나 고쳐 인증으로 둔다.
 * 오류의 `fieldErrors` 값이 와이어의 `errors[].reason`이다(기계값).
 */
export function verifyBusiness(
  db: DB,
  userId: number,
  body: { businessNumber?: unknown; representativeName?: unknown; openedAt?: unknown },
  now: Date,
): void {
  const number = digitsOf(trimmed(body.businessNumber));
  if (number.length !== 10) {
    throw fieldError('businessNumber', '사업자등록번호 10자리를 입력해 주세요.');
  }
  const name = trimmed(body.representativeName);
  if (name === '') throw fieldError('representativeName', '대표자명을 입력해 주세요.');
  const openedAt = trimmed(body.openedAt);
  if (!isDateKey(openedAt)) throw fieldError('openedAt', '개업일자를 입력해 주세요.');
  if (number === digitsOf(DEMO_BUSINESS.closed.businessNumber)) {
    throw fieldError('businessNumber', 'CLOSED', 'BIZ_CLOSED', 422);
  }
  const { match } = DEMO_BUSINESS;
  if (
    number !== digitsOf(match.businessNumber) ||
    name !== match.representativeName ||
    openedAt !== match.openingDate
  ) {
    throw fieldError('businessNumber', 'MISMATCH', 'BIZ_MISMATCH', 422);
  }
  const stamp = toSeoulIso(now);
  const row = db.businessVerifications.find((b) => b.id === userId);
  if (row) {
    row.isVerified = true;
    row.verifiedAt = stamp;
    row.updatedAt = stamp;
  } else {
    db.businessVerifications.push({
      id: userId,
      isVerified: true,
      verifiedAt: stamp,
      updatedAt: stamp,
    });
  }
}

const ownsBusinessVerification = (db: DB, userId: number) =>
  db.businessVerifications.some((b) => b.id === userId && b.isVerified);

/** 공백 · 대소문자를 무시하려고 비교용으로 접은 문자열. */
const fold = (value: string) => value.replace(/\s/g, '').toLowerCase();

/** S-01 상점 검색. 공백 뺀 2자 미만이면 keyword 칸 오류. 공백 · 대소문자 무시 상호 부분 일치, 이름(ko) → id 순. */
export function searchStores(db: DB, keyword: string | null): StoreRow[] {
  const needle = fold(keyword ?? '');
  if (needle.length < 2) throw fieldError('keyword', '검색어를 2자 이상 입력해 주세요.');
  return db.stores
    .filter((s) => fold(s.name).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id - b.id);
}

/**
 * S-01 가게 연결 · 등록. 순서: 사업자 미인증 403 `BIZ_NOT_VERIFIED` → 이미 가게가 있음 409 `STORE_LIMIT` →
 * `storeId`가 있으면 없는 상점 404 → 다른 사장님의 가게 409 `STORE_ALREADY_LINKED` → 그 상점에 `ownerId` 연결.
 * 없으면 직접 등록: `name` · `address` · `category` 빈 값 → 좌표가 수가 아님 → 새 상점(행정동 null).
 */
export function linkStore(
  db: DB,
  userId: number,
  body: {
    storeId?: unknown;
    name?: unknown;
    address?: unknown;
    category?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  },
  now: Date,
): StoreRow {
  if (!ownsBusinessVerification(db, userId)) throw new MockApiError(403, 'BIZ_NOT_VERIFIED');
  if (db.stores.some((s) => s.ownerId === userId)) throw new MockApiError(409, 'STORE_LIMIT');
  const stamp = toSeoulIso(now);
  if (body.storeId !== undefined && body.storeId !== null) {
    const store = db.stores.find((s) => s.id === body.storeId);
    if (!store) throw new MockApiError(404, 'NOT_FOUND');
    if (store.ownerId !== null) throw new MockApiError(409, 'STORE_ALREADY_LINKED');
    store.ownerId = userId;
    store.updatedAt = stamp;
    return store;
  }
  const name = trimmed(body.name);
  if (name === '') throw fieldError('name', '상호명을 입력해 주세요.');
  const address = trimmed(body.address);
  if (address === '') throw fieldError('address', '가게 주소를 입력해 주세요.');
  const category = trimmed(body.category);
  if (category === '') throw fieldError('category', '업종을 입력해 주세요.');
  const { latitude, longitude } = body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw fieldError('latitude', '가게 위치를 골라 주세요.');
  }
  const row: StoreRow = {
    id: nextId(db),
    ownerId: userId,
    name,
    address,
    category,
    administrativeDong: null,
    latitude,
    longitude,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.stores.push(row);
  return row;
}

/** S-01 가게 수정. 순서: 가게 없음 404 → 준 칸이 빈 문자열이면 그 칸 오류 → 준 칸만 고침(앞뒤 공백 뗌). */
export function updateStore(
  db: DB,
  userId: number,
  body: { name?: unknown; address?: unknown; category?: unknown },
  now: Date,
): StoreRow {
  const store = ownerStoreOf(db, userId);
  const messages = {
    name: '상호명을 입력해 주세요.',
    address: '가게 주소를 입력해 주세요.',
    category: '업종을 입력해 주세요.',
  } as const;
  const next: Partial<Record<keyof typeof messages, string>> = {};
  for (const field of ['name', 'address', 'category'] as const) {
    if (body[field] === undefined) continue;
    const value = trimmed(body[field]);
    if (value === '') throw fieldError(field, messages[field]);
    next[field] = value;
  }
  Object.assign(store, next, { updatedAt: toSeoulIso(now) });
  return store;
}

/**
 * S-03 제휴 설정. 순서: 가게 없음 404 → 문구 공백 뺀 1~50자 → 날짜 형식(시작 → 종료) → 종료 < 시작. 그 가게의 가장 큰 id 제휴 행을
 * 고치고(id 유지) 없으면 새로 만든다. 사용 조건은 명세에 없어 null이다.
 */
export function savePartnership(
  db: DB,
  userId: number,
  body: { discountText?: unknown; startDate?: unknown; endDate?: unknown },
  now: Date,
): PartnershipRow {
  const store = ownerStoreOf(db, userId);
  const discount = trimmed(body.discountText);
  if (discount.length < 1 || discount.length > 50) {
    throw fieldError('discountText', '50자 이내로 적어 주세요.');
  }
  const startDate = trimmed(body.startDate);
  if (!isDateKey(startDate)) throw fieldError('startDate', '날짜를 다시 확인해 주세요.');
  const endDate = trimmed(body.endDate);
  if (!isDateKey(endDate)) throw fieldError('endDate', '날짜를 다시 확인해 주세요.');
  if (endDate < startDate) {
    throw fieldError('endDate', '종료 날짜는 시작 날짜와 같거나 뒤여야 해요.');
  }
  const stamp = toSeoulIso(now);
  const current = db.partnerships
    .filter((p) => p.storeId === store.id)
    .reduce<PartnershipRow | undefined>(
      (a, p) => (a === undefined || p.id > a.id ? p : a),
      undefined,
    );
  if (current) {
    Object.assign(current, {
      discountDescription: discount,
      condition: null,
      startDate,
      endDate,
      updatedAt: stamp,
    });
    return current;
  }
  const row: PartnershipRow = {
    id: nextId(db),
    storeId: store.id,
    discountDescription: discount,
    condition: null,
    startDate,
    endDate,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.partnerships.push(row);
  return row;
}
