import {
  EMAIL_MAX_LENGTH,
  GUIDE_INTRO_MAX,
  GUIDE_MAJOR_MAX,
  HIGH_SCHOOL_NAME_MAX,
  INTEREST_MAJOR_MAX,
  NAME_MAX,
  PASSWORD_PATTERN,
  SIGNUP_ROLES,
  type SignupRole,
} from '@/features/auth/model';
import { nextId } from '@/mocks/db/ids';
import type { DB, GuideProfileRow, UserRow } from '@/mocks/db/schema';
import { fieldError, MockApiError } from './errors';
import { toSeoulIso } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';

// 가입(U-01) · 내 정보 수정(U-03) · 가이드 프로필(U-04) 규칙. 본문은 검증되지 않은 JSON이라 입력을 `Record<string, unknown>`로 받는다.
// 본문은 백엔드 이름(`schoolName` · `interestMajor` · `intro`, `readBody`가 camel로 되돌린 것)으로 읽고 칸 오류도 그 이름으로
// 던진다 — 그래야 봉투의 `errors[].field`가 명세의 snake 이름이 된다(어댑터 `fieldMap`이 화면 칸 이름으로 바꾼다).
// 위에서부터 검사해 처음 걸린 칸 오류를 던지고, 다 통과한 뒤에만 DB를 바꾼다. 안내 문구는 제안 문구이고 화면이 칸 아래에 보인다.

type Body = Record<string, unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 문자열이면 앞뒤 공백을 뗀 값, 아니면 null. */
const trimmed = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() : null;

/** 비어 있을 수 있는 글자 칸(null · 빈 문자열 → null). 문자열이 아니거나 `max`자를 넘으면 거부(null이 아니라 오류). */
function optionalText(
  value: unknown,
  max: number,
): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  const text = trimmed(value);
  if (text === null || text.length > max) return { ok: false };
  return { ok: true, value: text === '' ? null : text };
}

/** 가입. 새 사용자 행을 만들고 역할에 맞는 빈 프로필 행을 둔다(고교생 → 학생, 대학생 → 가이드). */
export function signUp(db: DB, input: Body, now: Date): UserRow {
  const email = trimmed(input.email)?.toLowerCase() ?? '';
  if (!EMAIL_PATTERN.test(email)) throw fieldError('email', '이메일 형식을 확인해 주세요.');
  if (email.length > EMAIL_MAX_LENGTH) {
    throw fieldError('email', `이메일은 ${EMAIL_MAX_LENGTH}자 이하로 입력해 주세요.`);
  }
  const password = input.password;
  if (typeof password !== 'string' || !PASSWORD_PATTERN.test(password)) {
    throw fieldError('password', '비밀번호는 영문과 숫자를 섞어 8자 이상으로 입력해 주세요.');
  }
  const name = trimmed(input.name) ?? '';
  if (name === '' || name.length > NAME_MAX) {
    throw fieldError('name', `이름은 1~${NAME_MAX}자로 입력해 주세요.`);
  }
  const role = SIGNUP_ROLES.find((r) => r === input.role);
  if (role === undefined) throw fieldError('role', '역할을 선택해 주세요.');
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw fieldError('email', errorMessage('EMAIL_DUPLICATE'), 'EMAIL_DUPLICATE', 409);
  }

  const at = toSeoulIso(now);
  const user: UserRow = {
    id: nextId(db),
    email,
    password,
    name,
    role,
    createdAt: at,
    updatedAt: at,
  };
  db.users.push(user);
  addEmptyProfile(db, user.id, role, at);
  return user;
}

function addEmptyProfile(db: DB, userId: number, role: SignupRole, at: string): void {
  if (role === 'HIGH_SCHOOL') {
    db.studentProfiles.push({
      id: userId,
      highSchoolName: null,
      grade: null,
      interestedMajor: null,
      createdAt: at,
      updatedAt: at,
    });
  } else if (role === 'UNIVERSITY') {
    db.guideProfiles.push({
      id: userId,
      universityId: null,
      major: null,
      introduction: null,
      createdAt: at,
      updatedAt: at,
    });
  }
}

/** 고교생 칸(`PATCH /users/me`에서 고교생만 보낼 수 있는 것). */
const STUDENT_ONLY_KEYS = ['schoolName', 'grade', 'interestMajor'] as const;

