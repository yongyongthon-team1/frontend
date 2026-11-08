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

export function readEnv(raw: Record<string, unknown>): AppEnv {
  return {
    apiBaseUrl: str(raw.VITE_API_BASE_URL) || '/api',
    apiMode: parseMode(str(raw.VITE_API_MODE)) ?? 'mock',
    mockDomains: parseMockDomains(raw.VITE_MOCK_DOMAINS),
    demoTools: raw.VITE_DEMO_TOOLS === true || raw.VITE_DEMO_TOOLS === 'true',
    kakaoMapKey: str(raw.VITE_KAKAO_MAP_KEY) || null,
    demoPassword: str(raw.VITE_DEMO_PASSWORD) || 'demo1234',
    realApi: !['off', 'false', '0'].includes(str(raw.VITE_REAL_API).toLowerCase()),
  };
}

export const env: AppEnv = readEnv(import.meta.env);

// 우선순위: URL ?mode= > override(시연 패널에서 저장한 값) > base(env). 실서버가 막힌 배포(`realApi` false)는
// 무엇을 골랐든 목업이다 — 전에 실서버로 저장해 둔 브라우저가 깨진 채 갇히지 않게.
export function resolveApiMode(
  base: ApiMode,
  override: ApiMode | null,
  search: string,
  realApi = true,
): ApiMode {
  if (!realApi) return 'mock';
  return parseMode(new URLSearchParams(search).get('mode')) ?? override ?? base;
}
