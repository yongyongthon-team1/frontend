import { listAll, request } from '@/shared/lib/http';
import type {
  AdminVerificationDetail,
  AdminVerificationItem,
  VerificationDecisionInput,
} from './model';
import {
  fromWireAdminDetail,
  fromWireAdminItem,
  type WireAdminDecided,
  type WireAdminDetail,
  type WireAdminItem,
} from './wire';

// 운영자 인증 심사(U-08). 목록은 `status` 없이 부른다 — 서버 기본이 PENDING이다(2B′-R11).
// 이미 심사된 요청의 `E409_ALREADY_REVIEWED`는 기본 표가 `ALREADY_PROCESSED`로 읽는다.

const verificationPath = (id: number) => `/admin/verifications/${id}`;

/** U-08 `GET /admin/verifications`: 심사 대기 전체(오래된 제출 먼저). */
export async function listPendingVerifications(): Promise<AdminVerificationItem[]> {
  const rows = await listAll<WireAdminItem>('/admin/verifications');
  return rows.map(fromWireAdminItem);
}

/** U-08 `GET /admin/verifications/{verificationId}`. 처리된 건도 열린다(사진 주소는 비어 있다). */
export async function getAdminVerification(id: number): Promise<AdminVerificationDetail> {
  return fromWireAdminDetail(await request<WireAdminDetail>(verificationPath(id)));
}

/**
 * U-08 `PATCH /admin/verifications/{verificationId}` 본문 `{ decision, reject_reason }`(사유는 반려일 때만, 100자 이내).
 * 되돌릴 수 없다 — 사진이 지워지고 이미 심사한 요청은 409다. 응답 본문은 쓰지 않는다.
 */
export async function patchAdminVerification(
  id: number,
  body: VerificationDecisionInput,
): Promise<void> {
  const payload =
    body.decision === 'REJECTED'
      ? { decision: body.decision, rejectReason: body.rejectReason?.trim() }
      : { decision: body.decision };
  await request<WireAdminDecided>(verificationPath(id), { method: 'PATCH', body: payload });
}
