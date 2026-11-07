import { snakeToCamel, toCamel, toSnake } from './caseKeys';
import { errorMessage, resolveErrorCode, type ErrorCode } from './errors';

export const DEFAULT_TIMEOUT_MS = 15_000;
export const AI_TIMEOUT_MS = 30_000;
/** 사진 업로드 제한 시간(느린 회선의 10MB). */
export const UPLOAD_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  status: number;
  code: string;
  /** 백엔드가 준 오류 코드(`E409_TOUR_FULL`). 클라이언트 오류(TIMEOUT · NETWORK)와 봉투 아닌 오류는 null. */
  backendCode: string | null;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra: {
      fieldErrors?: Record<string, string>;
      details?: Record<string, unknown>;
      backendCode?: string | null;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.backendCode = extra.backendCode ?? null;
    this.fieldErrors = extra.fieldErrors;
    this.details = extra.details;
  }
}

export interface HttpConfig {
  baseUrl: string;
  getToken(): string | null;
  onUnauthorized(): void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /**
   * false면 세션 토큰을 붙이지 않고, 401이어도 `onUnauthorized`(세션 만료 처리)를 부르지 않는다. 로그인 요청용 —
   * 로그인의 401은 자격 증명 오류이지 지금 세션의 만료가 아니다(로그인한 채 다른 계정으로 로그인해도 세션을 지키게).
   */
  auth?: boolean;
  /** 이 호출에서만 쓰는 백엔드 코드 → `ErrorCode`. 기본 표(`BACKEND_ERROR_MAP`)보다 앞선다. */
  errorMap?: Partial<Record<string, ErrorCode>>;
  /** `errors[].field`(snake) → 폼 칸 이름. 없으면 camelCase로 바꾼 이름을 쓴다. */
  fieldMap?: Record<string, string>;
}

let config: HttpConfig = {
  baseUrl: '/api',
  getToken: () => null,
  onUnauthorized: () => {},
};

