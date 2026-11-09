// 실서버 연동 점검: 배포 백엔드에 역할별 시험 계정을 가입 · 로그인하고, 읽기 API 응답을 파일로 떠 둔다.
// 쓰기는 가입 · 로그인뿐이다(탐방 개설 · 인증 제출 · 보호자 메일 같은 쓰기는 하지 않는다). 시험 계정은 실서버 DB에 남는다
// (이메일 `smoke-<역할>-<시각>@uniro.test`).
//
//   node scripts/smoke-real-api.mjs [백엔드 주소]      기본 http://13.211.202.139
//
// 화면에는 줄마다 `상태 코드 메서드 경로 → 응답 요약`을 찍고, 응답 원문 전체는 마지막 줄의 JSON 파일에 남는다.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://13.211.202.139').replace(/\/$/, '');
const STAMP = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const PASSWORD = `Smoke${STAMP.slice(-6)}a1`;
const ROLES = ['HIGH_SCHOOL', 'UNIVERSITY', 'OWNER', 'ADMIN'];

const log = [];

/** 응답 한 줄 요약: 봉투면 code와 data의 키(목록이면 개수와 첫 항목 키), 아니면 본문 앞부분. */
function summarize(body) {
  if (body === null || typeof body !== 'object') return String(body).slice(0, 120);
  if (!('code' in body)) return JSON.stringify(body).slice(0, 160);
  const { data } = body;
  let shape = 'data=null';
  if (Array.isArray(data)) shape = `data=array(${data.length})`;
  else if (data && typeof data === 'object') {
    const items = Array.isArray(data.items) ? data.items : null;
    shape = items
      ? `items(${items.length})${'total' in data ? ` total=${data.total}` : ''} 첫 항목 키=[${Object.keys(items[0] ?? {}).join(',')}]`
      : `키=[${Object.keys(data).join(',')}]`;
  }
  return `${body.code} ${shape}${body.code?.startsWith('E') ? ` "${body.message}"` : ''}`;
}

async function call(method, path, { token, body, label } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let status = 0;
  let parsed = null;
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    status = res.status;
    const text = await res.text();
    try {
      parsed = text === '' ? null : JSON.parse(text);
    } catch {
      parsed = text.slice(0, 300);
    }
  } catch (error) {
    parsed = `요청 실패: ${error.message}`;
  }
  const name = `${label ? `[${label}] ` : ''}${method} ${path}`;
  log.push({ name, status, body: parsed });
  console.log(`${String(status).padEnd(3)} ${name} → ${summarize(parsed)}`);
  return parsed;
}

const sessions = {};

console.log(`백엔드 ${BASE} · 시험 계정 접미사 ${STAMP}\n`);

await call('GET', '/campuses');
await call('POST', '/auth/login', {
  label: '틀린 비밀번호',
  body: { email: `nobody-${STAMP}@uniro.test`, password: 'Wrong1234' },
});
await call('POST', '/auth/signup', {
  label: '검증 실패',
  body: { email: 'not-an-email', password: 'short', name: '', role: 'HIGH_SCHOOL' },
});

for (const role of ROLES) {
  const email = `smoke-${role.toLowerCase().replace('_', '')}-${STAMP}@uniro.test`;
  await call('POST', '/auth/signup', {
    label: role,
    body: { email, password: PASSWORD, name: `점검${role.slice(0, 2)}`, role },
  });
  const login = await call('POST', '/auth/login', {
    label: role,
    body: { email, password: PASSWORD },
  });
  const token = login?.data?.access_token;
  if (!token) continue;
  sessions[role] = token;
  await call('GET', '/users/me', { label: role, token });
}

const hs = sessions.HIGH_SCHOOL;
const uni = sessions.UNIVERSITY;
const owner = sessions.OWNER;
const admin = sessions.ADMIN;

if (hs) {
  await call('GET', '/tours?page=1&size=5', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/users/me/tours?page=1&size=5', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/users/me/tour-wishes?page=1&size=5', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/users/me/coupons', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/campuses/1/places', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/stores/nearby?campus_id=1', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/tours/1', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/tours/1/course', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/stores/1/reviews?page=1&size=5', { label: 'HIGH_SCHOOL', token: hs });
  await call('GET', '/tours/1/applications', { label: '권한 없음', token: hs });
}
if (uni) {
  await call('GET', '/tour-wishes?campus_id=1&page=1&size=5', { label: 'UNIVERSITY', token: uni });
  await call('GET', '/users/me/tours?page=1&size=5', { label: 'UNIVERSITY', token: uni });
}
if (owner) {
  await call('GET', '/stores/search?keyword=%EC%B9%B4%ED%8E%98&page=1&size=5', {
    label: 'OWNER',
    token: owner,
  });
  await call('GET', '/users/me/store', { label: 'OWNER', token: owner });
  await call('GET', '/users/me/store/report', { label: 'OWNER', token: owner });
  await call('GET', '/coupons/NOPE-0000', { label: 'OWNER', token: owner });
}
if (admin) {
  await call('GET', '/admin/verifications?page=1&size=5', { label: 'ADMIN', token: admin });
}
await call('POST', '/auth/logout', { label: 'HIGH_SCHOOL', token: hs });

const out = join(tmpdir(), `uniro-smoke-${STAMP}.json`);
writeFileSync(out, JSON.stringify({ base: BASE, stamp: STAMP, calls: log }, null, 2));
console.log(`\n응답 원문: ${out}`);
