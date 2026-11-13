// `docs/api/backend-spec.md` T-04 · A. 신청의 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `GET /users/me/tours`(T-04) 고교생 — 내가 신청한 탐방. */
export const MY_TOURS_HIGH_SCHOOL = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        tour_id: 31,
        campus_name: '단국대학교 죽전캠퍼스',
        date: '2027-01-15',
        tour_status: 'RECRUITING',
        application_id: 77,
        application_status: 'APPROVED',
        course_confirmed: true,
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};

/** `GET /users/me/tours`(T-04) 대학생 — 내가 개설한 탐방. */
export const MY_TOURS_UNIVERSITY = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        tour_id: 31,
        date: '2027-01-15',
        tour_status: 'RECRUITING',
        capacity: 5,
        approved_count: 2,
        pending_count: 3,
        course_confirmed: false,
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};

/** `POST /tours/{tourId}/applications`(A-01) 성공 — 201. */
export const APPLY_OK = {
  code: 'S201',
  message: '신청 완료',
  data: {
    application_id: 77,
    tour_id: 31,
    status: 'PENDING',
    created_at: '2026-11-04T21:00:00+09:00',
  },
};

/** A-01 인증 · 보호자 동의 전 — 403. */
export const APPLY_NOT_VERIFIED = {
  code: 'E403_VERIFICATION_REQUIRED',
  message: '인증 후 신청할 수 있어요',
  data: null,
};

/** A-01 정원 마감 · 모집 종료 — 409. */
export const APPLY_FULL = {
  code: 'E409_TOUR_FULL',
  message: '신청할 수 없는 투어입니다',
  data: null,
};

/** A-01 이미 신청 — 409. */
export const APPLY_DUPLICATE = {
  code: 'E409_ALREADY_APPLIED',
  message: '이미 신청한 투어입니다',
  data: null,
};

/** `PATCH /applications/{applicationId}/decision`(A-02) 성공. */
export const DECISION_OK = {
  code: 'S200',
  message: '처리 완료',
  data: { application_id: 77, status: 'APPROVED', tour_status: 'CLOSED' },
};

/** A-02 정원 초과 — 409. */
export const DECISION_FULL = {
  code: 'E409_TOUR_FULL',
  message: '정원이 모두 찼습니다',
  data: null,
};

/** `POST /applications/{applicationId}/cancel`(A-03) 성공. */
export const CANCEL_OK = {
  code: 'S200',
  message: '신청 취소 완료',
  data: { application_id: 77, status: 'CANCELED' },
};

/** A-03 취소할 수 없는 상태 — 409. */
export const CANCEL_INVALID = {
  code: 'E409_INVALID_APPLICATION_STATUS',
  message: '취소할 수 없는 신청입니다',
  data: null,
};

/** `GET /tours/{tourId}/applications`(A-04). 작은 목록이라 `items`만 온다. */
export const APPLICANTS_LIST = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        application_id: 77,
        name: '김하늘',
        grade: 2,
        wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
        status: 'PENDING',
        created_at: '2026-11-04T21:00:00+09:00',
      },
    ],
  },
};
