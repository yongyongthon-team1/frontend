import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_DOC_SAMPLE, getMockFile } from '@/mocks/db/files';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { DEMO_CONSENT_TOKENS } from '@/shared/config/demoAccounts';
import type { ErrorCode } from '@/shared/lib/errors';
import { testImage } from '@/test/files';
import { MockApiError } from './errors';
import {
  CONSENT_GUIDE_TEXT,
  CONSENT_LINK_DAYS,
  decideConsent,
  findConsent,
  requestGuardianConsent,
  submitEnrollment,
} from './verification';

const today = new Date('2026-11-15T01:00:00Z'); // KST 10:00
const now = new Date('2026-11-15T03:00:00Z'); // KST 12:00

let db: DB;
beforeEach(() => {
  db = createSeed(today);
});

const userId = (email: string) => db.users.find((u) => u.email === email)!.id;
const consentOf = (email: string) => db.guardianConsents.find((g) => g.id === userId(email))!;
const verificationOf = (email: string) => db.verifications.find((v) => v.id === userId(email));

function errorOf(run: () => unknown): MockApiError | undefined {
  try {
    run();
  } catch (e) {
    return e as MockApiError;
  }
  return undefined;
}
const codeOf = (run: () => unknown): ErrorCode | undefined => errorOf(run)?.code;
const fieldsOf = (run: () => unknown) => errorOf(run)?.fieldErrors;

const MB5 = 5 * 1024 * 1024;
const HS_FIELDS = { campusId: null, schoolName: '용인고등학교' };
const UNIV_FIELDS = { campusId: '2', schoolName: null };
const DOC_MESSAGE = 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요';

describe('submitEnrollment — 검사 순서', () => {
  it('역할이 맞지 않으면 403(운영자 · 사장님)', () => {
    expect(codeOf(() => submitEnrollment(db, userId('admin@demo.kr'), HS_FIELDS, null, now))).toBe(
      'FORBIDDEN',
    );
    expect(
      codeOf(() => submitEnrollment(db, userId('owner1@demo.kr'), HS_FIELDS, testImage(), now)),
    ).toBe('FORBIDDEN');
  });

  it('심사 중이면 사진이 없어도 409가 먼저 — 명세 코드 E409_ALREADY_SUBMITTED', () => {
    const error = errorOf(() =>
      submitEnrollment(db, userId('waiting@demo.kr'), HS_FIELDS, null, now),
    );
    expect(error).toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_ALREADY_SUBMITTED',
    });
  });

  it('승인된 계정도 409', () => {
    expect(
      errorOf(() => submitEnrollment(db, userId('student@demo.kr'), HS_FIELDS, testImage(), now)),
    ).toMatchObject({ status: 409, backendCode: 'E409_ALREADY_SUBMITTED' });
  });

  it('사진이 없으면 document 칸 오류', () => {
    expect(
      fieldsOf(() => submitEnrollment(db, userId('newbie@demo.kr'), HS_FIELDS, null, now)),
    ).toEqual({
      document: '학생증 또는 재학증명서 사진을 올려 주세요.',
    });
  });

  it('형식이 틀리면 명세 문장, 용량이 틀려도 같은 문장', () => {
    const newbie = userId('newbie@demo.kr');
    expect(
      fieldsOf(() =>
        submitEnrollment(
          db,
          newbie,
          HS_FIELDS,
          testImage('x.pdf', { type: 'application/pdf' }),
          now,
        ),
      ),
    ).toEqual({ document: DOC_MESSAGE });
    expect(
      fieldsOf(() =>
        submitEnrollment(db, newbie, HS_FIELDS, testImage('a.jpg', { size: MB5 + 1 }), now),
      ),
    ).toEqual({ document: DOC_MESSAGE });
    expect(
      codeOf(() => submitEnrollment(db, newbie, HS_FIELDS, testImage('a.jpg', { size: MB5 }), now)),
    ).toBeUndefined();
  });

  it('파일 검사가 칸 검사보다 앞 — 학교가 비어도 형식 오류가 먼저', () => {
    expect(
      fieldsOf(() =>
        submitEnrollment(
          db,
          userId('newbie@demo.kr'),
          { campusId: null, schoolName: '' },
          testImage('x.pdf', { type: 'application/pdf' }),
          now,
        ),
      ),
    ).toEqual({ document: DOC_MESSAGE });
  });

  it.each([null, '', '   ', 'ㅎ'.repeat(51)])(
    '고교생 학교 이름 %j는 schoolName 칸 오류',
    (schoolName) => {
      expect(
        fieldsOf(() =>
          submitEnrollment(
            db,
            userId('newbie@demo.kr'),
            { campusId: null, schoolName },
            testImage(),
            now,
          ),
        ),
      ).toEqual({ schoolName: '학교 이름은 50자 이하로 입력해 주세요.' });
    },
  );

  it.each([null, '', 'abc', '6', '0', '1.5'])(
    '대학생 campusId %j는 5개교가 아니라 campusId 칸 오류',
    (campusId) => {
      expect(
        fieldsOf(() =>
          submitEnrollment(
            db,
            userId('guide-new@demo.kr'),
            { campusId, schoolName: null },
            testImage(),
            now,
          ),
        ),
      ).toEqual({ campusId: '5개교 이외 학교 선택 시 제출할 수 없어요.' });
    },
  );

  it('걸린 검사가 있으면 DB는 그대로', () => {
    const before = JSON.stringify(db);
    submitEnrollmentSafely(
      userId('newbie@demo.kr'),
      HS_FIELDS,
      testImage('x.pdf', { type: 'application/pdf' }),
    );
    expect(JSON.stringify(db)).toBe(before);
  });
});

