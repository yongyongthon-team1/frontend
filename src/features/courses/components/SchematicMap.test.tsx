import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CourseStop } from '@/features/courses/model';
import { SchematicMap } from './SchematicMap';

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
    partnership: null,
    review: null,
    dataSource: null,
  };
}

function pinPositions() {
  return within(screen.getByTestId('schematic-map'))
    .getAllByRole('button')
    .map((pin) => [pin.style.left, pin.style.top]);
}

describe('SchematicMap', () => {
  it('지점이 하나면 박스 가운데', () => {
    render(
      <SchematicMap stops={[stop(1, 1, '카페 모래시계', 37.24, 127.08)]} onSelect={() => {}} />,
    );
    expect(pinPositions()).toEqual([['50%', '50%']]);
  });

  it('좌표가 같은 지점들도 가운데(0으로 나누지 않는다)', () => {
    render(
      <SchematicMap
        stops={[stop(1, 1, '서천 밥상', 37.24, 127.08), stop(2, 2, '카페 모래시계', 37.24, 127.08)]}
        onSelect={() => {}}
      />,
    );
    expect(pinPositions()).toEqual([
      ['50%', '50%'],
      ['50%', '50%'],
    ]);
  });

  it('서쪽 → 동쪽은 왼쪽 → 오른쪽, 북쪽이 위이고 모두 박스 안이다', () => {
    render(
      <SchematicMap
        stops={[
          stop(1, 1, '서쪽 남쪽', 37.2405, 127.0815),
          stop(2, 2, '동쪽 북쪽', 37.2417, 127.0848),
        ]}
        onSelect={() => {}}
      />,
    );
    const [[westX, southY], [eastX, northY]] = pinPositions().map((p) => p.map(parseFloat));
    expect(westX).toBeLessThan(eastX);
    expect(northY).toBeLessThan(southY);
    for (const v of [westX, southY, eastX, northY]) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(100);
    }
  });

  it('핀은 "{순서} {이름}" 버튼이고 누르면 그 지점을 고른다', async () => {
    const onSelect = vi.fn();
    render(
      <SchematicMap
        stops={[
          stop(7, 1, '서천 밥상', 37.2417, 127.0848),
          stop(8, 2, '카페 모래시계', 37.2405, 127.0821),
        ]}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '② 카페 모래시계' }));
    expect(onSelect).toHaveBeenCalledWith(8);
  });
});
