import { fromWireCampus, type WireCampus } from '@/features/campuses/wire';
import type { University } from '@/features/campuses/model';
import { toCamel } from '@/shared/lib/caseKeys';

// `docs/api/backend-spec.md` D-01 `GET /campuses`의 응답 예시(한 글자도 바꾸지 않았다). 명세 예시에는 timestamp가 없다.
export const CAMPUSES_LIST = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        campus_id: 1,
        name: '단국대학교',
        campus_name: '주전캠퍼스',
        address: '경기 용인시 수지구 주전로 152',
        lat: 37.3219,
        lng: 127.1268,
        vacation_periods: [
          { start_date: '2027-01-01', end_date: '2027-02-28' },
          { start_date: '2027-06-21', end_date: '2027-08-31' },
        ],
      },
    ],
  },
};

/** 확장 없는 실서버 경로로 읽은 캠퍼스 목록(어댑터 테스트가 쓴다). 시드 id(1 = 강남대)와 다르다. */
export const D01: University[] = CAMPUSES_LIST.data.items.map((c) =>
  fromWireCampus(toCamel<WireCampus>(c)),
);

// `docs/api/backend-spec.md` C-02 보완 `GET /campuses/{campusId}/places`(캠퍼스 장소 조회)의 응답 예시(한 글자도 바꾸지 않았다).
export const CAMPUS_PLACES = {
  code: 'S200',
  message: '조회 성공',
  data: {
    items: [
      {
        campus_building_id: 3,
        name: '중앙도서관',
        description: '24시간 열람실이 있어요',
        lat: 37.3226,
        lng: 127.1261,
      },
    ],
  },
};
