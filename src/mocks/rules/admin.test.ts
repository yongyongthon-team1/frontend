import { beforeEach, describe, expect, it } from 'vitest';
import { getMockFile, MOCK_DOC_SAMPLE, putMockFile } from '@/mocks/db/files';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { toWireMe } from '@/mocks/wire/auth';
import { toWireAdminDetail, toWireAdminItem } from '@/mocks/wire/admin';
import type { ErrorCode } from '@/shared/lib/errors';
import { testImage } from '@/test/files';
import { decideVerification, findVerification, listVerifications } from './admin';
import { MockApiError } from './errors';

const today = new Date('2026-11-15T01:00:00Z'); // KST 10:00
const now = new Date('2026-11-15T03:00:00Z'); // KST 12:00

let db: DB;
beforeEach(() => {
  db = createSeed(today);
});

const userId = (email: string) => db.users.find((u) => u.email === email)!.id;
const adminId = () => userId('admin@demo.kr');
const rowOf = (email: string) => db.verifications.find((v) => v.id === userId(email))!;

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
const nameOf = (id: number) => db.users.find((u) => u.id === id)!.name;

describe('listVerifications', () => {
  it('상태를 생략하면 PENDING만, 오래된 제출부터: 한도윤 → 오지호 → 강하린', () => {
    expect(listVerifications(db, null).map((r) => nameOf(r.id))).toEqual([
      '한도윤',
      '오지호',
      '강하린',
    ]);
  });

  it('APPROVED · REJECTED도 받는다(명세 "선택")', () => {
    const rejected = listVerifications(db, 'REJECTED').map((r) => nameOf(r.id));
    expect(rejected).toEqual(expect.arrayContaining(['윤서아', '서지안']));
    expect(listVerifications(db, 'APPROVED').every((r) => r.status === 'APPROVED')).toBe(true);
  });

  it('모르는 상태는 status 칸 오류', () => {
    expect(fieldsOf(() => listVerifications(db, 'X'))).toEqual({
      status: '심사 상태를 다시 골라 주세요.',
    });
  });
});

