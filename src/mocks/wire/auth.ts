import type { GuardianStatus, VerificationStatus } from '@/features/auth/model';
import type { WireLogin, WireMe, WireSignupResult } from '@/features/auth/wire';
import { campusLabel } from '@/features/tours/model';
import type { DB, GuardianConsentRow, UserRow } from '@/mocks/db/schema';
import { MockApiError } from '@/mocks/rules/errors';

// 사용자 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toMe`의 자리(2C-R26) —
// `mocks/rules/views.ts`의 `toMe`는 `fromWireMe(toWireMe(…), 가게 id)`로 다시 구현한다.

/** 대기 동의는 링크 기한(`expiresAt`)이 지나면 EXPIRED, 기록이 없으면 NONE(미요청). */
function guardianStatusOf(consent: GuardianConsentRow | undefined, now: Date): GuardianStatus {
  if (!consent) return 'NONE';
  if (
    consent.status === 'PENDING' &&
    consent.expiresAt !== null &&
    Date.parse(consent.expiresAt) < now.getTime()
  ) {
    return 'EXPIRED';
  }
  return consent.status;
}

/** 사장님은 사업자 인증이 맞으면 바로 APPROVED, 아니면 NONE(명세 값 정의). 그 밖의 역할은 인증 제출 행의 상태(없으면 NONE). */
function verificationStatusOf(db: DB, user: UserRow): VerificationStatus {
  if (user.role === 'OWNER') {
    return db.businessVerifications.find((b) => b.id === user.id)?.isVerified ? 'APPROVED' : 'NONE';
  }
  return db.verifications.find((v) => v.id === user.id)?.status ?? 'NONE';
}

function findUser(db: DB, userId: number): UserRow {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new MockApiError(401, 'UNAUTHORIZED');
  return user;
}

/**
 * `GET /users/me`의 데이터. 확장 `guardianConsentToken`은 동의 대기인 고교생에게만 붙는다. 역할에 해당하지 않는 칸은 null이다: 고교생 칸(학년 · 관심 학과 · 보호자 동의)은 고교생만,
 * 학교 이름은 고교생이면 고교 이름 · 대학생이면 가이드 프로필 대학의 `campusLabel`이다. `universityId`는 배포 백엔드처럼 늘 싣고, 대학생이 아니면 null이다.
 */
export function toWireMe(db: DB, userId: number, now: Date): WireMe {
  const user = findUser(db, userId);
  const verification = db.verifications.find((v) => v.id === userId);
  const isStudent = user.role === 'HIGH_SCHOOL';
  const student = isStudent ? db.studentProfiles.find((p) => p.id === userId) : undefined;
  const guide =
    user.role === 'UNIVERSITY' ? db.guideProfiles.find((p) => p.id === userId) : undefined;
  const university =
    guide?.universityId != null
      ? db.universities.find((u) => u.id === guide.universityId)
      : undefined;

  const me: WireMe = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    verificationStatus: verificationStatusOf(db, user),
    rejectReason: verification?.rejectionReason ?? null,
    schoolName: isStudent
      ? (student?.highSchoolName ?? null)
      : university
        ? campusLabel(university.name, university.campusName)
        : null,
    grade: student?.grade ?? null,
    interestMajor: student?.interestedMajor ?? null,
    guardianConsentStatus: isStudent
      ? guardianStatusOf(
          db.guardianConsents.find((g) => g.id === userId),
          now,
        )
      : null,
    guideProfile: guide ? { major: guide.major, intro: guide.introduction } : null,
  };
  me.universityId = guide?.universityId ?? null;
  // 시연 확장(2B′-R10): 동의 대기(기한 전)인 고교생에게만 보호자 링크 토큰. 실서버에는 없는 키다.
  const consent = isStudent ? db.guardianConsents.find((g) => g.id === userId) : undefined;
  if (me.guardianConsentStatus === 'PENDING' && consent?.tokenHash) {
    me.guardianConsentToken = consent.tokenHash;
  }
  return me;
}

/** `POST /auth/login`의 데이터. */
export function toWireLogin(db: DB, userId: number, accessToken: string): WireLogin {
  const user = findUser(db, userId);
  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      verificationStatus: verificationStatusOf(db, user),
    },
  };
}

/** `POST /auth/signup`의 데이터(토큰 없음). */
export function toWireSignupResult(user: UserRow): WireSignupResult {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
