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

/** `POST /auth/signup` 요청(U-01). */
export interface SignupInput {
  email: string;
  password: string;
  name: string;
  role: SignupRole;
}

/** `PATCH /users/me` 요청(U-03)의 화면 쪽 이름. 어댑터가 네 칸을 모두 보낸다(`null`은 지움). */
export interface StudentProfileInput {
  name: string;
  highSchoolName: string | null;
  grade: number | null;
  interestedMajor: string | null;
}

/** `PUT /users/me/guide-profile` 요청(U-04)의 화면 쪽 이름(`intro`). 학교는 받지 않는다(재학 인증 제출 때 정해진다). */
export interface GuideProfileInput {
  major: string;
  introduction: string;
}

export const PASSWORD_MIN_LENGTH = 8;
/** 영문과 숫자를 섞은 8자 이상(U-01 `password`). */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const EMAIL_MAX_LENGTH = 255;
/** 이름의 최대 글자 수(가입 · 내 정보 수정). */
export const NAME_MAX = 20;
export const HIGH_SCHOOL_NAME_MAX = 50;
export const INTEREST_MAJOR_MAX = 30;
export const GUIDE_MAJOR_MAX = 30;
export const GUIDE_INTRO_MAX = 200;
