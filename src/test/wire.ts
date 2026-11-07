import { HttpResponse } from 'msw';
import { toSnake } from '@/shared/lib/caseKeys';

// 백엔드 응답 봉투를 만드는 테스트 도구(2C-R25 ④). 본문은 snake_case 와이어 모양이다.

const TIMESTAMP = '2026-11-04T21:00:00+09:00';

/** 성공 봉투 `{ code: S200|S201, message, data, errors: null, timestamp }`. `data`의 키는 snake로 바뀐다. */
export function wireOk(data: unknown, init: { status?: 200 | 201 } = {}): Response {
  const status = init.status ?? 200;
  return HttpResponse.json(
    {
      code: status === 201 ? 'S201' : 'S200',
      message: '성공',
      data: toSnake(data),
      errors: null,
      timestamp: TIMESTAMP,
    },
    { status },
  );
}

/** 목록 봉투 `data: { items, page, size, total }`. 생략하면 1쪽 · 50개 · `items.length`. */
export function wirePage(
  items: unknown[],
  meta: { page?: number; size?: number; total?: number } = {},
): Response {
  return wireOk({
    items,
    page: meta.page ?? 1,
    size: meta.size ?? 50,
    total: meta.total ?? items.length,
  });
}

/** 오류 봉투. 상태 기본값은 코드의 세 자리(`E409_TOUR_FULL` → 409), 없으면 500. */
export function wireFail(
  code: string,
  init: {
    status?: number;
    errors?: { field: string; reason: string }[];
    data?: unknown;
    message?: string;
  } = {},
): Response {
  const status = init.status ?? Number(/^E(\d{3})/.exec(code)?.[1] ?? 500);
  return HttpResponse.json(
    {
      code,
      message: init.message ?? '실패',
      data: init.data === undefined ? null : toSnake(init.data),
      errors: init.errors ?? null,
      timestamp: TIMESTAMP,
    },
    { status },
  );
}

/**
 * 상태 코드(201 · 204)와 본문을 변환 없이 보는 fetch(`/api` + path). 본문이 JSON이면 파싱한 값, 비었으면 `undefined`.
 * 본문 모양은 호출하는 쪽이 `rawFetch<모양>`으로 적는다(`any`를 쓰지 않으려고 기본은 `unknown`).
 */
export async function rawFetch<T = unknown>(
  path: string,
  init: { method: string; token?: string; body?: unknown },
): Promise<{ status: number; body: T }> {
  const res = await fetch(new URL(`/api${path}`, window.location.origin), {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: unknown;
  if (text !== '') {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body: body as T };
}
