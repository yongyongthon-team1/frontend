/**
 * 배포 미리보기 잠금(HTTP Basic 인증)의 판정. 사용자 이름은 보지 않고 비밀번호만 맞춘다.
 * 비밀번호가 설정되지 않았으면 열지 않는다(잠긴 채로 둔다). 비밀번호는 ASCII만 쓴다(`atob`은 latin1로 푼다).
 * 루트 `middleware.ts`(Vercel 라우팅 미들웨어)가 쓴다 — 앱 번들에는 들어가지 않는다.
 */
export function isAuthorized(header: string | null, password: string | undefined): boolean {
  if (!password) return false;
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice('Basic '.length).trim());
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  return decoded.slice(separator + 1) === password;
}
