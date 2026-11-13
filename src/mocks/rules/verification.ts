import { EMAIL_MAX_LENGTH, HIGH_SCHOOL_NAME_MAX } from '@/features/auth/model';
import { GUARDIAN_NAME_MAX, validateProofFile } from '@/features/verification/model';
import { deleteMockFile, MOCK_FILE_PREFIX, putMockFile } from '@/mocks/db/files';
import { nextId } from '@/mocks/db/ids';
import type { DB, GuardianConsentRow, VerificationRow } from '@/mocks/db/schema';
import { toSeoulIso } from '@/shared/lib/date';
import { backendError, fieldError, MockApiError } from './errors';

// 재학 인증 제출(U-05) · 보호자 동의(U-06) 규칙. 위에서부터 검사해 처음 걸린 오류를 던지고, 다 통과한 뒤에만 DB를 바꾼다.
// 사진은 메모리에만 둔다(2B-R9). 칸 오류의 이름은 규칙이 읽는 와이어 이름(camel)이고 봉투에서 snake가 된다.

/** 보호자 동의 링크 기한(명세 U-06 "링크는 7일 뒤 만료"). */
export const CONSENT_LINK_DAYS = 7;

/** 보호자 안내 조회의 `guide_text`(제안 문구, 실서버는 서버 문구가 대신한다). */
export const CONSENT_GUIDE_TEXT =
  '용용톤 캠퍼스 투어는 방학 중 대학생 가이드와 캠퍼스와 주변 상점을 함께 둘러보는 서비스예요. 가이드가 신청을 승인하면 오픈채팅으로 연결되고, 투어 날 캠퍼스와 주변 가게를 함께 걸어요.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 파일 칸의 명세 문장(형식 · 용량 오류 공통, 서버 400의 `errors[].reason`). */
const DOCUMENT_INVALID = 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요';

/**
 * 재학 인증 제출(U-05). 순서: 고교생 · 대학생이 아니면 403 → 심사 중 · 승인이면 409 `E409_ALREADY_SUBMITTED` → 사진 없음 →
 * 형식 · 용량 → 칸(고교생 학교 이름 1~50자 / 대학생 5개교 id). 저장하면 인증 행을 PENDING으로 만들고(반려 뒤 다시 내면 같은 행을
 * 덮는다) 고교생은 프로필 학교, 대학생은 가이드 프로필 학교를 맞춘다(9절 33번).
 */
