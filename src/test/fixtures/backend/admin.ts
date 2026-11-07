// `docs/api/backend-spec.md` U-08(운영자 인증 심사 목록 · 상세 · 승인/반려)의 응답 예시
// (한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `GET /admin/verifications`(U-08 보완) 성공. */
export const ADMIN_VERIFICATIONS = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        verification_id: 10,
        user_name: '김하늘',
        role: 'HIGH_SCHOOL',
        school_name: '용인고등학교',
        submitted_at: '2026-11-04T21:00:00+09:00',
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};

/** `GET /admin/verifications/{verificationId}`(U-08 보완) 성공. */
export const ADMIN_VERIFICATION = {
  code: 'S200',
  message: '조회 성공',
  data: {
    verification_id: 10,
    user_name: '김하늘',
    role: 'HIGH_SCHOOL',
    school_name: '용인고등학교',
    document_url: 'https://.../temp-signed-url',
    status: 'PENDING',
    submitted_at: '2026-11-04T21:00:00+09:00',
  },
};

/** `PATCH /admin/verifications/{verificationId}`(U-08) 성공. */
export const ADMIN_DECIDED = {
  code: 'S200',
  message: '심사 완료',
  data: { verification_id: 10, status: 'REJECTED', reviewed_at: '2026-11-04T21:30:00+09:00' },
};

/** `PATCH /admin/verifications/{verificationId}` 이미 심사됨 — 409. */
export const ADMIN_ALREADY_REVIEWED = {
  code: 'E409_ALREADY_REVIEWED',
  message: '이미 심사가 끝난 요청입니다',
  data: null,
};
