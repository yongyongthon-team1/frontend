import { describe, expect, it } from 'vitest';
import { toCamel } from '@/shared/lib/caseKeys';
import { CAMPUS_PLACES } from '@/test/fixtures/backend/campuses';
import { COURSE_DRAFT, COURSE_VIEW } from '@/test/fixtures/backend/courses';
import { NEARBY_STORES } from '@/test/fixtures/backend/stores';
import { TOUR_31 } from '@/test/fixtures/backend/tours';
import { COURSE_CRITERIA, type CourseStop } from './model';
import {
  fromWireCampusPlace,
  fromWireCourse,
  fromWireNearbyStore,
  type WireCampusPlace,
  type WireCourse,
  type WireNearbyStore,
} from './wire';

const view = () => toCamel<WireCourse>(COURSE_VIEW.data);

describe('fromWireCourse (Review Focus 1: 확장 없는 실서버 응답)', () => {
  it('명세 C-04 예시: 지점 id는 order, 제휴 문구는 대체값, 리뷰 수 없이도 AI 요약', () => {
    const course = fromWireCourse(view(), TOUR_31);
    expect(course.stops[0]).toEqual({
      id: 1,
      order: 1,
      visitTime: '13:00',
      type: 'STORE',
      name: '용인 분식',
      category: '식당',
      lat: 37.3219,
      lng: 127.1268,
      description: '학생들이 즐겨 가는 분식집이에요',
      recommendationReason: '신청자들이 맛집을 가고 싶다고 적었어요',
      storeId: 201,
      campusBuildingId: null,
      partnership: { discount: '쿠폰 사용 가능' },
      review: { average: null, count: 0, summary: '양이 많고 가격이 착하다는 평이 많아요' },
      dataSource: '공공데이터(인허가) 기반',
    } satisfies CourseStop);
    expect(course.stops[1]).toEqual({
      id: 2,
      order: 2,
      visitTime: '14:30',
      type: 'CAMPUS',
      name: '중앙도서관',
      category: '캠퍼스',
      lat: 37.3226,
      lng: 127.1261,
      description: '시험 기간엔 24시간 열려요',
      recommendationReason: null,
      storeId: null,
      campusBuildingId: 3,
      partnership: null,
      review: null,
      dataSource: null,
    } satisfies CourseStop);
  });

  it('코스: 탐방 정보는 상세에서, 확정 코스의 쿠폰 수는 승인 수 × 제휴 지점 수', () => {
    const course = fromWireCourse(view(), TOUR_31);
    expect(course).toMatchObject({
      tourId: 31,
      status: 'CONFIRMED',
      tour: {
        id: 31,
        title: '단국대 죽전캠퍼스 컴퓨터공학과 탐방',
        universityId: 0,
        universityShortName: '단국대',
        campusName: '죽전캠퍼스',
        startsAt: '2027-01-15T13:00:00+09:00',
        endsAt: '2027-01-15T16:00:00+09:00',
      },
      interests: [],
      confirmedAt: null,
      issuedCouponCount: 2, // 승인 2(정원 5 − 남은 3) × 제휴 1
    });
    expect(course.criteria).toBe(COURSE_CRITERIA);
  });

  it('초안이면 쿠폰 수 대체값은 0', () => {
    const draft = fromWireCourse(toCamel<WireCourse>(COURSE_DRAFT.data), TOUR_31);
    expect(draft).toMatchObject({ status: 'DRAFT', issuedCouponCount: 0 });
    expect(draft.stops).toHaveLength(1);
  });

  it('목업 확장(spot_id · discount_text · review_average · review_count · coupon_count)이 있으면 그 값', () => {
    const wire = view();
    const course = fromWireCourse(
      {
        ...wire,
        couponCount: 6,
        spots: [
          {
            ...wire.spots[0],
            spotId: 900,
            discountText: '음료 1,000원 할인',
            reviewAverage: 4.5,
            reviewCount: 11,
          },
          { ...wire.spots[1], spotId: 901 },
        ],
      },
      TOUR_31,
    );
    expect(course.issuedCouponCount).toBe(6);
    expect(course.stops[0]).toMatchObject({
      id: 900,
      partnership: { discount: '음료 1,000원 할인' },
      review: { average: 4.5, count: 11, summary: '양이 많고 가격이 착하다는 평이 많아요' },
    });
    expect(course.stops[1].id).toBe(901);
  });

  it('지점은 order 순서로 읽는다', () => {
    const wire = view();
    const course = fromWireCourse({ ...wire, spots: [wire.spots[1], wire.spots[0]] }, TOUR_31);
    expect(course.stops.map((s) => s.order)).toEqual([1, 2]);
  });
});

describe('주변 상점 · 캠퍼스 장소 (S-02 · C-02 보완)', () => {
  it('명세 S-02 예시 → NearbyStore, 거리는 기준점(캠퍼스 중심)에서 잰 미터', () => {
    const store = fromWireNearbyStore(toCamel<WireNearbyStore>(NEARBY_STORES.data.items[0]), {
      lat: 37.3219,
      lng: 127.1268,
    });
    expect(store).toEqual({
      storeId: 202,
      name: '캠퍼스 카페',
      category: '카페',
      address: '경기 용인시 처인구 ...',
      lat: 37.3225,
      lng: 127.1271,
      isPartner: false,
      reviewSummary: null,
      distanceM: expect.any(Number),
    });
    expect(Math.round(store.distanceM)).toBe(72);
  });

  it('명세 C-02 보완 예시 → CampusPlace', () => {
    expect(fromWireCampusPlace(toCamel<WireCampusPlace>(CAMPUS_PLACES.data.items[0]))).toEqual({
      campusBuildingId: 3,
      name: '중앙도서관',
      description: '24시간 열람실이 있어요',
      lat: 37.3226,
      lng: 127.1261,
    });
  });
});
