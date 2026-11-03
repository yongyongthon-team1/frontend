import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

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
