import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMAIL_MAX_LENGTH,
  GUIDE_INTRO_MAX,
  GUIDE_MAJOR_MAX,
  PROFILE_TEXT_MAX,
} from '@/features/auth/model';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { signUp, saveGuideProfile, updateStudentProfile } from './auth';
import { toMe } from './views';

const now = new Date('2026-11-14T03:00:00Z');
const NOW_ISO = '2026-11-14T12:00:00+09:00';

let db: DB;
beforeEach(() => {
  db = createSeed(new Date('2026-11-15T01:00:00Z'));
});

const id = (email: string) => db.users.find((u) => u.email === email)!.id;

const valid = { email: 'new@demo.kr', password: 'demo1234', name: '김하늘', role: 'HIGH_SCHOOL' };

/** 규칙이 이 칸 오류로 던지고, DB는 하나도 바뀌지 않았는지 확인한다. */
function expectFieldError(
  fn: () => unknown,
  field: string,
  extra: { status?: number; code?: string } = {},
) {
  const before = structuredClone(db);
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toMatchObject({
    status: extra.status ?? 400,
    code: extra.code ?? 'VALIDATION',
    fieldErrors: { [field]: expect.any(String) },
  });
  expect(Object.keys((thrown as { fieldErrors: object }).fieldErrors)).toEqual([field]);
  expect(db).toEqual(before);
}

