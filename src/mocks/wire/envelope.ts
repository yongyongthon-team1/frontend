import { HttpResponse, type HttpResponseResolver } from 'msw';
import { mockNow } from '@/mocks/clock';
import type { Resolver } from '@/mocks/handlers/util';
import { MockApiError } from '@/mocks/rules/errors';
import { camelToSnake, toSnake } from '@/shared/lib/caseKeys';
import { toSeoulIso } from '@/shared/lib/date';
import { toBackendError } from './errorCodes';

// 목업이 내는 백엔드 응답 봉투(`backend-spec.md` 공통 응답). 본문 키는 snake_case다.

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/** 성공 봉투 `{ code: S200|S201, message: '성공', data, errors: null, timestamp }`. `data`의 키는 snake로 바뀐다. */
export function ok(data: unknown, status: 200 | 201 = 200): Response {
  return HttpResponse.json(
    {
      code: status === 201 ? 'S201' : 'S200',
      message: '성공',
      data: toSnake(data ?? null),
      errors: null,
      timestamp: toSeoulIso(mockNow()),
    },
    { status },
  );
}

function positiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return raw !== null && Number.isInteger(n) && n >= 1 ? n : fallback;
}

/** 목록 봉투의 `data`: `page` 기본 1, `size` 기본 20 · 최대 50. `items`는 전체 목록이고 여기서 자른다. 목록 말고 쪽 정보가 필요한 응답(리뷰 R-02)도 쓴다. */
export function pageOf<T>(
  items: T[],
  search: URLSearchParams,
): { items: T[]; page: number; size: number; total: number } {
  const page = positiveInt(search.get('page'), 1);
  const size = Math.min(positiveInt(search.get('size'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), page, size, total: items.length };
}

/** 목록 봉투 `data: { items, page, size, total }`(`pageOf`). */
export function okPage(items: unknown[], search: URLSearchParams): Response {
  return ok(pageOf(items, search));
}

/** 쪽 없는 목록 봉투 `data: { items }`. */
export function okItems(items: unknown[]): Response {
  return ok({ items });
}

/** 오류 봉투 본문과 상태를 직접 지정해 낸다(`fail`과 테스트 도구 `wireFail`이 공유). `data`는 snake로, `errors`는 그대로. */
export function failRaw(
  code: string,
  status: number,
  parts: {
    message: string;
    data?: unknown;
    errors?: { field: string; reason: string }[] | null;
  },
): Response {
  return HttpResponse.json(
    {
      code,
      message: parts.message,
      data: parts.data === undefined || parts.data === null ? null : toSnake(parts.data),
      errors: parts.errors ?? null,
      timestamp: toSeoulIso(mockNow()),
    },
    { status },
  );
}

/**
 * 규칙이 던진 `MockApiError`를 오류 봉투와 역표(`toBackendError`)의 상태로 바꾼다. `backendCode`가 있으면(`backendError`, 2B′-R4)
 * 역표 대신 그 코드와 `error.status`로 낸다. `fieldErrors` → `errors[]`, `details` → `data`.
 */
export function fail(error: MockApiError): Response {
  const wire = error.backendCode
    ? { code: error.backendCode, status: error.status }
    : toBackendError(error.code, error.status);
  return failRaw(wire.code, wire.status, {
    message: error.message,
    data: error.details,
    errors: error.fieldErrors
      ? Object.entries(error.fieldErrors).map(([field, reason]) => ({
          field: camelToSnake(field),
          reason,
        }))
      : null,
  });
}

/** 핸들러 경계. `MockApiError`는 `fail`로, 다른 오류는 그대로 던진다. */
export function withWire(resolver: Resolver): HttpResponseResolver {
  return async ({ request, params }) => {
    try {
      return await resolver({ request, params });
    } catch (error) {
      if (!(error instanceof MockApiError)) throw error;
      return fail(error);
    }
  };
}
