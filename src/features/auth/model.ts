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
