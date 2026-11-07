import type { WireMe } from '@/features/auth/wire';
import type { GuardianStatus } from '@/features/auth/model';
import { request, upload } from '@/shared/lib/http';
import type { ConsentDecision, ConsentView, EnrollmentSubmit, GuardianConsentInput } from './model';
import {
  fromWireConsentView,
  type WireConsentDecided,
  type WireConsentRequested,
  type WireConsentView,
  type WireEnrollment,
} from './wire';

// 재학 인증 제출(U-05)과 보호자 동의(U-06). 새 `Me`를 돌려주지 않는 쓰기는 훅이 `GET /users/me`를 다시 읽는다.

/** 보호자 조회 · 결정의 오류 읽기(2B′-R9): 404는 잘못된 링크, 410은 만료(기본 표는 410을 쿠폰 만료로 읽는다). */
const CONSENT_ERROR_MAP = {
  E404: 'CONSENT_LINK_INVALID',
  E410_EXPIRED: 'CONSENT_LINK_EXPIRED',
} as const;

const consentPath = (token: string) => `/guardian-consents/${encodeURIComponent(token)}`;

/**
 * U-05 `POST /verifications/enrollment`(multipart). 칸 이름은 snake로 직접 쓴다 — 고교생 `school_name`, 대학생 `campus_id`(문자열),
 * 둘 다 `document`. 상태는 PENDING이 된다. 형식 · 용량 오류는 400 `errors[document]`(`fieldErrors.document`), 심사 중이거나 승인되면
 * `E409_ALREADY_SUBMITTED` → `ALREADY_PROCESSED`, 본문 없는 413은 `FILE_TOO_LARGE`. 응답 본문은 쓰지 않는다.
 */
export async function postEnrollment(input: EnrollmentSubmit): Promise<void> {
  const form = new FormData();
  if (input.role === 'HIGH_SCHOOL') form.set('school_name', input.schoolName.trim());
  else form.set('campus_id', String(input.universityId));
  form.set('document', input.document);
  await upload<WireEnrollment>('/verifications/enrollment', form);
}

/**
 * U-06 `POST /guardian-consents` 본문 `{ guardian_name, guardian_email }`. 상태는 PENDING이 되고 링크는 7일 뒤 만료된다.
 * 진행 중이거나 동의 완료면 `E409_CONSENT_EXISTS` → `ALREADY_PROCESSED`. 응답 본문은 쓰지 않는다.
 */
export async function postGuardianConsent(input: GuardianConsentInput): Promise<void> {
  await request<WireConsentRequested>('/guardian-consents', {
    method: 'POST',
    body: { guardianName: input.guardianName.trim(), guardianEmail: input.guardianEmail.trim() },
  });
}

/** U-06 `GET /guardian-consents/{consentToken}`. 로그인 없이(`auth: false`) — 토큰이 곧 인증 수단이고, 401이 지금 세션을 끊지 않는다. */
export async function getConsent(token: string): Promise<ConsentView> {
  const wire = await request<WireConsentView>(consentPath(token), {
    auth: false,
    errorMap: CONSENT_ERROR_MAP,
  });
  return fromWireConsentView(wire);
}

/** U-06 `PATCH /guardian-consents/{consentToken}` 본문 `{ agree }`. 처리한 요청은 바꿀 수 없다(409 `ALREADY_PROCESSED`). 돌려주는 값은 새 상태. */
export async function patchConsent(
  token: string,
  decision: ConsentDecision,
): Promise<GuardianStatus> {
  const wire = await request<WireConsentDecided>(consentPath(token), {
    method: 'PATCH',
    body: { agree: decision === 'AGREED' },
    auth: false,
    errorMap: CONSENT_ERROR_MAP,
  });
  return wire.status;
}

/**
 * 목업 전용 확장 `guardian_consent_token`(2B′-R10): 동의 대기인 고교생의 `GET /users/me`에만 붙는다. 실서버(확장 없음)에서는 null이라
 * `/verify`가 시연 도구를 그리지 않는다. `Me`에 토큰을 넣지 않으려고 같은 엔드포인트를 한 번 더 읽는다(errata PM8).
 */
export async function getDemoConsentToken(): Promise<string | null> {
  const wire = await request<Pick<WireMe, 'guardianConsentToken'>>('/users/me');
  return wire.guardianConsentToken ?? null;
}
