// 목업 사진 보관소. DB에는 참조 문자열(`mock-file:…`)만 두고 파일 자체는 모듈 메모리에 둔다 — 새로고침하면 사라진다(2B-R9).

export const MOCK_FILE_PREFIX = 'mock-file:';

/** 시드 계정의 정적 견본 학생증(`public/mock-docs`, "견본" 표시 + 가상 이름). 새로고침해도 남는다. */
export const MOCK_DOC_SAMPLE = {
  HIGH_SCHOOL: '/mock-docs/student-id-hs.svg',
  UNIVERSITY: '/mock-docs/student-id-univ.svg',
} as const;

const files = new Map<string, Blob>();
const urls = new Map<string, string>();
let counter = 0;

/** 파일을 보관하고 참조(`mock-file:{시각36}-{n}`)를 돌려준다. */
export function putMockFile(file: Blob): string {
  counter += 1;
  const ref = `${MOCK_FILE_PREFIX}${Date.now().toString(36)}-${counter}`;
  files.set(ref, file);
  return ref;
}

export function getMockFile(ref: string): Blob | null {
  return files.get(ref) ?? null;
}

/** 화면에 그릴 object URL. 같은 참조는 같은 주소이고, 파일이 없거나 `URL.createObjectURL`이 없으면(jsdom) null. */
export function mockFileUrl(ref: string): string | null {
  const known = urls.get(ref);
  if (known) return known;
  const file = files.get(ref);
  if (!file || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(file);
  urls.set(ref, url);
  return url;
}

function revoke(ref: string): void {
  const url = urls.get(ref);
  if (url !== undefined) URL.revokeObjectURL(url);
  urls.delete(ref);
}

export function deleteMockFile(ref: string): void {
  revoke(ref);
  files.delete(ref);
}

export function clearMockFiles(): void {
  for (const ref of [...urls.keys()]) revoke(ref);
  files.clear();
}
