// 백엔드(snake_case)와 프론트(camelCase)의 키 변환(2C-R3). 값(문자열 · 열거형)은 바꾸지 않는다.

/** `_` 뒤의 영소문자 · 숫자를 붙인다(`address_line_2` → `addressLine2`). 맨 앞 `_`는 그대로(`_meta`). 이미 camel이면 그대로(멱등). */
export function snakeToCamel(key: string): string {
  return key.replace(/(?<=.)_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * 소문자 · 숫자 바로 뒤의 대문자 앞에 `_`를 넣는다(`addressLine2` → `address_line2` — 숫자 앞에는 넣지 않는다).
 * 이미 snake면 그대로(멱등). `STORE` 같은 전부 대문자 키는 그대로 둔다.
 */
export function camelToSnake(key: string): string {
  return key.replace(/(?<=[a-z0-9])[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => convertKeys(item, convert));
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) out[convert(key)] = convertKeys(inner, convert);
  return out;
}

/** 보통 객체의 키와 배열 원소를 camelCase로. `FormData` · `Blob` · `Date` · `URLSearchParams` 같은 인스턴스는 같은 참조로 둔다. */
export function toCamel<T = unknown>(value: unknown): T {
  return convertKeys(value, snakeToCamel) as T;
}

/** 보통 객체의 키와 배열 원소를 snake_case로. 인스턴스는 같은 참조로 둔다. */
export function toSnake<T = unknown>(value: unknown): T {
  return convertKeys(value, camelToSnake) as T;
}
