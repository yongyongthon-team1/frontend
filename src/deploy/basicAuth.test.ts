import { describe, expect, it } from 'vitest';
import { isAuthorized } from './basicAuth';

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe('isAuthorized (배포 미리보기 잠금)', () => {
  it('비밀번호가 맞으면 연다 — 사용자 이름은 무엇이든 된다', () => {
    expect(isAuthorized(basic('uniro', 'open-sesame'), 'open-sesame')).toBe(true);
    expect(isAuthorized(basic('', 'open-sesame'), 'open-sesame')).toBe(true);
  });

  it('비밀번호에 쌍점이 있어도 첫 쌍점 뒤 전부를 비밀번호로 본다', () => {
    expect(isAuthorized(basic('u', 'a:b'), 'a:b')).toBe(true);
  });

  it('비밀번호가 틀리거나 헤더가 없거나 모양이 틀리면 열지 않는다', () => {
    expect(isAuthorized(basic('uniro', 'wrong'), 'open-sesame')).toBe(false);
    expect(isAuthorized(null, 'open-sesame')).toBe(false);
    expect(isAuthorized('Bearer abc', 'open-sesame')).toBe(false);
    expect(isAuthorized('Basic %%%', 'open-sesame')).toBe(false);
    expect(isAuthorized(`Basic ${btoa('no-colon')}`, 'open-sesame')).toBe(false);
  });

  it('서버에 비밀번호가 설정되지 않았으면 잠긴 채로 둔다', () => {
    expect(isAuthorized(basic('uniro', ''), undefined)).toBe(false);
    expect(isAuthorized(basic('uniro', ''), '')).toBe(false);
  });
});
