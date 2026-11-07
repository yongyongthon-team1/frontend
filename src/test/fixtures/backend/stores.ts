// `docs/api/backend-spec.md` S-01 보완 `GET /users/me/store`(내 가게 조회)와 S-01 `PATCH /users/me/store`(가게 수정)의 응답 예시
// (한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.
export const MY_STORE = {
  code: 'S200',
  message: '조회 성공',
  data: {
    store_id: 201,
    name: '용인 분식',
    address: '경기 용인시 처인구 ...',
    category: '식당',
    partnership: {
      discount_text: '음료 1,000원 할인',
      start_date: '2027-01-01',
      end_date: '2027-02-28',
    },
  },
};

export const MY_STORE_PATCHED = {
  code: 'S200',
  message: '수정 성공',
  data: {
    store_id: 201,
    name: '용인 분식',
    address: '경기 용인시 처인구 ...',
    category: '식당',
    partnership: null,
  },
};

// `docs/api/backend-spec.md` S-07 `GET /users/me/store/report`(방문 · 리뷰 리포트 조회)의 응답 예시(한 글자도 바꾸지 않았다).
export const STORE_REPORT = {
  code: 'S200',
  message: '조회 성공',
  data: {
    from: '2027-01-01',
    to: '2027-01-31',
    visit_count: 18,
    review_count: 11,
    average_rating: 4.5,
  },
};

// `docs/api/backend-spec.md` S-02 `GET /stores/nearby`(주변 상점 조회)의 응답 예시(한 글자도 바꾸지 않았다).
export const NEARBY_STORES = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        store_id: 202,
        name: '캠퍼스 카페',
        category: '카페',
        address: '경기 용인시 처인구 ...',
        lat: 37.3225,
        lng: 127.1271,
        is_partner: false,
        review_summary: null,
      },
    ],
  },
};

// `docs/api/backend-spec.md` U-07 `POST /verifications/business`(사업자 인증)의 성공 · 불일치 응답 예시(한 글자도 바꾸지 않았다).
export const BUSINESS_OK = {
  code: 'S200',
  message: '사업자 인증 완료',
  data: { status: 'APPROVED' },
};

export const BUSINESS_INVALID = {
  code: 'E422_BUSINESS_INVALID',
  message: '사업자 정보를 확인할 수 없습니다',
  data: null,
  errors: [{ field: 'business_number', reason: 'MISMATCH' }],
};

// `docs/api/backend-spec.md` S-01 `GET /stores/search`(상점 검색)의 응답 예시(한 글자도 바꾸지 않았다).
export const STORE_SEARCH = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        store_id: 201,
        name: '용인 분식',
        address: '경기 용인시 처인구 ...',
        category: '식당',
        is_registered: false,
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};

// `docs/api/backend-spec.md` S-01 `POST /users/me/store`(가게 등록)의 성공 · 409 응답 예시(한 글자도 바꾸지 않았다).
export const STORE_REGISTERED = {
  code: 'S201',
  message: '가게 등록 성공',
  data: { store_id: 201, name: '용인 분식', address: '경기 용인시 처인구 ...', category: '식당' },
};

export const STORE_UNAVAILABLE = {
  code: 'E409_STORE_UNAVAILABLE',
  message: '연결할 수 없는 상점입니다',
  data: null,
};

// `docs/api/backend-spec.md` S-03 `PUT /users/me/store/partnership`(제휴 할인 설정)의 응답 예시(한 글자도 바꾸지 않았다).
export const PARTNERSHIP_SAVED = {
  code: 'S200',
  message: '저장 성공',
  data: { discount_text: '음료 1,000원 할인', start_date: '2027-01-01', end_date: '2027-02-28' },
};
