// `docs/api/backend-spec.md` S-05 · S-06 쿠폰의 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `GET /users/me/coupons`(S-05) 성공. */
export const MY_COUPONS = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        coupon_id: 501,
        code: '483920',
        tour_id: 31,
        store: { store_id: 201, name: '용인 분식' },
        discount_text: '음료 1,000원 할인',
        status: 'ISSUED',
        valid_until: '2027-01-15T23:59:59+09:00',
        used_at: null,
        reviewed: false,
      },
    ],
  },
};

/** `GET /coupons/{couponCode}`(S-06) 성공. */
export const COUPON_LOOKUP = {
  code: 'S200',
  message: '조회 성공',
  data: {
    coupon_id: 501,
    code: '483920',
    discount_text: '음료 1,000원 할인',
    tour_date: '2027-01-15',
    status: 'ISSUED',
    valid_until: '2027-01-15T23:59:59+09:00',
  },
};

/** `GET /coupons/{couponCode}` · `POST /coupons/{couponCode}/redeem`(S-06) 다른 가게 쿠폰 — 403. */
export const COUPON_OTHER_STORE = {
  code: 'E403_OTHER_STORE',
  message: '다른 가게의 쿠폰입니다',
  data: null,
};

/** `POST /coupons/{couponCode}/redeem`(S-06) 성공. */
export const REDEEM_OK = {
  code: 'S200',
  message: '사용 처리 완료',
  data: { coupon_id: 501, status: 'USED', used_at: '2027-01-15T13:40:00+09:00' },
};

/** 사용 처리 — 이미 사용됨, 409. */
export const REDEEM_ALREADY_USED = {
  code: 'E409_ALREADY_USED',
  message: '이미 사용된 쿠폰입니다',
  data: null,
};

/** 사용 처리 — 만료됨, 410. */
export const REDEEM_EXPIRED = {
  code: 'E410_EXPIRED',
  message: '만료된 쿠폰입니다',
  data: null,
};

/** 사용 처리 — 오늘 이미 다른 쿠폰 사용됨, 409. */
export const REDEEM_DAILY_LIMIT = {
  code: 'E409_DAILY_LIMIT',
  message: '오늘 이미 다른 쿠폰이 사용되었습니다',
  data: null,
};
