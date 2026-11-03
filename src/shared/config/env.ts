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
  };
}

export const env: AppEnv = readEnv(import.meta.env);

// 우선순위: URL ?mode= > override(시연 패널에서 저장한 값) > base(env)
export function resolveApiMode(base: ApiMode, override: ApiMode | null, search: string): ApiMode {
  return parseMode(new URLSearchParams(search).get('mode')) ?? override ?? base;
}
