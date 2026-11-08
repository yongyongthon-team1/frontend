import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CourseStop } from '@/features/courses/model';
import { MapView } from './MapView';

function stop(id: number, order: number, name: string, lat: number, lng: number): CourseStop {
  return {
    id,
    order,
    visitTime: '14:00',
    type: 'STORE',
    name,
    category: '카페',
    lat,
    lng,
    description: null,
    recommendationReason: null,
    storeId: id,
    campusBuildingId: null,
    partnership: null,
    review: null,
    dataSource: null,
  };
}

async function pinNames() {
  const map = await screen.findByTestId('schematic-map');
  return within(map)
    .getAllByRole('button')
    .map((pin) => pin.getAttribute('aria-label'));
}

// 테스트 환경에는 카카오 키가 없어 도식 지도로 간다 — 핀 거르기는 두 지도에 같이 걸린다.
describe('MapView 좌표 방어', () => {
  it('한국 범위 밖 좌표(0 · 중부원점 TM 값)의 지점은 핀에서 뺀다', async () => {
    render(
      <MapView
        onSelect={vi.fn()}
        stops={[
          stop(1, 1, '예술·디자인대학', 37.2431, 127.0832),
          stop(2, 2, '좌표 없는 가게', 0, 0),
          stop(3, 3, '변환 안 된 가게', 455123.4, 205678.9),
          stop(4, 4, '카페 모래시계', 37.2412, 127.0861),
        ]}
      />,
    );
    expect(await pinNames()).toEqual(['① 예술·디자인대학', '④ 카페 모래시계']);
  });

  it('모든 지점이 범위 밖이면 도식 지도에 지점을 다 그린다(상대 위치만 쓴다)', async () => {
    render(
      <MapView
        onSelect={vi.fn()}
        stops={[stop(1, 1, '가', 455123.4, 205678.9), stop(2, 2, '나', 455300.1, 205900.2)]}
      />,
    );
    expect(await pinNames()).toEqual(['① 가', '② 나']);
  });
});
