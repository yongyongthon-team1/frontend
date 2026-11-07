import { slotTimes, type Course, type CourseStop, type PlaceRef } from './model';
import type { SpotInput } from './wire';

// 코스 지점 PUT 빌더(2C-R13). 백엔드에는 지점 단위 편집이 없고 `PUT /tours/{tourId}/course/spots`가 전체 교체라,
// 화면의 순서 바꾸기 · 한줄평 · 빼기 · 추가 · 교체를 지금 코스에 적용한 뒤 전체 `spots` 배열로 만든다.
// 새로 넣는 장소는 `CourseStop`이 없으므로 편집은 `Slot`(장소 + 한줄평)으로 적용한다(2B′-R14).

export type SpotEdit =
  | { kind: 'reorder'; stopIds: number[] }
  | { kind: 'note'; stopId: number; description: string }
  | { kind: 'remove'; stopId: number }
  /** 맨 끝에 한줄평 없이 붙는다. 5곳 상한 · 같은 장소 중복은 빌더가 보지 않는다(화면 몫). */
  | { kind: 'add'; place: PlaceRef }
  /** 그 지점 자리에 그 장소를 한줄평 없이 넣는다. 다른 지점은 그대로다. */
  | { kind: 'replace'; stopId: number; place: PlaceRef };

/**
 * 편집을 적용하는 동안의 지점: 장소와 한줄평. `id`는 지금 코스의 지점 id이고 새로 넣는 장소는 없다.
 * 장소 id가 비어 있는 지점(잘못 읽은 코스)은 `place`가 오류이고, 그 지점이 결과에 남을 때만 던진다(빼면 던지지 않는다).
 */
interface Slot {
  id: number | null;
  place: PlaceRef | Error;
  description: string | null;
}

/** 지점의 장소(상점 · 캠퍼스 건물). 응답이 지점 유형에 맞는 칸을 채워 주므로 id가 null이면 잘못 읽은 코스다. */
function toSlot(stop: CourseStop): Slot {
  const missing = new Error(`${stop.type} 지점 ${stop.id}에 장소 id가 없어요`);
  let place: PlaceRef | Error;
  if (stop.type === 'STORE') {
    place = stop.storeId === null ? missing : { type: 'STORE', storeId: stop.storeId };
  } else {
    place =
      stop.campusBuildingId === null
        ? missing
        : { type: 'CAMPUS', campusBuildingId: stop.campusBuildingId };
  }
  return { id: stop.id, place, description: stop.description };
}

/** 편집을 적용한 지점 목록. */
function applyEdit(slots: Slot[], edit: SpotEdit): Slot[] {
  switch (edit.kind) {
    case 'reorder': {
      const ids = slots.map((s) => s.id);
      const isPermutation =
        edit.stopIds.length === ids.length &&
        new Set(edit.stopIds).size === ids.length &&
        edit.stopIds.every((id) => ids.includes(id));
      if (!isPermutation) throw new Error('reorder: 지점 id가 맞지 않아요');
      return edit.stopIds.map((id) => slots.find((s) => s.id === id)!);
    }
    case 'note': {
      const text = edit.description.trim();
      return slots.map((s) =>
        s.id === edit.stopId ? { ...s, description: text === '' ? null : text } : s,
      );
    }
    case 'remove':
      // 빈 배열도 만든다 — 서버 E400이 막고, 화면은 마지막 지점의 빼기를 미리 막는다(2C-R12 ②).
      return slots.filter((s) => s.id !== edit.stopId);
    case 'add':
      return [...slots, { id: null, place: edit.place, description: null }];
    case 'replace': {
      if (!slots.some((s) => s.id === edit.stopId)) {
        throw new Error('replace: 지점 id가 맞지 않아요');
      }
      return slots.map((s) =>
        s.id === edit.stopId ? { id: null, place: edit.place, description: null } : s,
      );
    }
  }
}

/** 지점 하나 → PUT 항목. 상점은 `storeId`, 캠퍼스는 `campusBuildingId`로 보내고, 한줄평이 있을 때만 `comment`를 넣는다. */
function toSpotInput(slot: Slot, startTime: string): SpotInput {
  const { place } = slot;
  if (place instanceof Error) throw place;
  const comment = slot.description === null ? {} : { comment: slot.description };
  return place.type === 'STORE'
    ? { stopType: 'STORE', storeId: place.storeId, startTime, ...comment }
    : { stopType: 'CAMPUS', campusBuildingId: place.campusBuildingId, startTime, ...comment };
}

/**
 * 지금 코스에 편집 하나를 적용한 전체 `spots`. 시각은 위치 슬롯(`slotTimes`: 시작 + 0 · 70 · 120 · 170 · 220분, 그 뒤 50분씩)이다.
 * `comment`는 한줄평이 있을 때만 넣는다 — 전체 교체라 빠지면 한줄평이 없어진다.
 */
export function buildSpots(course: Course, edit: SpotEdit): SpotInput[] {
  const slots = [...course.stops].sort((a, b) => a.order - b.order).map(toSlot);
  const next = applyEdit(slots, edit);
  const times = slotTimes(course.tour.startsAt, next.length);
  return next.map((slot, i) => toSpotInput(slot, times[i]));
}
