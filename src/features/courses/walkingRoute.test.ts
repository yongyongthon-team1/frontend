import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/node';
import { fetchWalkingRoute, WALKING_ROUTE_URL } from './walkingRoute';

const points = [
  { lat: 37.2431, lng: 127.0838 },
  { lat: 37.2468, lng: 127.0795 },
  { lat: 37.2471, lng: 127.0801 },
];

describe('fetchWalkingRoute (OSRM foot)', () => {
  it('지점 좌표를 경도,위도 순서로 이어 보내고, 경로 선과 구간별 거리 · 시간을 읽는다', async () => {
    let requested = '';
    server.use(
      http.get(`${WALKING_ROUTE_URL}/:coords`, ({ request, params }) => {
        requested = String(params.coords);
        expect(new URL(request.url).searchParams.get('geometries')).toBe('geojson');
        return HttpResponse.json({
          code: 'Ok',
          routes: [
            {
              geometry: {
                coordinates: [
                  [127.0838, 37.2431],
                  [127.081, 37.245],
                  [127.0795, 37.2468],
                  [127.0801, 37.2471],
                ],
              },
              legs: [
                { distance: 932.4, duration: 702 },
                { distance: 80, duration: 60 },
              ],
            },
          ],
        });
      }),
    );

    const route = await fetchWalkingRoute(points);
    expect(requested).toBe('127.083800,37.243100;127.079500,37.246800;127.080100,37.247100');
    expect(route.path[1]).toEqual({ lat: 37.245, lng: 127.081 });
    expect(route.path).toHaveLength(4);
    expect(route.legs).toEqual([
      { distance: 932.4, duration: 702 },
      { distance: 80, duration: 60 },
    ]);
  });

  it('길을 못 찾거나(code ≠ Ok) 서버 오류면 실패한다 — 지도는 직선으로 그린다', async () => {
    server.use(
      http.get(`${WALKING_ROUTE_URL}/:coords`, () => HttpResponse.json({ code: 'NoRoute' })),
    );
    await expect(fetchWalkingRoute(points)).rejects.toThrow('NoRoute');

    server.use(
      http.get(`${WALKING_ROUTE_URL}/:coords`, () => new HttpResponse(null, { status: 503 })),
    );
    await expect(fetchWalkingRoute(points)).rejects.toThrow('503');
  });
});
