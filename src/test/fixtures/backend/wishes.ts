// `docs/api/backend-spec.md` T. 탐방의 희망 사항 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `POST /tour-wishes`(T-01). */
export const WISH_CREATED = {
  code: 'S201',
  message: '등록 성공',
  data: {
    wish_id: 5,
    campus_id: 1,
    major: '컴퓨터공학',
    wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
    date: '2027-01-15',
    created_at: '2026-11-06T10:14:00+09:00',
  },
};

/** `GET /users/me/tour-wishes`(T-01 보완 · T-07). */
export const MY_WISHES = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        wish_id: 5,
        campus_name: '단국대학교 죽전캠퍼스',
        major: '컴퓨터공학',
        wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
        created_at: '2026-11-04T21:00:00+09:00',
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};

/** `PATCH /users/me/tour-wishes/{wishId}`(T-01 보완 · T-07). */
export const WISH_UPDATED = {
  code: 'S200',
  message: '수정 성공',
  data: {
    wish_id: 5,
    campus_name: '단국대학교 죽전캠퍼스',
    major: '컴퓨터공학',
    wish: '동아리 구경하고 학식도 먹어보고 싶어요',
    date: '2027-01-16',
    updated_at: '2026-11-05T19:30:00+09:00',
  },
};

/** `GET /tour-wishes`(T-01 보완 · T-08, 대학생). */
export const GUIDE_WISHES = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        wish_id: 5,
        campus_name: '단국대학교 죽전캠퍼스',
        major: '컴퓨터공학',
        wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
        created_at: '2026-11-04T21:00:00+09:00',
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};
