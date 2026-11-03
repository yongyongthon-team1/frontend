# 방학 상권 캠퍼스 탐방

방학 동안 대학 캠퍼스 주변 상권을 학생이 가이드와 함께 탐방하고, 코스 안의 제휴 상점에서 쿠폰을 쓰는 모바일 우선 웹 앱의 프런트엔드입니다.

React 19 · Vite · TypeScript SPA입니다. 백엔드 없이도 돌도록 목업(MSW)이 먼저이고, 폭 480px 이상 화면에서는 가운데 폰 프레임(390px) 안에 그립니다.

## 시작하기

```bash
npm install
cp .env.example .env.local   # 목업 모드 · 시연 도구 켬
npm run dev                  # http://localhost:5173
```

## 명령어

| 명령                                                    | 하는 일                                               |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                                           | 개발 서버(5173). `/api`는 `DEV_API_TARGET`으로 프록시 |
| `npm run build`                                         | 타입 검사 + 프로덕션 빌드(`dist/`)                    |
| `npm run preview`                                       | 빌드 결과를 4173에서 띄움                             |
| `npm run test` · `npm run test:run`                     | Vitest 감시 모드 · 한 번 실행                         |
| `npm run typecheck` · `npm run lint` · `npm run format` | 타입 검사 · ESLint · Prettier 쓰기                    |
| `npm run e2e`                                           | Playwright E2E(아래)                                  |

커밋 · 푸시 전 확인: `npm run test:run && npm run typecheck && npm run lint && npm run build`. CI도 main 푸시마다 같은 검사를 돈다. E2E는 체크포인트마다 직접 돌린다.

## E2E

```bash
npx playwright install chromium   # 처음 한 번
npm run e2e
```

`npm run e2e`는 `VITE_*`를 고정한 프로덕션 빌드(목업 모드 · 시연 도구 켬, `playwright.config.ts`)를 `vite preview`로 띄우고 세 스펙을 돈다.

- `e2e/smoke.spec.ts`: 로그인 후 딥링크(`/my-tours`)를 새로고침해도 로그인 · 목업 데이터가 남는다.
- `e2e/golden-path.spec.ts`: 시연 골든 패스 전체. 고교생 추천 · 신청 → 가이드 승인 · AI 코스 초안 · 순서 변경 · 확정 → 고교생 코스 지도 · 쿠폰 → 사장님 사용 처리.
- `e2e/stage-viewport.spec.ts`: 무대 노트북 화면(브라우저 UI를 뺀 페이지 영역 1366×620 · 1280×600 · 1280×590 @1.5배)에서 관심 키워드 · 첫 추천 이유, 코스 초안 지점 3곳, 쿠폰 코드가 스크롤 없이 하단 탭 위에 보이는지 본다. 스크린샷은 `test-results/stage-{폭}x{높이}@{배율}x-{1~3}.png`.

골든 패스와 무대 점검은 페이지 오류나 실패한 `/api/` 요청이 하나라도 있으면 실패한다. 4173에 이미 떠 있는 서버가 있으면 그 서버를 그대로 쓰므로, 다른 설정으로 띄운 서버는 먼저 끈다.

## 환경변수

`.env.example`을 `.env.local`로 복사해 쓴다. `VITE_*` 값은 빌드에 들어가 브라우저에 노출된다. 테스트는 값을 고정해 개발자의 `.env.local`이 섞이지 않게 한다. Vitest는 커밋된 `.env.test`, E2E는 `playwright.config.ts`의 `webServer.env`를 쓴다.

| 이름                 | 뜻                                                                                                                                                                             | 기본값                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `VITE_API_BASE_URL`  | API 기본 경로                                                                                                                                                                  | `/api`                  |
| `VITE_API_MODE`      | `mock`(MSW 목업) · `real`(실서버). 주소 `?mode=`와 시연 패널 설정이 이 값보다 먼저다                                                                                           | `mock`                  |
| `VITE_MOCK_DOMAINS`  | 목업 모드에서 목업으로 받을 도메인. 쉼표로 나열한다(`auth`, `campuses`, `tours`, `applications`, `courses`, `coupons`, `demo` 등). 빠진 도메인은 `/api` 프록시로 실서버에 간다 | `all`                   |
| `VITE_DEMO_TOOLS`    | `true`면 시연 패널을 항상 보인다. 아니어도 `?demo=1`로 켤 수 있다                                                                                                              | `false`                 |
| `VITE_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키. 비어 있으면 도식 지도로 그린다(결정 0004)                                                                                                              | 없음                    |
| `VITE_DEMO_PASSWORD` | 실서버 시연 계정 비밀번호(빠른 로그인용). 목업은 시드 비밀번호 `demo1234`를 쓴다                                                                                               | `demo1234`              |
| `DEV_API_TARGET`     | `npm run dev`가 `/api`를 보낼 백엔드 주소. 번들에는 들어가지 않는다                                                                                                            | `http://localhost:8080` |

