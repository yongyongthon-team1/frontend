import { errorMessage } from './errors';

export const DEFAULT_TIMEOUT_MS = 15_000;
export const AI_TIMEOUT_MS = 30_000;
/** 사진 업로드 제한 시간(느린 회선의 10MB). */
export const UPLOAD_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra: { fieldErrors?: Record<string, string>; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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

async function toApiError(res: Response): Promise<ApiError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await res.text());
  } catch {
    parsed = undefined;
  }
  if (isRecord(parsed) && typeof parsed.code === 'string') {
    return new ApiError(
      res.status,
      parsed.code,
      typeof parsed.message === 'string' ? parsed.message : errorMessage(parsed.code),
      {
        fieldErrors: isRecord(parsed.fieldErrors)
          ? (parsed.fieldErrors as Record<string, string>)
          : undefined,
        details: isRecord(parsed.details) ? parsed.details : undefined,
      },
    );
  }
  // JSON `code`가 없는 413(본문 없음 · 프록시의 HTML 오류 쪽)은 업로드 한도 초과다(계약 6절 18번).
  if (res.status === 413) {
    return new ApiError(413, 'FILE_TOO_LARGE', errorMessage('FILE_TOO_LARGE'));
  }
  return new ApiError(res.status, 'UNKNOWN', errorMessage('UNKNOWN'));
}

async function send<T>(
  path: string,
  init: { method: string; body?: BodyInit; headers: Record<string, string>; auth: boolean },
  timeoutMs: number,
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
      throw await toApiError(res);
    }
    const text = await res.text();
    if (text === '') return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, 'UNKNOWN', errorMessage('UNKNOWN'));
    }
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
  if (body === undefined) return send<T>(path, { method, headers, auth }, timeoutMs);
  return send<T>(
    path,
    {
      method,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
      auth,
    },
    timeoutMs,
  );
}

// Content-Type은 직접 넣지 않는다. 브라우저가 multipart 경계를 채운다.
export function upload<T>(
  path: string,
  form: FormData,
  options: Omit<RequestOptions, 'body'> = {},
): Promise<T> {
  const { method = 'POST', headers = {}, timeoutMs = UPLOAD_TIMEOUT_MS, auth = true } = options;
  return send<T>(path, { method, body: form, headers, auth }, timeoutMs);
}
