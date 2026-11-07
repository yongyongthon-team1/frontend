import { describe, expect, it } from 'vitest';
import { distanceMeters } from './geo';

describe('distanceMeters', () => {
  it('경희대 국제캠–수원역 약 8km', () =>
    expect(
      Math.round(
        distanceMeters({ lat: 37.2397, lng: 127.0833 }, { lat: 37.2664, lng: 127.0001 }) / 1000,
      ),
    ).toBe(8));

  it('같은 지점은 0m', () => {
    const p = { lat: 37.2397, lng: 127.0833 };
    expect(distanceMeters(p, p)).toBe(0);
  });
});
