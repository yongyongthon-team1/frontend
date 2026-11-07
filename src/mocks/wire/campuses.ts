import { shortUniversityName } from '@/features/tours/model';
import type { WireCampus, WireInsight } from '@/features/campuses/wire';
import type { WireCampusPlace } from '@/features/courses/wire';
import type { CampusPlaceRow, DB, UniversityRow } from '@/mocks/db/schema';
import { MockApiError } from '@/mocks/rules/errors';

// 캠퍼스 행 → 와이어 객체(`ok`가 키를 snake로 바꾼다). 도메인 객체를 만들던 `toUniversity`의 자리(2C-R26).

// "방학 상권 인사이트" 카드(설계 5.6)의 자리 값. 실제 지표 · 출처는 팀 데이터 담당이 정한다(5개교 공통 예시).
const INSIGHT_TITLE = '방학 상권 인사이트';
const INSIGHT_SOURCE = '팀 데이터 담당 확정 전 예시';

/** D-01 항목. `campusName`은 행의 값 그대로이고 방학은 시작일 순이다. */
export function toWireCampus(db: DB, row: UniversityRow): WireCampus {
  return {
    campusId: row.id,
    name: row.name,
    campusName: row.campusName,
    address: row.address,
    lat: row.latitude,
    lng: row.longitude,
    vacationPeriods: db.vacations
      .filter((v) => v.universityId === row.id)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
      .map((v) => ({ startDate: v.startDate, endDate: v.endDate })),
  };
}

/** 확장 인사이트. 행정동이 있으면 그것을, 없으면 `{짧은 이름} 주변 상권`을 넣은 예시 문구. */
export function toWireInsight(row: UniversityRow): WireInsight {
  const area = row.administrativeDong ?? `${shortUniversityName(row.name)} 주변 상권`;
  return {
    campusId: row.id,
    title: INSIGHT_TITLE,
    text: `${area}은 방학이면 대학가 손님이 크게 줄어요. 이 코스는 그 상권으로 신청자들을 보내요.`,
    source: INSIGHT_SOURCE,
    isPlaceholder: true,
  };
}

/** 그 캠퍼스의 장소(건물), 건물 id 순. 없는 캠퍼스는 404 NOT_FOUND(장소가 0개인 캠퍼스는 빈 목록). */
export function campusPlacesOf(db: DB, campusId: number): CampusPlaceRow[] {
  if (!db.universities.some((u) => u.id === campusId)) throw new MockApiError(404, 'NOT_FOUND');
  return db.campusPlaces
    .filter((p) => p.universityId === campusId)
    .sort((a, b) => a.campusBuildingId - b.campusBuildingId);
}

/** C-02 보완 항목. */
export function toWireCampusPlace(row: CampusPlaceRow): WireCampusPlace {
  return {
    campusBuildingId: row.campusBuildingId,
    name: row.name,
    description: row.description,
    lat: row.latitude,
    lng: row.longitude,
  };
}
