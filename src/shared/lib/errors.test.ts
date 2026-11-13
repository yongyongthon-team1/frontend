import { describe, expect, it } from 'vitest';
import {
  BACKEND_ERROR_MAP,
  errorMessage,
  ERROR_CODES,
  isErrorCode,
  resolveErrorCode,
} from './errors';

describe('errorMessage', () => {
  it('알려진 코드는 표의 문구', () =>
    expect(errorMessage('TOUR_CLOSED')).toBe('정원이 마감됐어요.'));
  it('모르는 코드는 fallback, 없으면 UNKNOWN 문구', () => {
    expect(errorMessage('WHAT', '기본')).toBe('기본');
    expect(errorMessage('WHAT')).toBe('문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    expect(errorMessage(undefined)).toBe('문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    expect(errorMessage(null)).toBe('문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
  });
});

describe('P1에서 새로 쓰는 에러 코드', () => {
  it.each([
    ['COMPLETE_BEFORE_TOUR_DATE', '투어 날짜 이후에 완료할 수 있어요.'],
    ['COURSE_STOP_DUPLICATE', '이미 코스에 있는 장소예요.'],
    ['COURSE_STOP_LIMIT', '지점은 최대 5곳까지 넣을 수 있어요.'],
    ['BIZ_NOT_VERIFIED', '사업자 인증을 마친 뒤에 가게를 연결할 수 있어요.'],
    ['ADDRESS_NOT_FOUND', '주소를 찾을 수 없어요. 도로명 주소로 다시 입력해 주세요.'],
  ])('%s는 표의 문구', (code, message) => {
    expect(Object.hasOwn(ERROR_CODES, code)).toBe(true);
    expect(errorMessage(code)).toBe(message);
  });

  it('BIZ_CLOSED는 다음 행동이 있는 문구', () =>
    expect(errorMessage('BIZ_CLOSED')).toBe(
      '휴업 또는 폐업한 사업자예요. 계속사업자 정보로 다시 입력해 주세요.',
    ));
});

describe('2C에서 새로 쓰는 에러 코드', () => {
  it.each([
    ['COURSE_PARTNER_REQUIRED', '제휴 상점을 1곳 이상 넣어 주세요.'],
    ['COUPON_DAILY_LIMIT', '오늘 이 가게에서는 이미 쿠폰을 사용했어요.'],
    ['AI_FAILED', 'AI가 코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'],
  ])('%s는 표의 문구', (code, message) => {
    expect(Object.hasOwn(ERROR_CODES, code)).toBe(true);
    expect(errorMessage(code)).toBe(message);
  });
});

describe('2B′-R7 사진 규칙(jpg · png, 5MB)', () => {
  it.each([
    ['FILE_TYPE', 'jpg, png 이미지만 올릴 수 있어요.'],
    ['FILE_TOO_LARGE', '5MB 이하 이미지만 올릴 수 있어요.'],
  ])('%s는 표의 문구', (code, message) => {
    expect(errorMessage(code)).toBe(message);
  });
});

describe('isErrorCode', () => {
  it('표에 있는 이름만 true', () => {
    expect(isErrorCode('TOUR_CLOSED')).toBe(true);
    expect(isErrorCode('E409_TOUR_FULL')).toBe(false);
    expect(isErrorCode('toString')).toBe(false);
  });
});

describe('BACKEND_ERROR_MAP', () => {
  it('값은 모두 ErrorCode', () => {
    for (const code of Object.values(BACKEND_ERROR_MAP)) expect(isErrorCode(code)).toBe(true);
  });
});

describe('resolveErrorCode', () => {
  it('호출별 errorMap이 가장 앞선다', () =>
    expect(resolveErrorCode('E409_TOUR_FULL', { E409_TOUR_FULL: 'CAPACITY_EXCEEDED' })).toBe(
      'CAPACITY_EXCEEDED',
    ));
  it('ErrorCode 이름 그대로는 백엔드 코드가 아니라서 UNKNOWN', () =>
    expect(resolveErrorCode('TOUR_CLOSED')).toBe('UNKNOWN'));
  it('기본 표', () => {
    expect(resolveErrorCode('E409_TOUR_FULL')).toBe('TOUR_CLOSED');
    expect(resolveErrorCode('E422_PARTNER_REQUIRED')).toBe('COURSE_PARTNER_REQUIRED');
  });
  it('표에 없으면 E###_ 뒤의 이름이 ErrorCode일 때 그것(접미사)', () =>
    expect(resolveErrorCode('E409_COUPON_NOT_YET')).toBe('COUPON_NOT_YET'));
  it('아무것도 아니면 UNKNOWN', () => {
    expect(resolveErrorCode('E418_TEAPOT')).toBe('UNKNOWN');
    expect(resolveErrorCode('whatever')).toBe('UNKNOWN');
  });
});