function submitEnrollmentSafely(id: number, fields: typeof HS_FIELDS, file: File) {
  try {
    submitEnrollment(db, id, fields, file, now);
  } catch {
    // 규칙에 걸린 것이 기대다
  }
}

describe('submitEnrollment — 저장', () => {
  it('고교생: PENDING 행 + 사진 참조 + 프로필 학교(앞뒤 공백 뺀 값)', () => {
    const row = submitEnrollment(
      db,
      userId('newbie@demo.kr'),
      { campusId: null, schoolName: '  용인고등학교 ' },
      testImage(),
      now,
    );
    expect(row).toBe(verificationOf('newbie@demo.kr'));
    expect(row).toMatchObject({
      status: 'PENDING',
      highSchoolName: '용인고등학교',
      universityId: null,
      rejectionReason: null,
      submittedAt: '2026-11-15T12:00:00+09:00',
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(row.documentUrl).toMatch(/^mock-file:/);
    expect(getMockFile(row.documentUrl!)).not.toBeNull();
    expect(db.studentProfiles.find((p) => p.id === row.id)!.highSchoolName).toBe('용인고등학교');
  });

  it('반려 뒤 다시 제출하면 같은 행이 PENDING으로, 사유 · 심사 기록이 지워진다', () => {
    const before = verificationOf('rejected@demo.kr')!;
    expect(before.status).toBe('REJECTED');
    const row = submitEnrollment(db, userId('rejected@demo.kr'), HS_FIELDS, testImage(), now);
    expect(row).toBe(before);
    expect(db.verifications.filter((v) => v.id === row.id)).toHaveLength(1);
    expect(row).toMatchObject({
      status: 'PENDING',
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(row.documentUrl).not.toBe(MOCK_DOC_SAMPLE.HIGH_SCHOOL);
  });

  it('대학생 제출이 가이드 프로필의 universityId를 맞춘다', () => {
    const row = submitEnrollment(
      db,
      userId('guide-rejected@demo.kr'),
      UNIV_FIELDS,
      testImage(),
      now,
    );
    expect(row).toMatchObject({ status: 'PENDING', universityId: 2, highSchoolName: null });
    expect(db.guideProfiles.find((p) => p.id === row.id)).toMatchObject({
      universityId: 2,
      major: '기계공학과',
    });
  });

  it('프로필 행이 없는 대학생은 학과 · 소개 null로 만든다', () => {
    const id = userId('guide-new@demo.kr');
    expect(db.guideProfiles.find((p) => p.id === id)).toBeUndefined();
    submitEnrollment(db, id, UNIV_FIELDS, testImage(), now);
    expect(db.guideProfiles.find((p) => p.id === id)).toMatchObject({
      universityId: 2,
      major: null,
      introduction: null,
    });
  });
});

describe('requestGuardianConsent', () => {
  const body = { guardianName: '최보호', guardianEmail: 'parent@example.com' };

  it('고교생이 아니면 403', () => {
    expect(codeOf(() => requestGuardianConsent(db, userId('guide-new@demo.kr'), body, now))).toBe(
      'FORBIDDEN',
    );
  });

  it('대기 중(기한 전) · 동의 완료면 409 — 명세 코드 E409_CONSENT_EXISTS', () => {
    for (const email of ['waiting@demo.kr', 'student@demo.kr']) {
      expect(errorOf(() => requestGuardianConsent(db, userId(email), body, now))).toMatchObject({
        status: 409,
        code: 'ALREADY_PROCESSED',
        backendCode: 'E409_CONSENT_EXISTS',
      });
    }
  });

  it('409가 칸 검사보다 앞', () => {
    expect(
      codeOf(() =>
        requestGuardianConsent(
          db,
          userId('waiting@demo.kr'),
          { guardianName: '', guardianEmail: '' },
          now,
        ),
      ),
    ).toBe('ALREADY_PROCESSED');
  });

  it.each([undefined, '', '   ', 'ㅎ'.repeat(21), 5])(
    '이름 %j는 guardianName 칸 오류',
    (guardianName) => {
      expect(
        fieldsOf(() =>
          requestGuardianConsent(db, userId('newbie@demo.kr'), { ...body, guardianName }, now),
        ),
      ).toEqual({ guardianName: '보호자 이름은 1~20자로 입력해 주세요.' });
    },
  );

  it.each([undefined, '', 'parent', 'a@b', 'a b@c.kr', 3])(
    '이메일 %j는 guardianEmail 칸 오류',
    (guardianEmail) => {
      expect(
        fieldsOf(() =>
          requestGuardianConsent(db, userId('newbie@demo.kr'), { ...body, guardianEmail }, now),
        ),
      ).toEqual({ guardianEmail: '이메일 주소 형식을 확인해 주세요.' });
    },
  );

  it('처음 요청하면 행을 만든다: PENDING, 7일 뒤 만료, 토큰', () => {
    expect(CONSENT_LINK_DAYS).toBe(7);
    const id = userId('newbie@demo.kr');
    const row = requestGuardianConsent(db, id, body, now);
    expect(row).toBe(consentOf('newbie@demo.kr'));
    expect(row).toMatchObject({
      id,
      guardianName: '최보호',
      guardianEmail: 'parent@example.com',
      status: 'PENDING',
      expiresAt: '2026-11-22T12:00:00+09:00',
      agreedAt: null,
    });
    expect(row.tokenHash).toMatch(new RegExp(`^consent-${id}-\\d+$`));
  });

  it('거부된 뒤에는 다시 요청할 수 있고 예전 토큰은 404가 된다', () => {
    const old = DEMO_CONSENT_TOKENS.rejected;
    expect(findConsent(db, old, now).status).toBe('REJECTED');
    const row = requestGuardianConsent(db, userId('rejected@demo.kr'), body, now);
    expect(row.status).toBe('PENDING');
    expect(row.tokenHash).not.toBe(old);
    expect(db.guardianConsents.filter((g) => g.id === row.id)).toHaveLength(1);
    expect(codeOf(() => findConsent(db, old, now))).toBe('CONSENT_LINK_INVALID');
    expect(findConsent(db, row.tokenHash!, now)).toBe(row);
  });

  it('만료된 뒤에도 다시 요청할 수 있다', () => {
    const row = requestGuardianConsent(db, userId('expired@demo.kr'), body, now);
    expect(row).toMatchObject({ status: 'PENDING', expiresAt: '2026-11-22T12:00:00+09:00' });
    expect(codeOf(() => findConsent(db, DEMO_CONSENT_TOKENS.expired, now))).toBe(
      'CONSENT_LINK_INVALID',
    );
  });
});

describe('findConsent', () => {
  it('모르는 토큰은 404 CONSENT_LINK_INVALID', () => {
    expect(errorOf(() => findConsent(db, 'bad', now))).toMatchObject({
      status: 404,
      code: 'CONSENT_LINK_INVALID',
    });
    expect(codeOf(() => findConsent(db, '', now))).toBe('CONSENT_LINK_INVALID');
  });

  it('기한 지난 대기 링크는 410 CONSENT_LINK_EXPIRED', () => {
    expect(errorOf(() => findConsent(db, DEMO_CONSENT_TOKENS.expired, now))).toMatchObject({
      status: 410,
      code: 'CONSENT_LINK_EXPIRED',
    });
  });

  it('유효한 링크는 그 행, 처리된 링크(동의 · 거부)는 200으로 그 행', () => {
    expect(findConsent(db, DEMO_CONSENT_TOKENS.valid, now).status).toBe('PENDING');
    expect(findConsent(db, DEMO_CONSENT_TOKENS.agreed, now).status).toBe('AGREED');
    expect(findConsent(db, DEMO_CONSENT_TOKENS.rejected, now).status).toBe('REJECTED');
  });

  it('처리된 링크는 기한이 지나도 그 행이다', () => {
    const row = consentOf('pending@demo.kr');
    row.expiresAt = '2026-01-01T00:00:00+09:00';
    expect(findConsent(db, DEMO_CONSENT_TOKENS.agreed, now)).toBe(row);
  });
});

describe('decideConsent', () => {
  it('동의하면 AGREED + agreedAt', () => {
    const row = decideConsent(db, DEMO_CONSENT_TOKENS.valid, true, now);
    expect(row).toBe(consentOf('waiting@demo.kr'));
    expect(row).toMatchObject({ status: 'AGREED', agreedAt: '2026-11-15T12:00:00+09:00' });
  });

  it('거부하면 REJECTED, agreedAt은 null', () => {
    const row = decideConsent(db, DEMO_CONSENT_TOKENS.valid, false, now);
    expect(row).toMatchObject({ status: 'REJECTED', agreedAt: null });
  });

  it('두 번째 결정은 409 ALREADY_PROCESSED, 토큰은 남는다', () => {
    decideConsent(db, DEMO_CONSENT_TOKENS.valid, true, now);
    expect(errorOf(() => decideConsent(db, DEMO_CONSENT_TOKENS.valid, false, now))).toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
    });
    expect(findConsent(db, DEMO_CONSENT_TOKENS.valid, now).status).toBe('AGREED');
  });

  it('이미 처리된 시드 링크도 409', () => {
    expect(codeOf(() => decideConsent(db, DEMO_CONSENT_TOKENS.agreed, true, now))).toBe(
      'ALREADY_PROCESSED',
    );
  });

  it('agree가 불리언이 아니면 agree 칸 오류(상태는 그대로)', () => {
    for (const agree of [undefined, 'true', 1, null]) {
      expect(fieldsOf(() => decideConsent(db, DEMO_CONSENT_TOKENS.valid, agree, now))).toEqual({
        agree: '동의 여부를 골라 주세요.',
      });
    }
    expect(consentOf('waiting@demo.kr').status).toBe('PENDING');
  });

  it('링크 오류가 agree 검사보다 앞(404 · 410)', () => {
    expect(codeOf(() => decideConsent(db, 'bad', 'x', now))).toBe('CONSENT_LINK_INVALID');
    expect(codeOf(() => decideConsent(db, DEMO_CONSENT_TOKENS.expired, true, now))).toBe(
      'CONSENT_LINK_EXPIRED',
    );
  });
});

describe('CONSENT_GUIDE_TEXT', () => {
  it('제안 문구', () => {
    expect(CONSENT_GUIDE_TEXT).toBe(
      '용용톤 캠퍼스 탐방은 방학 중 대학생 가이드와 캠퍼스와 주변 상점을 함께 둘러보는 서비스예요. 가이드가 신청을 승인하면 오픈채팅으로 연결되고, 탐방 날 캠퍼스와 주변 가게를 함께 걸어요.',
    );
  });
});
