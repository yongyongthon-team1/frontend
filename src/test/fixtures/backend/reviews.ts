// `docs/api/backend-spec.md` R-01 · R-02 리뷰의 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `GET /stores/{storeId}/reviews`(R-02) 성공. */
export const STORE_REVIEWS = {
  code: 'S200',
  message: '조회 성공',
  data: {
    summary: '양이 많고 가격이 착하다는 평이 많아요',
    average_rating: 4.5,
    review_count: 11,
    items: [
      {
        review_id: 90,
        rating: 5,
        content: '양도 많고 맛있었어요',
        author: '김*늘',
        created_at: '2027-01-15T15:00:00+09:00',
      },
    ],
    page: 1,
    size: 20,
    total: 11,
  },
};

/** `POST /stores/{storeId}/reviews`(R-01) 성공 — 201. */
export const REVIEW_CREATED = {
  code: 'S201',
  message: '리뷰 작성 성공',
  data: {
    review_id: 90,
    store_id: 201,
    rating: 5,
    content: '양도 많고 맛있었어요',
    created_at: '2027-01-15T15:00:00+09:00',
  },
};

/** `POST /stores/{storeId}/reviews`(R-01) 쿠폰 미사용 — 403. */
export const REVIEW_NOT_USED = {
  code: 'E403_COUPON_NOT_USED',
  message: '쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요',
  data: null,
};

/** `POST /stores/{storeId}/reviews`(R-01) 이미 작성함 — 409. */
export const REVIEW_ALREADY = {
  code: 'E409_ALREADY_REVIEWED',
  message: '이미 리뷰를 작성했습니다',
  data: null,
};
