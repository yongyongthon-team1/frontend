import type { CourseStop } from '@/features/courses/model';
import { circled } from '@/shared/lib/date';

export interface SchematicMapProps {
  stops: CourseStop[];
  onSelect(stopId: number): void;
}

// 핀을 놓는 범위(박스 기준 %). 핀 오른쪽에 이름표가 붙으므로 오른쪽을 넓게 비운다. 위도는 북쪽(큰 값)이 위다.
const X_RANGE = [12, 66] as const;
const Y_RANGE = [82, 18] as const;

/** `value`를 [min, max]에서 [from, to](%)로 옮긴다. 범위가 0이면(지점 1개 · 같은 좌표) 박스 가운데. */
function place(value: number, min: number, max: number, [from, to]: readonly [number, number]) {
  if (max === min) return 50;
  return from + ((value - min) / (max - min)) * (to - from);
}

/**
 * 카카오맵을 쓸 수 없을 때의 도식 지도(와이어 hs-s08, 결정 0004). 위도 · 경도를 각각 박스에 맞춰 늘리므로 실제
 * 거리 비율은 지키지 않는다 — 순서와 대략의 위치만 보여 준다. 도로 막대는 장식이다.
 */
export function SchematicMap({ stops, onSelect }: SchematicMapProps) {
  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];

  return (
    <div
      data-testid="schematic-map"
      className="relative h-[var(--map-h)] overflow-hidden rounded-lg bg-surface"
    >
      <div aria-hidden>
        <div className="absolute inset-x-[5%] top-[30%] h-3.5 rounded-full bg-bg" />
        <div className="absolute inset-x-[5%] top-[72%] h-3.5 rounded-full bg-bg" />
        <div className="absolute inset-y-[5%] left-[18%] w-3.5 rounded-full bg-bg" />
        <div className="absolute inset-y-[5%] left-[62%] w-3.5 rounded-full bg-bg" />
      </div>
      {stops.map((stop) => {
        const label = `${circled(stop.order)} ${stop.name}`;
        return (
          <button
            key={stop.id}
            type="button"
            aria-label={label}
            onClick={() => onSelect(stop.id)}
            style={{
              left: `${place(stop.lng, minLng, maxLng, X_RANGE)}%`,
              top: `${place(stop.lat, minLat, maxLat, Y_RANGE)}%`,
            }}
            // 핀(44px 터치 영역의 가운데 점)이 좌표에 오도록 반 칸씩 당긴다.
            className="absolute flex h-11 -translate-x-5.5 -translate-y-1/2 items-center pr-1"
          >
            <span className="flex size-11 shrink-0 items-center justify-center">
              <span className="size-6 rounded-full bg-primary" />
            </span>
            <span className="-ml-2 max-w-28 truncate text-xs font-bold text-ink">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
