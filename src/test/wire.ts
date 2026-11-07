import { failRaw, ok } from '@/mocks/wire/envelope';

// 백엔드 응답 봉투를 만드는 테스트 도구(2C-R25 ④). 본문은 snake_case 와이어 모양이다.

/** 성공 봉투 `{ code: S200|S201, message, data, errors: null, timestamp }`. 목업 `ok`를 그대로 쓴다(봉투 규칙을 둘로 두지 않는다 — errata G10). */
export function wireOk(data: unknown, init: { status?: 200 | 201 } = {}): Response {
  return ok(data, init.status ?? 200);
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

/** 오류 봉투. 목업 `fail`과 같은 본문 규칙 · 시계를 쓴다(`failRaw`). 상태 기본값은 코드의 세 자리(`E409_TOUR_FULL` → 409), 없으면 500. */
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
  return failRaw(code, status, {
    message: init.message ?? '실패',
    data: init.data,
    errors: init.errors,
  });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareShape(
  actual: unknown,
  example: unknown,
  ext: readonly string[],
  path: string,
): void {
  // 한쪽이 null이면(값이 없는 칸) 그 아래는 비교하지 않는다.
  if (actual === null || example === null || actual === undefined || example === undefined) return;
  if (Array.isArray(example)) {
    if (!Array.isArray(actual))
      throw new Error(`${path}: 배열이어야 해요 (받은 값: ${typeof actual})`);
    if (actual.length > 0 && example.length > 0) {
      compareShape(actual[0], example[0], ext, `${path}[0]`);
    }
    return;
  }
  if (!isRecord(example)) return;
  if (!isRecord(actual)) throw new Error(`${path}: 객체여야 해요 (받은 값: ${typeof actual})`);
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);
  for (const key of Object.keys(example)) {
    if (!Object.hasOwn(actual, key)) throw new Error(`${at(key)}: 명세 키가 없어요`);
  }
  for (const key of Object.keys(actual)) {
    if (!Object.hasOwn(example, key) && !ext.includes(key)) {
      throw new Error(`${at(key)}: 명세에도 확장 목록에도 없는 키예요`);
    }
  }
  for (const key of Object.keys(example)) compareShape(actual[key], example[key], ext, at(key));
}

/**
 * 목업 응답이 명세 예시와 같은 모양인지(2C-R25 ②). 객체는 `keys(example) ⊆ keys(actual)`이고 그 밖의 키는 `ext`(키 이름)에 든 것뿐이다.
 * 같은 키끼리 다시 비교하며, 배열은 둘 다 비어 있지 않으면 첫 원소끼리, 한쪽이 null이면 그 키는 넘어간다(최상위가 null · undefined면 실패). 실패 메시지에 경로(`data.items[0].guide`)가 있다.
 *
 * 주의: 안쪽 null은 건너뛰므로 `data: null`인 오류 봉투가 성공 예시와 맞을 수 있다. 호출하는 쪽이 `status`와 `code`도 따로 단언한다.
 */
export function expectWireShape(
  actual: unknown,
  example: unknown,
  ext: readonly string[] = [],
): void {
  // 최상위는 비어 있는 응답(`rawFetch`의 빈 본문 `undefined`, `null`)이 아무 예시와도 맞는 일이 없게 막는다.
  if ((isRecord(example) || Array.isArray(example)) && (actual === null || actual === undefined)) {
    throw new Error(`응답이 비어 있어요 (받은 값: ${String(actual)})`);
  }
  compareShape(actual, example, ext, '');
}
