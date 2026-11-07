import { errorMessage, type ErrorCode } from '@/shared/lib/errors';

/**
 * 목업 규칙이 던지는 API 오류. 핸들러 경계(`withWire`)가 `fail`로 오류 봉투
 * (`code` · `message` · `data` ← `details` · `errors` ← `fieldErrors`)와 그 상태 코드로 바꿔 응답한다. 메시지를 주지 않으면 에러 코드 표의 문구를 쓴다.
 */
export class MockApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message?: string,
    public details?: Record<string, unknown>,
    /** 입력 칸별 오류(`{ 칸 이름: 문구 }`). 화면이 해당 칸 아래에 보인다. */
    public fieldErrors?: Record<string, string>,
    /** 역표(`toBackendError`)로 나오지 않는 명세 코드(예 `E409_INVALID_TOUR_STATUS`). 있으면 `fail`이 이 코드와 `status`로 낸다(2B′-R4). */
    public backendCode?: string,
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

/**
 * 명세 코드를 그대로 내는 오류(2B′-R4). 내부 코드(`code`)는 규칙 단위 테스트와 화면이 읽는 `ErrorCode`이고, 와이어에는
 * `backendCode`와 `status`가 나간다. 역표만으로 명세 코드가 나오는 오류에는 쓰지 않는다.
 */
export function backendError(status: number, backendCode: string, code: ErrorCode): MockApiError {
  return new MockApiError(status, code, undefined, undefined, undefined, backendCode);
}
