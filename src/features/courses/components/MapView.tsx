import { useCallback, useEffect, useState } from 'react';
import { CustomOverlayMap, Map as KakaoMap, Polyline } from 'react-kakao-maps-sdk';
import { useKakaoMaps } from '@/features/courses/kakaoLoader';
import { isKoreaCoordinate, pinOffsets, type CourseStop } from '@/features/courses/model';
import { useWalkingRoute, WALKING_ROUTE_ATTRIBUTION } from '@/features/courses/walkingRoute';
import { circled } from '@/shared/lib/date';
import { Skeleton } from '@/shared/ui/Skeleton';
import { SchematicMap } from './SchematicMap';

export interface MapViewProps {
  stops: CourseStop[];
  onSelect(stopId: number): void;
  /** true면 SDK를 부르지 않고 도식 지도를 그린다(시연 패널의 도식 모드). */
  forceSchematic?: boolean;
}

/**
 * 코스 지도(결정 0004). 카카오맵 SDK가 뜨면 실제 지도, 키가 없거나 로딩에 실패하면 도식 지도, 그 사이에는 같은
 * 높이(토큰 `--map-h`)의 자리 표시를 그린다.
 */
export function MapView({ stops, onSelect, forceSchematic = false }: MapViewProps) {
  const status = useKakaoMaps(forceSchematic);
  // 좌표가 한국 범위 밖인 지점은 핀에서 뺀다(목록 · 시트에는 그대로 있다). 남는 핀이 없으면 도식 지도로 가고,
  // 도식 지도는 상대 위치만 쓰므로 그때는 지점을 다 그린다.
  const pinned = stops.filter((s) => isKoreaCoordinate(s.lat, s.lng));
  if (status === 'loading') return <Skeleton className="h-[var(--map-h)] rounded-lg" />;
  if (status === 'fallback' || pinned.length === 0) {
    return <SchematicMap stops={pinned.length > 0 ? pinned : stops} onSelect={onSelect} />;
  }
  return <KakaoCourseMap stops={pinned} onSelect={onSelect} />;
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * SDK가 뜬 뒤에만 그린다(`kakao` 전역을 쓴다). 번호 핀을 순서대로 실제 도보 경로(OpenStreetMap)로 잇고, 모든 지점이
 * 보이게 영역을 맞춘다. 경로를 받기 전이나 못 받으면 지점을 점선 직선으로 잇는다(실제 길이 아니라는 표시).
 */
function KakaoCourseMap({ stops, onSelect }: Pick<MapViewProps, 'stops' | 'onSelect'>) {
  const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const route = useWalkingRoute(path);
  const offsets = pinOffsets(path);
  const walking = route.data?.path ?? null;
  const center = { lat: average(path.map((p) => p.lat)), lng: average(path.map((p) => p.lng)) };
  // SDK 선 색은 CSS가 아니라 문자열로 받으므로 토큰 값을 읽어 넘긴다(결정 0003 — 색 값을 코드에 쓰지 않는다).
  const lineColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary')
    .trim();

  // 모든 지점이 보이게 영역을 맞춘다. 처음 그릴 때뿐 아니라 지점이 바뀔 때(코스 편집의 순서 · 교체 · 빼기 · 추가)마다
  // 다시 맞춘다 — 같은 지점 목록이 다시 내려온 것(재조회)이면 키가 같아 그대로 둔다. 도보 경로가 오면 길이 지점 밖으로
  // 돌아 나가도 잘리지 않게 경로까지 담아 한 번 더 맞춘다.
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const stopsKey = stops.map((s) => `${s.id}:${s.lat},${s.lng}`).join('|');
  const fitBounds = useCallback(
    (target: kakao.maps.Map) => {
      if (stops.length < 2) return;
      const bounds = new kakao.maps.LatLngBounds();
      for (const p of [...path, ...(walking ?? [])])
        bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
      target.setBounds(bounds);
    },
    // stopsKey가 지점 좌표를 다 담는다 — 배열 자체가 새로 와도 좌표가 같으면 다시 맞추지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopsKey, walking],
  );
  useEffect(() => {
    if (map !== null) fitBounds(map);
  }, [map, fitBounds]);

  return (
    <div>
      <KakaoMap
        center={center}
        onCreate={setMap}
        className="h-[var(--map-h)] w-full overflow-hidden rounded-lg"
      >
        <Polyline
          path={walking ?? path}
          strokeWeight={walking ? 5 : 3}
          strokeOpacity={walking ? 0.9 : 0.6}
          strokeStyle={walking ? 'solid' : 'shortdash'}
          strokeColor={lineColor || undefined}
        />
        {stops.map((stop, index) => (
          <CustomOverlayMap key={stop.id} position={{ lat: stop.lat, lng: stop.lng }} clickable>
            {/* 아주 가까운 지점(같은 골목의 두 가게 등)은 핀을 옆으로 벌려 둘 다 보이게 한다(선은 실제 좌표 그대로). */}
            <button
              type="button"
              aria-label={`${circled(stop.order)} ${stop.name}`}
              onClick={() => onSelect(stop.id)}
              style={offsets[index] ? { transform: `translateX(${offsets[index]}px)` } : undefined}
              className="flex size-11 items-center justify-center"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary ring-2 ring-surface">
                {stop.order}
              </span>
            </button>
          </CustomOverlayMap>
        ))}
      </KakaoMap>
      {walking ? (
        <p className="mt-1 text-right text-[11px] text-muted">{WALKING_ROUTE_ATTRIBUTION}</p>
      ) : null}
    </div>
  );
}
