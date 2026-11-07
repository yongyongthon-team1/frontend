import type { GuardianStatus, VerificationStatus } from '@/features/auth/model';
import type { ConsentView } from './model';

// 백엔드 U-05 · U-06의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

/** `POST /verifications/enrollment`의 `data`. */
export interface WireEnrollment {
  verificationId: number;
  status: VerificationStatus;
  submittedAt: string;
}

/** `POST /guardian-consents`의 `data`. */
export interface WireConsentRequested {
  status: GuardianStatus;
  expiresAt: string;
}

/** `GET /guardian-consents/{consentToken}`의 `data`. */
export interface WireConsentView {
  studentName: string;
  schoolName: string | null;
  guideText: string;
  status: GuardianStatus;
  expiresAt: string | null;
}

/** `PATCH /guardian-consents/{consentToken}`의 `data`. */
export interface WireConsentDecided {
  status: GuardianStatus;
}

export function fromWireConsentView(w: WireConsentView): ConsentView {
  return {
    studentName: w.studentName,
    schoolName: w.schoolName,
    guideText: w.guideText,
    status: w.status,
    expiresAt: w.expiresAt,
  };
}
