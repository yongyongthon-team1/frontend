import type {
  AdminDecision,
  AdminVerificationDetail,
  AdminVerificationItem,
  AdminVerificationStatus,
  VerificationSubjectRole,
} from './model';

// 백엔드 U-08의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

/** `GET /admin/verifications`의 `items[]`. */
export interface WireAdminItem {
  verificationId: number;
  userName: string;
  role: VerificationSubjectRole;
  schoolName: string;
  submittedAt: string;
}

/** `GET /admin/verifications/{verificationId}`의 `data`. */
export interface WireAdminDetail extends WireAdminItem {
  documentUrl: string | null;
  status: AdminVerificationStatus;
}

/** `PATCH /admin/verifications/{verificationId}`의 `data`. */
export interface WireAdminDecided {
  verificationId: number;
  status: AdminDecision;
  reviewedAt: string;
}

export function fromWireAdminItem(w: WireAdminItem): AdminVerificationItem {
  return {
    id: w.verificationId,
    userName: w.userName,
    role: w.role,
    schoolName: w.schoolName,
    submittedAt: w.submittedAt,
  };
}

export function fromWireAdminDetail(w: WireAdminDetail): AdminVerificationDetail {
  return { ...fromWireAdminItem(w), documentUrl: w.documentUrl, status: w.status };
}
