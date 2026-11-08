import { describe, expect, it } from 'vitest';
import { STORE_CATEGORIES } from '@/features/stores/model';
import { COURSE_RADIUS_M } from '@/mocks/ai/course';
import { createSeed } from '@/mocks/db/seed';
import { distanceMeters } from '@/shared/lib/geo';
import data from './yonginStores.json';

// `scripts/build-yongin-stores.mjs`가 만든 용인시 상가정보 데이터(`docs/reference/store-data.md`)가 거른 조건 그대로인지 본다.
// 원본 CSV는 저장소에 없으므로 결과 파일만 검사한다.

const { universities } = createSeed(new Date('2026-11-15T01:00:00Z'));
const { stores } = data;

/** 문서의 업종 대응표: 소분류가 먼저, 다음은 중분류, 둘 다 없으면 `기타`. */
const BY_MINOR: Record<string, string> = {
  '김밥/만두/분식': '분식',
  버거: '양식',
  피자: '양식',
  '토스트/샌드위치/샐러드': '양식',
  '빵/도넛': '카페',
  '아이스크림/빙수': '카페',
};
const BY_MIDDLE: Record<string, string> = {
  한식: '한식',
  중식: '중식',
  일식: '일식',
  서양식: '양식',
  비알코올: '카페',
};

const distancesOf = (s: { lat: number; lng: number }) =>
  universities.map((u) => ({
    id: u.id,
    d: distanceMeters({ lat: u.latitude, lng: u.longitude }, s),
  }));

describe('용인시 상가정보 목업 데이터', () => {
  it('출처는 소상공인시장진흥공단 상가(상권)정보 15083033, 2026-09 기준, 반경은 코스 후보 반경', () => {
    expect(data).toMatchObject({
      dataset: '소상공인시장진흥공단_상가(상권)정보',
      datasetId: '15083033',
      basis: '2026-09',
      radiusM: COURSE_RADIUS_M,
    });
  });

  it('캠퍼스별 행 수(합 590)', () => {
    const count = (campusId: number) => stores.filter((s) => s.campusId === campusId).length;
    expect([1, 2, 3, 4, 5].map(count)).toEqual([185, 106, 185, 104, 10]);
    expect(stores).toHaveLength(590);
  });

  it('모든 행이 용인시의 음식점이고 주점은 없다', () => {
    for (const s of stores) {
      expect(s.district, s.sourceId).toMatch(/^용인시 (처인구|기흥구|수지구)$/);
      expect(s.address, s.sourceId).toMatch(/^경기도 용인시 (처인구|기흥구|수지구) /);
      expect(s.industryMiddle, s.sourceId).not.toBe('주점');
    }
    expect(stores.filter((s) => s.industryMiddle.includes('주점'))).toEqual([]);
  });

  it('좌표는 한국 범위의 WGS84이고 소수점 7자리 이하', () => {
    for (const s of stores) {
      expect(s.lat, s.sourceId).toBeGreaterThanOrEqual(33);
      expect(s.lat, s.sourceId).toBeLessThanOrEqual(39);
      expect(s.lng, s.sourceId).toBeGreaterThanOrEqual(124);
      expect(s.lng, s.sourceId).toBeLessThanOrEqual(132);
      expect(Math.round(s.lat * 1e7) / 1e7, s.sourceId).toBe(s.lat);
      expect(Math.round(s.lng * 1e7) / 1e7, s.sourceId).toBe(s.lng);
    }
  });

  it('모든 행이 시드 캠퍼스 중심에서 1km 안이고 campusId는 가장 가까운 캠퍼스', () => {
    for (const s of stores) {
      const [nearest] = distancesOf(s).sort((a, b) => a.d - b.d);
      expect(nearest.d, s.sourceId).toBeLessThanOrEqual(COURSE_RADIUS_M);
      expect(s.campusId, s.sourceId).toBe(nearest.id);
    }
  });

  it('상가업소번호는 겹치지 않고, 캠퍼스 → 상가업소번호 순이다', () => {
    const ids = stores.map((s) => s.sourceId);
    expect(new Set(ids).size).toBe(stores.length);
    for (const id of ids) expect(id).toMatch(/^MA[0-9A-Z]{18}$/);
    const sorted = [...stores].sort(
      (a, b) => a.campusId - b.campusId || (a.sourceId < b.sourceId ? -1 : 1),
    );
    expect(ids).toEqual(sorted.map((s) => s.sourceId));
  });

  it('업종은 대응표대로 STORE_CATEGORIES 중 하나다', () => {
    for (const s of stores) {
      expect(STORE_CATEGORIES, s.sourceId).toContain(s.category);
      expect(s.category, s.sourceId).toBe(
        BY_MINOR[s.industryMinor] ?? BY_MIDDLE[s.industryMiddle] ?? '기타',
      );
    }
  });

  it('이름 · 주소 · 행정동은 앞뒤 공백 없이 채워져 있다', () => {
    for (const s of stores) {
      for (const value of [s.name, s.address, s.administrativeDong, s.industryMinor]) {
        expect(value, s.sourceId).not.toBe('');
        expect(value, s.sourceId).toBe(value.trim());
      }
    }
  });
});
