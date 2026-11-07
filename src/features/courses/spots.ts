import { slotTimes, type Course, type CourseStop } from './model';
import type { SpotInput } from './wire';

// 코스 지점 PUT 빌더(2C-R13). 백엔드에는 지점 단위 편집이 없고 `PUT /tours/{tourId}/course/spots`가 전체 교체라,
// 화면의 순서 바꾸기 · 한줄평 · 빼기를 지금 코스에 적용한 뒤 전체 `spots` 배열로 만든다.

export type SpotEdit =
  | { kind: 'reorder'; stopIds: number[] }
  | { kind: 'note'; stopId: number; description: string }
  | { kind: 'remove'; stopId: number };

/** 순서 · 지점 id가 바뀌지 않는 편집을 적용한 지점 목록. */
function applyEdit(stops: CourseStop[], edit: SpotEdit): CourseStop[] {
  switch (edit.kind) {
    case 'reorder': {
      const ids = stops.map((s) => s.id);
      const isPermutation =
        edit.stopIds.length === ids.length &&
        new Set(edit.stopIds).size === ids.length &&
        edit.stopIds.every((id) => ids.includes(id));
      if (!isPermutation) throw new Error('reorder: 지점 id가 맞지 않아요');
      return edit.stopIds.map((id) => stops.find((s) => s.id === id)!);
    }
    case 'note': {
      const text = edit.description.trim();
      return stops.map((s) =>
        s.id === edit.stopId ? { ...s, description: text === '' ? null : text } : s,
      );
    }
    case 'remove':
      // 빈 배열도 만든다 — 서버 E400이 막고, 화면은 마지막 지점의 빼기를 미리 막는다(2C-R12 ②).
      return stops.filter((s) => s.id !== edit.stopId);
  }
}

/** 지점의 장소 id(상점 · 캠퍼스 건물). 응답이 지점 유형에 맞는 칸을 채워 주므로 null이면 잘못 읽은 코스다. */
function placeId(stop: CourseStop, id: number | null): number {
  if (id === null) throw new Error(`${stop.type} 지점 ${stop.id}에 장소 id가 없어요`);
  return id;
}

/** 지점 하나 → PUT 항목. 상점은 `storeId`, 캠퍼스는 `campusBuildingId`로 보내고, 한줄평이 있을 때만 `comment`를 넣는다. */
function toSpotInput(stop: CourseStop, startTime: string): SpotInput {
  const comment = stop.description === null ? {} : { comment: stop.description };
  return stop.type === 'STORE'
    ? { stopType: 'STORE', storeId: placeId(stop, stop.storeId), startTime, ...comment }
    : {
        stopType: 'CAMPUS',
        campusBuildingId: placeId(stop, stop.campusBuildingId),
        startTime,
        ...comment,
      };
}

/**
 * 지금 코스에 편집 하나를 적용한 전체 `spots`. 시각은 위치 슬롯(`slotTimes`: 시작 + 0 · 70 · 120 · 170 · 220분, 그 뒤 50분씩)이다.
 * `comment`는 한줄평이 있을 때만 넣는다 — 전체 교체라 빠지면 한줄평이 없어진다.
 */
export function buildSpots(course: Course, edit: SpotEdit): SpotInput[] {
  const stops = [...course.stops].sort((a, b) => a.order - b.order);
  const next = applyEdit(stops, edit);
  const times = slotTimes(course.tour.startsAt, next.length);
  return next.map((stop, i) => toSpotInput(stop, times[i]));
}
