// `docs/api/backend-spec.md` C. 코스의 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `POST /tours/{tourId}/course`(C-01) 성공 — 201. */
export const COURSE_DRAFT = {
  code: 'S201',
  message: '코스 초안 생성 완료',
  data: {
    tour_id: 31,
    status: 'DRAFT',
    spots: [
      {
        order: 1,
        stop_type: 'STORE',
        store_id: 201,
        campus_building_id: null,
        name: '용인 분식',
        category: '식당',
        address: '경기 용인시 처인구 ...',
        lat: 37.3219,
        lng: 127.1268,
        start_time: '13:00',
        reason: '신청자들이 맛집을 가고 싶다고 적었어요',
        comment: null,
        is_partner: true,
        review_summary: null,
      },
    ],
  },
};

/** `PUT /tours/{tourId}/course/spots`(C-02) 성공. */
export const COURSE_SPOTS_OK = {
  code: 'S200',
  message: '수정 완료',
  data: {
    tour_id: 31,
    status: 'DRAFT',
    spots: [
      {
        order: 1,
        stop_type: 'STORE',
        store_id: 201,
        campus_building_id: null,
        name: '용인 분식',
        category: '식당',
        address: '경기 용인시 처인구 ...',
        lat: 37.3219,
        lng: 127.1268,
        start_time: '13:00',
        reason: '신청자들이 맛집을 가고 싶다고 적었어요',
        comment: '학생들이 즐겨 가는 분식집이에요',
        is_partner: true,
        review_summary: null,
      },
      {
        order: 2,
        stop_type: 'CAMPUS',
        store_id: null,
        campus_building_id: 3,
        name: '중앙도서관',
        category: null,
        address: null,
        lat: 37.3226,
        lng: 127.1261,
        start_time: '14:30',
        reason: null,
        comment: '시험 기간엔 24시간 열려요',
        is_partner: false,
        review_summary: null,
      },
    ],
  },
};

/** `POST /tours/{tourId}/course/confirm`(C-03 · S-04) 성공. */
export const COURSE_CONFIRM_OK = {
  code: 'S200',
  message: '코스 확정 완료',
  data: { tour_id: 31, status: 'CONFIRMED', coupon_count: 6 },
};

/** `GET /tours/{tourId}/course`(C-04) 성공. */
export const COURSE_VIEW = {
  code: 'S200',
  message: '조회 성공',
  data: {
    tour_id: 31,
    status: 'CONFIRMED',
    spots: [
      {
        order: 1,
        stop_type: 'STORE',
        store_id: 201,
        campus_building_id: null,
        name: '용인 분식',
        category: '식당',
        address: '경기 용인시 처인구 ...',
        lat: 37.3219,
        lng: 127.1268,
        start_time: '13:00',
        reason: '신청자들이 맛집을 가고 싶다고 적었어요',
        comment: '학생들이 즐겨 가는 분식집이에요',
        is_partner: true,
        review_summary: '양이 많고 가격이 착하다는 평이 많아요',
      },
      {
        order: 2,
        stop_type: 'CAMPUS',
        store_id: null,
        campus_building_id: 3,
        name: '중앙도서관',
        category: null,
        address: null,
        lat: 37.3226,
        lng: 127.1261,
        start_time: '14:30',
        reason: null,
        comment: '시험 기간엔 24시간 열려요',
        is_partner: false,
        review_summary: null,
      },
    ],
  },
};

/** `GET /tours/{tourId}/course`(C-04) 코스 준비 중 — 409. */
export const COURSE_NOT_READY = {
  code: 'E409_COURSE_NOT_READY',
  message: '가이드가 코스를 준비 중이에요',
  data: null,
};
