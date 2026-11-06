import { beforeEach, describe, expect, it } from 'vitest';
import type { DB, StoreRow } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import { COURSE_CRITERIA, COURSE_RADIUS_M, generateCourseDraft } from './course';

const today = new Date('2026-11-15T01:00:00Z'); // 시연일 KST 10:00, 탐방 1은 그날 14:00

let db: DB;
beforeEach(() => {
  db = createSeed(today, 'APPROVED'); // 탐방 1 승인: 박서준 · 이하은 · 김민지
});

const storeIdsOf = (stops: { storeId: number | null }[]) => stops.map((s) => s.storeId);
const partnershipIdsOf = (stops: { partnershipId: number | null }[]) =>
  stops.map((s) => s.partnershipId);
const store = (storeId: number) => db.stores.find((s) => s.id === storeId)!;
/** 이 상점들의 제휴 행을 지운다. */
const dropPartnerships = (...storeIds: number[]) => {
  db.partnerships = db.partnerships.filter((p) => !storeIds.includes(p.storeId));
};
/** 경희대 근처에 상점을 하나 더 넣는다. `partnershipId`를 주면 오늘 유효한 제휴도 넣는다. */
function addStore(
  row: Pick<StoreRow, 'name' | 'category' | 'latitude' | 'longitude'>,
  partnershipId?: number,
) {
  const s: StoreRow = {
    ...row,
    id: db.stores.length + 1,
    ownerId: null,
    address: '경기도 용인시 기흥구 서천동',
    administrativeDong: '서천동',
    createdAt: '2026-09-16T09:00:00+09:00',
    updatedAt: '2026-09-16T09:00:00+09:00',
  };
  db.stores.push(s);
  if (partnershipId !== undefined) {
    db.partnerships.push({
      id: partnershipId,
      storeId: s.id,
      discountDescription: '음료 500원 할인',
      condition: null,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      createdAt: '2026-09-16T09:00:00+09:00',
      updatedAt: '2026-09-16T09:00:00+09:00',
    });
  }
  return s;
}
const setMotivation = (email: string, tourId: number, motivation: string) => {
  const userId = db.users.find((u) => u.email === email)!.id;
  db.applications.find((a) => a.tourId === tourId && a.userId === userId)!.motivation = motivation;
};

describe('상수', () => {
  it('추천 상점 기준 문구와 반경', () => {
    expect(COURSE_CRITERIA).toBe(
      '신청자들이 적은 하고 싶은 것 → 관련 업종 상점 매칭(인허가 공공데이터) · 제휴 상점 1곳 이상 포함',
    );
    expect(COURSE_RADIUS_M).toBe(1000);
  });
});

