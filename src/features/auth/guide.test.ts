import { describe, expect, it } from 'vitest';
import { hasGuideProfile, tourCreateBlock } from './guide';
import type { Me, VerificationStatus } from './model';
import { errorMessage } from '@/shared/lib/errors';

const guide = (status: VerificationStatus, major: string | null | undefined): Me => ({
  id: 1,
  email: 'g@demo.kr',
  name: '가이드',
  role: 'UNIVERSITY',
  verificationStatus: status,
  rejectionReason: null,
  guardianStatus: 'NONE',
  studentProfile: null,
  guideProfile: major === undefined ? null : { universityId: 2, major, introduction: null },
  businessVerified: false,
  storeId: null,
});

const NOT_VERIFIED_CHIP = '재학 인증 승인 필요';

describe('hasGuideProfile', () => {
  it.each([
    [undefined, false],
    [null, false],
    ['', false],
    ['   ', false],
    ['산업디자인학과', true],
    [' 컴퓨터공학과 ', true],
  ])('학과 %j → %s', (major, expected) =>
    expect(hasGuideProfile(guide('APPROVED', major))).toBe(expected),
  );
});

describe('tourCreateBlock', () => {
  it.each(['NONE', 'REJECTED'] as const)('인증 %s → 역할 인증 단계로 보낸다', (status) => {
    expect(tourCreateBlock(guide(status, '산업디자인학과'))).toEqual({
      code: 'NOT_VERIFIED',
      chip: NOT_VERIFIED_CHIP,
      reason: '학생증 또는 재학증명서 인증 후에만 투어를 개설할 수 있어요.',
      action: { label: '역할 인증 단계로 이동', to: '/guide/verify' },
    });
  });

  it('인증 NONE은 학과가 비어도 인증이 먼저다', () => {
    expect(tourCreateBlock(guide('NONE', undefined))?.action.to).toBe('/guide/verify');
  });

  it('심사 중 + 학과 없음 → 프로필 작성으로 보낸다', () => {
    expect(tourCreateBlock(guide('PENDING', '  '))).toEqual({
      code: 'NOT_VERIFIED',
      chip: NOT_VERIFIED_CHIP,
      reason: '승인 전에는 투어를 개설할 수 없습니다.',
      action: { label: '가이드 프로필 작성하기', to: '/guide/me/profile' },
    });
  });

  it('심사 중 + 학과 있음 → 인증 상태 보기', () => {
    expect(tourCreateBlock(guide('PENDING', '산업디자인학과'))).toEqual({
      code: 'NOT_VERIFIED',
      chip: NOT_VERIFIED_CHIP,
      reason: '승인 전에는 투어를 개설할 수 없습니다.',
      action: { label: '인증 상태 보기', to: '/guide/verify' },
    });
  });

  it('승인 + 학과 없음 → 프로필 필요', () => {
    expect(tourCreateBlock(guide('APPROVED', null))).toEqual({
      code: 'GUIDE_PROFILE_REQUIRED',
      chip: '가이드 프로필 작성 필요',
      reason: errorMessage('GUIDE_PROFILE_REQUIRED'),
      action: { label: '가이드 프로필 작성하기', to: '/guide/me/profile' },
    });
    expect(tourCreateBlock(guide('APPROVED', '   '))?.code).toBe('GUIDE_PROFILE_REQUIRED');
  });

  it('승인 + 학과 있음 → 막지 않는다', () => {
    expect(tourCreateBlock(guide('APPROVED', '산업디자인학과'))).toBeNull();
  });
});
