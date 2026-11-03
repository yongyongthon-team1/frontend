import { errorMessage, type ErrorCode } from '@/shared/lib/errors';

/**
 * 목업 규칙이 던지는 API 오류. 핸들러(Task 9 `withErrors`)가 `status`와
 * `{ code, message, details }` 본문으로 바꿔 응답한다. 메시지를 주지 않으면 에러 코드 표의 문구를 쓴다.
 */
export class MockApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message ?? errorMessage(code));
    this.name = 'MockApiError';
  }
}
