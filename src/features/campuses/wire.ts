import { campusLabel, shortUniversityName } from '@/features/tours/model';
import type { Insight, University } from './model';

// 백엔드 D-01 `GET /campuses` 항목과 목업 확장 인사이트의 와이어 모양(키는 `request`가 camelCase로 바꾼 뒤의 것).

export interface WireCampus {
  campusId: number;
  name: string;
  campusName: string;
  address: string | null;
  lat: number;
  lng: number;
  vacationPeriods: { startDate: string; endDate: string }[];
}

/** 목업 전용 확장 `GET /campuses/{campusId}/insight`(2C-R8). */
export interface WireInsight {
  campusId: number;
  title: string;
  text: string;
  source: string;
  isPlaceholder: boolean;
}

export function fromWireCampus(w: WireCampus): University {
  return {
    id: w.campusId,
    name: w.name,
    shortName: shortUniversityName(w.name),
    campusName: w.campusName,
    address: w.address,
    lat: w.lat,
    lng: w.lng,
    administrativeDong: null,
    vacations: w.vacationPeriods.map((v) => ({
      startDate: v.startDate,
      endDate: v.endDate,
      label: null,
    })),
  };
}

export function fromWireInsight(w: WireInsight): Insight {
  return {
    universityId: w.campusId,
    title: w.title,
    text: w.text,
    source: w.source,
    isPlaceholder: w.isPlaceholder,
  };
}

/**
 * 캠퍼스 조인(2C-R9)의 앞 두 길: `campusId`(확장)로 찾고, 못 찾으면 `campusName`이
 * `campusLabel(학교, 캠퍼스)` 또는 `학교 캠퍼스`와 같은 캠퍼스. 둘 다 못 찾으면 null(부르는 쪽이 `splitCampusName`으로 나눈다).
 */
export function findCampus(
  campuses: University[],
  ref: { campusId?: number | null; campusName: string },
): University | null {
  if (ref.campusId !== undefined && ref.campusId !== null) {
    const byId = campuses.find((u) => u.id === ref.campusId);
    if (byId) return byId;
  }
  return (
    campuses.find(
      (u) =>
        ref.campusName === campusLabel(u.name, u.campusName) ||
        ref.campusName === `${u.name} ${u.campusName}`,
    ) ?? null
  );
}

/** 캠퍼스 조인의 세 번째 길: 첫 공백에서 나눈다. 공백이 없으면 캠퍼스는 `본교`. */
export function splitCampusName(label: string): { universityName: string; campusName: string } {
  const at = label.indexOf(' ');
  if (at < 0) return { universityName: label, campusName: '본교' };
  return { universityName: label.slice(0, at), campusName: label.slice(at + 1) };
}