/**
 * 내 정보 수정(PATCH). 보낸 칸만 바꾼다(빠진 칸은 그대로, `null` · 빈 문자열은 지움). `name`은 `users.name`에 반영한다.
 * 학교 · 학년 · 관심 학과는 고교생만 보낼 수 있다(아니면 403 FORBIDDEN). 고교생 프로필 행이 없으면 만든다.
 */
export function updateStudentProfile(db: DB, userId: number, input: Body, now: Date): UserRow {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new MockApiError(401, 'UNAUTHORIZED'); // 핸들러가 requireUser로 막으므로 닿지 않는다
  if (user.role !== 'HIGH_SCHOOL' && STUDENT_ONLY_KEYS.some((key) => key in input)) {
    throw new MockApiError(403, 'FORBIDDEN');
  }

  let name: string | undefined;
  if ('name' in input) {
    name = trimmed(input.name) ?? '';
    if (name === '' || name.length > NAME_MAX) {
      throw fieldError('name', `이름은 1~${NAME_MAX}자로 입력해 주세요.`);
    }
  }
  const school =
    'schoolName' in input ? optionalText(input.schoolName, HIGH_SCHOOL_NAME_MAX) : null;
  if (school && !school.ok) {
    throw fieldError('schoolName', `학교 이름은 ${HIGH_SCHOOL_NAME_MAX}자 이하로 입력해 주세요.`);
  }
  let grade: number | null = null; // 빠졌거나 null이면 null(빠진 칸은 아래에서 건드리지 않는다)
  if ('grade' in input && input.grade !== null) {
    const value = input.grade;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3) {
      throw fieldError('grade', '학년은 1~3 중에서 골라 주세요.');
    }
    grade = value;
  }
  const major =
    'interestMajor' in input ? optionalText(input.interestMajor, INTEREST_MAJOR_MAX) : null;
  if (major && !major.ok) {
    throw fieldError('interestMajor', `관심 학과는 ${INTEREST_MAJOR_MAX}자 이하로 입력해 주세요.`);
  }

  const at = toSeoulIso(now);
  if (name !== undefined) user.name = name;
  user.updatedAt = at;
  if (user.role === 'HIGH_SCHOOL') {
    let row = db.studentProfiles.find((p) => p.id === userId);
    if (!row) {
      row = {
        id: userId,
        highSchoolName: null,
        grade: null,
        interestedMajor: null,
        createdAt: at,
        updatedAt: at,
      };
      db.studentProfiles.push(row);
    }
    if (school?.ok) row.highSchoolName = school.value;
    if ('grade' in input) row.grade = grade;
    if (major?.ok) row.interestedMajor = major.value;
    row.updatedAt = at;
  }
  return user;
}

/**
 * 가이드 프로필 저장(PUT). 본문은 `{ major, intro }`이고 둘 다 필수다. 학교는 받지 않는다 — `universityId`는 재학 인증 제출 행의 대학 ?? 기존 값 ?? null이다.
 * 프로필 행이 없으면 만든다.
 */
export function saveGuideProfile(db: DB, userId: number, input: Body, now: Date): GuideProfileRow {
  const major = trimmed(input.major) ?? '';
  if (major === '' || major.length > GUIDE_MAJOR_MAX) {
    throw fieldError('major', `학과는 1~${GUIDE_MAJOR_MAX}자로 입력해 주세요.`);
  }
  const intro = trimmed(input.intro) ?? '';
  if (intro === '' || intro.length > GUIDE_INTRO_MAX) {
    throw fieldError('intro', `소개는 1~${GUIDE_INTRO_MAX}자로 입력해 주세요.`);
  }

  const at = toSeoulIso(now);
  let row = db.guideProfiles.find((p) => p.id === userId);
  if (!row) {
    row = {
      id: userId,
      universityId: null,
      major: null,
      introduction: null,
      createdAt: at,
      updatedAt: at,
    };
    db.guideProfiles.push(row);
  }
  row.universityId =
    db.verifications.find((v) => v.id === userId)?.universityId ?? row.universityId;
  row.major = major;
  row.introduction = intro;
  row.updatedAt = at;
  return row;
}
