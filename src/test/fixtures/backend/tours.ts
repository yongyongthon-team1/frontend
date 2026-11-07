import { D01 } from './campuses';
import { fromWireTourDetail, type WireTourDetail } from '@/features/tours/wire';
import type { TourDetail } from '@/features/tours/model';
import { toCamel } from '@/shared/lib/caseKeys';

// `docs/api/backend-spec.md` T. 탐방의 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.

/** `GET /tours`(T-01 보완). */
export const TOURS_LIST = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        tour_id: 31,
        campus_name: '단국대학교 죽전캠퍼스',
        major: '컴퓨터공학과',
        date: '2027-01-15',
        start_time: '13:00',
        capacity: 5,
        remaining: 3,
        status: 'RECRUITING',
        guide: { name: '이준호', verified: true },
      },
    ],
    page: 1,
    size: 20,
    total: 1,
  },
};

/** `GET /tours/{tourId}`(T-02). */
export const TOUR_DETAIL = {
  code: 'S200',
  message: '조회 성공',
  data: {
    tour_id: 31,
    campus_name: '단국대학교 죽전캠퍼스',
    major: '컴퓨터공학과',
    date: '2027-01-15',
    start_time: '13:00',
    end_time: '16:00',
    capacity: 5,
    remaining: 3,
    status: 'RECRUITING',
    intro: '캠퍼스와 근처 맛집을 함께 둘러봐요',
    open_chat_url: null,
    guide: {
      name: '이준호',
      major: '컴퓨터공학과',
      intro: '신입생 때부터 동아리 활동을 했어요',
      verified: true,
    },
    my_application: { application_id: 77, status: 'PENDING' },
  },
};

/** 확장 없는 실서버 경로로 읽은 탐방 31의 상세(캠퍼스 이름 `죽전`이 목록 `주전`과 달라 이름 나누기 대체를 탄다). 다른 도메인의 어댑터 테스트가 쓴다. */
export const TOUR_31: TourDetail = fromWireTourDetail(
  toCamel<WireTourDetail>(TOUR_DETAIL.data),
  D01,
);

/** `POST /tours`(T-03) 성공 — 201. */
export const TOUR_CREATED = {
  code: 'S201',
  message: '탐방 개설 성공',
  data: { tour_id: 31, status: 'RECRUITING' },
};

/** `POST /tours`(T-03) 방학 기간 밖 날짜 — 400. */
export const TOUR_OUTSIDE_VACATION = {
  code: 'E400',
  message: '요청 값이 유효하지 않습니다',
  data: null,
  errors: [{ field: 'date', reason: '방학 기간 안의 날짜만 선택할 수 있어요' }],
};

/** `POST /tours`(T-03) 가이드 프로필 없음 — 409. */
export const TOUR_PROFILE_REQUIRED = {
  code: 'E409_GUIDE_PROFILE_REQUIRED',
  message: '가이드 프로필을 먼저 등록해 주세요',
  data: null,
};

/** `POST /tours/{tourId}/cancel`(T-05) 성공 — 200. */
export const TOUR_CANCELED = {
  code: 'S200',
  message: '탐방 취소 완료',
  data: { tour_id: 31, status: 'CANCELED' },
};

/** `POST /tours/{tourId}/cancel`(T-05) 취소할 수 없는 상태 — 409. */
export const TOUR_CANCEL_INVALID = {
  code: 'E409_INVALID_TOUR_STATUS',
  message: '이미 완료되었거나 취소된 탐방입니다',
  data: null,
};

/** `POST /tours/{tourId}/complete`(T-06) 성공 — 200. */
export const TOUR_COMPLETED = {
  code: 'S200',
  message: '탐방 완료 처리',
  data: { tour_id: 31, status: 'COMPLETED' },
};

/** `POST /tours/{tourId}/complete`(T-06) 완료할 수 없는 상태 — 409. */
export const TOUR_COMPLETE_INVALID = {
  code: 'E409_INVALID_TOUR_STATUS',
  message: '탐방 날짜 이후에만 완료 처리할 수 있어요',
  data: null,
};
