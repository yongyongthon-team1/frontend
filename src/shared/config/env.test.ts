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
      realApi: true,
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
  it('VITE_REAL_API가 off · false · 0이면 실서버를 막는다(백엔드가 없는 배포)', () => {
    expect(readEnv({ VITE_REAL_API: 'off' }).realApi).toBe(false);
    expect(readEnv({ VITE_REAL_API: 'false' }).realApi).toBe(false);
    expect(readEnv({ VITE_REAL_API: '0' }).realApi).toBe(false);
    expect(readEnv({ VITE_REAL_API: 'on' }).realApi).toBe(true);
  });
  it('실서버가 막히면 URL · 저장값 · 기본값이 무엇이든 목업', () => {
    expect(resolveApiMode('mock', 'real', '?mode=real', false)).toBe('mock');
    expect(resolveApiMode('real', null, '', false)).toBe('mock');
    expect(resolveApiMode('mock', null, '?mode=real', true)).toBe('real');
  });
});
