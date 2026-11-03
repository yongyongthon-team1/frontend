import { describe, expect, it } from 'vitest';
import { readEnv, resolveApiMode } from './env';

describe('env', () => {
  it('기본값', () =>
    expect(readEnv({})).toEqual({
      apiBaseUrl: '/api',
      apiMode: 'mock',
      mockDomains: 'all',
      demoTools: false,
      kakaoMapKey: null,
      demoPassword: 'demo1234',
    }));
  it('도메인 목록', () =>
    expect(readEnv({ VITE_MOCK_DOMAINS: 'auth,tours' }).mockDomains).toEqual(['auth', 'tours']));
  it('잘못된 모드는 mock', () => expect(readEnv({ VITE_API_MODE: 'x' }).apiMode).toBe('mock'));
  it('demoTools는 문자열 true일 때만 켜진다', () => {
    expect(readEnv({ VITE_DEMO_TOOLS: 'true' }).demoTools).toBe(true);
    expect(readEnv({ VITE_DEMO_TOOLS: 'false' }).demoTools).toBe(false);
  });
  it('빈 카카오 키는 null', () => {
    expect(readEnv({ VITE_KAKAO_MAP_KEY: '' }).kakaoMapKey).toBeNull();
    expect(readEnv({ VITE_KAKAO_MAP_KEY: 'k' }).kakaoMapKey).toBe('k');
  });
  it('URL 모드가 가장 우선', () => {
    expect(resolveApiMode('real', null, '?mode=mock')).toBe('mock');
    expect(resolveApiMode('mock', 'real', '')).toBe('real');
  });
});
