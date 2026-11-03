import { errorMessage } from './errors';

export const DEFAULT_TIMEOUT_MS = 15_000;
export const AI_TIMEOUT_MS = 30_000;

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
  return new ApiError(res.status, 'UNKNOWN', errorMessage('UNKNOWN'));
}

async function send<T>(
  path: string,
  init: { method: string; body?: BodyInit; headers: Record<string, string> },
  timeoutMs: number,
): Promise<T> {
  const url = new URL(config.baseUrl + path, window.location.origin);
  const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
  const token = config.getToken();
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
      if (res.status === 401) config.onUnauthorized();
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
  const { method = 'GET', body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (body === undefined) return send<T>(path, { method, headers }, timeoutMs);
  return send<T>(
    path,
    {
      method,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
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
  const { method = 'POST', headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  return send<T>(path, { method, body: form, headers }, timeoutMs);
}
