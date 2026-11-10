export type ApiMode = 'mock' | 'real';

export type MockDomain =
  | 'auth'
  | 'campuses'
  | 'tours'
  | 'applications'
  | 'courses'
  | 'coupons'
  | 'demo'
  | 'stores'
  | 'reviews'
  | 'verification'
  | 'admin';

export interface AppEnv {
  apiBaseUrl: string;
  apiMode: ApiMode;
  mockDomains: MockDomain[] | 'all';
  demoTools: boolean;
  kakaoMapKey: string | null;
  demoPassword: string;
  /** 실서버 모드를 쓸 수 있는지. 백엔드가 연결되지 않은 배포는 `VITE_REAL_API=off`로 막는다(그때는 늘 목업). */
  realApi: boolean;
  /**
   * 목업 모드를 쓸 수 있는 빌드인지(빌드 상수 `__MOCK_API__`). 라이브 배포(Vercel 프로덕션)는 false라 목업 코드가
   * 번들에 없고 늘 실서버다 — 주소 `?mode=mock` · 시연 패널 저장값도 무시한다.
   */
  mockApi: boolean;
}

const MOCK_DOMAINS: readonly MockDomain[] = [
  'auth',
  'campuses',
  'tours',
  'applications',
  'courses',
  'coupons',
  'demo',
  'stores',
  'reviews',
  'verification',
  'admin',
];

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseMode(value: unknown): ApiMode | null {
  return value === 'mock' || value === 'real' ? value : null;
}

function parseMockDomains(value: unknown): MockDomain[] | 'all' {
  const names = str(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0 || names.includes('all')) return 'all';
  return names.filter((n): n is MockDomain => (MOCK_DOMAINS as readonly string[]).includes(n));
}

/** `mockApi`는 빌드 상수(`__MOCK_API__`)라 env 값이 아니라 인자로 받는다. false면 기본 모드도 실서버다. */
export function readEnv(raw: Record<string, unknown>, mockApi = true): AppEnv {
  return {
    apiBaseUrl: str(raw.VITE_API_BASE_URL) || '/api',
    apiMode: mockApi ? (parseMode(str(raw.VITE_API_MODE)) ?? 'mock') : 'real',
    mockDomains: parseMockDomains(raw.VITE_MOCK_DOMAINS),
    demoTools: raw.VITE_DEMO_TOOLS === true || raw.VITE_DEMO_TOOLS === 'true',
    kakaoMapKey: str(raw.VITE_KAKAO_MAP_KEY) || null,
    demoPassword: str(raw.VITE_DEMO_PASSWORD) || 'demo1234',
    realApi: !['off', 'false', '0'].includes(str(raw.VITE_REAL_API).toLowerCase()),
    mockApi,
  };
}

export const env: AppEnv = readEnv(import.meta.env, __MOCK_API__);

// 우선순위: URL ?mode= > override(시연 패널에서 저장한 값) > base(env). 목업을 뺀 빌드(`mockApi` false)는 무엇을
// 골랐든 실서버다 — 목업 코드가 없고, 예전 목업 배포에서 저장해 둔 브라우저도 실서버로 연다. 실서버가 막힌
// 배포(`realApi` false)는 무엇을 골랐든 목업이다 — 전에 실서버로 저장해 둔 브라우저가 깨진 채 갇히지 않게.
export function resolveApiMode(
  base: ApiMode,
  override: ApiMode | null,
  search: string,
  realApi = true,
  mockApi = true,
): ApiMode {
  if (!mockApi) return 'real';
  if (!realApi) return 'mock';
  return parseMode(new URLSearchParams(search).get('mode')) ?? override ?? base;
}
