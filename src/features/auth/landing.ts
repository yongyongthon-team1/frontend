import { hasGuideProfile } from './guide';
import type { GuardianStatus, Me, VerificationStatus } from './model';

interface StudentStatus {
  verificationStatus: VerificationStatus;
  guardianStatus: GuardianStatus;
}

const studentMustSubmit = (s: StudentStatus) =>
  s.verificationStatus === 'NONE' || s.verificationStatus === 'REJECTED';
const guardianMustRequest = (s: StudentStatus) =>
  s.guardianStatus === 'NONE' || s.guardianStatus === 'REJECTED' || s.guardianStatus === 'EXPIRED';

/**
 * 고교생이 인증을 이어 가야 할 때 가는 곳(새 시안 C03 → C04). 순서는 학생증 → 보호자다.
 * 학생이 해야 할 일이 남은 쪽이 먼저(미제출 · 반려 → `/verify`, 미요청 · 거부 · 만료 → `/verify/guardian`).
 * 해야 할 일이 없고 누군가의 처리를 기다리는 중이면 `null`(심사 중 · 동의 대기), 이 함수의 호출자는 첫 화면 `/`로 간다.
 */
function studentNextStep(s: StudentStatus): string | null {
  if (studentMustSubmit(s)) return '/verify';
  if (guardianMustRequest(s)) return '/verify/guardian';
  return null;
}

/**
 * 재학 인증을 낸 직후(C03 → C04 · C08 → C07). 보호자 동의를 아직 요청하지 않았으면 다음 단계인 C04로,
 * 보호자 쪽이 이미 진행 중이거나 끝났으면 인증 상태(C07)에서 `심사 중`을 보여 준다.
 */
export function studentAfterEnrollmentPath(s: StudentStatus): string {
  return guardianMustRequest(s) ? '/verify/guardian' : '/me/status';
}

/**
 * 막힌 신청 · `인증 이어하기`가 보내는 곳. 할 일이 남았으면 그 단계, 아직 기다리는 중이면 기다리는 쪽 화면
 * (심사 중이면 `/verify`, 동의 대기면 `/verify/guardian`), 모두 끝났으면 인증 상태(`/me/status`)다.
 */
export function studentVerificationPath(s: StudentStatus): string {
  const next = studentNextStep(s);
  if (next !== null) return next;
  if (s.verificationStatus === 'PENDING') return '/verify';
  if (s.guardianStatus === 'PENDING') return '/verify/guardian';
  return '/me/status';
}

/** 로그인 직후(또는 `/`) 역할과 인증 상태에 따라 처음 보여줄 화면. */
export function getLandingPath(me: Me): string {
  switch (me.role) {
    case 'HIGH_SCHOOL':
      return studentNextStep(me) ?? '/';
    case 'UNIVERSITY':
      if (me.verificationStatus === 'NONE' || me.verificationStatus === 'REJECTED') {
        return '/guide/verify';
      }
      // 학과가 없으면 프로필부터(2B-R5). 학과가 있으면 가이드 홈.
      if (!hasGuideProfile(me)) return '/guide/me/profile';
      return '/guide';
    case 'OWNER':
      if (!me.businessVerified) return '/owner/verify';
      if (me.storeId === null) return '/owner/store/connect';
      return '/owner/store';
    case 'ADMIN':
      return '/admin/verifications';
  }
}
