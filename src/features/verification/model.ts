import type { GuardianStatus, VerificationStatus } from '@/features/auth/model';
import { errorMessage } from '@/shared/lib/errors';
import type { Tone } from '@/shared/lib/types';

// 재학 인증(U-05) · 보호자 동의(U-06)의 화면 쪽 모양. 사진 규칙은 명세 그대로 jpg · png, 5MB(2B′-R7).

/** 증명 사진 최대 크기(명세 U-05 `document`). 정확히 5MB는 통과한다. */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';

const PROOF_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
const PROOF_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png'];

/** 형식은 MIME 또는 확장자(대소문자 무시) 중 하나가 맞으면 통과. 형식을 먼저, 그다음 용량을 본다. */
export function validateProofFile(
  f: Pick<File, 'name' | 'type' | 'size'>,
): 'FILE_TYPE' | 'FILE_TOO_LARGE' | null {
  const name = f.name.toLowerCase();
  const typeOk =
    PROOF_TYPES.includes(f.type.toLowerCase()) ||
    PROOF_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!typeOk) return 'FILE_TYPE';
  if (f.size > PROOF_MAX_BYTES) return 'FILE_TOO_LARGE';
  return null;
}

/** `FileField`의 `validate`용. 통과하면 null, 아니면 오류 코드 문구. */
export function proofFileError(f: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const code = validateProofFile(f);
  return code === null ? null : errorMessage(code);
}

/** 재학 인증 제출 입력. 고교생은 학교 이름 · 학년, 대학생은 학교(캠퍼스 id). 사진은 둘 다. */
export type EnrollmentSubmit =
  | { role: 'HIGH_SCHOOL'; schoolName: string; grade: number; document: File }
  | { role: 'UNIVERSITY'; universityId: number; document: File };

export interface GuardianConsentInput {
  guardianName: string;
  guardianEmail: string;
}

/** 보호자 이름 최대 글자 수(명세 U-06 `guardian_name`). */
export const GUARDIAN_NAME_MAX = 20;

/** 보호자가 보는 안내(U-06 조회). `schoolName`은 학생이 학교를 안 적었으면 null. */
export interface ConsentView {
  studentName: string;
  schoolName: string | null;
  guideText: string;
  status: GuardianStatus;
  expiresAt: string | null;
}

export type ConsentDecision = 'AGREED' | 'REJECTED';

/** 제출할 수 있는 인증 상태: 미제출 · 반려(심사 중이거나 승인되면 다시 낼 수 없다). */
export function canSubmitVerification(status: VerificationStatus): boolean {
  return status === 'NONE' || status === 'REJECTED';
}

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  NONE: '미제출',
  PENDING: '심사 중',
  APPROVED: '승인',
  REJECTED: '반려',
};

export const GUARDIAN_STATUS_LABEL: Record<GuardianStatus, string> = {
  NONE: '미요청',
  PENDING: '동의 대기',
  AGREED: '동의 완료',
  REJECTED: '거부',
  EXPIRED: '링크 만료',
};

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  NONE: 'neutral',
  PENDING: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const GUARDIAN_TONE: Record<GuardianStatus, Tone> = {
  NONE: 'neutral',
  PENDING: 'info',
  AGREED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

export type StudentStep = 'FORM' | 'IN_REVIEW' | 'RESUBMIT' | 'DONE';
export type GuardianStep = 'FORM' | 'WAITING' | 'REREQUEST' | 'DONE';

/**
 * `/verify`의 두 단계가 지금 어느 모습인지. 학생 단계: 미제출 → 폼, 심사 중 → 안내, 반려 → 다시 제출, 승인 → 끝.
 * 보호자 단계: 미요청 → 폼, 대기 → 기다림, 거부 · 만료 → 다시 요청(대기 중 다시 보내기는 없다, 2B′-R9), 동의 → 끝.
 * `done`은 둘 다 끝났을 때만이다.
 */
export function verifySteps(s: {
  verificationStatus: VerificationStatus;
  guardianStatus: GuardianStatus;
}): {
  student: StudentStep;
  guardian: GuardianStep;
  done: boolean;
} {
  const student: StudentStep = {
    NONE: 'FORM',
    PENDING: 'IN_REVIEW',
    REJECTED: 'RESUBMIT',
    APPROVED: 'DONE',
  }[s.verificationStatus] as StudentStep;
  const guardian: GuardianStep = {
    NONE: 'FORM',
    PENDING: 'WAITING',
    REJECTED: 'REREQUEST',
    EXPIRED: 'REREQUEST',
    AGREED: 'DONE',
  }[s.guardianStatus] as GuardianStep;
  return { student, guardian, done: student === 'DONE' && guardian === 'DONE' };
}
