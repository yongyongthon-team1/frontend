import { useCallback } from 'react';
import { CustomOverlayMap, Map as KakaoMap, Polyline } from 'react-kakao-maps-sdk';
import { useKakaoMaps } from '@/features/courses/kakaoLoader';
import type { CourseStop } from '@/features/courses/model';
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
 * 높이(255px)의 자리 표시를 그린다.
 */
export function MapView({ stops, onSelect, forceSchematic = false }: MapViewProps) {
  const status = useKakaoMaps(forceSchematic);
  if (status === 'loading') return <Skeleton className="h-[255px] rounded-lg" />;
  if (status === 'fallback' || stops.length === 0) {
    return <SchematicMap stops={stops} onSelect={onSelect} />;
  }
  return <KakaoCourseMap stops={stops} onSelect={onSelect} />;
}

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** SDK가 뜬 뒤에만 그린다(`kakao` 전역을 쓴다). 번호 핀을 순서대로 선으로 잇고, 모든 지점이 보이게 영역을 맞춘다. */
function KakaoCourseMap({ stops, onSelect }: Pick<MapViewProps, 'stops' | 'onSelect'>) {
  const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const center = { lat: average(path.map((p) => p.lat)), lng: average(path.map((p) => p.lng)) };
  // SDK 선 색은 CSS가 아니라 문자열로 받으므로 토큰 값을 읽어 넘긴다(결정 0003 — 색 값을 코드에 쓰지 않는다).
  const lineColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary')
    .trim();

  const fitBounds = useCallback(
    (map: kakao.maps.Map) => {
      if (stops.length < 2) return;
      const bounds = new kakao.maps.LatLngBounds();
      for (const s of stops) bounds.extend(new kakao.maps.LatLng(s.lat, s.lng));
      map.setBounds(bounds);
    },
    [stops],
  );

  return (
    <KakaoMap
      center={center}
      onCreate={fitBounds}
      className="h-[255px] w-full overflow-hidden rounded-lg"
    >
      <Polyline path={path} strokeWeight={4} strokeColor={lineColor || undefined} />
      {stops.map((stop) => (
        <CustomOverlayMap key={stop.id} position={{ lat: stop.lat, lng: stop.lng }} clickable>
          <button
            type="button"
            aria-label={`${circled(stop.order)} ${stop.name}`}
            onClick={() => onSelect(stop.id)}
            className="flex size-11 items-center justify-center"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
              {stop.order}
            </span>
          </button>
        </CustomOverlayMap>
      ))}
    </KakaoMap>
  );
}
