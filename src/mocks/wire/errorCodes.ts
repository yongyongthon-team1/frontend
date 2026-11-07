import type { ErrorCode } from '@/shared/lib/errors';

// 목업 오류 역표(2C-R6). 규칙은 `MockApiError(상태, ErrorCode)`를 던지고, 핸들러 경계의 `fail()`이 이 표로
// 백엔드 코드 · 상태를 정한다. 짝이 없는 코드는 `E{상태}_{ErrorCode}`인 목업 확장 코드로 내고,
// 클라이언트는 `resolveErrorCode`의 접미사 규칙으로 되찾는다.

type Wire = { code: string; status: number };

const FIXED: Partial<Record<ErrorCode, Wire>> = {
  VALIDATION: { code: 'E400', status: 400 },
  UNAUTHORIZED: { code: 'E401', status: 401 },
  INVALID_CREDENTIALS: { code: 'E401_INVALID_CREDENTIALS', status: 401 },
  FORBIDDEN: { code: 'E403', status: 403 },
  NOT_VERIFIED: { code: 'E403_VERIFICATION_REQUIRED', status: 403 },
  GUARDIAN_NOT_AGREED: { code: 'E403_VERIFICATION_REQUIRED', status: 403 },
  BIZ_NOT_VERIFIED: { code: 'E403_VERIFICATION_REQUIRED', status: 403 },
  COUPON_OTHER_STORE: { code: 'E403_OTHER_STORE', status: 403 },
  REVIEW_NOT_ALLOWED: { code: 'E403_COUPON_NOT_USED', status: 403 },
  NOT_FOUND: { code: 'E404', status: 404 },
  COUPON_NOT_FOUND: { code: 'E404', status: 404 },
  STORE_NOT_LINKED: { code: 'E404', status: 404 },
  CONSENT_LINK_INVALID: { code: 'E404', status: 404 },
  EMAIL_DUPLICATE: { code: 'E409', status: 409 },
  TOUR_CLOSED: { code: 'E409_TOUR_FULL', status: 409 },
  TOUR_NOT_RECRUITING: { code: 'E409_TOUR_FULL', status: 409 },
  CAPACITY_EXCEEDED: { code: 'E409_TOUR_FULL', status: 409 },
  DUPLICATE_APPLICATION: { code: 'E409_ALREADY_APPLIED', status: 409 },
  ALREADY_PROCESSED: { code: 'E409_ALREADY_PROCESSED', status: 409 },
  CANCEL_AFTER_TOUR_DATE: { code: 'E409_INVALID_APPLICATION_STATUS', status: 409 },
  TOUR_ALREADY_COMPLETED: { code: 'E409_INVALID_TOUR_STATUS', status: 409 },
  COMPLETE_BEFORE_TOUR_DATE: { code: 'E409_INVALID_TOUR_STATUS', status: 409 },
  GUIDE_PROFILE_REQUIRED: { code: 'E409_GUIDE_PROFILE_REQUIRED', status: 409 },
  NO_APPROVED_APPLICANTS: { code: 'E409_NO_APPROVED_APPLICANT', status: 409 },
  COURSE_NOT_DRAFT: { code: 'E409_COURSE_CONFIRMED', status: 409 },
  COURSE_NOT_READY: { code: 'E409_COURSE_NOT_READY', status: 409 },
  COUPON_ALREADY_USED: { code: 'E409_ALREADY_USED', status: 409 },
  COUPON_DAILY_LIMIT: { code: 'E409_DAILY_LIMIT', status: 409 },
  STORE_ALREADY_LINKED: { code: 'E409_STORE_UNAVAILABLE', status: 409 },
  STORE_LIMIT: { code: 'E409_STORE_UNAVAILABLE', status: 409 },
  REVIEW_DUPLICATE: { code: 'E409_ALREADY_REVIEWED', status: 409 },
  COUPON_EXPIRED: { code: 'E410_EXPIRED', status: 410 },
  CONSENT_LINK_EXPIRED: { code: 'E410_EXPIRED', status: 410 },
  BIZ_MISMATCH: { code: 'E422_BUSINESS_INVALID', status: 422 },
  BIZ_CLOSED: { code: 'E422_BUSINESS_INVALID', status: 422 },
  COURSE_PARTNER_REQUIRED: { code: 'E422_PARTNER_REQUIRED', status: 422 },
  AI_FAILED: { code: 'E502_AI_FAILED', status: 502 },
  UNKNOWN: { code: 'E500', status: 500 },
};

/** 되돌려 읽으면(`resolveErrorCode`) 자기 자신이 아닌 코드. 2C-R15의 호출별 세분이 되찾는다(2C 밖의 것은 2B 재계획). */
export const LOSSY_CODES: readonly ErrorCode[] = [
  'GUARDIAN_NOT_AGREED',
  'BIZ_NOT_VERIFIED',
  'TOUR_NOT_RECRUITING',
  'CAPACITY_EXCEEDED',
  'COUPON_NOT_FOUND',
  'STORE_NOT_LINKED',
  'CONSENT_LINK_INVALID',
  'EMAIL_DUPLICATE',
  'CANCEL_AFTER_TOUR_DATE',
  'TOUR_ALREADY_COMPLETED',
  'COMPLETE_BEFORE_TOUR_DATE',
  'STORE_LIMIT',
  'REVIEW_DUPLICATE',
  'CONSENT_LINK_EXPIRED',
  'BIZ_CLOSED',
];

/** `ErrorCode` → 백엔드 코드 · 상태. 표에 없는 코드는 `E{받은 상태}_{ErrorCode}`(목업 확장 코드). */
export function toBackendError(code: ErrorCode, status: number): Wire {
  return FIXED[code] ?? { code: `E${status}_${code}`, status };
}
