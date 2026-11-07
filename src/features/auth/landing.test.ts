import { describe, expect, it } from 'vitest';
import { getLandingPath } from './landing';
import type { Me } from './model';

const base: Me = {
  id: 1,
  email: 'a@b.c',
  name: '김민지',
  role: 'HIGH_SCHOOL',
  verificationStatus: 'APPROVED',
  rejectionReason: null,
  guardianStatus: 'AGREED',
  studentProfile: null,
  guideProfile: null,
  businessVerified: false,
  storeId: null,
};

describe('getLandingPath', () => {
  it.each([
    [{ verificationStatus: 'NONE' }, '/verify'],
    [{ verificationStatus: 'REJECTED' }, '/verify'],
    [{ guardianStatus: 'NONE' }, '/verify'],
    [{ guardianStatus: 'REJECTED' }, '/verify'],
    [{ guardianStatus: 'EXPIRED' }, '/verify'],
    [{ verificationStatus: 'PENDING', guardianStatus: 'PENDING' }, '/'],
    [{}, '/'],
  ])('고교생 %o → %s', (patch, path) =>
    expect(getLandingPath({ ...base, ...patch } as Me)).toBe(path),
  );

  it.each([
    [{ verificationStatus: 'NONE' }, '/guide/verify'],
    [{ verificationStatus: 'REJECTED' }, '/guide/verify'],
  ])('가이드 %o → %s', (patch, path) =>
    expect(getLandingPath({ ...base, role: 'UNIVERSITY', ...patch } as Me)).toBe(path),
  );

  it('가이드: 학과가 비면 /guide/me/profile', () =>
    expect(
      getLandingPath({
        ...base,
        role: 'UNIVERSITY',
        guideProfile: { universityId: 2, major: null, introduction: null },
      }),
    ).toBe('/guide/me/profile'));

  it('가이드: 승인돼도 학과가 공백뿐이면 /guide/me/profile (hasGuideProfile 기준)', () =>
    expect(
      getLandingPath({
        ...base,
        role: 'UNIVERSITY',
        guideProfile: { universityId: 2, major: '  ', introduction: null },
      }),
    ).toBe('/guide/me/profile'));

  it('가이드: 프로필이 없어도 /guide/me/profile', () =>
    expect(getLandingPath({ ...base, role: 'UNIVERSITY' })).toBe('/guide/me/profile'));

  it('가이드: 심사 중이고 학과가 없으면 /guide/me/profile', () =>
    expect(
      getLandingPath({
        ...base,
        role: 'UNIVERSITY',
        verificationStatus: 'PENDING',
        guideProfile: { universityId: 3, major: null, introduction: null },
      }),
    ).toBe('/guide/me/profile'));

  it('가이드: 학과가 있으면 /guide', () =>
    expect(
      getLandingPath({
        ...base,
        role: 'UNIVERSITY',
        guideProfile: { universityId: 2, major: '컴퓨터공학과', introduction: null },
      }),
    ).toBe('/guide'));

  it('가이드: 대기 중 인증은 학과가 있으면 /guide', () =>
    expect(
      getLandingPath({
        ...base,
        role: 'UNIVERSITY',
        verificationStatus: 'PENDING',
        guideProfile: { universityId: 2, major: '컴퓨터공학과', introduction: null },
      }),
    ).toBe('/guide'));

  it('사장님: 사업자 인증 전이면 /owner/verify', () =>
    expect(getLandingPath({ ...base, role: 'OWNER', businessVerified: false })).toBe(
      '/owner/verify',
    ));

  it('사장님: 가게가 없으면 연결 화면', () =>
    expect(getLandingPath({ ...base, role: 'OWNER', businessVerified: true, storeId: null })).toBe(
      '/owner/store/connect',
    ));

  it('사장님: 가게가 있으면 /owner/store', () =>
    expect(getLandingPath({ ...base, role: 'OWNER', businessVerified: true, storeId: 3 })).toBe(
      '/owner/store',
    ));

  it('관리자: /admin/verifications', () =>
    expect(getLandingPath({ ...base, role: 'ADMIN' })).toBe('/admin/verifications'));
});
