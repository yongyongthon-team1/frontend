// 소상공인시장진흥공단_상가(상권)정보(공공데이터포털 15083033) 경기 CSV에서 목업 상점 데이터를 만든다.
//
//   node scripts/build-yongin-stores.mjs <경기 CSV 경로> [출력 경로]
//
// 남기는 행: 시군구명이 `용인시`로 시작 · 대분류 `음식` · 중분류 `주점` 아님(방문자가 미성년자) · 다섯 캠퍼스 중심 중
// 하나에서 1000m(`COURSE_RADIUS_M`) 안. 상가업소번호로 중복을 뺀다. 출력은 `src/mocks/db/data/yonginStores.json`이고
// 시드(`src/mocks/db/seed.ts`)가 읽는다. 업종 대응 · 다시 만드는 법은 `docs/reference/store-data.md`.
// 의존성 없는 Node 스크립트다(CSV는 따옴표 · 쉼표를 직접 읽는다). 원본은 데이터로만 읽는다.

import { createReadStream, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'src/mocks/db/data/yonginStores.json');

/** 코스 후보 반경(`src/mocks/ai/course.ts`의 `COURSE_RADIUS_M`과 같아야 한다 — 데이터 테스트가 확인한다). */
const RADIUS_M = 1000;

/** `createSeed`의 대학 중심 좌표(id 순서). 바뀌면 여기도 고치고 다시 만든다 — 데이터 테스트가 시드와 견준다. */
const CAMPUSES = [
  { id: 1, lat: 37.2754, lng: 127.1315 }, // 강남대학교 본교
  { id: 2, lat: 37.2397, lng: 127.0833 }, // 경희대학교 국제캠퍼스
  { id: 3, lat: 37.322, lng: 127.1253 }, // 단국대학교 죽전캠퍼스
  { id: 4, lat: 37.2224, lng: 127.1903 }, // 명지대학교 자연캠퍼스
  { id: 5, lat: 37.3398, lng: 127.2655 }, // 한국외국어대학교 글로벌캠퍼스
];

/** 원본 열 이름(헤더로 위치를 찾는다 — 열 순서가 바뀌어도 이름이 같으면 읽는다). */
const COLUMNS = {
  sourceId: '상가업소번호',
  name: '상호명',
  branch: '지점명',
  major: '상권업종대분류명',
  middle: '상권업종중분류명',
  minor: '상권업종소분류명',
  district: '시군구명',
  dong: '행정동명',
  jibunAddress: '지번주소',
  roadAddress: '도로명주소',
  lng: '경도',
  lat: '위도',
};

/**
 * 원본 업종(중분류 · 소분류) → 앱 업종(`STORE_CATEGORIES`). 소분류 표가 먼저고, 없으면 중분류 표, 그것도 없으면 `기타`.
 * `카페` 의도의 사전에 `디저트`가 있어 빵 · 아이스크림 가게는 `카페`로 둔다.
 */
const BY_MINOR = {
  '김밥/만두/분식': '분식',
  버거: '양식',
  피자: '양식',
  '토스트/샌드위치/샐러드': '양식',
  '빵/도넛': '카페',
  '아이스크림/빙수': '카페',
};
const BY_MIDDLE = {
  한식: '한식',
  중식: '중식',
  일식: '일식',
  서양식: '양식',
  비알코올: '카페',
};

function categoryOf(middle, minor) {
  return BY_MINOR[minor] ?? BY_MIDDLE[middle] ?? '기타';
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg) => (deg * Math.PI) / 180;

/** 하버사인 거리(미터). `src/shared/lib/geo.ts`의 `distanceMeters`와 같은 식이다. */
function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round7 = (value) => Math.round(value * 1e7) / 1e7;

/** 한국 본토 · 제주를 넉넉히 감싸는 WGS84 범위. 0이나 중부원점 TM(미터) 값은 여기서 걸러진다. */
const inKorea = ({ lat, lng }) => lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;

/** CSV 한 줄을 칸으로 나눈다. 따옴표 안의 쉼표 · `""`를 처리하고, 따옴표가 줄 끝까지 닫히지 않았는지도 돌려준다. */
function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      fields.push(field);
      field = '';
    } else field += c;
  }
  fields.push(field);
  return { fields, open: quoted };
}

