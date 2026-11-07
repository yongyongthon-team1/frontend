import { errorMessage, type ErrorCode } from '@/shared/lib/errors';

/**
 * 목업 규칙이 던지는 API 오류. 핸들러(Task 9 `withErrors`)가 `status`와
 * `{ code, message, details, fieldErrors }` 본문으로 바꿔 응답한다. 메시지를 주지 않으면 에러 코드 표의 문구를 쓴다.
 */
export class MockApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message?: string,
    public details?: Record<string, unknown>,
    /** 입력 칸별 오류(`{ 칸 이름: 문구 }`). 화면이 해당 칸 아래에 보인다. */
    public fieldErrors?: Record<string, string>,
  ) {
    super(message ?? errorMessage(code));
    this.name = 'MockApiError';
  }
}

/**
 * 입력 칸 하나의 오류. 응답 본문의 `message`는 코드 표 문구이고, 칸 아래에 보일 문구는 `fieldErrors[field]`다.
 * `field`는 규칙이 읽는 와이어 이름(camel, 예 `schoolName`)으로 쓴다 — 봉투의 `errors[].field`가 그 snake 이름(`school_name`)이 된다.
 * 문구를 생략하면 기본 문구를 쓴다.
 */
export function fieldError(
  field: string,
  message = '입력값을 확인해 주세요.',
  code: ErrorCode = 'VALIDATION',
  status = 400,
): MockApiError {
  return new MockApiError(status, code, undefined, undefined, { [field]: message });
}
