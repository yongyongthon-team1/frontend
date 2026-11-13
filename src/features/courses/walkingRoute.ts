import { useQuery } from '@tanstack/react-query';

// 코스 지도의 도보 경로. 카카오맵 SDK에는 도보 길찾기가 없어서 OpenStreetMap 데이터의 공개 보행 경로 서버(OSRM
// foot 프로필, 키 없음 · CORS 허용)에 지점 좌표만 순서대로 보내 실제 걷는 길을 받는다. 개인정보는 보내지 않는다.
// 무료 공용 서버라 늦거나 실패할 수 있다 — 그때는 지금처럼 지점을 직선으로 잇는다(지도는 그대로 쓸 수 있다).
// 같은 지점 순서는 다시 묻지 않는다(세션 동안 기억, 재시도 없음).

export const WALKING_ROUTE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
export const WALKING_ROUTE_TIMEOUT_MS = 4000;
/** 경로 데이터 출처 표기(ODbL). 실제 경로를 그렸을 때만 지도 아래에 보인다. */
export const WALKING_ROUTE_ATTRIBUTION = '도보 경로 © OpenStreetMap 기여자';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface WalkingRoute {
  /** 지도에 그릴 선(지점 순서대로 이어진 실제 길). */
  path: LatLng[];
  /** 구간마다(지점 i → i+1) 걷는 거리(m)와 시간(초). */
  legs: { distance: number; duration: number }[];
}

interface OsrmResponse {
  code: string;
  routes?: {
    geometry: { coordinates: [number, number][] };
    legs: { distance: number; duration: number }[];
  }[];
}

export async function fetchWalkingRoute(
  points: LatLng[],
  signal?: AbortSignal,
): Promise<WalkingRoute> {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  // 제한 시간 · 화면 이탈(react-query의 signal) 둘 다 요청을 끊는다. AbortSignal.any는 옛 Safari에 없어 직접 잇는다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WALKING_ROUTE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  let body: OsrmResponse;
  try {
    const response = await fetch(
      `${WALKING_ROUTE_URL}/${coords}?overview=full&geometries=geojson`,
      {
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`walking route ${response.status}`);
    body = (await response.json()) as OsrmResponse;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  const route = body.routes?.[0];
  if (body.code !== 'Ok' || route === undefined || route.geometry.coordinates.length < 2) {
    throw new Error(`walking route ${body.code}`);
  }
  return {
    path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    legs: route.legs.map(({ distance, duration }) => ({ distance, duration })),
  };
}

/**
 * 지점 순서대로의 도보 경로. 지점이 2곳 미만이거나 `enabled`가 false(도식 지도 등)면 묻지 않는다.
 * 실패하면 `data`가 없다 — 부르는 쪽은 직선으로 그린다.
 */
export function useWalkingRoute(points: LatLng[], enabled = true) {
  const key = points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(';');
  return useQuery({
    queryKey: ['walking-route', key],
    queryFn: ({ signal }) => fetchWalkingRoute(points, signal),
    enabled: enabled && points.length >= 2,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
