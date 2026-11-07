import { REJECT_REASON_MAX } from '@/features/admin/model';
import { deleteMockFile, MOCK_FILE_PREFIX } from '@/mocks/db/files';
import type { DB, VerificationRow } from '@/mocks/db/schema';
import { toSeoulIso } from '@/shared/lib/date';
import { backendError, fieldError, MockApiError } from './errors';

// 운영자 인증 심사(U-08) 규칙. 위에서부터 검사해 처음 걸린 오류를 던지고, 다 통과한 뒤에만 DB를 바꾼다.
// 칸 오류의 이름은 규칙이 읽는 와이어 이름(camel)이고 봉투에서 snake가 된다. 인증 행의 id는 제출자의 사용자 id다.

const STATUSES: readonly string[] = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * 심사 목록. 상태를 생략하면 PENDING이고, 명세는 상태를 "선택"으로 열어 두어 `APPROVED` · `REJECTED`도 받는다
 * (화면은 대기 목록만 부른다, 2B′-R11). 그 밖의 값은 400. 오래된 제출부터, 같으면 id 순이다.
 */
export function listVerifications(db: DB, status: string | null): VerificationRow[] {
  const wanted = status ?? 'PENDING';
  if (!STATUSES.includes(wanted)) throw fieldError('status', '심사 상태를 다시 골라 주세요.');
  return db.verifications
    .filter((v) => v.status === wanted)
    .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt) || a.id - b.id);
}

/** 심사 요청 하나. 없으면 404. */
export function findVerification(db: DB, id: number): VerificationRow {
  const row = db.verifications.find((v) => v.id === id);
  if (!row) throw new MockApiError(404, 'NOT_FOUND');
  return row;
}

/**
 * 승인 · 반려. 순서: 404 → 이미 처리됐으면 409 `E409_ALREADY_REVIEWED`(내부 코드 `ALREADY_PROCESSED`) → `decision`이 둘 중
 * 하나가 아니면 칸 오류 → 반려인데 사유가 공백을 뺀 1~100자가 아니면 칸 오류. 처리하면 상태 · 사유(승인은 null) · 처리 시각 · 처리자를
 * 남기고 제출 사진을 지운다(명세: "제출 사진 파일은 삭제").
 */
export function decideVerification(
  db: DB,
  adminId: number,
  id: number,
  body: { decision?: unknown; rejectReason?: unknown },
  now: Date,
): VerificationRow {
  const row = findVerification(db, id);
  if (row.status !== 'PENDING') {
    throw backendError(409, 'E409_ALREADY_REVIEWED', 'ALREADY_PROCESSED');
  }
  const { decision } = body;
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    throw fieldError('decision', '승인 또는 반려를 골라 주세요.');
  }
  let reason: string | null = null;
  if (decision === 'REJECTED') {
    const text = typeof body.rejectReason === 'string' ? body.rejectReason.trim() : '';
    if (text.length < 1 || text.length > REJECT_REASON_MAX) {
      throw fieldError('rejectReason', `반려 사유는 1~${REJECT_REASON_MAX}자로 적어 주세요.`);
    }
    reason = text;
  }

  if (row.documentUrl?.startsWith(MOCK_FILE_PREFIX)) deleteMockFile(row.documentUrl);
  row.documentUrl = null;
  row.status = decision;
  row.rejectionReason = reason;
  row.reviewedAt = toSeoulIso(now);
  row.reviewedBy = adminId;
  return row;
}
