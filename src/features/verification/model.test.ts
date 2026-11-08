import { describe, expect, it } from 'vitest';
import type { GuardianStatus, VerificationStatus } from '@/features/auth/model';
import {
  canSubmitVerification,
  GUARDIAN_STATUS_LABEL,
  GUARDIAN_TONE,
  PROOF_ACCEPT,
  PROOF_MAX_BYTES,
  proofFileError,
  validateProofFile,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_TONE,
  verifySteps,
} from './model';

const MB5 = 5 * 1024 * 1024;

describe('validateProofFile (2B′-R7: jpg · png, 5MB, 형식 → 용량)', () => {
  it('PROOF_MAX_BYTES는 5MB', () => expect(PROOF_MAX_BYTES).toBe(MB5));

  it('PROOF_ACCEPT는 jpg · png만', () =>
    expect(PROOF_ACCEPT).toBe('image/jpeg,image/png,.jpg,.jpeg,.png'));

  it.each([
    [{ name: 'x.heic', type: 'image/heic', size: 1 }, 'FILE_TYPE'],
    [{ name: 'x.pdf', type: 'application/pdf', size: 1 }, 'FILE_TYPE'],
    [{ name: 'x.gif', type: '', size: 1 }, 'FILE_TYPE'],
    [{ name: 'a.JPG', type: '', size: 1 }, null],
    [{ name: 'scan', type: 'image/png', size: 1 }, null],
    [{ name: 'a.jpeg', type: 'image/jpeg', size: 1 }, null],
    [{ name: 'a.png', type: 'image/png', size: MB5 }, null],
    [{ name: 'a.png', type: 'image/png', size: MB5 + 1 }, 'FILE_TOO_LARGE'],
    // 형식이 먼저다: 형식도 용량도 틀리면 형식 오류.
    [{ name: 'a.heic', type: 'image/heic', size: MB5 + 1 }, 'FILE_TYPE'],
  ] as const)('%j → %s', (file, expected) => {
    expect(validateProofFile(file)).toBe(expected);
  });
});

describe('proofFileError', () => {
  it('통과하면 null, 아니면 오류 코드 문구', () => {
    expect(proofFileError({ name: 'a.png', type: 'image/png', size: 1 })).toBeNull();
    expect(proofFileError({ name: 'a.pdf', type: 'application/pdf', size: 1 })).toBe(
      'jpg, png 이미지만 올릴 수 있어요.',
    );
    expect(proofFileError({ name: 'a.png', type: 'image/png', size: MB5 + 1 })).toBe(
      '5MB 이하 이미지만 올릴 수 있어요.',
    );
  });
});

describe('라벨 · 톤', () => {
  it('재학 인증 상태', () => {
    expect(VERIFICATION_STATUS_LABEL).toEqual({
      NONE: '미제출',
      PENDING: '심사 중',
      APPROVED: '승인 완료',
      REJECTED: '반려',
    });
    expect(VERIFICATION_TONE).toEqual({
      NONE: 'neutral',
      PENDING: 'info',
      APPROVED: 'success',
      REJECTED: 'danger',
    });
  });

  it('보호자 동의 상태', () => {
    expect(GUARDIAN_STATUS_LABEL).toEqual({
      NONE: '미요청',
      PENDING: '동의 대기',
      AGREED: '동의 완료',
      REJECTED: '거부',
      EXPIRED: '링크 만료',
    });
    expect(GUARDIAN_TONE).toEqual({
      NONE: 'neutral',
      PENDING: 'info',
      AGREED: 'success',
      REJECTED: 'danger',
      EXPIRED: 'warning',
    });
  });
});

describe('canSubmitVerification', () => {
  it.each([
    ['NONE', true],
    ['REJECTED', true],
    ['PENDING', false],
    ['APPROVED', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canSubmitVerification(status)).toBe(expected);
  });
});

describe('verifySteps', () => {
  const V: VerificationStatus[] = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'];
  const G: GuardianStatus[] = ['NONE', 'PENDING', 'AGREED', 'REJECTED', 'EXPIRED'];
  const student = {
    NONE: 'FORM',
    PENDING: 'IN_REVIEW',
    APPROVED: 'DONE',
    REJECTED: 'RESUBMIT',
  } as const;
  const guardian = {
    NONE: 'FORM',
    PENDING: 'WAITING',
    AGREED: 'DONE',
    REJECTED: 'REREQUEST',
    EXPIRED: 'REREQUEST',
  } as const;

  it.each(V.flatMap((v) => G.map((g) => [v, g] as const)))('%s · %s', (v, g) => {
    expect(verifySteps({ verificationStatus: v, guardianStatus: g })).toEqual({
      student: student[v],
      guardian: guardian[g],
      done: v === 'APPROVED' && g === 'AGREED',
    });
  });
});
