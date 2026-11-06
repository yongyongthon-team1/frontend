import {
  EMAIL_MAX_LENGTH,
  GUIDE_INTRO_MAX,
  GUIDE_MAJOR_MAX,
  PASSWORD_MIN_LENGTH,
  PROFILE_TEXT_MAX,
  SIGNUP_ROLES,
  type SignupRole,
} from '@/features/auth/model';
import { nextId } from '@/mocks/db/ids';
import type { DB, GuideProfileRow, StudentProfileRow, UserRow } from '@/mocks/db/schema';
import { fieldError } from '@/mocks/handlers/util';
import { toSeoulIso } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';

// 가입(#1) · 고교생 프로필(#2) · 가이드 프로필(#3) 규칙. 본문은 검증되지 않은 JSON이라 입력을 `Record<string, unknown>`로 받는다.
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
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw fieldError('password', `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상으로 입력해 주세요.`);
  }
  const name = trimmed(input.name) ?? '';
  if (name === '' || name.length > PROFILE_TEXT_MAX) {
    throw fieldError('name', `이름은 1~${PROFILE_TEXT_MAX}자로 입력해 주세요.`);
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

/** 고교생 프로필 저장(PUT). `name`은 `users.name`에 반영하고, 프로필 행이 없으면 만든다. */
export function updateStudentProfile(
  db: DB,
  userId: number,
  input: Body,
  now: Date,
): StudentProfileRow {
  const name = trimmed(input.name) ?? '';
  if (name === '' || name.length > PROFILE_TEXT_MAX) {
    throw fieldError('name', `이름은 1~${PROFILE_TEXT_MAX}자로 입력해 주세요.`);
  }
  const school = optionalText(input.highSchoolName, PROFILE_TEXT_MAX);
  if (!school.ok) {
    throw fieldError('highSchoolName', `학교 이름은 ${PROFILE_TEXT_MAX}자 이하로 입력해 주세요.`);
  }
  const grade = input.grade ?? null;
  if (
    grade !== null &&
    !(typeof grade === 'number' && Number.isInteger(grade) && grade >= 1 && grade <= 3)
  ) {
    throw fieldError('grade', '학년은 1~3 중에서 골라 주세요.');
  }
  const major = optionalText(input.interestedMajor, PROFILE_TEXT_MAX);
  if (!major.ok) {
    throw fieldError('interestedMajor', `관심 학과는 ${PROFILE_TEXT_MAX}자 이하로 입력해 주세요.`);
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user) throw fieldError('name'); // 핸들러가 requireUser로 막으므로 닿지 않는다
  const at = toSeoulIso(now);
  user.name = name;
  user.updatedAt = at;
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
  row.highSchoolName = school.value;
  row.grade = grade;
  row.interestedMajor = major.value;
  row.updatedAt = at;
  return row;
}

/**
 * 가이드 프로필 저장(PUT). 학교는 받지 않는다 — `universityId`는 재학 인증 제출 행의 대학 ?? 기존 값 ?? null이다.
 * 프로필 행이 없으면 만든다.
 */
export function saveGuideProfile(db: DB, userId: number, input: Body, now: Date): GuideProfileRow {
  const major = trimmed(input.major) ?? '';
  if (major === '' || major.length > GUIDE_MAJOR_MAX) {
    throw fieldError('major', `학과는 1~${GUIDE_MAJOR_MAX}자로 입력해 주세요.`);
  }
  const intro = optionalText(input.introduction, GUIDE_INTRO_MAX);
  if (!intro.ok) {
    throw fieldError('introduction', `소개는 ${GUIDE_INTRO_MAX}자 이하로 입력해 주세요.`);
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
  row.introduction = intro.value;
  row.updatedAt = at;
  return row;
}