export function submitEnrollment(
  db: DB,
  userId: number,
  fields: { campusId: string | null; schoolName: string | null },
  document: File | null,
  now: Date,
): VerificationRow {
  const user = db.users.find((u) => u.id === userId);
  if (!user || (user.role !== 'HIGH_SCHOOL' && user.role !== 'UNIVERSITY')) {
    throw new MockApiError(403, 'FORBIDDEN');
  }
  const existing = db.verifications.find((v) => v.id === userId);
  if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
    throw backendError(409, 'E409_ALREADY_SUBMITTED', 'ALREADY_PROCESSED');
  }
  if (document === null) {
    throw fieldError('document', '학생증 또는 재학증명서 사진을 올려 주세요.');
  }
  if (validateProofFile(document) !== null) throw fieldError('document', DOCUMENT_INVALID);

  let schoolName: string | null = null;
  let universityId: number | null = null;
  if (user.role === 'HIGH_SCHOOL') {
    schoolName = fields.schoolName?.trim() ?? '';
    if (schoolName === '' || schoolName.length > HIGH_SCHOOL_NAME_MAX) {
      throw fieldError('schoolName', '학교 이름은 50자 이하로 입력해 주세요.');
    }
  } else {
    const id = /^[1-9]\d*$/.test(fields.campusId ?? '') ? Number(fields.campusId) : null;
    if (id === null || !db.universities.some((u) => u.id === id)) {
      throw fieldError('campusId', '5개교 이외 학교 선택 시 제출할 수 없어요.');
    }
    universityId = id;
  }

  const at = toSeoulIso(now);
  const documentUrl = putMockFile(document);
  if (existing?.documentUrl?.startsWith(MOCK_FILE_PREFIX)) deleteMockFile(existing.documentUrl);
  const next: Omit<VerificationRow, 'id'> = {
    highSchoolName: schoolName,
    universityId,
    documentUrl,
    status: 'PENDING',
    rejectionReason: null,
    submittedAt: at,
    reviewedAt: null,
    reviewedBy: null,
  };
  let row: VerificationRow;
  if (existing) {
    Object.assign(existing, next);
    row = existing;
  } else {
    row = { id: userId, ...next };
    db.verifications.push(row);
  }

  if (user.role === 'HIGH_SCHOOL') {
    const profile = db.studentProfiles.find((p) => p.id === userId);
    if (profile) {
      profile.highSchoolName = schoolName;
      profile.updatedAt = at;
    } else {
      db.studentProfiles.push({
        id: userId,
        highSchoolName: schoolName,
        grade: null,
        interestedMajor: null,
        createdAt: at,
        updatedAt: at,
      });
    }
  } else {
    const profile = db.guideProfiles.find((p) => p.id === userId);
    if (profile) {
      profile.universityId = universityId;
      profile.updatedAt = at;
    } else {
      db.guideProfiles.push({
        id: userId,
        universityId,
        major: null,
        introduction: null,
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  return row;
}

/** 기한이 지난 대기 동의인지. */
function isExpired(row: GuardianConsentRow, now: Date): boolean {
  return (
    row.status === 'PENDING' && row.expiresAt !== null && Date.parse(row.expiresAt) < now.getTime()
  );
}

/**
 * 보호자 동의 요청(U-06). 순서: 고교생이 아니면 403 → 대기 중(기한 전) · 동의 완료면 409 `E409_CONSENT_EXISTS` →
 * 이름 1~20자 → 이메일 형식. 거부 · 만료 뒤에는 같은 행을 새 토큰 · 7일 기한의 PENDING으로 바꾼다(예전 토큰은 404가 된다).
 */
export function requestGuardianConsent(
  db: DB,
  userId: number,
  body: { guardianName?: unknown; guardianEmail?: unknown },
  now: Date,
): GuardianConsentRow {
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.role !== 'HIGH_SCHOOL') throw new MockApiError(403, 'FORBIDDEN');
  const existing = db.guardianConsents.find((g) => g.id === userId);
  if (
    existing &&
    (existing.status === 'AGREED' || (existing.status === 'PENDING' && !isExpired(existing, now)))
  ) {
    throw backendError(409, 'E409_CONSENT_EXISTS', 'ALREADY_PROCESSED');
  }
  const name = typeof body.guardianName === 'string' ? body.guardianName.trim() : '';
  if (name.length < 1 || name.length > GUARDIAN_NAME_MAX) {
    throw fieldError('guardianName', '보호자 이름은 1~20자로 입력해 주세요.');
  }
  const email = typeof body.guardianEmail === 'string' ? body.guardianEmail.trim() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    throw fieldError('guardianEmail', '이메일 주소 형식을 확인해 주세요.');
  }

  const at = toSeoulIso(now);
  const next = {
    guardianName: name,
    guardianEmail: email,
    tokenHash: `consent-${userId}-${nextId(db)}`,
    status: 'PENDING' as const,
    expiresAt: toSeoulIso(new Date(now.getTime() + CONSENT_LINK_DAYS * DAY_MS)),
    agreedAt: null,
    updatedAt: at,
  };
  if (existing) {
    Object.assign(existing, next);
    return existing;
  }
  const row: GuardianConsentRow = { id: userId, createdAt: at, ...next };
  db.guardianConsents.push(row);
  return row;
}

/**
 * 토큰의 동의 행. 모르는 토큰은 404 `CONSENT_LINK_INVALID`, 기한이 지난 대기 링크는 410 `CONSENT_LINK_EXPIRED`,
 * 이미 처리된 링크는 기한과 상관없이 그 행(조회는 200 + 그 상태, 9절 31번).
 */
export function findConsent(db: DB, token: string, now: Date): GuardianConsentRow {
  const row = token === '' ? undefined : db.guardianConsents.find((g) => g.tokenHash === token);
  if (!row) throw new MockApiError(404, 'CONSENT_LINK_INVALID');
  if (isExpired(row, now)) throw new MockApiError(410, 'CONSENT_LINK_EXPIRED');
  return row;
}

/**
 * 보호자의 동의 · 거부(U-06). 순서: 링크(404 · 410) → `agree`가 불리언 → 대기 중이 아니면 409 `ALREADY_PROCESSED`.
 * 처리한 뒤에도 토큰은 남겨 같은 링크로 결과를 다시 볼 수 있다.
 */
export function decideConsent(
  db: DB,
  token: string,
  agree: unknown,
  now: Date,
): GuardianConsentRow {
  const row = findConsent(db, token, now);
  if (typeof agree !== 'boolean') throw fieldError('agree', '동의 여부를 골라 주세요.');
  if (row.status !== 'PENDING') throw new MockApiError(409, 'ALREADY_PROCESSED');
  const at = toSeoulIso(now);
  row.status = agree ? 'AGREED' : 'REJECTED';
  row.agreedAt = agree ? at : null;
  row.updatedAt = at;
  return row;
}