## 시연 계정

목업 비밀번호는 모두 `demo1234`다. 실서버에서는 백엔드가 같은 계정을 시드해야 하고, 비밀번호는 `VITE_DEMO_PASSWORD`다.

| 역할            | 이메일                              | 메모                                                                                                      |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 고교생          | `student@demo.kr`                   | 김민지. 인증 · 보호자 동의 완료, 골든 패스에서 신청하는 학생                                              |
| 고교생(인증 전) | `newbie@demo.kr`                    | 최하늘. 로그인하면 재학 인증 화면(`/verify`)으로 간다                                                     |
| 가이드          | `guide@demo.kr`                     | 정다은. 경희대 국제캠퍼스 산업디자인학과, 시연 탐방(1번)의 가이드                                         |
| 사장님          | `owner1@demo.kr` ~ `owner4@demo.kr` | 제휴 상점 서천 밥상 · 카페 모래시계 · 영통 분식집 · 보드게임 카페 다이스. 시연 패널의 `사장님`은 `owner1` |
| 운영자          | `admin@demo.kr`                     | 인증 심사                                                                                                 |

시연 패널(폭 900px 이상이면 프레임 옆, 좁으면 오른쪽 위 버튼)에서 역할을 바로 바꾸고, `쿠폰 가게 사장님으로 전환`으로 학생이 마지막으로 본 쿠폰의 가게 사장님이 되어 그 코드를 사용 처리 화면에 채운다.

## 원클릭 시연 링크

주소 하나로 시연 준비를 끝낸다. 초기화와 로그인은 첫 화면이 그려지기 전에 끝나고, 처리한 파라미터는 주소에서 지운다(`present`만 남긴다).

- 처음부터: `/?demo=1&reset=1&as=student&present=1`
- 코스 확정 단계부터(쿠폰 화면 바로 시연): `/?demo=1&reset=1&checkpoint=CONFIRMED&as=student&present=1`
- 발표 모드 끄기: `/?present=0`
- 실서버로: `/?demo=1&mode=real&key=<초기화 키>&reset=1&as=student`

| 파라미터     | 값                                             | 동작                                                                                                           |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `demo`       | `1`                                            | 시연 도구(시연 패널)를 켠다(브라우저에 저장)                                                                   |
| `reset`      | `1`                                            | 시연 데이터 초기화. 목업은 오늘 날짜 기준 시드로 되돌리고, 실서버는 백엔드 시연 리셋을 부른다. 로그인도 풀린다 |
| `checkpoint` | `START` · `APPLIED` · `APPROVED` · `CONFIRMED` | `reset`과 함께 쓴다. 골든 패스를 그 단계(처음 · 신청 · 승인 · 코스 확정)까지 진행한 데이터                     |
| `as`         | `student` · `guide` · `owner` · `admin`        | 그 역할의 시연 계정으로 빠른 로그인                                                                            |
| `present`    | `1` · `0`                                      | 발표 모드 켜기 · 끄기. 시연 패널이 역할 버튼 막대로 줄고 프레임에 역할 배지가 뜬다                             |
| `mode`       | `mock` · `real`                                | API 모드(브라우저에 저장, 다시 바꿀 때까지 유지)                                                               |
| `key`        | 문자열                                         | 실서버 초기화 키(헤더 `X-Demo-Key`)                                                                            |

## 문서 위치

- `docs/progress`: 진척 대시보드(`README.md`)와 개발 일지(`devlog.md`)
- `docs/decisions`: 결정 기록 0001~0009
- `docs/api/frontend-needs.md`: 백엔드에 요청한 API 계약 초안(골든 패스 엔드포인트 29개)
- `docs/reference`: 기획 레퍼런스 스냅샷(기능 명세 · ERD · 유저 플로우 · 와이어프레임 · 해커톤 규정)
- `docs/superpowers`: 프론트엔드 설계(`specs`)와 구현 계획 · 실행 중 판정(`plans`)