export function configureHttp(partial: Partial<HttpConfig>): void {
  config = { ...config, ...partial };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type EnvelopeLike = Record<string, unknown> & { code: string };

/** 객체이고 `code`가 S/E 세 자리로 시작한다(2C-R2의 `code` 조건). 봉투 판별의 공통 부분. */
function hasEnvelopeCode(value: unknown): value is EnvelopeLike {
  return isRecord(value) && typeof value.code === 'string' && /^[SE]\d{3}/.test(value.code);
}

/** 성공 응답의 봉투(2C-R2): `code` 조건 + `data` 키. `timestamp`는 보지 않는다. */
function isEnvelope(value: unknown): value is EnvelopeLike {
  return hasEnvelopeCode(value) && 'data' in value;
}

/** `errors: [{ field, reason }]` → `{ 칸: 문구 }`(2C-R5). 같은 칸은 첫 항목, 대문자 기계값은 코드 문구로. */
function toFieldErrors(
  errors: unknown,
  code: ErrorCode,
  fieldMap: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!Array.isArray(errors)) return undefined;
  const out: Record<string, string> = {};
  for (const entry of errors as unknown[]) {
    if (!isRecord(entry) || typeof entry.field !== 'string') continue;
    const field = fieldMap?.[entry.field] ?? snakeToCamel(entry.field);
    if (Object.hasOwn(out, field)) continue;
    const reason = typeof entry.reason === 'string' ? entry.reason : '';
    out[field] = reason === '' || /^[A-Z][A-Z_]*$/.test(reason) ? errorMessage(code) : reason;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function detailsOf(data: unknown): Record<string, unknown> | undefined {
  return isRecord(data) ? toCamel<Record<string, unknown>>(data) : undefined;
}

function envelopeError(status: number, body: EnvelopeLike, options: RequestOptions): ApiError {
  const code = resolveErrorCode(body.code, options.errorMap);
  return new ApiError(status, code, errorMessage(code), {
    backendCode: body.code,
    fieldErrors: toFieldErrors(body.errors, code, options.fieldMap),
    details: detailsOf(body.data),
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function toApiError(res: Response, options: RequestOptions): Promise<ApiError> {
  const parsed = parseJson(await res.text());
  // 2C-R2 해석(통제자 확정): 실패 본문은 `code`만으로 봉투다 — `data` 키는 요구하지 않는다.
  if (hasEnvelopeCode(parsed)) return envelopeError(res.status, parsed, options);
  // 봉투가 아닌 413(본문 없음 · 프록시의 HTML 오류 쪽)은 업로드 한도 초과다(계약 6절 18번).
  if (res.status === 413) {
    return new ApiError(413, 'FILE_TOO_LARGE', errorMessage('FILE_TOO_LARGE'));
  }
  return new ApiError(res.status, 'UNKNOWN', errorMessage('UNKNOWN'));
}

async function send<T>(
  path: string,
  init: { method: string; body?: BodyInit; headers: Record<string, string>; auth: boolean },
  timeoutMs: number,
  options: RequestOptions,
): Promise<T> {
  const url = new URL(config.baseUrl + path, window.location.origin);
  const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
  const token = init.auth ? config.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: init.method,
      headers,
      body: init.body,
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401 && init.auth) config.onUnauthorized();
      throw await toApiError(res, options);
    }
    const text = await res.text();
    if (text === '') return undefined as T;
    const parsed = parseJson(text);
    if (parsed === undefined) throw new ApiError(res.status, 'UNKNOWN', errorMessage('UNKNOWN'));
    if (isEnvelope(parsed)) {
      // 2xx인데 실패 봉투(`E…`)면 실패로 다룬다.
      if (parsed.code.startsWith('E')) throw envelopeError(res.status, parsed, options);
      return toCamel<T>(parsed.data);
    }
    return toCamel<T>(parsed);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (timedOut) throw new ApiError(0, 'TIMEOUT', errorMessage('TIMEOUT'));
    throw new ApiError(0, 'NETWORK', errorMessage('NETWORK'));
  } finally {
    clearTimeout(timer);
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = true,
  } = options;
  if (body === undefined) return send<T>(path, { method, headers, auth }, timeoutMs, options);
  return send<T>(
    path,
    {
      method,
      body: JSON.stringify(toSnake(body)),
      headers: { 'Content-Type': 'application/json', ...headers },
      auth,
    },
    timeoutMs,
    options,
  );
}

// Content-Type은 직접 넣지 않는다. 브라우저가 multipart 경계를 채운다. 필드 이름은 호출하는 쪽이 쓴 그대로 보낸다.
export function upload<T>(
  path: string,
  form: FormData,
  options: Omit<RequestOptions, 'body'> = {},
): Promise<T> {
  const { method = 'POST', headers = {}, timeoutMs = UPLOAD_TIMEOUT_MS, auth = true } = options;
  return send<T>(path, { method, body: form, headers, auth }, timeoutMs, options);
}

/**
 * 쿼리 문자열을 붙인 경로. 이름은 호출하는 쪽이 snake로 쓴다(키 변환 안 함).
 * `undefined` · `null` · `''`은 뺀다. 경로에 이미 `?`가 있으면 `&`로 잇는다.
 */
export function withQuery(
  path: string,
  query: Record<string, string | number | boolean | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  if (qs === '') return path;
  return `${path}${path.includes('?') ? '&' : '?'}${qs}`;
}

/** 목록 API의 쪽 크기 상한(명세). */
export const PAGE_SIZE_MAX = 50;
const LIST_ALL_MAX_PAGES = 20;

/**
 * 목록 전체(2C-R23). `size=50`으로 부르고, 응답에 `total`이 있고 모은 수가 그보다 적으면 다음 쪽을 이어 부른다.
 * 빈 쪽이 오면 멈추고 최대 20쪽. `items`만 오는 작은 목록은 한 번으로 끝난다.
 */
export async function listAll<T>(
  path: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= LIST_ALL_MAX_PAGES; page += 1) {
    const data = await request<unknown>(withQuery(path, { page, size: PAGE_SIZE_MAX }), {
      ...options,
      method: 'GET',
    });
    if (Array.isArray(data)) return [...all, ...(data as T[])];
    const items: unknown = isRecord(data) ? data.items : undefined;
    if (!Array.isArray(items)) return all;
    all.push(...(items as T[]));
    const total = isRecord(data) ? data.total : undefined;
    if (items.length === 0 || typeof total !== 'number' || all.length >= total) return all;
  }
  return all;
}

/** 같은 오류의 코드만 바꾼다(2C-R15의 세분). 상태 · `backendCode` · `details`는 그대로, 문구는 새 코드의 것. */
export function recode(
  error: ApiError,
  code: ErrorCode,
  extra: { fieldErrors?: Record<string, string> } = {},
): ApiError {
  return new ApiError(error.status, code, errorMessage(code), {
    backendCode: error.backendCode,
    details: error.details,
    fieldErrors: extra.fieldErrors ?? error.fieldErrors,
  });
}
