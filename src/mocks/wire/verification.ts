import type {
  WireConsentDecided,
  WireConsentRequested,
  WireConsentView,
  WireEnrollment,
} from '@/features/verification/wire';
import type { DB, GuardianConsentRow, VerificationRow } from '@/mocks/db/schema';
import { CONSENT_GUIDE_TEXT } from '@/mocks/rules/verification';

// 재학 인증 · 보호자 동의 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 확장 필드는 없다(U-05 · U-06 명세 그대로).
// `GET /users/me`의 시연 확장 `guardian_consent_token`은 `mocks/wire/auth.ts`의 `toWireMe`가 붙인다.

/** U-05 응답. */
export function toWireEnrollment(row: VerificationRow): WireEnrollment {
  return { verificationId: row.id, status: row.status, submittedAt: row.submittedAt };
}

/** U-06 요청 응답. */
export function toWireConsentRequested(row: GuardianConsentRow): WireConsentRequested {
  return { status: row.status, expiresAt: row.expiresAt ?? '' };
}

/** U-06 안내 조회. 학생 이름 · 학교는 행의 학생 계정에서 읽는다. */
export function toWireConsentView(db: DB, row: GuardianConsentRow): WireConsentView {
  return {
    studentName: db.users.find((u) => u.id === row.id)?.name ?? '',
    schoolName: db.studentProfiles.find((p) => p.id === row.id)?.highSchoolName ?? null,
    guideText: CONSENT_GUIDE_TEXT,
    status: row.status,
    expiresAt: row.expiresAt,
  };
}

/** U-06 동의 · 거부 응답. */
export function toWireConsentDecided(row: GuardianConsentRow): WireConsentDecided {
  return { status: row.status };
}
