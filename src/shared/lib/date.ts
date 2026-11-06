// 날짜 · 시각 표시는 모두 Asia/Seoul 고정이다. KST는 서머타임이 없어 +09:00 고정 오프셋으로 계산한다.
export const SEOUL_TZ = 'Asia/Seoul';

const OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface SeoulParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

function seoulParts(input: string | Date): SeoulParts {
  const date = typeof input === 'string' ? new Date(input) : input;
  // 서울 벽시계 시각을 UTC 필드로 읽기 위해 9시간을 더한다.
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: WEEKDAYS[shifted.getUTCDay()],
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function seoulDateKey(input: string | Date): string {
  const p = seoulParts(input);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function formatTourDate(iso: string): string {
  const p = seoulParts(iso);
  return `${p.month}월 ${p.day}일(${p.weekday})`;
}

export function formatMonthDay(iso: string): string {
  const p = seoulParts(iso);
  return `${p.month}월 ${p.day}일`;
}

export function formatShortDate(iso: string): string {
  const p = seoulParts(iso);
  return `${pad2(p.month)}/${pad2(p.day)}(${p.weekday})`;
}

/** `11.12` — V2 목록 행의 날짜. */
export function formatDotDate(iso: string): string {
  const p = seoulParts(iso);
  return `${pad2(p.month)}.${pad2(p.day)}`;
}

/** `11.12 (목)` */
export function formatDotDateWeekday(iso: string): string {
  return `${formatDotDate(iso)} (${seoulParts(iso).weekday})`;
}

/** `11.12 (목) 14:00~16:30` — V2 탐방 상세의 일정. 종료가 없으면 시작 시각만. */
export function formatDotDateTimeRange(startIso: string, endIso: string | null): string {
  const start = formatTime(startIso);
  const time = endIso === null ? start : `${start}~${formatTime(endIso)}`;
  return `${formatDotDateWeekday(startIso)} ${time}`;
}

export function formatTime(iso: string): string {
  const p = seoulParts(iso);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function formatTimeRange(startIso: string, endIso: string | null): string {
  const start = formatTime(startIso);
  return endIso === null ? start : `${start}–${formatTime(endIso)}`;
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function toSeoulIso(date: Date): string {
  const p = seoulParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}+09:00`;
}

export function seoulDateAt(dayKey: string, hhmm: string): string {
  return `${dayKey}T${hhmm}:00+09:00`;
}

export function addDaysKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function endOfSeoulDay(dayKey: string): string {
  return `${dayKey}T23:59:59+09:00`;
}

export function circled(n: number): string {
  return String.fromCodePoint(0x2460 + n - 1);
}
