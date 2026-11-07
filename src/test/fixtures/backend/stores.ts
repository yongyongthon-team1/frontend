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
