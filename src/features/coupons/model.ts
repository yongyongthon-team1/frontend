import { formatTime, seoulDateKey } from '@/shared/lib/date';
import type { Tone } from '@/shared/lib/types';

export type CouponStatus = 'ISSUED' | 'USED' | 'EXPIRED';
/** 어댑터가 쿠폰 상태와 지금 시각으로 계산한다(`computeCouponState`). */
export type CouponState = 'BEFORE_DAY' | 'USABLE' | 'EXPIRED' | 'USED';

export interface Coupon {
  id: number;
  code: string;
  status: CouponStatus;
  state: CouponState;
  discount: string;
  storeId: number;
  storeName: string;
  storeCategory: string;
  applicationId: number;
  tourId: number;
  tourTitle: string;
  tourStartsAt: string;
  expiresAt: string;
  usedAt: string | null;
  reviewWritten: boolean;
}

export interface CouponLookup {
  code: string;
  state: CouponState;
  discount: string;
  storeName: string;
  tourTitle: string;
  tourStartsAt: string;
  studentName: string;
  usedAt: string | null;
}

export interface RedeemResult {
  coupon: CouponLookup;
  /** 이 가게의 사용 쿠폰 중 이번 탐방 것. 실서버는 주지 않아(null) 화면이 캡션을 숨긴다(2C-R12 ⑤). */
  tourVisitorCount: number | null;
  totalVisitorCount: number | null;
}

/**
 * 목업 서버 · API 어댑터 전용. 컴포넌트는 어댑터가 계산한 `Coupon.state`를 그린다.
 * 사용 완료 → 만료(상태 또는 기한 경과) → 탐방 당일 전 → 사용 가능 순으로 검사한다.
 */
export function computeCouponState(
  c: { status: CouponStatus; tourStartsAt: string; expiresAt: string },
  now: Date,
): CouponState {
  if (c.status === 'USED') return 'USED';
  if (c.status === 'EXPIRED' || now.getTime() > Date.parse(c.expiresAt)) return 'EXPIRED';
  if (seoulDateKey(now) < seoulDateKey(c.tourStartsAt)) return 'BEFORE_DAY';
  return 'USABLE';
}

/** 쿠폰 상태 칩 색: 쓸 수 있는 것만 success, 나머지(당일 전 · 만료 · 사용 완료)는 조용한 neutral. 목록과 상세가 같이 쓴다. */
export function couponStateTone(state: CouponState): Tone {
  return state === 'USABLE' ? 'success' : 'neutral';
}

export function couponStateLabel(state: CouponState, usedAt: string | null): string {
  switch (state) {
    case 'BEFORE_DAY':
      return '투어 당일 사용 가능';
    case 'USABLE':
      return '사용 가능';
    case 'EXPIRED':
      return '만료';
    case 'USED':
      return usedAt ? `사용 완료 · ${formatTime(usedAt)}` : '사용 완료';
  }
}

/** 쿠폰 코드를 3자리씩 끊어 보인다(`824193` → `824 193`, V2 V11). 6자리 숫자가 아니면 그대로 둔다. */
export function formatCouponCode(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export interface CouponNotice {
  title: string;
  description: string;
}

/**
 * 사장님 쿠폰 사용 처리 화면의 오류 카드(owner-a03). 조회 · 사용 처리 오류 코드 또는 조회 상태로 문구를 정한다.
 * 오류 코드가 우선이고, 코드가 없거나 모르는 코드면 상태를 본다. 카드가 필요 없으면(사용 가능 · 모르는 오류) null.
 * `usedAt`은 `이미 사용된 쿠폰`의 사용 시각이다(조회 결과의 값 또는 사용 처리 오류의 `details.usedAt`).
 */
export function couponNotice(input: {
  errorCode?: string;
  state?: CouponState;
  usedAt?: string | null;
}): CouponNotice | null {
  const { errorCode, state, usedAt } = input;
  if (errorCode === 'COUPON_ALREADY_USED') return usedNotice(usedAt);
  if (errorCode === 'COUPON_EXPIRED' || errorCode === 'COUPON_OTHER_STORE') return EXPIRED_NOTICE;
  if (errorCode === 'COUPON_NOT_FOUND') return NOT_FOUND_NOTICE;
  if (errorCode === 'COUPON_NOT_YET') return NOT_YET_NOTICE;
  if (errorCode === 'COUPON_DAILY_LIMIT') return DAILY_LIMIT_NOTICE;
  if (state === 'USED') return usedNotice(usedAt);
  if (state === 'EXPIRED') return EXPIRED_NOTICE;
  if (state === 'BEFORE_DAY') return NOT_YET_NOTICE;
  return null;
}

const EXPIRED_NOTICE: CouponNotice = {
  title: '만료되었거나 다른 가게 쿠폰',
  description: '코드를 다시 확인해 주세요.',
};
const NOT_FOUND_NOTICE: CouponNotice = {
  title: '존재하지 않는 6자리 코드',
  description: '입력값을 다시 확인해 주세요.',
};
const NOT_YET_NOTICE: CouponNotice = {
  title: '아직 사용할 수 없는 쿠폰',
  description: '투어 당일에만 사용할 수 있어요.',
};
const DAILY_LIMIT_NOTICE: CouponNotice = {
  title: '오늘 이미 쿠폰을 처리한 가게',
  description: '같은 날 한 가게에서는 쿠폰 한 장만 사용할 수 있어요.',
};

function usedNotice(usedAt: string | null | undefined): CouponNotice {
  return {
    title: '이미 사용된 쿠폰',
    description: usedAt ? `재사용 불가 · 사용 시각 ${formatTime(usedAt)}` : '재사용 불가',
  };
}