describe('findVerification', () => {
  it('없는 id는 404 NOT_FOUND', () => {
    expect(errorOf(() => findVerification(db, 9999))).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('decideVerification — 승인', () => {
  it('상태 · 처리자 · 시각이 남고 사진 참조가 지워지며 학생의 인증 상태가 APPROVED가 된다', () => {
    const id = userId('waiting@demo.kr');
    const ref = putMockFile(testImage());
    rowOf('waiting@demo.kr').documentUrl = ref;
    expect(toWireMe(db, id, now).verificationStatus).toBe('PENDING');

    const row = decideVerification(db, adminId(), id, { decision: 'APPROVED' }, now);

    expect(row).toMatchObject({
      status: 'APPROVED',
      rejectionReason: null,
      documentUrl: null,
      reviewedBy: adminId(),
      reviewedAt: '2026-11-15T12:00:00+09:00',
    });
    expect(getMockFile(ref)).toBeNull();
    expect(toWireMe(db, id, now).verificationStatus).toBe('APPROVED');
  });

  it('정적 견본 경로도 비운다(파일은 지울 게 없다)', () => {
    decideVerification(db, adminId(), userId('waiting@demo.kr'), { decision: 'APPROVED' }, now);
    expect(rowOf('waiting@demo.kr').documentUrl).toBeNull();
  });

  it('승인은 반려 사유를 무시한다', () => {
    const row = decideVerification(
      db,
      adminId(),
      userId('guide-pending@demo.kr'),
      { decision: 'APPROVED', rejectReason: '무시' },
      now,
    );
    expect(row.rejectionReason).toBeNull();
  });
});

describe('decideVerification — 반려', () => {
  it('사유는 앞뒤 공백을 뺀 값으로 남고 내 정보의 reject_reason에 보인다', () => {
    const id = userId('waiting@demo.kr');
    decideVerification(
      db,
      adminId(),
      id,
      { decision: 'REJECTED', rejectReason: '  학교명이 보이지 않습니다  ' },
      now,
    );
    const me = toWireMe(db, id, now);
    expect(me.verificationStatus).toBe('REJECTED');
    expect(me.rejectReason).toBe('학교명이 보이지 않습니다');
    expect(rowOf('waiting@demo.kr').documentUrl).toBeNull();
  });

  it.each([[''], ['   '], [undefined], [7], ['가'.repeat(101)]])(
    '사유 %j는 rejectReason 칸 오류이고 아무것도 바뀌지 않는다',
    (reason) => {
      const before = structuredClone(rowOf('waiting@demo.kr'));
      expect(
        fieldsOf(() =>
          decideVerification(
            db,
            adminId(),
            userId('waiting@demo.kr'),
            { decision: 'REJECTED', rejectReason: reason },
            now,
          ),
        ),
      ).toEqual({ rejectReason: '반려 사유는 1~100자로 적어 주세요.' });
      expect(rowOf('waiting@demo.kr')).toEqual(before);
    },
  );

  it('공백을 뺀 100자는 통과', () => {
    const row = decideVerification(
      db,
      adminId(),
      userId('waiting@demo.kr'),
      { decision: 'REJECTED', rejectReason: ` ${'가'.repeat(100)} ` },
      now,
    );
    expect(row.rejectionReason).toHaveLength(100);
  });
});

describe('decideVerification — 검사 순서', () => {
  it('없는 id → 404가 먼저', () => {
    expect(codeOf(() => decideVerification(db, adminId(), 9999, {}, now))).toBe('NOT_FOUND');
  });

  it('두 번째 처리는 ALREADY_PROCESSED(봉투 E409_ALREADY_REVIEWED), decision이 틀려도 409가 먼저', () => {
    const id = userId('waiting@demo.kr');
    decideVerification(db, adminId(), id, { decision: 'APPROVED' }, now);
    expect(
      errorOf(() => decideVerification(db, adminId(), id, { decision: 'APPROVED' }, now)),
    ).toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_ALREADY_REVIEWED',
    });
    expect(codeOf(() => decideVerification(db, adminId(), id, {}, now))).toBe('ALREADY_PROCESSED');
    // 시드에서 이미 반려된 건도 마찬가지.
    expect(
      codeOf(() =>
        decideVerification(
          db,
          adminId(),
          userId('rejected@demo.kr'),
          { decision: 'APPROVED' },
          now,
        ),
      ),
    ).toBe('ALREADY_PROCESSED');
  });

  it('decision이 둘 중 하나가 아니면 decision 칸 오류', () => {
    const id = userId('waiting@demo.kr');
    for (const decision of [undefined, 'MAYBE', 'approved', 1]) {
      expect(fieldsOf(() => decideVerification(db, adminId(), id, { decision }, now))).toEqual({
        decision: '승인 또는 반려를 골라 주세요.',
      });
    }
    expect(rowOf('waiting@demo.kr').status).toBe('PENDING');
  });
});

describe('와이어 변환', () => {
  it('고교생은 행의 고교 이름, 대학생은 그 대학의 캠퍼스 이름', () => {
    expect(toWireAdminItem(db, rowOf('waiting@demo.kr'))).toEqual({
      verificationId: userId('waiting@demo.kr'),
      userName: '강하린',
      role: 'HIGH_SCHOOL',
      schoolName: '수원영통고등학교',
      submittedAt: rowOf('waiting@demo.kr').submittedAt,
    });
    expect(toWireAdminItem(db, rowOf('guide-pending@demo.kr'))).toMatchObject({
      userName: '한도윤',
      role: 'UNIVERSITY',
      schoolName: '단국대학교 죽전캠퍼스',
    });
  });

  it('상세의 documentUrl은 PENDING일 때만: 정적 경로는 그대로, 사라진 mock-file 참조는 견본, 없으면 null', () => {
    expect(toWireAdminDetail(db, rowOf('waiting@demo.kr'))).toMatchObject({
      documentUrl: MOCK_DOC_SAMPLE.HIGH_SCHOOL,
      status: 'PENDING',
    });
    rowOf('waiting@demo.kr').documentUrl = 'mock-file:gone';
    expect(toWireAdminDetail(db, rowOf('waiting@demo.kr')).documentUrl).toBe(
      MOCK_DOC_SAMPLE.HIGH_SCHOOL,
    );
    rowOf('guide-pending@demo.kr').documentUrl = 'mock-file:gone';
    expect(toWireAdminDetail(db, rowOf('guide-pending@demo.kr')).documentUrl).toBe(
      MOCK_DOC_SAMPLE.UNIVERSITY,
    );
    rowOf('guide-pending@demo.kr').documentUrl = null;
    expect(toWireAdminDetail(db, rowOf('guide-pending@demo.kr')).documentUrl).toBeNull();
  });

  it('처리된 건의 documentUrl은 null이다', () => {
    const row = decideVerification(
      db,
      adminId(),
      userId('waiting@demo.kr'),
      { decision: 'APPROVED' },
      now,
    );
    expect(toWireAdminDetail(db, row)).toMatchObject({ documentUrl: null, status: 'APPROVED' });
  });
});