describe('generateCourseDraft', () => {
  it('코스 초안: 캠퍼스 → 식사 → 카페, 14:00/15:10/16:00, 제휴 1곳 이상', () => {
    const { stops } = generateCourseDraft(db, 1);
    expect(stops[0].stopType).toBe('CAMPUS');
    expect(stops.map((s) => s.visitTime)).toEqual(['14:00', '15:10', '16:00']);
    expect(stops.some((s) => s.partnershipId !== null)).toBe(true);
  });

  it('시연 초안 전체: 예술·디자인대학 → 서천 밥상 → 카페 모래시계와 이유 · 관심사', () =>
    expect(generateCourseDraft(db, 1)).toEqual({
      interests: ['전공 수업', '캠퍼스 시설', '식사', '카페'],
      stops: [
        {
          stopType: 'CAMPUS',
          campusBuildingId: 3, // 예술·디자인대학
          storeId: null,
          partnershipId: null,
          stopOrder: 1,
          visitTime: '14:00',
          description: null,
          recommendationReason: '산업디자인학과 전공 공간에서 실제 수업 이야기를 들어요.',
        },
        {
          stopType: 'STORE',
          campusBuildingId: null,
          storeId: 1, // 서천 밥상
          partnershipId: 1,
          stopOrder: 2,
          visitTime: '15:10',
          description: null,
          // 식사 의도: 박서준 · 김민지(신청 id 순서로 박서준이 먼저)
          recommendationReason:
            '신청자 2명이 "학생들이 자주 가는 밥집이 궁금해요"를 궁금해했어요. 학생들은 양이 넉넉하고 사장님이 친절하다고 해요.',
        },
        {
          stopType: 'STORE',
          campusBuildingId: null,
          storeId: 2, // 카페 모래시계
          partnershipId: 2,
          stopOrder: 3,
          visitTime: '16:00',
          description: null,
          // 카페 의도: 이하은. 동기 앞 20자만 인용한다.
          recommendationReason:
            '신청자 1명이 "카페에서 과제하는 분위기를 보고 싶어"를 궁금해했어요. 콘센트 자리가 많아 과제하기 좋다는 평이 많아요.',
        },
      ],
    }));

  it('승인자 동기에 생활 의도가 없으면 식사 · 카페, 인용 없이 리뷰 요약(없으면 기본 문장)', () => {
    // 단국대 탐방 2: 승인 3명 모두 '커뮤니케이션디자인 수업이 어떤지 궁금해요'
    expect(generateCourseDraft(db, 2)).toEqual({
      interests: ['전공 수업', '캠퍼스 시설', '식사', '카페'],
      stops: [
        {
          stopType: 'CAMPUS',
          campusBuildingId: 6, // 이름에 '디자인'이 든 장소가 없어 첫 장소(소프트웨어융합대학)
          storeId: null,
          partnershipId: null,
          stopOrder: 1,
          visitTime: '10:00',
          description: null,
          recommendationReason: '커뮤니케이션디자인학과 전공 공간에서 실제 수업 이야기를 들어요.',
        },
        {
          stopType: 'STORE',
          campusBuildingId: null,
          storeId: 5, // 죽전 돼지국밥(비제휴)
          partnershipId: null,
          stopOrder: 2,
          visitTime: '11:10',
          description: null,
          recommendationReason: '학생들이 자주 찾는 곳이에요.',
        },
        {
          stopType: 'STORE',
          campusBuildingId: null,
          storeId: 6, // 카페 단풍(비제휴)
          partnershipId: null,
          stopOrder: 3,
          visitTime: '12:00',
          description: null,
          recommendationReason: '학생들이 자주 찾는 곳이에요.',
        },
      ],
    });

    for (const email of ['seojun@demo.kr', 'haeun@demo.kr', 'student@demo.kr']) {
      setMotivation(email, 1, '대학 수업이 궁금해요');
    }
    expect(generateCourseDraft(db, 1).stops.map((s) => s.recommendationReason)).toEqual([
      '산업디자인학과 전공 공간에서 실제 수업 이야기를 들어요.',
      '학생들은 양이 넉넉하고 사장님이 친절하다고 해요.',
      '콘센트 자리가 많아 과제하기 좋다는 평이 많아요.',
    ]);
  });

  it('놀거리 의도가 있으면 놀거리 상점을 식사 · 카페 뒤에 넣는다', () => {
    setMotivation('haeun@demo.kr', 1, '카페에서 과제하고 보드게임도 해 보고 싶어요');
    const { stops, interests } = generateCourseDraft(db, 1);
    expect(interests).toEqual(['전공 수업', '캠퍼스 시설', '식사', '카페', '놀거리']);
    expect(storeIdsOf(stops)).toEqual([null, 1, 2, 4]);
    expect(stops.map((s) => [s.stopOrder, s.visitTime])).toEqual([
      [1, '14:00'],
      [2, '15:10'],
      [3, '16:00'],
      [4, '16:50'],
    ]);
    expect(stops[3]).toMatchObject({
      partnershipId: 4,
      recommendationReason:
        '신청자 1명이 "카페에서 과제하고 보드게임도 해 보고"를 궁금해했어요. 학생들이 자주 찾는 곳이에요.',
    });
  });

  it('반경 1km 밖 상점은 고르지 않는다(거리는 대학 중심에서 잰다)', () => {
    store(1).latitude += 0.02; // 서천 밥상을 약 2km 밖으로
    expect(storeIdsOf(generateCourseDraft(db, 1).stops)).toEqual([null, 3, 2]); // 영통 분식집
  });

  it('가장 가까운 상점은 캠퍼스 장소가 아니라 대학 중심에서 잰다', () => {
    // 대학 중심에서 83m · 예술·디자인대학에서 306m(카페 모래시계는 각각 139m · 85m)
    const nearCenter = addStore(
      { name: '카페 정문', category: '카페', latitude: 37.2392, longitude: 127.084 },
      99,
    );
    expect(storeIdsOf(generateCourseDraft(db, 1).stops)).toEqual([null, 1, nearCenter.id]);
  });

  it('같은 거리면 이름 순으로 고른다', () => {
    const twin = addStore({
      name: '가나 식당',
      category: '한식',
      latitude: store(1).latitude,
      longitude: store(1).longitude,
    });
    expect(storeIdsOf(generateCourseDraft(db, 1).stops)).toEqual([null, twin.id, 2]);
  });

  it('고른 상점이 모두 비제휴면 같은 업종의 가장 가까운 제휴 상점으로 첫 상점을 바꾼다', () => {
    dropPartnerships(1, 2);
    const { stops } = generateCourseDraft(db, 1);
    expect(storeIdsOf(stops)).toEqual([null, 3, 2]); // 서천 밥상 → 영통 분식집(분식, 제휴)
    expect(partnershipIdsOf(stops)).toEqual([null, 3, null]);
    expect(stops[1].recommendationReason).toBe(
      '신청자 2명이 "학생들이 자주 가는 밥집이 궁금해요"를 궁금해했어요. 학생들이 자주 찾는 곳이에요.',
    );
  });

  it('첫 상점 업종에 제휴 후보가 없으면 다음 상점 업종의 제휴 상점으로 바꾼다', () => {
    dropPartnerships(1, 2, 3);
    const cafe = addStore(
      { name: '카페 새벽', category: '카페', latitude: 37.242, longitude: 127.086 },
      99,
    );
    const { stops } = generateCourseDraft(db, 1);
    expect(storeIdsOf(stops)).toEqual([null, 1, cafe.id]);
    expect(partnershipIdsOf(stops)).toEqual([null, null, 99]);
  });

  it('관련 업종 상점이 모두 비제휴면 제휴 지점 없이 만든다(다른 업종 제휴 상점은 붙이지 않는다)', () => {
    dropPartnerships(1, 2, 3); // 보드게임 카페 다이스(놀거리)만 제휴로 남는다
    const { stops } = generateCourseDraft(db, 1);
    expect(storeIdsOf(stops)).toEqual([null, 1, 2]);
    expect(partnershipIdsOf(stops)).toEqual([null, null, null]);
  });

  it('탐방 날짜에 유효하지 않은 제휴는 제휴로 치지 않는다', () => {
    db.partnerships.find((p) => p.storeId === 1)!.endDate = '2026-11-14';
    expect(partnershipIdsOf(generateCourseDraft(db, 1).stops)).toEqual([null, null, 2]);

    db.partnerships.find((p) => p.storeId === 2)!.startDate = '2026-11-16';
    const { stops } = generateCourseDraft(db, 1);
    expect(storeIdsOf(stops)).toEqual([null, 3, 2]);
    expect(partnershipIdsOf(stops)).toEqual([null, 3, null]);
  });

  it('탐방이 없으면 NOT_FOUND', () =>
    expect(() => generateCourseDraft(db, 999)).toThrow(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    ));

  it('같은 입력이면 같은 결과', () =>
    expect(generateCourseDraft(db, 1)).toEqual(
      generateCourseDraft(createSeed(today, 'APPROVED'), 1),
    ));
});
