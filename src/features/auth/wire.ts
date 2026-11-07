import type { GuardianStatus, Me, Role, VerificationStatus } from './model';

// 백엔드 U-01~U-03의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

/** `POST /auth/login`의 `data`. */
export interface WireLogin {
  accessToken: string;
  user: { id: number; name: string; role: Role; verificationStatus: VerificationStatus };
}

/** `GET /users/me`의 `data`. `campusId`는 목업 전용 확장이다(2C-R8). */
export interface WireMe {
  id: number;
  email: string;
  name: string;
  role: Role;
  verificationStatus: VerificationStatus;
  rejectReason: string | null;
  schoolName: string | null;
  grade: number | null;
  interestMajor: string | null;
  guardianConsentStatus: GuardianStatus | null;
  guideProfile: { major: string | null; intro: string | null } | null;
  campusId?: number | null;
}

/** `POST /auth/signup`의 `data`(토큰 없음). */
export interface WireSignupResult {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

/**
 * `GET /users/me` → `Me`(2C-R26의 합성 한쪽). 고교생만 `studentProfile`, 대학생만 `guideProfile`(있으면)을 갖는다.
 * 가이드 학교 `universityId`는 확장 `campusId`뿐이다(없으면 null — 명세에 학교 id가 없다).
 * 사장님의 `businessVerified`는 인증 상태가 `APPROVED`인지로 정하고(명세: 사업자 인증이 맞으면 바로 APPROVED),
 * 내 가게 id는 `GET /users/me/store`에서 와서 인자로 받는다.
 */
export function fromWireMe(w: WireMe, storeId: number | null): Me {
  return {
    id: w.id,
    email: w.email,
    name: w.name,
    role: w.role,
    verificationStatus: w.verificationStatus,
    rejectionReason: w.rejectReason,
    guardianStatus: w.guardianConsentStatus ?? 'NONE',
    studentProfile:
      w.role === 'HIGH_SCHOOL'
        ? {
            highSchoolName: w.schoolName,
            grade: w.grade,
            interestedMajor: w.interestMajor,
          }
        : null,
    guideProfile:
      w.role === 'UNIVERSITY' && w.guideProfile
        ? {
            universityId: w.campusId ?? null,
            major: w.guideProfile.major,
            introduction: w.guideProfile.intro,
          }
        : null,
    businessVerified: w.role === 'OWNER' && w.verificationStatus === 'APPROVED',
    storeId,
  };
}
