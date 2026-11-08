// Vercel 라우팅 미들웨어: 배포 미리보기를 HTTP Basic 인증(브라우저 비밀번호 창)으로 잠근다.
// Vercel의 Password Protection은 Hobby 플랜에서 쓸 수 없어 같은 효과를 미들웨어로 낸다.
// 비밀번호는 Vercel 환경 변수 `PREVIEW_PASSWORD`(저장소에 두지 않는다). 잠금은 선택이다 — 이 변수가 없거나 비어
// 있으면 잠그지 않고 그대로 통과시킨다(2026-11-08 사용자 요청으로 공개 배포). 다시 잠그려면 변수를 넣고 재배포한다.
// 로컬 개발 · E2E(vite)는 이 파일을 쓰지 않는다.
// Vercel이 미들웨어를 Node ESM으로 돌려 확장자 없는 상대 경로를 못 찾는다 — 컴파일된 .js를 가리킨다.
import { isAuthorized } from './src/deploy/basicAuth.js';

export const config = {
  // 목업 서비스 워커 스크립트는 잠그지 않는다 — 브라우저가 워커를 등록할 때 인증 정보를 안 보낼 수 있어,
  // 잠그면 앱이 목업 없이 떠 버린다. 이 스크립트에는 앱 데이터가 없다.
  matcher: ['/((?!mockServiceWorker\\.js).*)'],
};

export default function middleware(request: Request): Response | undefined {
  const password = process.env.PREVIEW_PASSWORD;
  if (!password) return undefined;
  if (isAuthorized(request.headers.get('authorization'), password)) {
    return undefined;
  }
  return new Response('UNIRO 미리보기는 비밀번호가 필요해요.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="UNIRO preview", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