/** CSV를 한 행(칸 배열)씩 돌려준다. 따옴표 안 줄바꿈은 다음 줄과 이어 붙인다. */
async function* readCsv(file) {
  const lines = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let pending = null;
  for await (const line of lines) {
    const text = pending === null ? line.replace(/^\uFEFF/, '') : `${pending}\n${line}`;
    const { fields, open } = splitCsvLine(text);
    if (open) {
      pending = text;
      continue;
    }
    pending = null;
    yield fields;
  }
  if (pending !== null) throw new Error('CSV가 닫히지 않은 따옴표로 끝났어요.');
}

async function build(file) {
  let index = null;
  const kept = new Map();
  const counts = { rows: 0, yongin: 0, food: 0, pub: 0, badCoords: 0, outside: 0, duplicate: 0 };
  for await (const fields of readCsv(file)) {
    if (index === null) {
      index = Object.fromEntries(
        Object.entries(COLUMNS).map(([key, header]) => {
          const at = fields.findIndex((f) => f.trim() === header);
          if (at < 0) throw new Error(`CSV 헤더에 '${header}' 열이 없어요.`);
          return [key, at];
        }),
      );
      continue;
    }
    counts.rows += 1;
    const get = (key) => (fields[index[key]] ?? '').trim();
    if (!get('district').startsWith('용인시')) continue;
    counts.yongin += 1;
    if (get('major') !== '음식') continue;
    counts.food += 1;
    if (get('middle') === '주점') {
      counts.pub += 1;
      continue;
    }
    const point = { lat: round7(Number(get('lat'))), lng: round7(Number(get('lng'))) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !inKorea(point)) {
      counts.badCoords += 1;
      continue;
    }
    const nearest = CAMPUSES.map((c) => ({ id: c.id, d: distanceMeters(c, point) }))
      .filter((c) => c.d <= RADIUS_M)
      .sort((a, b) => a.d - b.d || a.id - b.id)[0];
    if (nearest === undefined) {
      counts.outside += 1;
      continue;
    }
    const sourceId = get('sourceId');
    if (kept.has(sourceId)) {
      counts.duplicate += 1;
      continue;
    }
    kept.set(sourceId, {
      sourceId,
      name: [get('name'), get('branch')].filter((s) => s !== '').join(' '),
      category: categoryOf(get('middle'), get('minor')),
      industryMiddle: get('middle'),
      industryMinor: get('minor'),
      address: get('roadAddress') || get('jibunAddress'),
      district: get('district'),
      administrativeDong: get('dong'),
      lat: point.lat,
      lng: point.lng,
      campusId: nearest.id,
    });
  }
  if (index === null) throw new Error('CSV가 비어 있어요.');
  // 캠퍼스 → 상가업소번호 순(코드 단위 비교라 실행 환경에 상관없이 같다).
  const stores = [...kept.values()].sort(
    (a, b) => a.campusId - b.campusId || (a.sourceId < b.sourceId ? -1 : 1),
  );
  return { stores, counts };
}

async function main() {
  const [file, out = DEFAULT_OUT] = process.argv.slice(2);
  if (!file) {
    console.error('사용법: node scripts/build-yongin-stores.mjs <경기 CSV 경로> [출력 경로]');
    process.exit(1);
  }
  // 기준 연월은 배포 파일 이름 끝(`…_경기_202609.csv`)에서 읽는다.
  const yearMonth = /_(\d{4})(\d{2})\.csv$/i.exec(path.basename(file));
  if (yearMonth === null)
    throw new Error('파일 이름 끝에서 기준 연월(예: _202609.csv)을 찾지 못했어요.');
  const { stores, counts } = await build(path.resolve(file));
  const data = {
    dataset: '소상공인시장진흥공단_상가(상권)정보',
    datasetId: '15083033',
    basis: `${yearMonth[1]}-${yearMonth[2]}`,
    radiusM: RADIUS_M,
    stores,
  };
  writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
  const perCampus = CAMPUSES.map(
    (c) => `${c.id}:${stores.filter((s) => s.campusId === c.id).length}`,
  );
  console.log(
    `읽은 행 ${counts.rows} · 용인 ${counts.yongin} · 음식 ${counts.food} · 주점 제외 ${counts.pub} · ` +
      `좌표 오류 ${counts.badCoords} · 반경 밖 ${counts.outside} · 중복 ${counts.duplicate}`,
  );
  console.log(
    `남긴 상점 ${stores.length}(캠퍼스별 ${perCampus.join(' ')}) → ${path.relative(ROOT, out)}`,
  );
}

await main();
