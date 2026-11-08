import type { ApplicationStatus } from '@/features/applications/model';
import type { Role } from '@/features/auth/model';
import type { CouponStatus } from '@/features/coupons/model';
import type { CourseStatus, StopType } from '@/features/courses/model';
import type { TourStatus } from '@/features/tours/model';

// ERD(`docs/reference/erd.md`) 19개 테이블을 camelCase 행 타입으로 옮겼다.
// DATE는 `YYYY-MM-DD`, DATETIME은 `+09:00` ISO 8601 문자열이다.
// `id`가 users.id를 가리키는 테이블(프로필 · 인증 · 동의)은 ERD 그대로 `id`가 사용자 ID다.

export const MOCK_DB_VERSION = 5;

export type StudentVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type GuardianConsentStatus = 'PENDING' | 'AGREED' | 'REJECTED';

export interface UserRow {
  id: number;
  email: string;
  /** 목업 전용 평문 비밀번호(ERD의 password_hash 자리). */
  password: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileRow {
  id: number;
  highSchoolName: string | null;
  grade: number | null;
  interestedMajor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuideProfileRow {
  id: number;
  universityId: number | null;
  major: string | null;
  introduction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationRow {
  id: number;
  highSchoolName: string | null;
  universityId: number | null;
  documentUrl: string | null;
  status: StudentVerificationStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: number | null;
}

export interface GuardianConsentRow {
  id: number;
  guardianName: string;
  guardianEmail: string;
  /** ERD는 해시지만 목업은 평문 토큰이다(고정 시연 토큰 `DEMO_CONSENT_TOKENS`). */
  tokenHash: string | null;
  status: GuardianConsentStatus;
  expiresAt: string | null;
  agreedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessVerificationRow {
  id: number;
  isVerified: boolean;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface UniversityRow {
  id: number;
  name: string;
  campusName: string;
  address: string | null;
  latitude: number;
  longitude: number;
  administrativeDong: string | null;
}

export interface VacationRow {
  id: number;
  universityId: number;
  startDate: string;
  endDate: string;
  label: string | null;
}

export interface CampusPlaceRow {
  campusBuildingId: number;
  universityId: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
}

export interface TourRow {
  id: number;
  guideId: number;
  universityId: number;
  /** 가이드가 정한 탐방 이름. null이면 "대학 + 학과 + 탐방"으로 만든다. */
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  introduction: string;
  openChatUrl: string | null;
  status: TourStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRow {
  id: number;
  tourId: number;
  userId: number;
  motivation: string;
  status: ApplicationStatus;
  /** PENDING 또는 APPROVED이면 userId, 그 외 null(중복 신청 방지). */
  activeUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRow {
  tourId: number;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  /** 목업 전용(ERD에 없음). 초안을 만들 때 저장한 "입력된 관심사" 라벨(`Course.interests`). */
  interests: string[];
}

export interface CourseStopRow {
  id: number;
  tourId: number;
  stopType: StopType;
  campusBuildingId: number | null;
  storeId: number | null;
  partnershipId: number | null;
  stopOrder: number;
  /** `HH:mm` */
  visitTime: string | null;
  description: string | null;
  recommendationReason: string | null;
}

export interface StoreRow {
  id: number;
  ownerId: number | null;
  name: string;
  address: string;
  category: string;
  administrativeDong: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnershipRow {
  id: number;
  storeId: number;
  discountDescription: string;
  /** 사용 조건(예: `탐방 당일 · 1회 사용 가능`). 비우면 null. */
  condition: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CouponRow {
  id: number;
  applicationId: number;
  storeId: number;
  partnershipId: number;
  code: string;
  status: CouponStatus;
  discountSnapshot: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface ReviewRow {
  id: number;
  userId: number;
  tourId: number;
  storeId: number;
  couponId: number;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummaryRow {
  id: number;
  storeId: number;
  summary: string;
  reviewCount: number;
  generatedAt: string;
}

export interface TourWishRow {
  id: number;
  userId: number;
  universityId: number;
  major: string;
  content: string;
  preferredDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRow {
  token: string;
  userId: number;
}

export interface DB {
  version: number;
  /** 시드를 만든 날(Asia/Seoul, `YYYY-MM-DD`). */
  seedDay: string;
  users: UserRow[];
  studentProfiles: StudentProfileRow[];
  guideProfiles: GuideProfileRow[];
  verifications: VerificationRow[];
  guardianConsents: GuardianConsentRow[];
  businessVerifications: BusinessVerificationRow[];
  universities: UniversityRow[];
  vacations: VacationRow[];
  campusPlaces: CampusPlaceRow[];
  tours: TourRow[];
  applications: ApplicationRow[];
  courses: CourseRow[];
  courseStops: CourseStopRow[];
  stores: StoreRow[];
  partnerships: PartnershipRow[];
  coupons: CouponRow[];
  reviews: ReviewRow[];
  reviewSummaries: ReviewSummaryRow[];
  tourWishes: TourWishRow[];
  sessions: SessionRow[];
  /** 시드 이후 규칙이 새 행을 만들 때 모든 테이블이 함께 쓰는 다음 ID. */
  nextId: number;
}
