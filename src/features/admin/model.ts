import type { Tone } from '@/shared/lib/types';

// 운영자 인증 심사(U-08)의 화면 쪽 모양. 처리 내역 목록은 명세에 없어(9절 34번) 대기 목록과 상세만 있다(2B′-R11).

export type VerificationSubjectRole = 'HIGH_SCHOOL' | 'UNIVERSITY';
export type AdminVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AdminDecision = 'APPROVED' | 'REJECTED';

export interface AdminVerificationItem {
  id: number;
  userName: string;
  role: VerificationSubjectRole;
  schoolName: string;
  submittedAt: string;
}

export interface AdminVerificationDetail extends AdminVerificationItem {
  /** 제출 사진 주소. 처리가 끝났거나 사진이 없으면 null. */
  documentUrl: string | null;
  status: AdminVerificationStatus;
}

/** `PATCH /admin/verifications/{verificationId}` 본문. 사유는 반려일 때만 보낸다. */
export interface VerificationDecisionInput {
  decision: AdminDecision;
  rejectReason?: string;
}

/** 반려 사유 최대 글자 수(명세 U-08 `reject_reason` "100자 이내"). */
export const REJECT_REASON_MAX = 100;

export const SUBJECT_ROLE_LABEL: Record<VerificationSubjectRole, string> = {
  HIGH_SCHOOL: '고교생',
  UNIVERSITY: '대학생',
};

/** 목록 카드 줄의 끝말: 고교생은 재학, 대학생은 학교를 확인한다. */
export const SUBJECT_CHECK_LABEL: Record<VerificationSubjectRole, string> = {
  HIGH_SCHOOL: '재학 확인',
  UNIVERSITY: '학교 확인',
};

/** 처리 결과 칩(A02). 대기는 칩이 없다. */
export const DECISION_RESULT: Record<AdminDecision, { label: string; tone: Tone }> = {
  APPROVED: { label: '승인', tone: 'success' },
  REJECTED: { label: '반려', tone: 'danger' },
};

export type DocumentView = 'IMAGE' | 'MISSING' | 'DELETED';

/** 증빙 사진 자리가 어떤 모습인지. 처리가 끝난 건은 사진이 지워졌으므로 주소가 와도 DELETED다. */
export function documentView(
  d: Pick<AdminVerificationDetail, 'status' | 'documentUrl'>,
): DocumentView {
  if (d.status !== 'PENDING') return 'DELETED';
  return d.documentUrl ? 'IMAGE' : 'MISSING';
}

/** 반려 사유 입력의 오류 문구(공백을 뺀 길이로 센다). 통과하면 null. */
export function rejectReasonError(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return '반려 사유를 입력해 주세요.';
  if (length > REJECT_REASON_MAX) return `${REJECT_REASON_MAX}자 이내로 적어 주세요.`;
  return null;
}
