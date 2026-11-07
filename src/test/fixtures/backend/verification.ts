// `docs/api/backend-spec.md` U-05 · U-06(재학 인증 제출 · 보호자 동의 요청 · 안내 조회 · 동의/거부)의 응답 예시
// (한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `POST /verifications/enrollment`(U-05) 성공 — 201. */
export const ENROLLMENT_OK = {
  code: 'S201',
  message: '인증 요청 완료',
  data: { verification_id: 10, status: 'PENDING', submitted_at: '2026-11-04T21:00:00+09:00' },
};

/** `POST /verifications/enrollment` 형식 · 용량 오류 — 400. */
export const ENROLLMENT_INVALID = {
  code: 'E400',
  message: '요청 값이 유효하지 않습니다',
  data: null,
  errors: [{ field: 'document', reason: 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요' }],
};

/** `POST /verifications/enrollment` 이미 심사 중이거나 승인됨 — 409. */
export const ENROLLMENT_SUBMITTED = {
  code: 'E409_ALREADY_SUBMITTED',
  message: '이미 심사 중이거나 승인된 인증입니다',
  data: null,
};

/** `POST /guardian-consents`(U-06) 성공 — 201. */
export const CONSENT_REQUESTED = {
  code: 'S201',
  message: '동의 요청 완료',
  data: { status: 'PENDING', expires_at: '2026-11-11T21:00:00+09:00' },
};

/** `POST /guardian-consents` 진행 중이거나 동의 완료 — 409. */
export const CONSENT_EXISTS = {
  code: 'E409_CONSENT_EXISTS',
  message: '이미 요청했거나 동의가 완료되었습니다',
  data: null,
};

/** `GET /guardian-consents/{consentToken}`(U-06) 성공. */
export const CONSENT_VIEW = {
  code: 'S200',
  message: '조회 성공',
  data: {
    student_name: '김하늘',
    school_name: '용인고등학교',
    guide_text: '용용톤은 방학 중 대학생 가이드와 캠퍼스를 둘러보는 서비스입니다 ...',
    status: 'PENDING',
    expires_at: '2026-11-11T21:00:00+09:00',
  },
};

/** `GET /guardian-consents/{consentToken}` 만료된 링크 — 410. */
export const CONSENT_EXPIRED = {
  code: 'E410_EXPIRED',
  message: '만료된 링크입니다. 학생에게 다시 요청해 달라고 알려주세요',
  data: null,
};

/** `PATCH /guardian-consents/{consentToken}`(U-06) 성공. */
export const CONSENT_DECIDED = {
  code: 'S200',
  message: '처리 완료',
  data: { status: 'AGREED' },
};

/** `PATCH /guardian-consents/{consentToken}` 이미 처리됨 — 409. */
export const CONSENT_PROCESSED = {
  code: 'E409_ALREADY_PROCESSED',
  message: '이미 처리된 요청입니다',
  data: null,
};

/** `PATCH /guardian-consents/{consentToken}` 만료된 링크 — 410. */
export const CONSENT_DECIDE_EXPIRED = {
  code: 'E410_EXPIRED',
  message: '만료된 링크입니다',
  data: null,
};
