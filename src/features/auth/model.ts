export type Role = 'HIGH_SCHOOL' | 'UNIVERSITY' | 'OWNER' | 'ADMIN';
/** NONE = 미제출 */
export type VerificationStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
/** NONE = 미요청 */
export type GuardianStatus = 'NONE' | 'PENDING' | 'AGREED' | 'REJECTED' | 'EXPIRED';

export interface StudentProfile {
  highSchoolName: string | null;
  grade: number | null;
  interestedMajor: string | null;
}

export interface GuideProfile {
  /** 최근 재학 인증 제출 대학(서버가 인증 제출(#5) 때 맞춘다). 프로필 저장(#3)은 학교를 받지 않는다. */
  universityId: number | null;
  major: string | null;
  introduction: string | null;
}

export interface Me {
  id: number;
  email: string;
  name: string;
  role: Role;
  verificationStatus: VerificationStatus;
  /** `verificationStatus`가 `REJECTED`일 때만 그린다(다른 상태에 남은 값은 무시). */
  rejectionReason: string | null;
  guardianStatus: GuardianStatus;
  studentProfile: StudentProfile | null;
  guideProfile: GuideProfile | null;
  businessVerified: boolean;
  storeId: number | null;
}

export interface LoginResponse {
  token: string;
  me: Me;
}

/** 가입할 수 있는 역할(운영자는 가입으로 만들 수 없다). */
export type SignupRole = Exclude<Role, 'ADMIN'>;
export const SIGNUP_ROLES: readonly SignupRole[] = ['HIGH_SCHOOL', 'UNIVERSITY', 'OWNER'];

/** #1 `POST /api/auth/signup` 요청. */
export interface SignupInput {
  email: string;
  password: string;
  name: string;
  role: SignupRole;
}

/** #2 `PUT /api/me/student-profile` 요청. PUT이라 네 키를 모두 보낸다. */
export interface StudentProfileInput {
  name: string;
  highSchoolName: string | null;
  grade: number | null;
  interestedMajor: string | null;
}

/** #3 `PUT /api/me/guide-profile` 요청. 학교는 받지 않는다(재학 인증 제출 때 정해진다). */
export interface GuideProfileInput {
  major: string;
  introduction: string | null;
}

export const PASSWORD_MIN_LENGTH = 8;
export const EMAIL_MAX_LENGTH = 255;
/** 이름 · 고교 이름 · 관심 학과의 최대 글자 수. */
export const PROFILE_TEXT_MAX = 100;
export const GUIDE_MAJOR_MAX = 30;
export const GUIDE_INTRO_MAX = 300;