describe('signUp', () => {
  it('검사 순서: 이메일 형식 → 이메일 길이 → 비밀번호 → 이름 → 역할 → 중복', () => {
    // 모든 칸이 틀려도 위에서부터 첫 오류만 나온다.
    const allBad = { email: 'x', password: '1', name: '', role: 'ADMIN' };
    expectFieldError(() => signUp(db, allBad, now), 'email');
    const longEmail = `${'a'.repeat(EMAIL_MAX_LENGTH)}@demo.kr`;
    expectFieldError(() => signUp(db, { ...allBad, email: longEmail }, now), 'email');
    expectFieldError(() => signUp(db, { ...allBad, email: 'ok@demo.kr' }, now), 'password');
    expectFieldError(
      () => signUp(db, { ...allBad, email: 'ok@demo.kr', password: 'demo1234' }, now),
      'name',
    );
    expectFieldError(
      () => signUp(db, { ...allBad, email: 'ok@demo.kr', password: 'demo1234', name: '가' }, now),
      'role',
    );
    // 역할까지 틀리면 중복보다 역할이 먼저다.
    expectFieldError(
      () => signUp(db, { ...valid, email: 'student@demo.kr', role: 'ADMIN' }, now),
      'role',
    );
  });

  it('잘못된 이메일 형식', () => {
    for (const email of ['', 'abc', 'a@b', 'a b@c.kr', '@c.kr', 7]) {
      expectFieldError(() => signUp(db, { ...valid, email }, now), 'email');
    }
  });

  it('이메일이 255자를 넘으면 거부하고 255자는 통과한다', () => {
    const at255 = `${'a'.repeat(EMAIL_MAX_LENGTH - '@demo.kr'.length)}@demo.kr`;
    expect(at255).toHaveLength(EMAIL_MAX_LENGTH);
    expectFieldError(() => signUp(db, { ...valid, email: `b${at255}` }, now), 'email');
    expect(signUp(db, { ...valid, email: at255 }, now).email).toBe(at255);
  });

  it('비밀번호 8자 미만 · 문자열이 아님', () => {
    expectFieldError(() => signUp(db, { ...valid, password: '1234567' }, now), 'password');
    expectFieldError(() => signUp(db, { ...valid, password: 12345678 }, now), 'password');
    expect(signUp(db, { ...valid, password: '12345678' }, now).password).toBe('12345678');
  });

  it('이름은 공백을 뗀 1~100자', () => {
    expectFieldError(() => signUp(db, { ...valid, name: '   ' }, now), 'name');
    expectFieldError(
      () => signUp(db, { ...valid, name: '가'.repeat(PROFILE_TEXT_MAX + 1) }, now),
      'name',
    );
    expect(
      signUp(db, { ...valid, name: ` ${'가'.repeat(PROFILE_TEXT_MAX)} ` }, now).name,
    ).toHaveLength(PROFILE_TEXT_MAX);
  });

  it('모르는 역할 · 운영자 가입은 거부', () => {
    for (const role of ['ADMIN', 'GUARDIAN', '', undefined]) {
      expectFieldError(() => signUp(db, { ...valid, role }, now), 'role');
    }
  });

  it('대소문자만 다른 이메일은 중복 → 409 EMAIL_DUPLICATE (fieldErrors.email)', () => {
    expectFieldError(() => signUp(db, { ...valid, email: ' Student@Demo.KR ' }, now), 'email', {
      status: 409,
      code: 'EMAIL_DUPLICATE',
    });
  });

  it('이메일은 공백을 떼고 소문자로 저장한다', () => {
    const user = signUp(db, { ...valid, email: '  New.Person@Demo.KR ' }, now);
    expect(user.email).toBe('new.person@demo.kr');
    expect(() => signUp(db, { ...valid, email: 'NEW.person@demo.kr' }, now)).toThrow(
      expect.objectContaining({ code: 'EMAIL_DUPLICATE' }),
    );
  });

  it('고교생은 빈 학생 프로필 행, 인증 · 동의 기록 없음', () => {
    const user = signUp(db, valid, now);
    expect(user).toMatchObject({
      email: 'new@demo.kr',
      name: '김하늘',
      role: 'HIGH_SCHOOL',
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(db.studentProfiles.find((p) => p.id === user.id)).toEqual({
      id: user.id,
      highSchoolName: null,
      grade: null,
      interestedMajor: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(db.guideProfiles.some((p) => p.id === user.id)).toBe(false);
    expect(toMe(db, user.id, now)).toMatchObject({
      verificationStatus: 'NONE',
      guardianStatus: 'NONE',
      studentProfile: { highSchoolName: null, grade: null, interestedMajor: null },
      guideProfile: null,
    });
  });

  it('대학생은 빈 가이드 프로필 행', () => {
    const user = signUp(db, { ...valid, role: 'UNIVERSITY' }, now);
    expect(db.guideProfiles.find((p) => p.id === user.id)).toEqual({
      id: user.id,
      universityId: null,
      major: null,
      introduction: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(db.studentProfiles.some((p) => p.id === user.id)).toBe(false);
    expect(toMe(db, user.id, now)).toMatchObject({
      studentProfile: null,
      guideProfile: { universityId: null, major: null, introduction: null },
    });
  });

  it('사장님은 프로필 행이 없다', () => {
    const user = signUp(db, { ...valid, role: 'OWNER' }, now);
    expect(db.studentProfiles.some((p) => p.id === user.id)).toBe(false);
    expect(db.guideProfiles.some((p) => p.id === user.id)).toBe(false);
  });

  it('새 ID는 공용 카운터에서 받는다', () => {
    const next = db.nextId;
    expect(signUp(db, valid, now).id).toBe(next);
    expect(db.nextId).toBe(next + 1);
  });
});

describe('updateStudentProfile', () => {
  const input = { name: '김민지', highSchoolName: '수원고', grade: 3, interestedMajor: '디자인' };

  it('이름은 users.name에, 나머지는 학생 프로필에 저장하고 Me에 반영된다', () => {
    const userId = id('student@demo.kr');
    updateStudentProfile(db, userId, { ...input, name: '  새이름 ' }, now);
    const me = toMe(db, userId, now);
    expect(me.name).toBe('새이름');
    expect(me.studentProfile).toEqual({
      highSchoolName: '수원고',
      grade: 3,
      interestedMajor: '디자인',
    });
    expect(db.users.find((u) => u.id === userId)!.updatedAt).toBe(NOW_ISO);
    expect(db.studentProfiles.find((p) => p.id === userId)!.updatedAt).toBe(NOW_ISO);
  });

  it('비운 칸(null · 빈 문자열)은 null로 저장한다', () => {
    const userId = id('student@demo.kr');
    updateStudentProfile(
      db,
      userId,
      { name: '김민지', highSchoolName: '', grade: null, interestedMajor: null },
      now,
    );
    expect(toMe(db, userId, now).studentProfile).toEqual({
      highSchoolName: null,
      grade: null,
      interestedMajor: null,
    });
  });

  it('프로필 행이 없으면 만든다', () => {
    const userId = id('student@demo.kr');
    db.studentProfiles = db.studentProfiles.filter((p) => p.id !== userId);
    updateStudentProfile(db, userId, input, now);
    const row = db.studentProfiles.find((p) => p.id === userId)!;
    expect(row).toMatchObject({ highSchoolName: '수원고', createdAt: NOW_ISO, updatedAt: NOW_ISO });
  });

  it('검사 순서: 이름 → 학교 → 학년 → 관심 학과', () => {
    const userId = id('student@demo.kr');
    const bad = {
      name: '',
      highSchoolName: 'x'.repeat(PROFILE_TEXT_MAX + 1),
      grade: 4,
      interestedMajor: 'x'.repeat(PROFILE_TEXT_MAX + 1),
    };
    expectFieldError(() => updateStudentProfile(db, userId, bad, now), 'name');
    const b2 = { ...bad, name: '가' };
    expectFieldError(() => updateStudentProfile(db, userId, b2, now), 'highSchoolName');
    const b3 = { ...b2, highSchoolName: null };
    expectFieldError(() => updateStudentProfile(db, userId, b3, now), 'grade');
    const b4 = { ...b3, grade: 1 };
    expectFieldError(() => updateStudentProfile(db, userId, b4, now), 'interestedMajor');
  });

  it('학년은 1~3 정수 또는 null', () => {
    const userId = id('student@demo.kr');
    for (const grade of [0, 4, 1.5, '2', NaN]) {
      expectFieldError(() => updateStudentProfile(db, userId, { ...input, grade }, now), 'grade');
    }
    for (const grade of [1, 2, 3, null]) {
      updateStudentProfile(db, userId, { ...input, grade }, now);
      expect(toMe(db, userId, now).studentProfile?.grade).toBe(grade);
    }
  });

  it('100자는 통과하고 101자는 거부한다', () => {
    const userId = id('student@demo.kr');
    const at100 = 'x'.repeat(PROFILE_TEXT_MAX);
    updateStudentProfile(db, userId, { ...input, highSchoolName: at100 }, now);
    expectFieldError(
      () => updateStudentProfile(db, userId, { ...input, highSchoolName: `${at100}x` }, now),
      'highSchoolName',
    );
  });
});

describe('saveGuideProfile', () => {
  const input = { major: '컴퓨터공학과', introduction: '안녕하세요.' };

  it('학과 · 소개를 저장하고 Me에 반영된다 (학교는 기존 값을 유지)', () => {
    const userId = id('guide@demo.kr');
    const before = db.guideProfiles.find((p) => p.id === userId)!.universityId;
    saveGuideProfile(db, userId, input, now);
    expect(toMe(db, userId, now).guideProfile).toEqual({
      universityId: before,
      major: '컴퓨터공학과',
      introduction: '안녕하세요.',
    });
    expect(db.guideProfiles.find((p) => p.id === userId)!.updatedAt).toBe(NOW_ISO);
  });

  it('소개가 빈 문자열이면 null', () => {
    const userId = id('guide@demo.kr');
    saveGuideProfile(db, userId, { major: '컴퓨터공학과', introduction: '' }, now);
    expect(toMe(db, userId, now).guideProfile?.introduction).toBeNull();
    saveGuideProfile(db, userId, { major: '컴퓨터공학과', introduction: null }, now);
    expect(toMe(db, userId, now).guideProfile?.introduction).toBeNull();
  });

  it('universityId는 재학 인증 제출 행이 있으면 그 대학으로 맞춘다', () => {
    const userId = id('guide@demo.kr');
    const verification = db.verifications.find((v) => v.id === userId)!;
    verification.universityId = 3;
    saveGuideProfile(db, userId, input, now);
    expect(toMe(db, userId, now).guideProfile?.universityId).toBe(3);
  });

  it('인증 행도 기존 값도 없으면 null, 프로필 행이 없으면 만든다', () => {
    const userId = id('guide@demo.kr');
    db.verifications = db.verifications.filter((v) => v.id !== userId);
    db.guideProfiles = db.guideProfiles.filter((p) => p.id !== userId);
    saveGuideProfile(db, userId, input, now);
    expect(db.guideProfiles.find((p) => p.id === userId)).toEqual({
      id: userId,
      universityId: null,
      major: '컴퓨터공학과',
      introduction: '안녕하세요.',
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
  });

  it('학과는 공백을 뗀 1~30자, 31자는 거부', () => {
    const userId = id('guide@demo.kr');
    expectFieldError(() => saveGuideProfile(db, userId, { ...input, major: '  ' }, now), 'major');
    expectFieldError(
      () =>
        saveGuideProfile(db, userId, { ...input, major: '가'.repeat(GUIDE_MAJOR_MAX + 1) }, now),
      'major',
    );
    saveGuideProfile(db, userId, { ...input, major: '가'.repeat(GUIDE_MAJOR_MAX) }, now);
    expect(toMe(db, userId, now).guideProfile?.major).toHaveLength(GUIDE_MAJOR_MAX);
  });

  it('소개 301자는 거부, 학과 오류가 소개보다 먼저', () => {
    const userId = id('guide@demo.kr');
    const longIntro = '가'.repeat(GUIDE_INTRO_MAX + 1);
    expectFieldError(
      () => saveGuideProfile(db, userId, { ...input, introduction: longIntro }, now),
      'introduction',
    );
    expectFieldError(
      () => saveGuideProfile(db, userId, { major: '', introduction: longIntro }, now),
      'major',
    );
    saveGuideProfile(db, userId, { ...input, introduction: '가'.repeat(GUIDE_INTRO_MAX) }, now);
  });
});
