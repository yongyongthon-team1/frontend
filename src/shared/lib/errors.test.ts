import { describe, expect, it } from 'vitest';
import { errorMessage, ERROR_CODES } from './errors';

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
    ['COMPLETE_BEFORE_TOUR_DATE', '탐방 날짜 이후에 완료할 수 있어요.'],
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
