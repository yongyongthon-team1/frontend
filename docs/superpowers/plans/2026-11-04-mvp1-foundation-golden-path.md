# MVP 1단계 — 기반 + 시연 골든 패스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 목업 모드에서 시연 골든 패스(고교생 AI 추천 → 신청 / 가이드 승인 → AI 코스 → 확정 / 고교생 코스 지도 · 쿠폰 / 사장님 쿠폰 사용 처리)가 처음부터 끝까지 동작하는 React SPA와 그 기반(목업 API · 공통 UI · 시연 도구 · E2E · 배포 준비)을 만든다.

**Architecture:** Vite + React SPA 하나. 화면(`src/pages`)은 `src/features/*/queries.ts`의 훅만 쓰고, HTTP · DTO는 `src/features/*/api.ts`에만 둔다. 백엔드 명세가 오기 전까지 MSW가 ERD 모양의 인메모리 DB(localStorage 보존)와 명세 규칙(잠정) · AI 흉내로 `/api`를 대신한다. 시연 도구는 `src/demo`에 모은다.

**Tech Stack:** Vite 7 · React 19 · TypeScript 5 · React Router 7 · TanStack Query 5 · Zustand 5 · React Hook Form 7 + Zod 4 · Tailwind CSS 4 · Radix Dialog · sonner · lucide-react · pretendard · react-kakao-maps-sdk · MSW 2 · Vitest 3 + Testing Library + jsdom · Playwright · ESLint 9 + Prettier 3 · npm

**Rulings:** `docs/superpowers/plans/2026-11-04-mvp1-rulings.md` — 실행 중 판정(계획 리뷰 49건 반영). 같은 태스크에서 이 계획과 다르면 판정 문서가 우선한다.

**Spec:** `docs/superpowers/specs/2026-11-03-frontend-design.md` (근거 자료 `docs/reference/` — 화면 문구는 `docs/reference/wireframes/*.png`)

**이 계획의 범위:** 설계 5.3의 **P0 화면** + 공통 기반 + 시연 도구 + E2E + 배포 준비. **P1 화면은 "자리(placeholder) 라우트"로만** 두고 MVP 2단계 계획에서 채운다. 실서버 연동 · 하이파이 반영 · P2는 3단계 계획(백엔드 명세 · 시안 도착 후).

## Global Constraints

- 메이저 버전 고정: `react@19` `react-dom@19` `react-router@7` `@tanstack/react-query@5` `tailwindcss@4` `msw@2` `vite@7` `typescript@5` `vitest@3` `zustand@5` `zod@4`. `package-lock.json` 커밋. 11/8 이후 의존성 업그레이드 금지.
- 패키지 매니저는 npm만.
- **라우트 단위 코드 분할 금지**(`React.lazy`, route `lazy` 금지). 예외: `main.tsx`에서 목업 워커를 켤 때의 동적 import 하나.
- `src/pages/**`는 `@/shared/lib/http`와 `@/features/*/api`를 import하지 않는다(ESLint `no-restricted-imports`로 강제).
- 상태값은 ERD enum 그대로(`RECRUITING`, `PENDING`, `ISSUED` …). 한국어 라벨 · 표시 상태는 `src/features/*/model.ts`의 함수로만 만든다.
- 시간 판단(쿠폰 사용 가능, 신청 취소 가능)은 **서버가 준 값**(`Coupon.state`, `MyApplication.cancellable`)을 그린다. 프론트 컴포넌트에서 `new Date()`로 유효 여부를 판단하지 않는다.
- 날짜 · 시각: 주고받기는 `+09:00` ISO 8601, 날짜만은 `YYYY-MM-DD`, 시각만은 `HH:mm`. 표시는 Asia/Seoul 고정이고 `src/shared/lib/date.ts`만 쓴다.
- UI 한국어. 모바일 390px 기준, 좌우 여백 20px, TopBar 68px, BottomTabBar 81px, 기본 Button 높이 50px, TextField 56px, 터치 영역 44px 이상.
- 화면 문구는 각 태스크에 적힌 문구가 우선이고, 적히지 않은 문구는 해당 와이어프레임 이미지 그대로 쓴다. 단 가이드 코스 화면의 옛 추천 기준 문구는 쓰지 않는다(설계 5.6).
- 비활성 버튼에는 항상 **사유 + 다음 행동**을 함께 보여준다(`Button`의 `hint`).
- AI가 만든 결과에는 `AiBadge`(✦)와 이유 한 줄을 붙인다.
- 목업 시드는 초기화한 날(Asia/Seoul)의 **"오늘" 기준 상대 날짜**다. C-01 목업은 **관련 후보 중 제휴 상점을 최소 1곳 포함**한다.
- 폰트는 npm `pretendard`로 번들한다(외부 CDN 금지). 외부 스크립트는 카카오맵 SDK 하나만 쓴다.
- 데모 계정 비밀번호 기본값 `demo1234`(env `VITE_DEMO_PASSWORD`로 덮어씀).
- 커밋: 태스크마다 main에 직접 커밋, 메시지 `feat|fix|test|docs|chore: 한국어 요약`. **푸시는 사용자 확인 후에만.**
- 모든 태스크(Task 1 제외)의 마지막 구현 단계 = **진척 문서 갱신**(`docs/progress/README.md`의 해당 행 상태 + `docs/progress/devlog.md` 오늘 날짜 한 줄).

## Review Focus

1. **한글 입력 조합 중 Enter** — 조합을 확정하려고 누른 Enter가 폼을 제출하면 안 된다 → Task 11 LoginPage 테스트(`preventImeEnter`).
2. **새로고침 · 딥링크** — 배포 빌드에서 `/my-tours` 같은 주소를 새로고침해도 로그인 상태와 목업 데이터가 유지되고, 목업 워커가 첫 API 요청 전에 켜져야 한다 → Task 12 E2E smoke.
3. **무대 노트북 화면(1280×720 · 1366×768)** — 골든 패스 핵심 정보(관심 키워드 · 첫 추천 이유, 코스 초안 지점, 쿠폰 코드)가 스크롤 없이 보여야 한다 → Task 22 `toBeInViewport` 검사.
4. **역할 전환 직후 이전 역할의 캐시** — 전환 직후 이전 사용자의 데이터가 한 프레임도 보이면 안 된다 → Task 21 테스트(전환 시 쿼리 캐시 0개).
5. **지난 리허설의 localStorage** — 손상된 JSON이나 옛 버전 목업 DB가 앱을 깨뜨리면 안 되고 시드로 복구돼야 한다 → Task 6 테스트.
6. (추가) **버튼 연타** — 승인 · 사용 처리를 두 번 눌러도 요청은 한 번만 나가야 한다 → Task 18 · Task 20 테스트.

---

## 파일 구조

```
package.json · tsconfig.json · tsconfig.node.json · vite.config.ts · index.html · eslint.config.js
.prettierrc.json · .gitignore · .env.example · vercel.json · playwright.config.ts · .github/workflows/ci.yml
public/mockServiceWorker.js                    (msw init 생성)
e2e/smoke.spec.ts · e2e/golden-path.spec.ts · e2e/stage-viewport.spec.ts
docs/progress/README.md · docs/progress/devlog.md · docs/decisions/0001~0009-*.md · docs/api/frontend-needs.md
src/
  main.tsx                     부트스트랩: 시연 파라미터 적용 → 목업 워커 시작 → 렌더
  app/
    App.tsx · providers.tsx · routes.tsx · router.tsx · tabs.ts
    guards/RequireAuth.tsx · guards/RequireRole.tsx
    layouts/AppShell.tsx · layouts/MobileFrame.tsx · layouts/RoleTabLayout.tsx · layouts/FrameContext.tsx
    ErrorPage.tsx · NotFoundPage.tsx
  shared/
    config/env.ts · config/demoAccounts.ts
    lib/cn.ts · lib/date.ts · lib/errors.ts · lib/http.ts · lib/ime.ts
    api/queryKeys.ts
    ui/ Button · TextField · Textarea · Select · TopBar · BottomTabBar · StatusChip · InfoCard · Badge · AiBadge
        KeywordChips · AiLoading · CodeInput · EmptyState · ErrorState · Skeleton · BottomSheet · ConfirmDialog · Page (.tsx)
  styles/ tokens.css · globals.css
  features/
    auth/        model.ts · landing.ts · session.ts · api.ts · queries.ts
    campuses/    model.ts · api.ts · queries.ts · components/InsightCard.tsx
    tours/       model.ts · api.ts · queries.ts · examples.ts · lastQuery.ts · recommendationParams.ts · components/TourCard.tsx
    applications/ model.ts · api.ts · queries.ts
    courses/     model.ts · api.ts · queries.ts · kakaoLoader.ts · components/MapView.tsx · SchematicMap.tsx · StoreSheet.tsx · StopList.tsx
    coupons/     model.ts · api.ts · queries.ts
  mocks/
    clock.ts · latency.ts · browser.ts · node.ts · registry.ts
    db/schema.ts · db/seed.ts · db/store.ts · db/geo.ts
    rules/errors.ts · rules/applications.ts · rules/coupons.ts · rules/courses.ts · rules/views.ts
    ai/interests.ts · ai/recommend.ts · ai/course.ts
    handlers/ auth.ts · campuses.ts · tours.ts · applications.ts · courses.ts · coupons.ts · demo.ts · util.ts
  demo/ demoStore.ts · demoParams.ts · quickLogin.ts · resetDemo.ts · DemoPanel.tsx · RoleBadge.tsx
  pages/
    PlaceholderPage.tsx
    auth/LoginPage.tsx
    student/ HomePage · RecommendationsPage · TourDetailPage · ApplyPage · ApplyDonePage · MyToursPage
             MyTourDetailPage · CourseMapPage · CouponListPage · CouponDetailPage (.tsx)
    guide/   GuideToursPage · ApplicantsPage · CourseDraftPage · CourseEditPage · CourseConfirmedPage (.tsx)
    owner/   CouponRedeemPage.tsx
  test/ setup.ts · renderApp.tsx
```

테스트 파일은 대상 옆에 `*.test.ts(x)`로 둔다.

---

### Task 1: 프로젝트 셋업과 품질 도구

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.env.example`, `.github/workflows/ci.yml`, `src/main.tsx`, `src/app/App.tsx`, `src/styles/globals.css`, `src/vite-env.d.ts`, `src/shared/lib/cn.ts`, `src/test/setup.ts`
- Test: `src/shared/lib/cn.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`(clsx + tailwind-merge) · 경로 별칭 `@/` → `src/` · npm scripts `dev` `build` `preview` `typecheck` `lint` `format` `test` `test:run` `e2e`

- [ ] **Step 1: `package.json` 작성 후 설치**

dependencies: `react@^19 react-dom@^19 react-router@^7 @tanstack/react-query@^5 zustand@^5 react-hook-form@^7 zod@^4 @hookform/resolvers@^5 @radix-ui/react-dialog@^1 sonner@^2 lucide-react clsx@^2 tailwind-merge@^3 pretendard@^1 react-kakao-maps-sdk@^1`
devDependencies: `vite@^7 @vitejs/plugin-react@^5 typescript@~5.9 @types/react@^19 @types/react-dom@^19 @types/node@^22 tailwindcss@^4 @tailwindcss/vite@^4 vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 @testing-library/dom@^10 msw@^2 @playwright/test@^1 eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-react-hooks@^5 eslint-plugin-react-refresh@^0.4 globals@^16 prettier@^3`
scripts: `"dev":"vite"`, `"build":"tsc --noEmit -p tsconfig.json && vite build"`, `"preview":"vite preview --port 4173"`, `"typecheck":"tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json"`, `"lint":"eslint ."`, `"format":"prettier --write ."`, `"test":"vitest"`, `"test:run":"vitest run"`, `"e2e":"playwright test"`.

Run: `npm install && npx msw init public --save`
Expected: `package-lock.json`, `public/mockServiceWorker.js` 생성, `package.json`에 `"msw": {"workerDirectory": ["public"]}`

- [ ] **Step 2: 설정 파일 작성**

- `vite.config.ts`: `defineConfig` from `vitest/config`; plugins `react()`, `tailwindcss()`; alias `@` → `./src`; `server.port 5173`, `server.proxy['/api']` → `loadEnv(mode, cwd, '').DEV_API_TARGET ?? 'http://localhost:8080'`(changeOrigin); `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false, include: ['src/**/*.test.{ts,tsx}'] }`.
- `tsconfig.json`: `strict`, `jsx: react-jsx`, `moduleResolution: bundler`, `paths: {"@/*": ["./src/*"]}`, `types: ["vite/client"]`, include `src`. `tsconfig.node.json`: `vite.config.ts`, `playwright.config.ts`, `e2e`.
- `eslint.config.js`: flat config(js.recommended + typescript-eslint recommended + react-hooks `recommended-latest` + react-refresh `only-export-components` warn), ignore `dist`, `public/mockServiceWorker.js`, `playwright-report`, `test-results`. 추가 규칙 — files `src/pages/**`: `no-restricted-imports` patterns `['@/shared/lib/http', '@/features/*/api']`, message `"화면은 features/*/queries.ts 훅만 쓴다 (설계 5.2)"`.
- `.prettierrc.json`: `{"singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all"}`.
- `.gitignore`: `node_modules dist .env.local .vercel playwright-report test-results coverage .DS_Store`.
- `.env.example`:
  ```
  VITE_API_BASE_URL=/api
  VITE_API_MODE=mock
  VITE_MOCK_DOMAINS=all
  VITE_DEMO_TOOLS=true
  VITE_KAKAO_MAP_KEY=
  VITE_DEMO_PASSWORD=demo1234
  DEV_API_TARGET=http://localhost:8080
  ```
- `index.html`: `<html lang="ko">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, title `방학 상권 캠퍼스 탐방`, `<div id="root">`.
- `src/styles/globals.css`: `@import "tailwindcss";` (토큰은 Task 10).
- `src/main.tsx`: `createRoot(...).render(<StrictMode><App/></StrictMode>)`, `import './styles/globals.css'`. `src/app/App.tsx`: 임시로 `<main>방학 상권 캠퍼스 탐방</main>`.
- `src/test/setup.ts`: `import '@testing-library/jest-dom/vitest'` 와 `afterEach(cleanup)`(MSW 서버는 Task 3에서 추가).

- [ ] **Step 3: 실패하는 테스트 작성** — `src/shared/lib/cn.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('뒤에 온 Tailwind 클래스가 이긴다', () => expect(cn('px-2', 'px-4')).toBe('px-4'));
  it('false 값은 버린다', () => expect(cn('a', false && 'b', 'c')).toBe('a c'));
});
```

- [ ] **Step 4: 실패 확인** — Run: `npm run test:run -- src/shared/lib/cn.test.ts` / Expected: FAIL (`./cn` 없음)
- [ ] **Step 5: `cn(...inputs: ClassValue[]): string` 구현** — `twMerge(clsx(inputs))`.
- [ ] **Step 6: 통과 확인** — Run: `npm run test:run && npm run typecheck && npm run lint && npm run build` / Expected: 모두 성공
- [ ] **Step 7: CI 작성** — `.github/workflows/ci.yml`: `on: push: branches: [main]`, ubuntu-latest, `actions/setup-node@v4`(node 22, cache npm) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm run test:run` → `npm run build`.
- [ ] **Step 8: README 갱신** — 프로젝트 한 줄 소개, `npm install` · `cp .env.example .env.local` · `npm run dev` · `npm run test:run`, 문서 위치(`docs/superpowers/specs`, `docs/reference`, `docs/progress`).
- [ ] **Step 9: 커밋**

```bash
git add -A && git commit -m "chore: Vite·React·TS 프로젝트 셋업과 품질 도구(ESLint·Prettier·Vitest·CI)"
```

---

### Task 2: 진척 문서와 결정 기록

**Files:**
- Create: `docs/progress/README.md`, `docs/progress/devlog.md`, `docs/decisions/0001-single-spa.md` … `0009-commit-to-main.md`

**Interfaces:**
- Produces: 진척 대시보드의 표 형식(이후 모든 태스크가 행을 갱신). 상태 표기: `⬜` 미착수 · `🟨` 진행 중 · `✅` 완료 · `➖` 해당 없음 · `자리` placeholder 라우트.

- [ ] **Step 1: `docs/progress/README.md` 작성** — 섹션 순서와 표 머리글을 아래로 고정한다.
  1. `## 체크포인트` — 표 `| 날짜 | 체크포인트 | 완료 기준 | 상태 |`, 행 6개(설계 1장 표 그대로 + 팀 공식 일정 링크 `https://app.notion.com/p/408e0c1995d680e8be5cce86f42d362d`).
  2. `## 화면 진척` — 표 `| 코드 | 화면 | 라우트 | 우선 | UI | 목업 | 실API | 하이파이 | QA |`. 와이어프레임 36장 전부(코드 · 이름은 `docs/reference/wireframes.md` 목록, 라우트 · 우선순위는 설계 5.3)와 와이어 없는 라우트(`/explore`, `/owner/me`, `/guide/tours/:tourId/course`, 404) 행. 초기값 모두 `⬜`, OUT 행은 전부 `➖`.
  3. `## API 연동` — 표 `| 도메인 | 메서드 · 경로 | 쓰는 화면 | 계약 합의 | 목업 | 실서버 | 배포 확인 |` (행은 Task 4가 채움).
  4. `## 팀 요청 · 블로커` — 표 `| # | 대상 | 요청 | 기한 | 상태 |`. 설계 9장 18건을 그대로 옮기고 대상(백엔드 · 디자인 · 기획 · 운영진 · 사용자)과 기한(설계에 날짜가 있으면 그 날짜, 없으면 `11/8`)을 채운다.
  5. `## 열린 질문` — 비어 있으면 "없음".
- [ ] **Step 2: `docs/progress/devlog.md`** — `## 2026-11-03`(기획 문서 수집 · 설계 초안 · 빌더 리뷰 · 사용자 결정 3건), `## 2026-11-04`(불일치 정리 · 설계 승인 · 1단계 구현 계획 · Task 1 셋업) 항목을 `한 일 / 다음 할 일 / 이슈` 형식으로.
- [ ] **Step 3: 결정 기록 9개** — 각 파일은 `# 제목` · `- 날짜` · `## 맥락` · `## 결정` · `## 결과` 세 단락 이내. 0001 단일 SPA · 0002 MSW 목업 선개발(도메인 단위 교체, 시연은 섞지 않음) · 0003 토큰 기반 스타일 · 0004 카카오맵 + 도식 지도 폴백 · 0005 Vercel `/api` 프록시 · 0006 라우트 lazy 미사용 · 0007 시연 데이터 당일 날짜 시드(실서버 기본 + 리셋 수단) · 0008 C-01 제휴 상점 최소 1곳 포함 · 0009 main 직접 커밋 · 푸시는 확인 후. 내용은 설계 4장 · 5장 문장을 근거로 쓴다.
- [ ] **Step 4: 형식 검증** — Run: `grep -cE '^\| \`(hs|guide|owner)-' docs/progress/README.md` / Expected: `36`
- [ ] **Step 5: 커밋**

```bash
git add docs/progress docs/decisions && git commit -m "docs: 진척 대시보드·개발 일지·결정 기록 9건 추가"
```

---

### Task 3: 공통 라이브러리 — 날짜 · 에러 코드 · HTTP 클라이언트 · 환경 설정

**Files:**
- Create: `src/shared/lib/types.ts`, `src/shared/lib/date.ts`, `src/shared/lib/errors.ts`, `src/shared/lib/http.ts`, `src/shared/config/env.ts`, `src/mocks/node.ts`
- Modify: `src/test/setup.ts`
- Test: `src/shared/lib/date.test.ts`, `src/shared/lib/errors.test.ts`, `src/shared/lib/http.test.ts`, `src/shared/config/env.test.ts`

**Interfaces:**
- Produces (`types.ts`, 여러 계층이 같이 쓰는 작은 타입): `interface ActionLink { label: string; to: string }` · `type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'`
- Produces (`date.ts`, `Intl.DateTimeFormat` + 고정 오프셋 +09:00, KST는 서머타임이 없다):
  `SEOUL_TZ = 'Asia/Seoul'` · `seoulDateKey(input: string | Date): string` · `formatTourDate(iso): string`('11월 15일(일)') · `formatMonthDay(iso): string`('11월 15일') · `formatShortDate(iso): string`('11/15(일)') · `formatTime(iso): string`('14:00') · `formatTimeRange(startIso, endIso: string | null): string` · `formatDuration(startIso, endIso): string` · `toSeoulIso(date: Date): string` · `seoulDateAt(dayKey: string, hhmm: string): string` · `addDaysKey(dayKey: string, days: number): string` · `endOfSeoulDay(dayKey: string): string` · `circled(n: number): string`('①'…)
- Produces (`errors.ts`): `ERROR_CODES`(아래 표의 키, `as const`) · `type ErrorCode` · `ERROR_MESSAGES: Record<ErrorCode, string>` · `errorMessage(code: string | undefined | null, fallback?: string): string`
- Produces (`http.ts`): `DEFAULT_TIMEOUT_MS = 15_000` · `AI_TIMEOUT_MS = 30_000` · `class ApiError extends Error { status: number; code: string; fieldErrors?: Record<string, string>; details?: Record<string, unknown> }` · `configureHttp(partial: Partial<HttpConfig>): void`(`HttpConfig = { baseUrl: string; getToken(): string | null; onUnauthorized(): void }`) · `request<T>(path: string, options?: RequestOptions): Promise<T>` · `upload<T>(path: string, form: FormData, options?: Omit<RequestOptions, 'body'>): Promise<T>` · `RequestOptions = { method?: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE'; body?: unknown; headers?: Record<string,string>; timeoutMs?: number }`
- Produces (`env.ts`): `type ApiMode = 'mock' | 'real'` · `type MockDomain = 'auth'|'campuses'|'tours'|'applications'|'courses'|'coupons'|'demo'|'stores'|'reviews'|'verification'|'admin'` · `interface AppEnv { apiBaseUrl: string; apiMode: ApiMode; mockDomains: MockDomain[] | 'all'; demoTools: boolean; kakaoMapKey: string | null; demoPassword: string }` · `readEnv(raw: Record<string, unknown>): AppEnv` · `env: AppEnv` · `resolveApiMode(base: ApiMode, override: ApiMode | null, search: string): ApiMode`(우선순위: URL `?mode=` > override > base)
- Produces (`mocks/node.ts`): `server = setupServer()` (핸들러는 Task 9에서 등록)

에러 문구 표(그대로 쓴다):

| 코드 | 문구 |
|---|---|
| UNAUTHORIZED | 다시 로그인해 주세요. |
| FORBIDDEN | 이 작업을 할 권한이 없어요. |
| NOT_FOUND | 찾을 수 없어요. |
| VALIDATION | 입력값을 다시 확인해 주세요. |
| EMAIL_DUPLICATE | 이미 가입된 이메일이에요. |
| INVALID_CREDENTIALS | 이메일 또는 비밀번호가 맞지 않아요. |
| NOT_VERIFIED | 재학 인증이 승인된 뒤에 할 수 있어요. |
| GUARDIAN_NOT_AGREED | 보호자 동의가 끝난 뒤에 신청할 수 있어요. |
| TOUR_NOT_RECRUITING | 모집이 끝난 탐방이에요. |
| TOUR_CLOSED | 정원이 마감됐어요. |
| DUPLICATE_APPLICATION | 이미 신청한 탐방이에요. |
| REAPPLY_AFTER_REJECT | 거절된 탐방에는 다시 신청할 수 없어요. |
| CANCEL_AFTER_TOUR_DATE | 탐방 날짜가 되어 취소할 수 없어요. |
| TOUR_ALREADY_COMPLETED | 이미 완료된 탐방이에요. |
| CAPACITY_EXCEEDED | 정원을 넘겨 승인할 수 없어요. |
| ALREADY_PROCESSED | 이미 처리된 요청이에요. |
| NO_APPROVED_APPLICANTS | 승인한 신청자가 있어야 코스를 만들 수 있어요. |
| COURSE_NOT_DRAFT | 확정된 코스는 수정할 수 없어요. |
| COURSE_EMPTY | 지점이 하나 이상 있어야 확정할 수 있어요. |
| COURSE_NOT_READY | 가이드가 코스를 준비 중이에요. |
| OUTSIDE_VACATION | 방학 기간 안의 날짜만 고를 수 있어요. |
| GUIDE_PROFILE_REQUIRED | 가이드 프로필(학과)을 먼저 작성해 주세요. |
| BIZ_MISMATCH | 사업자 정보가 일치하지 않아요. 다시 입력해 주세요. |
| BIZ_CLOSED | 휴업 또는 폐업한 사업자예요. |
| STORE_ALREADY_LINKED | 이미 다른 사장님 계정에 연결된 가게예요. |
| STORE_LIMIT | 계정당 가게는 1개만 연결할 수 있어요. |
| PARTNERSHIP_PERIOD_INVALID | 제휴 기간을 다시 확인해 주세요. |
| COUPON_NOT_FOUND | 존재하지 않는 6자리 코드예요. 입력값을 다시 확인해 주세요. |
| COUPON_OTHER_STORE | 다른 가게 쿠폰이에요. 코드를 다시 확인해 주세요. |
| COUPON_ALREADY_USED | 이미 사용된 쿠폰이에요. |
| COUPON_EXPIRED | 만료된 쿠폰이에요. |
| COUPON_NOT_YET | 탐방 당일에만 사용할 수 있어요. |
| REVIEW_NOT_ALLOWED | 쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요. |
| REVIEW_DUPLICATE | 이미 리뷰를 작성했어요. |
| FILE_TYPE | jpg, png, heic 이미지만 올릴 수 있어요. |
| FILE_TOO_LARGE | 10MB 이하 이미지만 올릴 수 있어요. |
| CONSENT_LINK_EXPIRED | 동의 링크가 만료됐어요. 학생에게 다시 요청해 달라고 해 주세요. |
| CONSENT_LINK_INVALID | 잘못된 동의 링크예요. |
| TIMEOUT | 응답이 늦어지고 있어요. 다시 시도해 주세요. |
| NETWORK | 네트워크 연결을 확인해 주세요. |
| UNKNOWN | 문제가 생겼어요. 잠시 후 다시 시도해 주세요. |

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// date.test.ts
it('UTC 16:30은 서울 다음 날', () => expect(seoulDateKey('2026-11-14T16:30:00Z')).toBe('2026-11-15'));
it('탐방 날짜 표기', () => expect(formatTourDate('2026-11-15T14:00:00+09:00')).toBe('11월 15일(일)'));
it('월일 표기', () => expect(formatMonthDay('2026-11-15T14:00:00+09:00')).toBe('11월 15일'));
it('짧은 날짜', () => expect(formatShortDate('2026-11-15T14:00:00+09:00')).toBe('11/15(일)'));
it('시각', () => expect(formatTime('2026-11-15T05:00:00Z')).toBe('14:00'));
it('시간 범위는 en dash', () =>
  expect(formatTimeRange('2026-11-15T14:00:00+09:00', '2026-11-15T16:30:00+09:00')).toBe('14:00–16:30'));
it('종료가 없으면 시작만', () => expect(formatTimeRange('2026-11-15T14:00:00+09:00', null)).toBe('14:00'));
it('소요 시간', () => {
  expect(formatDuration('2026-11-15T14:00:00+09:00', '2026-11-15T16:30:00+09:00')).toBe('2시간 30분');
  expect(formatDuration('2026-11-15T14:00:00+09:00', '2026-11-15T16:00:00+09:00')).toBe('2시간');
  expect(formatDuration('2026-11-15T14:00:00+09:00', '2026-11-15T14:45:00+09:00')).toBe('45분');
});
it('서울 ISO', () => expect(toSeoulIso(new Date('2026-11-15T05:00:00Z'))).toBe('2026-11-15T14:00:00+09:00'));
it('날짜+시각', () => expect(seoulDateAt('2026-11-15', '14:00')).toBe('2026-11-15T14:00:00+09:00'));
it('날짜 더하기는 해를 넘긴다', () => expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01'));
it('하루 끝', () => expect(endOfSeoulDay('2026-11-15')).toBe('2026-11-15T23:59:59+09:00'));
it('원문자', () => expect([1, 2, 3].map(circled).join('')).toBe('①②③'));

// errors.test.ts
it('알려진 코드는 표의 문구', () => expect(errorMessage('TOUR_CLOSED')).toBe('정원이 마감됐어요.'));
it('모르는 코드는 fallback, 없으면 UNKNOWN 문구', () => {
  expect(errorMessage('WHAT', '기본')).toBe('기본');
  expect(errorMessage(undefined)).toBe('문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
});

// http.test.ts — server.use(...)로 각 케이스 핸들러를 건다. baseUrl '/api'.
it('JSON 응답을 돌려준다', async () => { /* GET /api/ping → {ok:true} */ expect(await request('/ping')).toEqual({ ok: true }); });
it('토큰이 있으면 Bearer 헤더', async () => { /* configureHttp({getToken:()=>'t1'}); 핸들러가 헤더를 그대로 반환 */ expect(await request('/echo')).toEqual({ auth: 'Bearer t1' }); });
it('에러 봉투를 ApiError로', async () => {
  /* 409 {code:'TOUR_CLOSED', message:'x', details:{a:1}} */
  await expect(request('/err')).rejects.toMatchObject({ status: 409, code: 'TOUR_CLOSED', details: { a: 1 } });
});
it('401이면 onUnauthorized 호출', async () => { /* 401 → spy 1회, code 'UNAUTHORIZED' */ });
it('시간이 지나면 TIMEOUT', async () => {
  /* 핸들러 await delay('infinite') */
  await expect(request('/slow', { timeoutMs: 30 })).rejects.toMatchObject({ code: 'TIMEOUT' });
});
it('204는 undefined', async () => { expect(await request('/none', { method: 'DELETE' })).toBeUndefined(); });
it('JSON이 아닌 500은 UNKNOWN', async () => { await expect(request('/plain')).rejects.toMatchObject({ status: 500, code: 'UNKNOWN' }); });

// env.test.ts
it('기본값', () => expect(readEnv({})).toEqual({ apiBaseUrl: '/api', apiMode: 'mock', mockDomains: 'all', demoTools: false, kakaoMapKey: null, demoPassword: 'demo1234' }));
it('도메인 목록', () => expect(readEnv({ VITE_MOCK_DOMAINS: 'auth,tours' }).mockDomains).toEqual(['auth', 'tours']));
it('잘못된 모드는 mock', () => expect(readEnv({ VITE_API_MODE: 'x' }).apiMode).toBe('mock'));
it('URL 모드가 가장 우선', () => {
  expect(resolveApiMode('real', null, '?mode=mock')).toBe('mock');
  expect(resolveApiMode('mock', 'real', '')).toBe('real');
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/shared` / Expected: FAIL (모듈 없음)
- [ ] **Step 3: `mocks/node.ts`와 setup 갱신** — `export const server = setupServer()`; `setup.ts`에 `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))`, `afterEach(() => server.resetHandlers())`, `afterAll(() => server.close())`, `afterEach(() => localStorage.clear())`.
- [ ] **Step 4: 네 모듈 구현** — `request`는 URL을 `new URL(baseUrl + path, window.location.origin)`으로 만든다(jsdom · 브라우저 공통). 타임아웃은 `AbortController`, 네트워크 실패는 `NETWORK`, 본문이 비면 `undefined`. `upload`는 `Content-Type`을 직접 넣지 않는다(FormData 경계). 모든 에러 응답은 JSON이면 `{code,message,fieldErrors,details}`를 그대로, 아니면 `UNKNOWN`.
- [ ] **Step 5: 통과 확인** — Run: `npm run test:run -- src/shared && npm run typecheck` / Expected: PASS
- [ ] **Step 6: 진척 문서 갱신** — devlog에 "공통 라이브러리" 한 줄.
- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat: 날짜·에러 코드·HTTP 클라이언트·환경 설정 공통 라이브러리"`

---

### Task 4: API 계약 초안과 도메인 타입

**Files:**
- Create: `docs/api/frontend-needs.md`, `src/features/auth/model.ts`, `src/features/campuses/model.ts`, `src/features/tours/model.ts`, `src/features/applications/model.ts`, `src/features/courses/model.ts`, `src/features/coupons/model.ts`
- Test: `src/features/tours/model.test.ts`, `src/features/courses/model.test.ts`
- Modify: `docs/progress/README.md`(API 연동 표 채우기)

**Interfaces:**
- Produces — 타입(전부 `export`). 필드 이름 · 타입을 그대로 쓴다.

```ts
// auth/model.ts
type Role = 'HIGH_SCHOOL' | 'UNIVERSITY' | 'OWNER' | 'ADMIN';
type VerificationStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';      // NONE = 미제출
type GuardianStatus = 'NONE' | 'PENDING' | 'AGREED' | 'REJECTED' | 'EXPIRED'; // NONE = 미요청
interface StudentProfile { highSchoolName: string | null; grade: number | null; interestedMajor: string | null }
interface GuideProfile { universityId: number | null; major: string | null; introduction: string | null }
interface Me { id: number; email: string; name: string; role: Role; verificationStatus: VerificationStatus;
  rejectionReason: string | null; guardianStatus: GuardianStatus; studentProfile: StudentProfile | null;
  guideProfile: GuideProfile | null; businessVerified: boolean; storeId: number | null }
interface LoginResponse { token: string; me: Me }
// campuses/model.ts
interface Vacation { startDate: string; endDate: string; label: string | null }
interface University { id: number; name: string; shortName: string; campusName: string; address: string | null;
  lat: number; lng: number; administrativeDong: string | null; vacations: Vacation[] }
interface Insight { universityId: number; title: string; text: string; source: string; isPlaceholder: boolean }
// tours/model.ts
type TourStatus = 'RECRUITING' | 'CLOSED' | 'CANCELED' | 'COMPLETED';
interface TourSummary { id: number; title: string; universityId: number; universityName: string; universityShortName: string;
  campusName: string; major: string | null; guideName: string; guideVerified: boolean; startsAt: string;
  endsAt: string | null; capacity: number; approvedCount: number; remainingSeats: number; status: TourStatus }
interface TourDetail extends TourSummary { introduction: string; guideIntroduction: string | null;
  openChatUrl: string | null; myApplication: { id: number; status: ApplicationStatus } | null }
interface RecommendationQuery { q: string; major?: string; universityId?: number; date?: string }
interface Recommendation { tour: TourSummary; reason: string }
interface RecommendationResult { headline: string; keywords: string[]; items: Recommendation[];
  fallback: null | 'SCHOOL' | 'ALL' }
// applications/model.ts
type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
interface MyApplication { id: number; status: ApplicationStatus; motivation: string; createdAt: string; tour: TourSummary;
  courseStatus: CourseStatus | null; openChatUrl: string | null; couponCount: number; cancellable: boolean }
interface Applicant { id: number; userName: string; grade: number | null; motivation: string; status: ApplicationStatus; verified: boolean }
interface ApplicantsBoard { tour: TourSummary; counts: { pending: number; approved: number; remaining: number };
  applicants: Applicant[]; course: { status: CourseStatus } | null }
interface GuideTourSummary extends TourSummary { counts: { total: number; pending: number; approved: number };
  courseStatus: CourseStatus | null }
// courses/model.ts
type CourseStatus = 'DRAFT' | 'CONFIRMED';
type StopType = 'CAMPUS' | 'STORE';
interface CourseStop { id: number; order: number; visitTime: string; type: StopType; name: string; category: string;
  lat: number; lng: number; description: string | null; recommendationReason: string | null; storeId: number | null;
  partnership: { discount: string } | null; review: { average: number | null; count: number; summary: string | null } | null;
  dataSource: string | null }
interface CourseTourInfo { id: number; title: string; universityId: number; universityShortName: string; campusName: string;
  startsAt: string; endsAt: string | null }
interface Course { tourId: number; status: CourseStatus; tour: CourseTourInfo; stops: CourseStop[]; interests: string[];
  criteria: string; confirmedAt: string | null; issuedCouponCount: number }
// coupons/model.ts
type CouponStatus = 'ISSUED' | 'USED' | 'EXPIRED';
type CouponState = 'BEFORE_DAY' | 'USABLE' | 'EXPIRED' | 'USED';   // 서버가 계산해서 준다
interface Coupon { id: number; code: string; status: CouponStatus; state: CouponState; discount: string; storeId: number;
  storeName: string; storeCategory: string; applicationId: number; tourId: number; tourTitle: string;
  tourStartsAt: string; expiresAt: string; usedAt: string | null; reviewWritten: boolean }
interface CouponLookup { code: string; state: CouponState; discount: string; storeName: string; tourTitle: string;
  tourStartsAt: string; studentName: string; usedAt: string | null }
interface RedeemResult { coupon: CouponLookup; tourVisitorCount: number; totalVisitorCount: number }
```

- Produces — 라벨 · 순수 함수:
  - `TOUR_STATUS_LABEL: Record<TourStatus, string>` = `{RECRUITING:'모집 중', CLOSED:'마감', CANCELED:'취소', COMPLETED:'완료'}`
  - `APPLICATION_STATUS_LABEL` = `{PENDING:'승인 대기', APPROVED:'승인됨', REJECTED:'거절됨', CANCELED:'취소됨'}`
  - `tourTitle(universityName: string, campusName: string, major: string | null): string` — 대학 이름 줄임(`한국외국어대학교`→`한국외대`, 그 밖은 끝의 `학교` 제거: `경희대학교`→`경희대`), 캠퍼스명이 `본교`면 생략, 학과가 없으면 `캠퍼스 탐방`.
  - `shortUniversityName(name: string): string` — 위 줄임 규칙.
  - `SLOT_OFFSETS_MIN = [0, 70, 120, 170, 220] as const` · `slotTimes(startsAt: string, count: number): string[]` — 5번째 뒤로는 50분씩.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tours/model.test.ts
it('제목: 대학 줄임 + 캠퍼스 + 학과', () =>
  expect(tourTitle('경희대학교', '국제캠퍼스', '산업디자인학과')).toBe('경희대 국제캠퍼스 산업디자인학과 탐방'));
it('제목: 본교는 생략, 한국외대 줄임', () => {
  expect(tourTitle('강남대학교', '본교', '사회복지학부')).toBe('강남대 사회복지학부 탐방');
  expect(tourTitle('한국외국어대학교', '글로벌캠퍼스', null)).toBe('한국외대 글로벌캠퍼스 캠퍼스 탐방');
});
// courses/model.test.ts
it('슬롯 시간은 와이어프레임과 같다', () =>
  expect(slotTimes('2026-11-15T14:00:00+09:00', 3)).toEqual(['14:00', '15:10', '16:00']));
it('6번째부터 50분 간격', () =>
  expect(slotTimes('2026-11-15T14:00:00+09:00', 6)).toEqual(['14:00', '15:10', '16:00', '16:50', '17:40', '18:30']));
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/features` / Expected: FAIL
- [ ] **Step 3: 타입과 함수 구현** — 위 Interfaces 그대로.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/features && npm run typecheck` / Expected: PASS
- [ ] **Step 5: `docs/api/frontend-needs.md` 작성** — 백엔드가 명세를 쓸 때 참고할 계약 초안. 아래 순서로.
  1. 머리말: 목적(프론트 목업이 쓰는 계약, 강제 아님), 11/6 골든 패스 계약 동결 제안, 결정 기록 링크.
  2. **공통 규약**: base `/api` · JSON camelCase(백엔드가 다르게 정하면 프론트 `api.ts`에서 변환) · 에러 봉투 `{ code, message, fieldErrors?, details? }` + HTTP 상태(코드 목록 = `src/shared/lib/errors.ts` 표) · 날짜 `+09:00` ISO 8601, 날짜만 `YYYY-MM-DD`, 시각만 `HH:mm` · ID는 number · 인증 `Authorization: Bearer <token>` · 목록은 배열(페이지네이션 없음) · 로그아웃 204.
  3. **골든 패스 엔드포인트 표**(메서드 · 경로 · 요청 · 응답 타입 · 에러 코드 · 쓰는 화면) — 아래 29개, 응답 타입 이름은 위 Interfaces.

| 메서드 · 경로 | 요청 | 응답 | 에러 |
|---|---|---|---|
| POST /api/auth/login | `{email,password}` | `LoginResponse` | INVALID_CREDENTIALS 401 |
| POST /api/auth/logout | — | 204 | — |
| GET /api/me | — | `Me` | UNAUTHORIZED 401 |
| GET /api/universities | — | `University[]` | — |
| GET /api/universities/:id/insight | — | `Insight` | NOT_FOUND 404 |
| POST /api/recommendations | `RecommendationQuery` | `RecommendationResult` | VALIDATION 400 |
| GET /api/tours?status=&universityId= | — | `TourSummary[]` | — |
| GET /api/tours/:id | — | `TourDetail` | NOT_FOUND 404 |
| POST /api/tours/:id/applications | `{motivation}` | `MyApplication` (201) | NOT_VERIFIED · GUARDIAN_NOT_AGREED 403 / TOUR_NOT_RECRUITING · TOUR_CLOSED · DUPLICATE_APPLICATION · REAPPLY_AFTER_REJECT 409 / VALIDATION 400 |
| GET /api/me/applications | — | `MyApplication[]` | — |
| GET /api/me/applications/:id | — | `MyApplication` | NOT_FOUND 404 |
| POST /api/me/applications/:id/cancel | — | `MyApplication` | CANCEL_AFTER_TOUR_DATE · ALREADY_PROCESSED 409 |
| GET /api/guide/tours | — | `GuideTourSummary[]` | FORBIDDEN 403 |
| GET /api/guide/tours/:id/applicants | — | `ApplicantsBoard` | FORBIDDEN 403 |
| POST /api/guide/applications/:id/approve | — | `ApplicantsBoard` | CAPACITY_EXCEEDED · ALREADY_PROCESSED 409 |
| POST /api/guide/applications/:id/reject | — | `ApplicantsBoard` | ALREADY_PROCESSED 409 |
| GET /api/guide/tours/:id/course | — | `Course` | NOT_FOUND 404(코스 없음) |
| POST /api/guide/tours/:id/course/draft | — | `Course` | NO_APPROVED_APPLICANTS · COURSE_NOT_DRAFT 409 |
| PUT /api/guide/tours/:id/course/order | `{stopIds:number[]}` | `Course` | COURSE_NOT_DRAFT 409 / VALIDATION 400 |
| PATCH /api/guide/tours/:id/course/stops/:stopId | `{description}` | `Course` | COURSE_NOT_DRAFT 409 |
| DELETE /api/guide/tours/:id/course/stops/:stopId | — | `Course` | COURSE_NOT_DRAFT 409 |
| POST /api/guide/tours/:id/course/confirm | — | `Course` | COURSE_EMPTY · COURSE_NOT_DRAFT 409 |
| GET /api/tours/:id/course | — | `Course` | FORBIDDEN 403 / COURSE_NOT_READY 404 |
| GET /api/me/coupons?applicationId= | — | `Coupon[]` | — |
| GET /api/me/coupons/:id | — | `Coupon` | NOT_FOUND 404 |
| GET /api/owner/coupons/:code | — | `CouponLookup` | COUPON_NOT_FOUND 404 / COUPON_OTHER_STORE 403 |
| POST /api/owner/coupons/:code/redeem | — | `RedeemResult` | COUPON_ALREADY_USED(`details.usedAt`) · COUPON_EXPIRED · COUPON_NOT_YET 409 / COUPON_OTHER_STORE 403 / COUPON_NOT_FOUND 404 |
| GET /api/health | — | `{ok:true, mode}` | — |
| POST /api/demo/reset | `{checkpoint?}` + 헤더 `X-Demo-Key` | `{ok:true}` | FORBIDDEN 403 |

  4. **타입 정의**: 위 Interfaces 블록을 그대로 붙인다(서버 계산 값 표시: `remainingSeats`, `myApplication`, `openChatUrl`(승인자만), `cancellable`, `Coupon.state`, `reviewWritten`, `CourseStop.review` · `partnership`, `Course.issuedCouponCount`).
  5. **P1 화면이 필요로 하는 것(목록)**: 회원가입(이름 포함) · 재학 인증 업로드(multipart) · 보호자 동의 요청 · 재요청 · 동의 페이지 · 내 정보 수정 · 가이드 프로필 · 탐방 개설(방학 기간 검증) · 탐방 완료 · 취소 · 주변 상점(S-02, 정렬: 관련 업종 우선 → 거리순) · 사업자 인증 · 가게 연결 · 직접 등록 · 제휴 설정 · 리뷰 작성 · 운영자 심사(목록 · 상세 · 승인 · 반려). 각 1줄.
  6. **백엔드에 묻는 것**: 설계 5.5 끝 문단의 질문 목록 + 시연 리셋 수단(`X-Demo-Key`) + 당일 날짜 시드 + C-01 제휴 1곳 포함 규칙.
- [ ] **Step 6: 진척 문서 갱신** — API 연동 표에 위 엔드포인트 전부를 행으로(목업 `⬜`, 계약 합의 `⬜`), 팀 요청 표에 "frontend-needs.md 공유 · 30분 리뷰(백엔드, 11/5)" 상태 `🟨`.
- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat: 도메인 타입·제목·시간 슬롯 함수와 API 계약 초안(frontend-needs)"`

---

### Task 5: 표시 상태 파생 함수

**Files:**
- Create: `src/features/auth/landing.ts`
- Modify: `src/features/tours/model.ts`, `src/features/applications/model.ts`, `src/features/coupons/model.ts`, `src/features/courses/model.ts`
- Test: `src/features/auth/landing.test.ts`, `src/features/tours/applyButtonState.test.ts`, `src/features/applications/model.test.ts`, `src/features/coupons/model.test.ts`, `src/features/courses/model.test.ts`(추가)

**Interfaces:**
- Consumes: Task 4 타입, Task 3 `formatShortDate`, `formatTime`, `ActionLink`
- Produces:
  - `getLandingPath(me: Me): string`
  - `interface ApplyButtonState { kind: 'APPLY'|'LOGIN'|'NOT_STUDENT'|'APPLIED'|'REJECTED'|'NOT_RECRUITING'|'CLOSED'|'NEED_VERIFICATION'; enabled: boolean; label: string; reason: string | null; action: ActionLink | null }`
  - `applyButtonState(me: Me | null, tour: TourDetail, recommendationsPath: string): ApplyButtonState`
  - `interface MyTourDisplay { label: string; description: string; tone: Tone; action: ActionLink | null }`
  - `myTourDisplay(app: MyApplication, recommendationsPath: string): MyTourDisplay`
  - `computeCouponState(c: { status: CouponStatus; tourStartsAt: string; expiresAt: string }, now: Date): CouponState` (목업 서버 · 어댑터 전용 — 컴포넌트에서 쓰지 않는다)
  - `couponStateLabel(state: CouponState, usedAt: string | null): string`
  - `studentCourseLabel(status: CourseStatus | null): '코스 준비 중' | '코스 확정'`

규칙(검사 순서 그대로):
- `getLandingPath`: HIGH_SCHOOL — 재학 인증 `NONE|REJECTED` 또는 보호자 `NONE|REJECTED|EXPIRED`면 `/verify`, 아니면 `/` · UNIVERSITY — 인증 `NONE|REJECTED`면 `/guide/verify`, `guideProfile?.major`가 비면 `/guide/me`, 아니면 `/guide/tours` · OWNER — `!businessVerified`면 `/owner/verify`, `storeId === null`이면 `/owner/store/connect`, 아니면 `/owner/store` · ADMIN — `/admin/verifications`.
- `applyButtonState`: `me === null` → LOGIN(enabled, label `로그인하고 신청하기`, action `{label:'로그인', to:'/login?next=/tours/{id}'}`) → role≠HIGH_SCHOOL → NOT_STUDENT(label `고교생만 신청할 수 있어요`) → 내 신청 PENDING|APPROVED → APPLIED(label `신청됨`, reason `이미 신청한 탐방이에요.`, action `내 탐방에서 상태 확인`→`/my-tours`) → 내 신청 REJECTED → REJECTED(label `신청 불가`, reason `거절된 탐방에는 다시 신청할 수 없어요.`, action `다른 추천 보기`→recommendationsPath) → status CANCELED|COMPLETED → NOT_RECRUITING(label `모집 종료`, reason `모집이 끝난 탐방이에요.`, 같은 action) → status CLOSED 또는 remainingSeats ≤ 0 → CLOSED(label `정원 마감`, reason `남은 자리가 없어요.`, 같은 action) → 재학 인증≠APPROVED 또는 보호자≠AGREED → NEED_VERIFICATION(label `탐방 신청하기`, disabled, reason `학생증 승인·보호자 동의 완료 후 신청할 수 있어요.`, action `역할 인증 단계로 이동`→`/verify`) → APPLY(enabled, label `탐방 신청하기`, action `{label:'탐방 신청하기', to:'/tours/{id}/apply'}`). LOGIN · APPLY 말고는 `enabled: false`.
- `myTourDisplay`(와이어 hs-a05): app CANCELED + tour CANCELED → `취소 · 쿠폰 만료` / `{title} · 가이드가 탐방을 취소했어요` / neutral / null · app CANCELED → `취소 · 쿠폰 만료` / `{title} · 신청을 취소했어요` / neutral / null · REJECTED → `거절 · 다른 탐방 보기` / `{title} · 신청 거절` / danger / `추천 탐방으로 다시 이동`→recommendationsPath · PENDING → `신청 · 가이드 승인 대기` / `{title} · {formatShortDate}` / warning / (`cancellable`이면 `승인 전 직접 취소 가능`, 아니면 `상세 보기`)→`/my-tours/{id}` · APPROVED + tour COMPLETED → `탐방 완료 · 리뷰 쓰기` / `{title} · 다녀온 상점에 리뷰를 남겨 주세요` / success / `쿠폰 쓴 상점 리뷰 쓰기`→`/my-tours/{id}/coupons` · APPROVED + course CONFIRMED → `승인 · 코스 확정` / `{title} · 지도와 쿠폰이 열렸어요` / success / `코스 지도 보기`→`/my-tours/{id}/course` · APPROVED → `승인 · 코스 준비 중` / `{title} · 오픈채팅 공개` / info / `확정되면 코스 지도와 쿠폰 열림`→`/my-tours/{id}`.
- `computeCouponState`: status USED → USED · status EXPIRED 또는 now > expiresAt → EXPIRED · `seoulDateKey(now) < seoulDateKey(tourStartsAt)` → BEFORE_DAY · 그 밖 → USABLE.
- `couponStateLabel`: BEFORE_DAY `탐방 당일 사용 가능` · USABLE `사용 가능` · EXPIRED `만료` · USED `사용 완료 · {HH:mm}`.

- [ ] **Step 1: 실패하는 테스트 작성** — 위 규칙의 분기마다 1개씩. 대표:

```ts
const base: Me = { id: 1, email: 'a@b.c', name: '김민지', role: 'HIGH_SCHOOL', verificationStatus: 'APPROVED',
  rejectionReason: null, guardianStatus: 'AGREED', studentProfile: null, guideProfile: null, businessVerified: false, storeId: null };
it.each([
  [{ verificationStatus: 'NONE' }, '/verify'], [{ verificationStatus: 'REJECTED' }, '/verify'],
  [{ guardianStatus: 'EXPIRED' }, '/verify'], [{ verificationStatus: 'PENDING', guardianStatus: 'PENDING' }, '/'], [{}, '/'],
])('고교생 %o → %s', (patch, path) => expect(getLandingPath({ ...base, ...patch } as Me)).toBe(path));
it('가이드: 학과가 비면 /guide/me', () => expect(getLandingPath({ ...base, role: 'UNIVERSITY',
  guideProfile: { universityId: 2, major: null, introduction: null } })).toBe('/guide/me'));
it('사장님: 가게가 없으면 연결 화면', () =>
  expect(getLandingPath({ ...base, role: 'OWNER', businessVerified: true, storeId: null })).toBe('/owner/store/connect'));

it('마감 탐방은 인증보다 마감 사유가 먼저', () => {
  const s = applyButtonState({ ...base, verificationStatus: 'PENDING' }, { ...tour, status: 'CLOSED', remainingSeats: 0 }, '/recommendations?q=a');
  expect(s).toMatchObject({ kind: 'CLOSED', enabled: false, reason: '남은 자리가 없어요.', action: { label: '다른 추천 보기', to: '/recommendations?q=a' } });
});
it('보호자 동의 전이면 인증 단계로', () =>
  expect(applyButtonState({ ...base, guardianStatus: 'PENDING' }, tour, '/').action).toEqual({ label: '역할 인증 단계로 이동', to: '/verify' }));

it('승인 + 확정 코스면 지도 링크', () =>
  expect(myTourDisplay({ ...app, status: 'APPROVED', courseStatus: 'CONFIRMED' }, '/').action).toEqual({ label: '코스 지도 보기', to: `/my-tours/${app.id}/course` }));

it.each([
  ['2026-11-14T12:00:00+09:00', 'BEFORE_DAY'], ['2026-11-15T09:00:00+09:00', 'USABLE'], ['2026-11-16T00:00:01+09:00', 'EXPIRED'],
])('쿠폰 상태 now=%s → %s', (now, state) =>
  expect(computeCouponState({ status: 'ISSUED', tourStartsAt: '2026-11-15T14:00:00+09:00', expiresAt: '2026-11-15T23:59:59+09:00' }, new Date(now))).toBe(state));
it('사용 완료 라벨', () => expect(couponStateLabel('USED', '2026-11-15T15:12:00+09:00')).toBe('사용 완료 · 15:12'));
```
(`tour`, `app`은 테스트 파일 안의 고정 픽스처 — RECRUITING, remainingSeats 3, myApplication null / 위 TourSummary를 품은 MyApplication)

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/features` / Expected: FAIL
- [ ] **Step 3: 함수 구현** — 위 규칙 그대로.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/features` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — devlog 한 줄.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 첫 화면·신청 버튼·내 탐방·쿠폰 표시 상태 파생 함수"`

---

### Task 6: 목업 DB — 스키마 · 시드 · 저장소

**Files:**
- Create: `src/mocks/db/schema.ts`, `src/mocks/db/seed.ts`, `src/mocks/db/store.ts`, `src/mocks/db/geo.ts`, `src/mocks/clock.ts`, `src/shared/config/demoAccounts.ts`
- Test: `src/mocks/db/seed.test.ts`, `src/mocks/db/store.test.ts`, `src/mocks/db/geo.test.ts`

**Interfaces:**
- Consumes: Task 3 `seoulDateKey`, `seoulDateAt`, `addDaysKey`, `endOfSeoulDay`; Task 4 `tourTitle`
- Produces:
  - `schema.ts`: ERD 19개 테이블을 camelCase 행 타입으로(`UserRow` … `ReviewSummaryRow`, 컬럼은 `docs/reference/erd.md` 그대로). 목업 전용 추가 컬럼: `UserRow.password: string`(평문). `interface DB { version: number; seedDay: string; users; studentProfiles; guideProfiles; verifications; guardianConsents; businessVerifications; universities; vacations; campusPlaces; tours; applications; courses; courseStops; stores; partnerships; coupons; reviews; reviewSummaries; tourWishes; sessions: { token: string; userId: number }[]; nextId: number }`
  - `clock.ts`: `mockNow(): Date` · `setMockNow(date: Date | null): void`(테스트 전용)
  - `geo.ts`: `distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number`(하버사인)
  - `seed.ts`: `type SeedCheckpoint = 'START' | 'APPLIED' | 'APPROVED' | 'CONFIRMED'` · `createSeed(today: Date): DB`(START만, 체크포인트는 Task 8) · 상수 `DEMO_TOUR_ID = 1`, `DEMO_UNIVERSITY_ID = 2`
  - `store.ts`: `MOCK_DB_VERSION = 1` · `MOCK_DB_KEY = 'ytt.mockdb'` · `getDb(): DB` · `mutate<T>(fn: (db: DB) => T): T`(실행 후 저장) · `resetDb(opts?: { today?: Date; checkpoint?: SeedCheckpoint }): DB` · `createSession(db: DB, userId: number): string`(`mock-{userId}-{n}`) · `userIdFromToken(db: DB, token: string | null): number | null` · `nextId(db: DB): number`
  - `demoAccounts.ts`(목업 · 시연 도구 · 화면이 같이 쓰는 시연 설정 — 화면이 `src/mocks`를 import하지 않게 여기에 둔다): `DEMO_EMAILS = { student: 'student@demo.kr', guide: 'guide@demo.kr', owner: 'owner1@demo.kr', admin: 'admin@demo.kr', unverified: 'newbie@demo.kr' } as const` · `type DemoRole = 'student' | 'guide' | 'owner' | 'admin'` · `DEMO_MOTIVATION = '실기 준비와 대학에서 배우는 수업이 궁금하고, 학생들이 자주 가는 밥집도 가 보고 싶어요.'` · `DEMO_STORE_OWNERS: Record<number, string> = { 1: 'owner1@demo.kr', 2: 'owner2@demo.kr', 3: 'owner3@demo.kr', 4: 'owner4@demo.kr' }`(storeId → 사장님 이메일)

**시드 내용(createSeed, `day = seoulDateKey(today)`)** — 검증 규칙을 거치지 않고 직접 넣는다.
- 대학 5개(이름 · 캠퍼스명 · 행정동, 좌표는 실제 캠퍼스 근처 값): 1 `강남대학교`/`본교`/구갈동 · **2 `경희대학교`/`국제캠퍼스`/서천동** · 3 `단국대학교`/`죽전캠퍼스`/죽전1동 · 4 `명지대학교`/`자연캠퍼스`/역북동 · 5 `한국외국어대학교`/`글로벌캠퍼스`/모현읍. 방학: 각 대학 겨울방학 `2026-12-21`~`2027-02-28`, 여름방학 `2027-06-21`~`2027-08-31`.
- 캠퍼스 장소: 대학마다 2~3곳. 경희대는 `예술·디자인대학`(설명 "산업디자인 · 시각디자인 작업실과 전시 공간"), `중앙도서관`, `학생회관`.
- 사용자(모두 비밀번호 `demo1234`, id는 아래 순서로 1부터): 고교생 `student@demo.kr` 김민지(인증 APPROVED, 보호자 AGREED, 고2, 관심 학과 산업디자인) · 고교생 `newbie@demo.kr` 최하늘(인증 NONE, 보호자 NONE) · 신청자용 고교생 `seojun@demo.kr` 박서준(고3) · `haeun@demo.kr` 이하은(고3) · `yujin@demo.kr` 최유진(고2) · 리뷰용 고교생 `past1@demo.kr` · `past2@demo.kr`(모두 인증 · 동의 완료) · 운영자 심사용 고교생 `pending@demo.kr`(인증 PENDING, 2단계 화면용) · 가이드 `guide@demo.kr` 정다은(경희대, `산업디자인학과`, 소개 "디자인 공부와 캠퍼스 생활이 궁금한 학생들에게 실제 작업실과 수업 이야기를 들려줄게요.", 인증 APPROVED) · 다른 가이드 4명(단국대 `커뮤니케이션디자인학과`, 명지대 `컴퓨터공학과`, 한국외대 `통번역학과`, 강남대 `사회복지학부`) · 사장님 `owner1@demo.kr`~`owner4@demo.kr`(사업자 인증 완료, 가게 각 1개) · 운영자 `admin@demo.kr`.
- 탐방(id 순서 고정): **1(시연)** 경희대 · 가이드 정다은 · `startsAt = seoulDateAt(day,'14:00')` · `endsAt = seoulDateAt(day,'16:30')` · 정원 5 · RECRUITING · 오픈채팅 `https://open.kakao.com/o/demo-khu-design` · 소개 "산업디자인 작업실과 수업 이야기, 학생들이 자주 가는 대학가 식당과 카페까지 함께 둘러봐요." / 2 단국대 커뮤니케이션디자인 · day+40 · 정원 3 · 승인 3(박서준 · 이하은 · 최유진) → **CLOSED** / 3 명지대 컴퓨터공학 · day+45 · RECRUITING / 4 한국외대 통번역 · day+47 · RECRUITING / 5 강남대 사회복지 · day+52 · RECRUITING / 6 경희대 정다은 · day+60 · RECRUITING(같은 가이드의 두 번째 탐방, 신청 없음) / 7 경희대 정다은 · day−30 · **COMPLETED**(지난 탐방 — 리뷰 · 사용 쿠폰의 출처).
- 신청(탐방 1): 박서준 APPROVED "학생들이 자주 가는 밥집이 궁금해요" · 이하은 APPROVED "카페에서 과제하는 분위기를 보고 싶어요" · 최유진 PENDING "실기 준비 이야기를 듣고 싶어요". 시연 학생 김민지는 신청 없음.
- 상점(경희대 중심 1km 안, 전부 제휴 · 제휴 기간 `addDaysKey(day,-30)`~`addDaysKey(day,90)`; **서천 밥상이 가장 가까운 식당, 카페 모래시계가 가장 가까운 카페**가 되게 좌표를 둔다): 1 `서천 밥상`(한식, owner1, 할인 "식사 금액 10% 할인") · 2 `카페 모래시계`(카페, owner2, "음료 1,000원 할인") · 3 `영통 분식집`(분식, owner3, "떡볶이 세트 1,500원 할인") · 4 `보드게임 카페 다이스`(보드게임카페, owner4, "1시간 무료 연장"). 경희대 밖 비제휴 상점 2곳(단국대 근처 식당 · 카페).
- 리뷰 · 요약(탐방 7의 승인 신청 · USED 쿠폰에 묶어 넣고, (작성자, 탐방, 상점)은 겹치지 않게): 상점 1 리뷰 5개(별점 5·5·4·5·4 → 평균 4.6), 요약 "학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요." · 상점 2 리뷰 5개(별점 5·4·4·5·4 → 평균 4.4), 요약 "콘센트 자리가 많아 과제하기 좋다는 평이 많아요. 디저트는 일찍 떨어진대요." · 상점 3 · 4 리뷰 0개.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// seed.test.ts
const today = new Date('2026-11-15T01:00:00Z'); // KST 10:00
it('대학 5곳', () => expect(createSeed(today).universities.map((u) => u.name)).toEqual(
  ['강남대학교', '경희대학교', '단국대학교', '명지대학교', '한국외국어대학교']));
it('시연 탐방은 오늘 14:00 · 모집 중 · 승인 2명', () => {
  const db = createSeed(today);
  const t = db.tours.find((x) => x.id === DEMO_TOUR_ID)!;
  expect([t.startsAt, t.status]).toEqual(['2026-11-15T14:00:00+09:00', 'RECRUITING']);
  expect(db.applications.filter((a) => a.tourId === 1 && a.status === 'APPROVED')).toHaveLength(2);
});
it('경희대 1km 안의 식사·카페 상점은 모두 오늘 유효한 제휴', () => { /* 각 상점에 partnerships 행이 있고 start ≤ '2026-11-15' ≤ end, owner 있음 */ });
it('시연 계정이 모두 있다', () => { /* DEMO_EMAILS의 값마다 users에 존재 */ });
// store.test.ts (Review Focus 5)
it('손상된 JSON이면 시드로 복구', () => { localStorage.setItem(MOCK_DB_KEY, '{oops'); expect(getDb().universities).toHaveLength(5); });
it('옛 버전이면 시드로 복구', () => { localStorage.setItem(MOCK_DB_KEY, JSON.stringify({ version: 0 })); expect(getDb().version).toBe(MOCK_DB_VERSION); });
it('mutate는 저장한다', () => { mutate((db) => { db.users[0].name = '바뀜'; }); expect(JSON.parse(localStorage.getItem(MOCK_DB_KEY)!).users[0].name).toBe('바뀜'); });
it('세션 토큰으로 사용자 찾기', () => { const db = resetDb(); const t = createSession(db, 3); expect(userIdFromToken(db, t)).toBe(3); expect(userIdFromToken(db, 'x')).toBeNull(); });
// geo.test.ts
it('경희대 국제캠–수원역 약 8km', () => expect(Math.round(distanceMeters({ lat: 37.2397, lng: 127.0833 }, { lat: 37.2664, lng: 127.0001 }) / 1000)).toBe(8));
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/mocks/db` / Expected: FAIL
- [ ] **Step 3: 구현** — `getDb()`는 모듈 캐시 → localStorage(버전 확인, 파싱 실패 시 무시) → `createSeed(mockNow())` 순. `resetDb`는 캐시 · localStorage를 덮어쓴다. `checkpoint`는 Task 8에서 구현하므로, 이 태스크에서는 `START`가 아닌 값이 오면 `throw new Error('checkpoint는 Task 8에서 지원')`.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/mocks/db` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — devlog 한 줄.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 목업 DB 스키마·당일 기준 시드·저장소"`

---

### Task 7: 목업 규칙 — 신청 · 승인 · 취소 · 쿠폰

**Files:**
- Create: `src/mocks/rules/errors.ts`, `src/mocks/rules/applications.ts`, `src/mocks/rules/coupons.ts`
- Test: `src/mocks/rules/applications.test.ts`, `src/mocks/rules/coupons.test.ts`

**Interfaces:**
- Consumes: Task 6 `DB`, `nextId`; Task 5 `computeCouponState`; Task 3 date 함수
- Produces:
  - `class MockApiError extends Error { constructor(public status: number, public code: ErrorCode, message?: string, public details?: Record<string, unknown>) }`
  - `remainingSeats(db: DB, tourId: number): number` · `activeApplication(db: DB, userId: number, tourId: number): ApplicationRow | undefined`
  - `applyToTour(db: DB, userId: number, tourId: number, motivation: string, now: Date): ApplicationRow`
  - `approveApplication(db: DB, guideId: number, applicationId: number, now: Date): ApplicationRow`
  - `rejectApplication(db: DB, guideId: number, applicationId: number): ApplicationRow`
  - `cancelApplication(db: DB, userId: number, applicationId: number, now: Date): ApplicationRow`
  - `isCancellable(db: DB, app: ApplicationRow, now: Date): boolean`
  - `issueCouponsForApplication(db: DB, applicationId: number, now: Date): CouponRow[]`
  - `expireCouponsForApplication(db: DB, applicationId: number): number`
  - `generateCouponCode(existing: Set<string>, random?: () => number): string` — `String(Math.floor(random() * 1_000_000)).padStart(6, '0')`를 겹치지 않을 때까지 반복(기본 random = `Math.random`)
  - `lookupCoupon(db: DB, ownerId: number, code: string, now: Date): CouponLookup`
  - `redeemCoupon(db: DB, ownerId: number, code: string, now: Date): RedeemResult`

규칙: 신청 — 탐방 없음 404 NOT_FOUND · 역할≠HIGH_SCHOOL 403 FORBIDDEN · 인증≠APPROVED 403 NOT_VERIFIED · 보호자≠AGREED 403 GUARDIAN_NOT_AGREED · 같은 탐방에 PENDING|APPROVED 있음 409 DUPLICATE_APPLICATION · REJECTED 이력 409 REAPPLY_AFTER_REJECT · status CANCELED|COMPLETED 409 TOUR_NOT_RECRUITING · CLOSED 또는 남은 자리 0 409 TOUR_CLOSED · motivation 공백 400 VALIDATION · CANCELED 이력은 재신청 허용. 승인 — 남의 탐방 403 · PENDING 아님 409 ALREADY_PROCESSED · 남은 자리 0 409 CAPACITY_EXCEEDED · 승인 후 승인 수 = 정원이면 tour CLOSED · 코스 CONFIRMED면 `issueCouponsForApplication`. 취소 — 남의 신청 403 · PENDING|APPROVED 아님 409 ALREADY_PROCESSED · `seoulDateKey(now) >= seoulDateKey(tour.startsAt)`면 409 CANCEL_AFTER_TOUR_DATE · APPROVED 취소면 CLOSED → RECRUITING · 쿠폰 EXPIRED. 쿠폰 발급 — 탐방 코스의 STORE 지점 중 탐방 날짜에 유효한 제휴가 있는 상점마다 1장(같은 (application, store)는 건너뜀), code 6자리 숫자 유일, `expiresAt = endOfSeoulDay(seoulDateKey(tour.startsAt))`, `discountSnapshot` = 제휴 할인 문구. 조회 — 코드 없음 404 COUPON_NOT_FOUND · 내 가게 쿠폰 아님 403 COUPON_OTHER_STORE. 사용 — 위 둘 + state USED 409 COUPON_ALREADY_USED(`details.usedAt`) · EXPIRED 409 COUPON_EXPIRED · BEFORE_DAY 409 COUPON_NOT_YET → USED + usedAt. `tourVisitorCount` = 같은 탐방 · 같은 상점 USED 수, `totalVisitorCount` = 같은 상점 USED 수.

- [ ] **Step 1: 실패하는 테스트 작성** — 위 규칙의 오류 코드마다 1개 + 정상 경로. 대표:

```ts
const now = new Date('2026-11-14T03:00:00Z');           // 시연일 전날 KST 12:00
let db: DB; beforeEach(() => { db = createSeed(new Date('2026-11-15T01:00:00Z')); });
const id = (email: string) => db.users.find((u) => u.email === email)!.id;

it('정상 신청은 PENDING', () => expect(applyToTour(db, id('student@demo.kr'), 1, '밥집이 궁금해요', now).status).toBe('PENDING'));
it('인증 전이면 NOT_VERIFIED', () => expect(() => applyToTour(db, id('newbie@demo.kr'), 1, '궁금해요', now)).toThrow(expect.objectContaining({ code: 'NOT_VERIFIED', status: 403 })));
it('중복 신청 차단, 취소 후엔 허용, 거절 후엔 차단', () => { /* apply → apply(409) → cancel → apply OK → reject → apply REAPPLY_AFTER_REJECT */ });
it('정원이 차면 자동 마감, 승인 취소하면 다시 모집', () => {
  /* 정원 5, 승인 2 → 신청 3명 추가 승인 → tour.status 'CLOSED' → 다음 승인 CAPACITY_EXCEEDED → 승인자 1명 취소 → 'RECRUITING' */
});
it('탐방 당일 취소는 CANCEL_AFTER_TOUR_DATE', () => { /* now = 2026-11-15T10:00+09:00 */ });
it('확정 코스가 있으면 늦은 승인자에게도 쿠폰', () => {
  /* db.courses / courseStops에 확정 코스(상점 1·2 지점)를 직접 넣고 승인 → coupons 2장, expiresAt '2026-11-15T23:59:59+09:00' */
});
it('쿠폰 사용: 다른 가게 · 이미 사용 · 만료 · 전날 · 없는 코드', () => {
  /* 상점1 쿠폰을 owner2로 조회 → COUPON_OTHER_STORE / owner1 사용 2번 → 두 번째 COUPON_ALREADY_USED, details.usedAt 존재 /
     now 다음날 → COUPON_EXPIRED / now 전날 → COUPON_NOT_YET / '000000' → COUPON_NOT_FOUND */
});
it('사용하면 이번 탐방 방문 수 1', () => { /* redeem → tourVisitorCount 1 */ });
it('쿠폰 코드는 6자리이고 겹치면 다시 뽑는다', () => { const s = new Set(['000001']); let i = 0;
  const seq = [0.000001, 0.5]; expect(generateCouponCode(s, () => seq[i++] ?? 0.5)).toBe('500000'); });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/mocks/rules` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 시그니처 · 규칙 그대로. 모든 함수는 `db`를 직접 바꾸고(저장은 호출한 핸들러의 `mutate`가 한다) 행을 돌려준다. `lookupCoupon` · `redeemCoupon`의 `state`는 `computeCouponState(…, now)`.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/mocks/rules` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — devlog 한 줄.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 목업 규칙(신청·승인·취소·쿠폰 발급·사용)"`

---

### Task 8: 목업 AI · 코스 규칙 · 체크포인트 시드

**Files:**
- Create: `src/mocks/ai/interests.ts`, `src/mocks/ai/recommend.ts`, `src/mocks/ai/course.ts`, `src/mocks/rules/courses.ts`
- Modify: `src/mocks/db/store.ts`(체크포인트 지원), `src/mocks/db/seed.ts`(`createSeed(today, checkpoint)`)
- Test: `src/mocks/ai/recommend.test.ts`, `src/mocks/ai/course.test.ts`, `src/mocks/rules/courses.test.ts`, `src/mocks/db/seed.test.ts`(추가)

**Interfaces:**
- Consumes: Task 6 · 7 전부, Task 4 `slotTimes`, `tourTitle`
- Produces:
  - `MAJOR_KEYWORDS: Record<string, string[]>` — `산업디자인`:['산업디자인','제품','디자인','스케치','포트폴리오','실기'] · `커뮤니케이션디자인`:['시각','그래픽','브랜딩','포스터','디자인'] · `컴퓨터공학`:['코딩','개발','프로그래밍','컴퓨터','인공지능','게임'] · `통번역`:['영어','통역','번역','외국어','언어'] · `사회복지`:['복지','봉사','상담','사회']
  - `MAJOR_FAMILY: Record<string, string>` — 산업디자인 · 커뮤니케이션디자인 → `디자인`, 컴퓨터공학 → `컴퓨터`, 통번역 → `언어`, 사회복지 → `사회복지`
  - `LIFESTYLE_KEYWORDS = { 식사: ['밥','맛집','식사','점심','저녁','먹'], 카페: ['카페','커피','디저트','과제','시간을 보내'], 놀거리: ['놀','보드게임','노래방','산책'] }`
  - `LIFESTYLE_CATEGORIES = { 식사: ['한식','분식','중식','일식','양식','식당'], 카페: ['카페'], 놀거리: ['보드게임카페','노래방','공방'] }`
  - `extractInterests(text: string, major?: string): { majors: string[]; lifestyle: Array<'식사'|'카페'|'놀거리'>; keywords: string[] }`
  - `recommendTours(db: DB, query: RecommendationQuery, now: Date): RecommendationResult`
  - `COURSE_CRITERIA = '신청자들이 적은 하고 싶은 것 → 관련 업종 상점 매칭(인허가 공공데이터) · 제휴 상점 1곳 이상 포함'`
  - `COURSE_RADIUS_M = 1000`
  - `generateCourseDraft(db: DB, tourId: number): { stops: Array<Omit<CourseStopRow, 'id' | 'tourId'>>; interests: string[] }`
  - `createDraft(db: DB, guideId: number, tourId: number): CourseRow` · `reorderStops(db, guideId, tourId, stopIds: number[]): void` · `updateStopDescription(db, guideId, tourId, stopId: number, description: string): void` · `deleteStop(db, guideId, tourId, stopId): void` · `confirmCourse(db, guideId, tourId, now: Date): { issuedCouponCount: number }` · `canViewCourse(db: DB, userId: number, tourId: number): boolean`
  - `createSeed(today: Date, checkpoint?: SeedCheckpoint): DB` — APPLIED: 김민지가 탐방 1에 `DEMO_MOTIVATION`으로 신청 · APPROVED: + 정다은이 승인 · CONFIRMED: + 초안 생성 + 확정(쿠폰 발급). 반드시 위 규칙 함수로 만든다(`now` = 시드 날 10:00 KST).

추천 규칙: 대상은 RECRUITING이고 남은 자리 > 0인 탐방 · `universityId`가 있으면 그 학교만 · `date`가 있으면 그 날짜만 · 점수 = 가이드 학과가 추출 학과와 같으면 +3, 소개문에 키워드가 있으면 키워드당 +1 · 점수 > 0만, 점수 내림차순 → 날짜 오름차순. 결과 0개면 — 학교 지정 시 그 학교의 모집 중 탐방(`fallback: 'SCHOOL'`, headline `같은 학교의 모집 중 탐방을 보여 드려요`), 아니면 전체 모집 중 탐방을 날짜 → 남은 자리 순(`fallback: 'ALL'`, headline `조건을 넓혀서 보여 드려요`). 매칭 시 headline `{MAJOR_FAMILY} 분야에 관심이 많군요!`, reason `"{키워드}"에 관심이 있다고 해서, {학과} 재학생 {가이드}님이 직접 보여주는 탐방을 골랐어요.` + 생활 키워드가 있으면 ` 학생들이 자주 가는 {식당|카페}도 들러요.`

코스 규칙: 승인 0명 → 409 NO_APPROVED_APPLICANTS · 코스 CONFIRMED → 409 COURSE_NOT_DRAFT · 초안 생성은 기존 DRAFT 지점을 지우고 새로 만든다. `generateCourseDraft`: ① 승인자 동기에서 생활 의도를 모은다(없으면 식사 · 카페) ② 캠퍼스 장소 하나(가이드 학과 계열 이름이 들어간 장소, 없으면 첫 장소)를 첫 지점으로 ③ 의도 순서(식사 → 카페 → 놀거리)마다 반경 1km 안의 해당 업종에서 가장 가까운 상점 ④ **고른 상점 중 탐방 날짜에 유효한 제휴가 하나도 없으면** 같은 업종의 가장 가까운 제휴 상점으로 첫 상점을 바꾸고, 그래도 없으면 반경 안 아무 제휴 상점을 마지막에 덧붙인다(반경 안에 제휴가 없으면 그대로 — 쿠폰 0장) ⑤ 시간은 `slotTimes(tour.startsAt, n)` ⑥ 이유: 캠퍼스 `{학과} 전공 공간에서 실제 수업 이야기를 들어요.` · 상점 `신청자 {k}명이 "{동기 앞 20자}"를 궁금해했어요. {리뷰 요약 첫 문장 ?? '학생들이 자주 찾는 곳이에요.'}` ⑦ interests 라벨 = `전공 수업`, `캠퍼스 시설` + 생활 의도들. `reorderStops`: DRAFT만, stopIds가 현재 지점 집합과 다르면 400 VALIDATION, 순서대로 `stopOrder` · `visitTime = slotTimes(...)` 다시 계산. `deleteStop`도 시간 재계산. `confirmCourse`: 지점 0개 409 COURSE_EMPTY → CONFIRMED + confirmedAt → 승인자마다 `issueCouponsForApplication` 합계. `canViewCourse`: 코스 CONFIRMED이고 (그 탐방의 APPROVED 신청자 || 가이드).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const today = new Date('2026-11-15T01:00:00Z');
it('관심사 추출', () => {
  const r = extractInterests('산업디자인을 공부하고 싶고, 학생들이 주로 어디서 밥 먹는지 궁금해요');
  expect(r.majors).toContain('산업디자인'); expect(r.lifestyle).toContain('식사'); expect(r.keywords).toContain('산업디자인');
});
it('디자인 문장이면 경희대 산업디자인 탐방이 첫 번째', () => {
  const r = recommendTours(createSeed(today), { q: '산업디자인을 공부하고 싶고, 학생들이 주로 어디서 시간을 보내는지 궁금해요.' }, today);
  expect(r.headline).toBe('디자인 분야에 관심이 많군요!');
  expect(r.items[0].tour.title).toBe('경희대 국제캠퍼스 산업디자인학과 탐방');
  expect(r.items.some((i) => i.tour.status !== 'RECRUITING')).toBe(false);   // 마감 탐방 제외
});
it('매칭 0 + 학교 미선택이면 전체로 넓힌다', () =>
  expect(recommendTours(createSeed(today), { q: '우주항공 로켓' }, today)).toMatchObject({ fallback: 'ALL', headline: '조건을 넓혀서 보여 드려요' }));
it('매칭 0 + 학교 선택이면 그 학교', () =>
  expect(recommendTours(createSeed(today), { q: '우주항공', universityId: 4 }, today).fallback).toBe('SCHOOL'));

it('코스 초안: 캠퍼스 → 식사 → 카페, 14:00/15:10/16:00, 제휴 1곳 이상', () => {
  const db = createSeed(today, 'APPROVED');
  const { stops } = generateCourseDraft(db, 1);
  expect(stops[0].stopType).toBe('CAMPUS');
  expect(stops.map((s) => s.visitTime)).toEqual(['14:00', '15:10', '16:00']);
  expect(stops.some((s) => s.partnershipId !== null)).toBe(true);
});
it('관련 업종에 제휴가 없으면 반경 안 제휴 상점을 덧붙인다', () => { /* 상점 1·2·3의 제휴 행 삭제 → 결과에 상점 4(보드게임 카페, 제휴) 포함 */ });
it('반경 안에 제휴가 하나도 없으면 확정 시 쿠폰 0장', () => { /* 제휴 전부 삭제 → createDraft → confirmCourse → issuedCouponCount 0 */ });
it('순서를 바꾸면 시간은 칸에 고정', () => {
  const db = createSeed(today, 'APPROVED'); const g = db.users.find((u) => u.email === 'guide@demo.kr')!.id;
  createDraft(db, g, 1); const ids = db.courseStops.filter((s) => s.tourId === 1).sort((a, b) => a.stopOrder - b.stopOrder).map((s) => s.id);
  reorderStops(db, g, 1, [ids[2], ids[0], ids[1]]);
  const after = db.courseStops.filter((s) => s.tourId === 1).sort((a, b) => a.stopOrder - b.stopOrder);
  expect(after.map((s) => s.id)).toEqual([ids[2], ids[0], ids[1]]); expect(after.map((s) => s.visitTime)).toEqual(['14:00', '15:10', '16:00']);
});
it('확정하면 승인자 × 제휴 지점만큼 쿠폰', () => { /* APPROVED 체크포인트(승인 3명: 박서준·이하은·김민지), 제휴 지점 2 → 6 */ });
it('CONFIRMED 체크포인트: 김민지 쿠폰 2장, 오늘 사용 가능', () => { /* createSeed(today,'CONFIRMED') → 김민지 신청의 쿠폰 2장, computeCouponState(…, today)='USABLE' */ });
it('코스 조회 권한', () => { /* CONFIRMED: 승인 학생 true, 최유진(PENDING) false, 가이드 true / DRAFT: 학생 false */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/mocks` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 규칙 그대로. 같은 입력이면 같은 결과(결정적)여야 한다(난수 금지, 거리 · 이름 순으로 동률 처리).
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/mocks` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — devlog 한 줄, 결정 0008이 목업에 반영됐다고 표시.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 목업 AI(추천·코스 초안)·코스 규칙·체크포인트 시드"`

---

### Task 9: MSW 핸들러와 목업 부트스트랩

**Files:**
- Create: `src/mocks/latency.ts`, `src/mocks/rules/views.ts`, `src/mocks/handlers/util.ts`, `src/mocks/handlers/{auth,campuses,tours,applications,courses,coupons,demo}.ts`, `src/mocks/registry.ts`, `src/mocks/browser.ts`
- Modify: `src/mocks/node.ts`(전체 핸들러 등록), `src/main.tsx`, `src/test/setup.ts`
- Test: `src/mocks/handlers/handlers.test.ts`, `src/mocks/registry.test.ts`

**Interfaces:**
- Consumes: Task 3 `request`, `configureHttp`, `env`, `resolveApiMode`; Task 6 · 7 · 8 전부
- Produces:
  - `latency.ts`: `setMockLatency(ms: { base: number; ai: number } | null): void`(테스트는 `{base:0, ai:0}`) · `delayBase(): Promise<void>`(기본 150ms) · `delayAi(): Promise<void>`(기본 1500ms, `getAiSpeed()`가 `'slow'`면 10000ms) · `setAiSpeedSource(fn: () => 'normal' | 'slow'): void`(Task 21이 시연 스토어를 연결)
  - `views.ts`(행 → DTO, 핸들러 전용): `toMe(db, userId): Me` · `toTourSummary(db, tour): TourSummary` · `toTourDetail(db, tour, viewerId): TourDetail` · `toMyApplication(db, app, now): MyApplication` · `toApplicantsBoard(db, tourId): ApplicantsBoard` · `toGuideTourSummary(db, tour): GuideTourSummary` · `toCourse(db, tourId): Course` · `toCoupon(db, coupon, now): Coupon` · `toUniversity(db, u): University`
  - `util.ts`: `requireUser(request: Request, db: DB, role?: Role): UserRow`(401 UNAUTHORIZED / 403 FORBIDDEN) · `withErrors(resolver)`(MockApiError → `HttpResponse.json({code,message,details}, {status})`)
  - `registry.ts`: `handlersByDomain: Record<MockDomain, HttpHandler[]>` · `selectHandlers(domains: MockDomain[] | 'all'): HttpHandler[]`
  - `browser.ts`: `startMockWorker(domains: MockDomain[] | 'all'): Promise<void>`(`onUnhandledRequest: 'bypass'`, `serviceWorker.url: '/mockServiceWorker.js'`, `quiet: true`)
  - 엔드포인트 = Task 4 계약 표 전부(경로 · 상태 코드 · 에러 그대로). `GET /api/health` → `{ ok: true, mode: 'mock' }`. `POST /api/demo/reset` → `resetDb({ today: mockNow(), checkpoint })`. 목록 정렬: 탐방 목록 · 가이드 탐방 목록은 `startsAt` 오름차순, 내 신청 목록은 `createdAt` 내림차순.
  - `src/demo/demoStore.ts`(최소판 — Task 17 · 21이 넓힌다): zustand persist `'ytt.demo'`, `{ enabled: boolean(false); apiModeOverride: ApiMode | null(null) }` · `readDemoOverride(): ApiMode | null` · `isDemoToolsOn(): boolean`(`env.demoTools || enabled`)
  - `main.tsx` 순서: `const mode = resolveApiMode(env.apiMode, readDemoOverride(), location.search)` → mock이면 `await (await import('./mocks/browser')).startMockWorker(env.mockDomains)` → `configureHttp({ baseUrl: env.apiBaseUrl })` → 렌더.

- [ ] **Step 1: 실패하는 테스트 작성** — 핸들러는 HTTP 클라이언트로 부른다(테스트 setup이 `node.ts` 서버 + `setMockLatency({base:0, ai:0})` + 매 테스트 `resetDb({ today: new Date() })`).

```ts
async function login(email: string) {
  const r = await request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });
  configureHttp({ getToken: () => r.token }); return r;
}
it('로그인 → /me', async () => { await login('student@demo.kr'); expect((await request<Me>('/me')).role).toBe('HIGH_SCHOOL'); });
it('틀린 비밀번호는 401 INVALID_CREDENTIALS', async () =>
  await expect(request('/auth/login', { method: 'POST', body: { email: 'student@demo.kr', password: 'x' } })).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' }));
it('추천 → 신청 → 내 탐방', async () => {
  await login('student@demo.kr');
  const rec = await request<RecommendationResult>('/recommendations', { method: 'POST', body: { q: '산업디자인 공부' } });
  const app = await request<MyApplication>(`/tours/${rec.items[0].tour.id}/applications`, { method: 'POST', body: { motivation: '밥집이 궁금해요' } });
  expect(app.status).toBe('PENDING');
  expect((await request<MyApplication[]>('/me/applications'))[0].id).toBe(app.id);
});
it('가이드 승인 → 보드 갱신', async () => { /* 최유진 PENDING 승인 → counts.approved 3 */ });
it('학생은 가이드 API 403', async () => { await login('student@demo.kr'); await expect(request('/guide/tours')).rejects.toMatchObject({ status: 403 }); });
it('미확정 코스 조회는 404 COURSE_NOT_READY', async () => { /* 승인된 학생 seojun@demo.kr → GET /tours/1/course */ });
it('사장님 쿠폰 사용 · 이미 사용', async () => { /* resetDb CONFIRMED → owner1로 김민지 상점1 쿠폰 redeem → tourVisitorCount 1 → 다시 → 409 COUPON_ALREADY_USED */ });
it('시연 초기화는 체크포인트를 적용', async () => { /* POST /demo/reset {checkpoint:'CONFIRMED'} → 김민지 쿠폰 2장 */ });
// registry.test.ts
it('도메인 일부만 고르면 그 핸들러만', () => {
  expect(selectHandlers(['auth']).length).toBe(handlersByDomain.auth.length);
  expect(selectHandlers('all').length).toBe(Object.values(handlersByDomain).flat().length);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/mocks` / Expected: FAIL
- [ ] **Step 3: 구현** — 모든 핸들러는 `withErrors` + `await delayBase()`(추천 · 초안은 `delayAi()`) → `mutate(db => …)`로 규칙 호출 → `views`로 DTO. `now`는 `mockNow()`. 쿠폰 · 신청 DTO의 `state` · `cancellable`은 여기서 계산한다.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run && npm run typecheck && npm run build` / Expected: PASS
- [ ] **Step 5: 브라우저 확인** — Run: `npm run dev` 후 개발자 도구 콘솔에서 `fetch('/api/health').then(r=>r.json())` / Expected: `{ok:true, mode:'mock'}`
- [ ] **Step 6: 진척 문서 갱신** — API 연동 표의 모든 행 `목업 ✅`, devlog.
- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat: MSW 핸들러(계약 초안 전체)와 목업 워커 부트스트랩"`

---

### Task 10: 디자인 토큰 · 폰트 · 공통 UI 컴포넌트

**Files:**
- Create: `src/styles/tokens.css`, `src/shared/lib/ime.ts`, `src/app/layouts/FrameContext.tsx`, `src/shared/ui/{Button,TextField,Textarea,Select,TopBar,BottomTabBar,StatusChip,InfoCard,Badge,AiBadge,KeywordChips,AiLoading,CodeInput,EmptyState,ErrorState,Skeleton,BottomSheet,ConfirmDialog,Page}.tsx`
- Modify: `src/styles/globals.css`, `src/main.tsx`(`import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'`)
- Test: `src/shared/lib/ime.test.ts`, `src/shared/ui/ui.test.tsx`

**Interfaces:**
- Produces:
  - `tokens.css`: `:root` CSS 변수 — 색(`--color-bg #ffffff`, `--color-surface #f2f2f2`, `--color-border #d9d9d9`, `--color-text #1a1a1a`, `--color-text-muted #6b6b6b`, `--color-primary #2b2b2b`, `--color-on-primary #ffffff`, `--color-accent #3b5bdb`, `--color-success #2f9e44`, `--color-warning #e8590c`, `--color-danger #e03131`, `--color-backdrop #e9ecef`), 반경(`--radius-sm 8px`, `--radius-md 14px`, `--radius-lg 20px`, `--radius-frame 36px`), 크기(`--topbar-h 68px`, `--tabbar-h 81px`, `--btn-h 50px`, `--field-h 56px`, `--gutter 20px`), 글꼴(`--font-sans "Pretendard Variable", Pretendard, system-ui, sans-serif`). `globals.css`의 `@theme`가 이 변수를 Tailwind 토큰(`bg-surface`, `text-muted`, `rounded-md` …)으로 연결한다. **하이파이 반영 = 이 파일 값 교체**.
  - `ime.ts`: `isImeComposing(e: { nativeEvent: { isComposing?: boolean; keyCode?: number } }): boolean`(isComposing 또는 keyCode 229) · `preventImeEnter(e: React.KeyboardEvent): void`(Enter + 조합 중이면 `preventDefault`)
  - `FrameContext.tsx`: `FrameProvider({ container: HTMLElement | null, children })` · `useFrameContainer(): HTMLElement | null`
  - 컴포넌트 props:
    - `Button({ variant?: 'primary'|'secondary'|'ghost'; size?: 'lg'|'sm'; loading?: boolean; hint?: { reason: string; action?: ActionLink }; ...ButtonHTMLAttributes })` — lg 높이 50px, 전체 폭. `hint`가 있으면 버튼 아래에 사유 문구(`id`로 `aria-describedby` 연결)와 액션 링크(react-router `Link`). `loading`이면 disabled.
    - `TextField({ label: string; error?: string; hint?: string; ...InputHTMLAttributes })` — `aria-label=label`, placeholder 기본값 label, 높이 56px, error는 `role="alert"`.
    - `Textarea({ label; error?; hint?; ...TextareaHTMLAttributes })` · `Select({ label; options: {value: string; label: string}[]; ...SelectHTMLAttributes })`(네이티브 select)
    - `TopBar({ title: string; back?: boolean | string; right?: ReactNode })` — 68px, 뒤로 버튼 `aria-label="뒤로 가기"`(true면 `navigate(-1)`, 문자열이면 그 경로).
    - `BottomTabBar({ tabs: TabItem[] })` — `TabItem = { to: string; label: string; icon: LucideIcon; end?: boolean }`, NavLink active면 `aria-current="page"`, 81px.
    - `StatusChip({ icon?: ReactNode; tone?: Tone; children })` · `InfoCard({ title: ReactNode; description?: ReactNode; muted?: boolean; children?; footer?: ReactNode })` · `Badge({ tone?: Tone; children })` · `AiBadge({ children?: ReactNode })`(`✦` + children, `aria-label="AI 결과"`) · `KeywordChips({ keywords: string[] })` · `AiLoading({ steps: string[]; intervalMs?: number })`(기본 1200ms마다 다음 문구, `role="status"`) · `CodeInput({ value: string; onChange(v: string): void; onComplete?(v: string): void; length?: number; label?: string })`(한 개 input, `inputMode="numeric"`, `autoComplete="one-time-code"`, 숫자 외 제거, 길이 초과 자르기) · `EmptyState({ title; description?; action?: ActionLink })` · `ErrorState({ error: unknown; onRetry?(): void })`(`errorMessage(error.code)`) · `Skeleton({ className? })` · `BottomSheet({ open; onOpenChange; title: string; children })`(Radix Dialog, `container = useFrameContainer()`) · `ConfirmDialog({ open; onOpenChange; title; description; confirmLabel: string; cancelLabel?: string = '돌아가기'; onConfirm(): void; pending?: boolean })` · `Page({ children; className? })`(좌우 20px, 하단 24px)
  - `Tone` · `ActionLink`는 Task 3의 `src/shared/lib/types.ts`를 쓴다(`shared`는 `features`를 import하지 않는다).

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('조합 중 Enter는 기본 동작을 막는다', () => {
  const e = { key: 'Enter', nativeEvent: { isComposing: true }, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
  preventImeEnter(e); expect(e.preventDefault).toHaveBeenCalled();
});
it('CodeInput은 숫자만 6자리, 다 차면 onComplete', async () => {
  const onComplete = vi.fn(); function W() { const [v, setV] = useState(''); return <CodeInput value={v} onChange={setV} onComplete={onComplete} />; }
  render(<W />); await userEvent.type(screen.getByLabelText('6자리 쿠폰 코드'), 'a1b2c3d4e5f6g7');
  expect(screen.getByLabelText('6자리 쿠폰 코드')).toHaveValue('123456'); expect(onComplete).toHaveBeenCalledWith('123456');
});
it('Button hint: 사유와 다음 행동 링크', () => {
  render(<MemoryRouter><Button disabled hint={{ reason: '사유', action: { label: '인증하러 가기', to: '/verify' } }}>탐방 신청하기</Button></MemoryRouter>);
  expect(screen.getByRole('button', { name: '탐방 신청하기' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '탐방 신청하기' })).toHaveAccessibleDescription('사유');
  expect(screen.getByRole('link', { name: '인증하러 가기' })).toHaveAttribute('href', '/verify');
});
it('ConfirmDialog: 확인은 onConfirm, 돌아가기는 닫기', async () => { /* open → '확정하기' 클릭 → onConfirm 1회 / '돌아가기' → onOpenChange(false) */ });
it('BottomTabBar: 현재 경로 탭에 aria-current', () => { /* MemoryRouter initialEntries ['/my-tours'] → '내 탐방' 링크 aria-current="page" */ });
it('AiLoading: 시간이 지나면 다음 문구', () => { vi.useFakeTimers(); /* steps 2개 → act(advance 1200) → 두 번째 문구 */ vi.useRealTimers(); });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/shared` / Expected: FAIL
- [ ] **Step 3: 구현** — 와이어프레임 형태(흰 바탕 · 회색 카드 · 검은 기본 버튼 · 회색 칩)를 토큰으로 재현. 색 값은 위 토큰만 쓰고 컴포넌트에 HEX를 쓰지 않는다.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run && npm run lint` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — devlog, 결정 0003 반영 표시.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 디자인 토큰·Pretendard·공통 UI 컴포넌트"`

---

### Task 11: 앱 셸 — 세션 · 라우터 · 가드 · 레이아웃 · 로그인 · 자리 라우트

**Files:**
- Create: `src/features/auth/session.ts`, `src/features/auth/api.ts`, `src/features/auth/queries.ts`, `src/shared/api/queryKeys.ts`, `src/app/providers.tsx`, `src/app/routes.tsx`, `src/app/router.tsx`, `src/app/tabs.ts`, `src/app/guards/RequireAuth.tsx`, `src/app/guards/RequireRole.tsx`, `src/app/layouts/AppShell.tsx`, `src/app/layouts/MobileFrame.tsx`, `src/app/layouts/RoleTabLayout.tsx`, `src/app/ErrorPage.tsx`, `src/app/NotFoundPage.tsx`, `src/pages/PlaceholderPage.tsx`, `src/pages/auth/LoginPage.tsx`, `src/test/renderApp.tsx`
- Modify: `src/app/App.tsx`, `src/main.tsx`, `src/styles/globals.css`(프레임 CSS)
- Test: `src/app/shell.test.tsx`, `src/pages/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: Task 3 `configureHttp`, Task 5 `getLandingPath`, Task 9 핸들러, Task 10 컴포넌트
- Produces:
  - `session.ts`: `useSession` (zustand persist `'ytt.session'`, `{ token: string | null; setToken(t: string | null): void }`) · `handleUnauthorized(): void`(토큰 비움 — Task 21이 시연 자동 재로그인을 덧붙임)
  - `api.ts`: `login(input: { email: string; password: string }): Promise<LoginResponse>` · `logout(): Promise<void>` · `fetchMe(): Promise<Me>`
  - `queries.ts`: `useMe(): UseQueryResult<Me>`(token 있을 때만, `refetchOnWindowFocus: true`) · `useLogin()`(성공 시 `queryClient.clear()` → `setToken` → `setQueryData(qk.me, me)`) · `useLogout(): () => Promise<void>`(서버 로그아웃 실패 무시 → `setToken(null)` → `queryClient.clear()` → `navigate('/login', { replace: true })`)
  - `queryKeys.ts`: `qk = { me, universities, insight(id), recommendations(q), tours(filter), tour(id), myApplications, myApplication(id), myCoupons(applicationId?), coupon(id), course(tourId), guideTours, applicants(tourId), guideCourse(tourId), couponLookup(code), health }` (모두 `as const` 배열)
  - `providers.tsx`: `createQueryClient(): QueryClient`(retry 1, staleTime 30_000, refetchOnWindowFocus true) · `AppProviders({ queryClient, children })`(QueryClientProvider + sonner `<Toaster position="top-center" />`)
  - `routes.tsx`: `routes: RouteObject[]` — 루트 `element: <AppShell/>`, `errorElement: <ErrorPage/>`. 공개: `/login`(LoginPage), `/signup`, `/consent/:token`. `RequireAuth` 아래: `RoleTabLayout` + `/tours/:tourId`(모든 역할) · `RequireRole role="HIGH_SCHOOL"` + `RoleTabLayout` 아래 고교생 라우트 · UNIVERSITY · OWNER · ADMIN 각각. **설계 5.3의 모든 라우트를 등록**하고, 이 계획에서 아직 없는 화면은 `<PlaceholderPage title="…" wireframe="…" />`(P0 화면도 처음엔 자리 → 각 태스크가 교체). `*` → NotFoundPage.
  - `router.tsx`: `createAppRouter(): ReturnType<typeof createBrowserRouter>` · `App.tsx`: `App({ router, queryClient })` = `AppProviders` + `RouterProvider`. `main.tsx`가 `createQueryClient()`와 `createAppRouter()`를 만들어 넘긴다(Task 21이 같은 인스턴스로 원클릭 로그인을 한다).
  - `tabs.ts`: `TABS: Record<Role, TabItem[]>` — HIGH_SCHOOL `[{to:'/',label:'탐색',icon:Search,end:true},{to:'/my-tours',label:'내 탐방',icon:List},{to:'/me',label:'MY',icon:CircleUser}]` · UNIVERSITY `[{to:'/explore',label:'탐색'},{to:'/guide/tours',label:'운영'},{to:'/guide/me',label:'MY'}]` · OWNER `[{to:'/explore',label:'탐색'},{to:'/owner/store',label:'운영'},{to:'/owner/me',label:'MY'}]` · ADMIN `[]`
  - `RequireAuth`: 토큰 없음 → `<Navigate to={'/login?next=' + encodeURIComponent(pathname + search)} replace/>` · `useMe` 로딩 → Skeleton · 성공 → `<Outlet/>`
  - `RequireRole({ role })`: `me.role !== role` → `<Navigate to={getLandingPath(me)} replace/>`
  - `MobileFrame`: 폭 ≥ 480px면 가운데 프레임(폭 390px, 높이 `min(844px, 100dvh - 32px)`, `--radius-frame`, 그림자, `overflow: hidden`, `position: relative`), 미만이면 전체 화면. 프레임 DOM을 `FrameProvider`로 제공. 옆 슬롯 `aside`(Task 21의 시연 패널 자리, 지금은 비움). `transform: scale` 금지.
  - `RoleTabLayout()`: `useMe().data.role`로 탭을 고른다. 세로 flex — 스크롤 영역(`Outlet`) + `BottomTabBar tabs={TABS[role]}`(탭이 없으면 생략)
  - `PlaceholderPage({ title: string; wireframe?: string; showLogout?: boolean })`: TopBar(back) + `EmptyState title={title} description="MVP 2단계에서 열려요."` + (`wireframe` 있으면 `와이어프레임: {code}`) + `showLogout`이면 `로그아웃` 버튼. `/me` `/guide/me` `/owner/me` 자리는 `showLogout`. 사장님 `/owner/store` 자리에는 추가로 `쿠폰 사용 처리` 링크(→ `/owner/coupons/redeem`).
  - `renderApp(path: string, opts?: { as?: DemoRole | string; checkpoint?: SeedCheckpoint }): Promise<{ user: UserEvent; router: ReturnType<typeof createMemoryRouter>; queryClient: QueryClient }>` — `resetDb({ today: new Date(), checkpoint })`, `as`가 있으면(DemoRole이면 `DEMO_EMAILS`로, 아니면 이메일 그대로) `createSession` 후 `useSession.setState({ token })`, `createMemoryRouter(routes, { initialEntries: [path] })`, `AppProviders`로 렌더.
  - `findApplicationId(email: string, tourId: number): number` — `getDb()`에서 그 학생의 해당 탐방 신청 id(테스트가 `renderApp` 뒤에 `router.navigate('/my-tours/' + id + '/…')`로 쓴다).
  - LoginPage(hs-s01 문구): TopBar `반가워요! 👋`, 제목 `대학생이 직접 안내하는\n나만의 캠퍼스 탐방`, 카드 `고등학생 · 대학생 · 사장님` / `각 역할에 맞는 탐방과 상권 서비스를 이용해요.`, `이메일로 시작하기`, TextField `이메일 주소`(type email) · `비밀번호`(type password), 기본 버튼 `로그인`, 보조 링크 버튼 `새 계정 만들기`(→ `/signup`), 각주 `가입 시 고교생 / 대학생 / 사장님 중 역할을 선택해요.` 폼은 zod(이메일 형식, 비밀번호 1자 이상), `<form onKeyDown={preventImeEnter}>`. 성공 → `next` 또는 `getLandingPath(me)`.
  - `main.tsx`: `configureHttp({ baseUrl: env.apiBaseUrl, getToken: () => useSession.getState().token, onUnauthorized: handleUnauthorized })`.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// shell.test.tsx
it('로그인 안 하면 /login?next=', async () => {
  const { router } = await renderApp('/my-tours');
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  expect(router.state.location.search).toBe('?next=%2Fmy-tours');
});
it('고교생이 가이드 화면에 가면 자기 첫 화면으로', async () => {
  const { router } = await renderApp('/guide/tours', { as: 'student' });
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
});
it('없는 주소는 404', async () => { await renderApp('/nope', { as: 'student' }); expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeInTheDocument(); });
it('로그아웃하면 세션·캐시를 비우고 /login', async () => {
  const { user, router, queryClient } = await renderApp('/me', { as: 'student' });
  await user.click(await screen.findByRole('button', { name: '로그아웃' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  expect(useSession.getState().token).toBeNull(); expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
it('고교생 하단 탭 3개', async () => { await renderApp('/me', { as: 'student' });
  for (const n of ['탐색', '내 탐방', 'MY']) expect(await screen.findByRole('link', { name: n })).toBeInTheDocument(); });

// LoginPage.test.tsx
it('데모 계정 로그인 → 첫 화면', async () => {
  const { user, router } = await renderApp('/login');
  await user.type(screen.getByLabelText('이메일 주소'), 'student@demo.kr'); await user.type(screen.getByLabelText('비밀번호'), 'demo1234');
  await user.click(screen.getByRole('button', { name: '로그인' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
});
it('틀리면 안내 문구', async () => { /* 비밀번호 'x' → findByText('이메일 또는 비밀번호가 맞지 않아요.') */ });
it('next로 돌아간다', async () => { /* renderApp('/login?next=%2Fmy-tours') → 로그인 → '/my-tours' */ });
it('한글 조합 중 Enter는 막는다 (Review Focus 1)', async () => {
  await renderApp('/login'); const input = screen.getByLabelText('비밀번호');
  const ev = createEvent.keyDown(input, { key: 'Enter', isComposing: true }); fireEvent(input, ev);
  expect(ev.defaultPrevented).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/app src/pages` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 Interfaces 그대로. `AppShell` = `MobileFrame` 안에 `<Outlet/>`.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run && npm run typecheck && npm run lint` / Expected: PASS
- [ ] **Step 5: 브라우저 확인** — `npm run dev` → `/login`에서 `student@demo.kr / demo1234` → 고교생 탭 3개가 보이는 자리 화면. 폭 1280에서 가운데 폰 프레임.
- [ ] **Step 6: 진척 문서 갱신** — `hs-s01` UI ✅ · 목업 ✅, P1 자리 라우트 전부 UI `자리`, devlog.
- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat: 앱 셸(세션·라우터·가드·폰 프레임·탭)과 로그인, P1 자리 라우트"`

---

### Task 12: 배포 준비 체크포인트 (11/4)

**Files:**
- Create: `vercel.json`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `docs/progress/README.md`

**Interfaces:**
- Produces: `vercel.json` = `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` (정적 파일이 먼저라 `mockServiceWorker.js` · 에셋은 그대로 서빙됨. `/api` 프록시 rewrite는 백엔드 주소가 정해지면 3단계에서 앞에 추가) · Playwright: `testDir: 'e2e'`, `use.baseURL: 'http://localhost:4173'`, `webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', env: { VITE_API_MODE: 'mock', VITE_DEMO_TOOLS: 'true' }, reuseExistingServer: !process.env.CI }`, projects chromium.

- [ ] **Step 1: 실패하는 테스트 작성** — `e2e/smoke.spec.ts` (Review Focus 2)

```ts
test('배포 빌드: 로그인 후 딥링크 새로고침에도 상태 유지', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일 주소').fill('student@demo.kr'); await page.getByLabel('비밀번호').fill('demo1234');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/my-tours'); await page.reload();
  await expect(page.getByRole('link', { name: '내 탐방' })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: 브라우저 설치 후 실패 확인** — Run: `npx playwright install chromium && npx playwright test e2e/smoke.spec.ts` / Expected: FAIL (`playwright.config.ts`가 없어 baseURL · 웹 서버가 없음 → `page.goto('/login')` 실패)
- [ ] **Step 3: `playwright.config.ts` · `vercel.json` 작성** — expect 기본 타임아웃 10초(목업 AI 지연 1.5초 고려).
- [ ] **Step 4: 통과 확인** — Run: `npm run e2e -- e2e/smoke.spec.ts` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — 체크포인트 "11/4 빈 앱 배포"를 `🟨`(배포 대기), devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "chore: Vercel SPA 설정과 배포 빌드 E2E 스모크"`
- [ ] **Step 7: [사용자 확인 — 오케스트레이터가 직접]** 사용자에게 ① main 푸시 허락 ② Vercel 프로젝트 연결(팀 계정 · GitHub `yongyongthon-team1/frontend` · 환경변수 `VITE_API_MODE=mock`, `VITE_DEMO_TOOLS=true`) 또는 `vercel` CLI 배포 허락을 묻는다. 배포 URL을 받으면 대시보드 체크포인트를 `✅`로, URL을 기록하고 커밋. (사용자가 미루면 `🟨` 유지하고 다음 태스크 진행)

---

### Task 13: 고교생 — 홈 · AI 추천 목록 (hs-s03, hs-s04, hs-a06 "추천 0건")

**Files:**
- Create: `src/features/tours/api.ts`, `src/features/tours/queries.ts`, `src/features/tours/examples.ts`, `src/features/tours/lastQuery.ts`, `src/features/tours/recommendationParams.ts`, `src/features/tours/components/TourCard.tsx`, `src/features/campuses/api.ts`, `src/features/campuses/queries.ts`, `src/pages/student/HomePage.tsx`, `src/pages/student/RecommendationsPage.tsx`
- Modify: `src/app/routes.tsx`(`/`, `/recommendations`)
- Test: `src/features/tours/recommendationParams.test.ts`, `src/pages/student/HomePage.test.tsx`, `src/pages/student/RecommendationsPage.test.tsx`

**Interfaces:**
- Consumes: Task 11 `qk`, `renderApp`; Task 10 UI
- Produces:
  - `tours/api.ts`: `recommend(q: RecommendationQuery): Promise<RecommendationResult>`(AI_TIMEOUT_MS) · `listTours(filter: { status?: TourStatus; universityId?: number }): Promise<TourSummary[]>` · `getTour(id: number): Promise<TourDetail>`
  - `tours/queries.ts`: `useRecommendations(q: RecommendationQuery | null)` · `useTours(filter)` · `useTour(id: number)`
  - `campuses/api.ts`: `listUniversities(): Promise<University[]>` · `getInsight(universityId: number): Promise<Insight>` / `campuses/queries.ts`: `useUniversities()` · `useInsight(universityId: number | undefined)`
  - `examples.ts`: `EXAMPLE_QUERIES = ['산업디자인을 공부하고 싶고, 학생들이 주로 어디서 시간을 보내는지 궁금해요.', '컴퓨터공학과 수업이 궁금하고, 캠퍼스 카페에서 공부해 보고 싶어요.', '통번역을 배우고 싶은데 외국어 수업 분위기가 궁금해요.'] as const`
  - `recommendationParams.ts`: `toSearch(q: RecommendationQuery): string`(키 `q`, `major`, `school`, `date`, 빈 값 생략) · `fromSearch(search: string): RecommendationQuery | null`(`q` 없으면 null)
  - `lastQuery.ts`: `useLastQuery`(zustand persist `'ytt.lastQuery'`, `{ search: string | null; setSearch(s: string): void }`) · `recommendationsPath(): string`(저장된 search가 있으면 `/recommendations?{search}`, 없으면 `/`)
  - `TourCard({ title: string; lines: ReactNode[]; reason?: string; footer?: ReactNode; to?: string })` — 와이어 hs-s04 카드 모양, `reason`이 있으면 `AiBadge` + 문구. `to`가 있으면 카드 전체가 하나의 `Link`다.
  - HomePage 문구(hs-s03): TopBar `어떤 캠퍼스가 궁금해?`(back 없음), 제목 `관심사에 맞는\n캠퍼스를 발견해봐요.`, Textarea label `하고 싶은 것`(placeholder = `EXAMPLE_QUERIES[0]`), 도움말 `하고 싶은 것을 편하게 문장으로 적어 주세요.`, 예시 칩 버튼 3개(`EXAMPLE_QUERIES`, 누르면 입력칸 채움), 소제목 `탐방 조건`, TextField `관심 학과 (선택)`, Select `방문할 학교 (선택)`(옵션 `전체` + 5개교 `shortName + ' ' + campusName`), date TextField `방학 중 탐방 날짜 (선택)`, 기본 버튼 `나에게 맞는 탐방 추천받기`, 각주 `추천은 가이드 정보와 관심 키워드를 비교해 정렬돼요.` 빈 문장 제출 → 필드 오류 `하고 싶은 것을 한 문장 이상 적어 주세요.`(5자 미만). 제출 → `setSearch(toSearch(q))` → `/recommendations?{search}`. 주소에 검색 파라미터가 있으면(`학교 · 날짜 다시 선택`으로 돌아온 경우) `fromSearch`로 폼 초깃값을 채운다.
  - RecommendationsPage 문구(hs-s04): TopBar `추천 탐방`(back `/`), 로딩 `AiLoading steps=['관심사를 분석하고 있어요','탐방을 비교하고 있어요']`, 칩 `AI가 관심사를 분석했어요 ✦`, 제목 = `result.headline`, `KeywordChips`, 부제 `추천 이유와 남은 자리를 확인해보세요.`, fallback이면 칩 대신 `StatusChip tone="warning"`에 headline, 카드마다 `TourCard title={universityName + ' ' + campusName}` · 줄 `{major} · {formatShortDate} {formatTime}` · reason · footer `잔여 {remainingSeats}자리` + `자세히 보기 →`(→ `/tours/{id}`), 보조 버튼 `학교 · 날짜 다시 선택`(→ `/?{search}`로 돌아가 입력 유지), 각주 `탐방이 없다면 같은 학교의 모집 중 탐방을 보여줘요.` 쿼리 없으면 `/`로 Navigate. 에러면 `ErrorState onRetry`.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('검색 파라미터 왕복', () => {
  const q = { q: '밥', major: '산업디자인', universityId: 2, date: '2026-12-28' };
  expect(fromSearch(toSearch(q))).toEqual(q); expect(fromSearch('')).toBeNull();
});
it('예시 칩을 누르면 입력칸이 채워진다', async () => {
  const { user } = await renderApp('/', { as: 'student' });
  await user.click(await screen.findByRole('button', { name: EXAMPLE_QUERIES[0] }));
  expect(screen.getByLabelText('하고 싶은 것')).toHaveValue(EXAMPLE_QUERIES[0]);
});
it('빈 문장은 안내', async () => { /* 바로 추천받기 → findByText('하고 싶은 것을 한 문장 이상 적어 주세요.') */ });
it('추천받기 → AI 결과', async () => {
  const { user, router } = await renderApp('/', { as: 'student' });
  await user.click(await screen.findByRole('button', { name: EXAMPLE_QUERIES[0] }));
  await user.click(screen.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }));
  expect(await screen.findByText('디자인 분야에 관심이 많군요!')).toBeInTheDocument();
  expect(screen.getByText('AI가 관심사를 분석했어요 ✦')).toBeInTheDocument();
  expect(screen.getByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/recommendations');
});
it('매칭이 없으면 넓힌 결과', async () => {
  await renderApp('/recommendations?q=%EC%9A%B0%EC%A3%BC%ED%95%AD%EA%B3%B5', { as: 'student' });
  expect(await screen.findByText('조건을 넓혀서 보여 드려요')).toBeInTheDocument();
});
it('쿼리가 없으면 홈으로', async () => { const { router } = await renderApp('/recommendations', { as: 'student' });
  await waitFor(() => expect(router.state.location.pathname).toBe('/')); });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/student src/features/tours` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 문구 · props 그대로. 폼은 React Hook Form + zod.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run && npm run lint` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `hs-s03` · `hs-s04` UI ✅ 목업 ✅, `hs-a06`(추천 0건) 🟨, devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 고교생 홈과 AI 추천 목록(0건 대체 포함)"`

---

### Task 14: 고교생 — 탐방 상세 · 신청서 · 신청 완료 (hs-s05, hs-a04, hs-s06, hs-a06)

**Files:**
- Create: `src/features/applications/api.ts`, `src/features/applications/queries.ts`, `src/pages/student/TourDetailPage.tsx`, `src/pages/student/ApplyPage.tsx`, `src/pages/student/ApplyDonePage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/pages/student/TourDetailPage.test.tsx`, `src/pages/student/ApplyPage.test.tsx`

**Interfaces:**
- Consumes: Task 5 `applyButtonState`; Task 13 `useTour`, `recommendationsPath`, `TourCard`
- Produces:
  - `applications/api.ts`(목업 규칙 함수와 이름이 겹치지 않게 HTTP 동사를 붙인다): `postApplication(tourId: number, motivation: string): Promise<MyApplication>` · `getMyApplications(): Promise<MyApplication[]>` · `getMyApplication(id: number): Promise<MyApplication>` · `postCancelApplication(id: number): Promise<MyApplication>` · `getGuideTours(): Promise<GuideTourSummary[]>` · `getApplicantsBoard(tourId: number): Promise<ApplicantsBoard>` · `postApprove(id: number): Promise<ApplicantsBoard>` · `postReject(id: number): Promise<ApplicantsBoard>`
  - `applications/queries.ts`: `useApplyToTour(tourId)`(성공 → invalidate `qk.tour(tourId)`, `qk.myApplications`) · `useMyApplications()` · `useMyApplication(id)` · `useCancelMyApplication(id)` · `useGuideTours()` · `useApplicantsBoard(tourId)` · `useApprove(tourId)` · `useReject(tourId)`(성공 → `setQueryData(qk.applicants(tourId), board)` + invalidate `qk.guideTours`, `qk.tour(tourId)`)
  - TourDetailPage(hs-s05): TopBar `탐방 상세`(back), 칩 `{TOUR_STATUS_LABEL} · 남은 자리 {n}명`(CLOSED면 `마감`), 제목 `tour.title`, 카드 `가이드 {guideName} · {major}` / (guideVerified면) `✓ 재학 인증 완료 · {guideIntroduction}`, 카드 `{formatTourDate} {formatTimeRange} · 정원 {capacity}명` / `캠퍼스 소개 → 전공 공간 → 대학가 식사·카페`, 소제목 `이 탐방에서 만날 수 있는 것` + `introduction`, 버튼 = `applyButtonState(me, tour, recommendationsPath())` — enabled면 `action.to`로 이동, 아니면 disabled + `hint={{ reason, action }}`.
  - ApplyPage(hs-a04): TopBar `탐방 신청서`(back), 칩 `신청 전 정보 확인`, 카드 `{tour.title}` / `{formatMonthDay} · {formatTimeRange} · 가이드 재학 인증 완료`, 소제목 `가이드에게 하고 싶은 이야기는?`, Textarea label `하고 싶은 것 입력`, placeholder `실기 준비와 대학에서 배우는 수업이 궁금해요.`, 도움말 `예: 전공 수업, 시설, 대학 생활`(`isDemoToolsOn()`이면 초깃값 `DEMO_MOTIVATION`), 카드 `신청 조건 확인` + 두 줄 `재학 인증 승인 ✓|✗`, `보호자 동의 완료 ✓|✗`, 기본 버튼 `탐방 신청 완료하기`(applyButtonState가 APPLY가 아니면 disabled + hint), 각주 `정원 마감 · 중복 신청 시 신청 버튼이 비활성화돼요.` 검증: 5자 미만 `하고 싶은 것을 5자 이상 적어 주세요.`, 300자 초과 `300자 이내로 적어 주세요.` 성공 → `/tours/{id}/apply/done`(replace). 실패 → `toast.error(errorMessage(code))`.
  - ApplyDonePage(hs-s06): TopBar `신청이 접수됐어요!`, 카드 `⌛ 가이드 승인 대기 중` / `신청이 완료되었어요. 승인 결과는 내 탐방에서 확인해요.`, 소제목 `신청한 탐방` + TourCard(`{universityName} {campusName}` / `{major} · {formatMonthDay}` / `가이드 승인 후 오픈채팅 링크가 공개돼요.` / `상태 · 신청됨`), 카드 `가이드가 신청 내용을 확인하고 있어요.` / `거절 시 다른 추천 탐방으로 이동할 수 있어요.`, 기본 버튼 `내 탐방 확인하기`(→ `/my-tours`), 보조 버튼 `다른 탐방 둘러보기`(→ `recommendationsPath()`).

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('인증된 학생: 신청 → 완료 화면 → 상세는 신청됨', async () => {
  const { user, router } = await renderApp('/tours/1', { as: 'student' });
  await user.click(await screen.findByRole('button', { name: '탐방 신청하기' }));
  await user.type(await screen.findByLabelText('하고 싶은 것 입력'), '밥집이 궁금해요');
  await user.click(screen.getByRole('button', { name: '탐방 신청 완료하기' }));
  expect(await screen.findByText('신청이 접수됐어요!')).toBeInTheDocument();
  await router.navigate('/tours/1');
  expect(await screen.findByRole('button', { name: '신청됨' })).toBeDisabled();
  expect(screen.getByRole('link', { name: '내 탐방에서 상태 확인' })).toHaveAttribute('href', '/my-tours');
});
it('인증 전 학생: 비활성 + 역할 인증 링크', async () => {
  await renderApp('/tours/1', { as: 'newbie@demo.kr' });
  expect(await screen.findByRole('button', { name: '탐방 신청하기' })).toBeDisabled();
  expect(screen.getByText('학생증 승인·보호자 동의 완료 후 신청할 수 있어요.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '역할 인증 단계로 이동' })).toHaveAttribute('href', '/verify');
});
it('마감 탐방: 정원 마감 + 다른 추천 보기', async () => { await renderApp('/tours/2', { as: 'student' });
  expect(await screen.findByRole('button', { name: '정원 마감' })).toBeDisabled(); });
it('신청서 5자 미만은 막는다', async () => { /* '밥' 입력 → findByText('하고 싶은 것을 5자 이상 적어 주세요.') */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/student` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run && npm run lint` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `hs-s05` `hs-a04` `hs-s06` UI ✅ 목업 ✅, `hs-a06` 정원 마감 · 인증 미완료 · 이미 신청 반영, devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 탐방 상세·신청서·신청 완료와 신청 불가 상태"`

---

### Task 15: 고교생 — 내 탐방 목록 · 상세 (hs-a05, hs-s07)

**Files:**
- Create: `src/pages/student/MyToursPage.tsx`, `src/pages/student/MyTourDetailPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/pages/student/MyToursPage.test.tsx`

**Interfaces:**
- Consumes: Task 5 `myTourDisplay`, `studentCourseLabel`; Task 14 `useMyApplications`, `useMyApplication`, `useCancelMyApplication`
- Produces:
  - MyToursPage(hs-a05): TopBar `내 탐방 · 신청 상태`, 캡션 `신청한 탐방 · 상태별 목록`, 카드마다 `myTourDisplay(app, recommendationsPath())`의 label(굵게) · description · action(링크, `→`), 빈 목록 `EmptyState title="아직 신청한 탐방이 없어요." action={{label:'추천받으러 가기', to:'/'}}`, 각주 `승인된 탐방의 오픈채팅 링크만 공개됩니다.`
  - MyTourDetailPage(hs-s07): TopBar `내 탐방`(back `/my-tours`), 상태 칩(APPROVED `✓ 신청 승인 완료` · PENDING `⌛ 가이드 승인 대기 중` · REJECTED `신청 거절` · CANCELED `취소됨`), APPROVED면 제목 `{formatMonthDay}에 만나요!`, 카드 `{universityName} {campusName}` / `{formatShortDate} {formatTimeRange} · {guideName} 가이드` / `진행 상태 · {studentCourseLabel(courseStatus)}`, `openChatUrl`이 있으면 카드 `가이드와 오픈채팅 참여하기` / `승인된 신청자에게만 링크가 열려요.` / 외부 링크 `오픈채팅 바로가기 ↗`(`target="_blank" rel="noopener noreferrer"`), 카드 `캠퍼스 & 상권 코스` — CONFIRMED면 버튼 `코스 지도 보기`(→ `course`) · `쿠폰 보기`(→ `coupons`), 아니면 `가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.` `cancellable`이면 보조 버튼 `탐방 신청 취소` → ConfirmDialog(`신청을 취소할까요?` / `승인된 신청을 취소하면 자리가 다른 학생에게 돌아가고, 발급된 쿠폰은 만료돼요.` / 확인 `신청 취소`) → 성공 `toast('신청을 취소했어요.')`. `cancellable`이 아니고 PENDING|APPROVED면 비활성 + hint 사유 `탐방 날짜가 되어 취소할 수 없어요.`

- [ ] **Step 1: 실패하는 테스트 작성** — 시연 탐방(1)은 "오늘"이라 취소할 수 없다. 취소 성공은 60일 뒤 탐방(6)으로 확인한다.

```tsx
it('오늘 탐방 신청은 대기 카드 + 취소 비활성', async () => {
  const { user, router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'APPLIED' });
  expect(await screen.findByText('신청 · 가이드 승인 대기')).toBeInTheDocument();
  await router.navigate(`/my-tours/${findApplicationId('student@demo.kr', 1)}`);
  expect(await screen.findByRole('button', { name: '탐방 신청 취소' })).toBeDisabled();
  expect(screen.getByText('탐방 날짜가 되어 취소할 수 없어요.')).toBeInTheDocument();
});
it('미래 탐방 신청은 취소된다', async () => {
  const { user, router } = await renderApp('/my-tours', { as: 'student' });
  mutate((db) => applyToTourRule(db, db.users.find((u) => u.email === 'student@demo.kr')!.id, 6, '수업이 궁금해요', new Date()));
  await router.navigate(`/my-tours/${findApplicationId('student@demo.kr', 6)}`);
  await user.click(await screen.findByRole('button', { name: '탐방 신청 취소' }));
  await user.click(await screen.findByRole('button', { name: '신청 취소' }));
  expect(await screen.findByText('취소됨')).toBeInTheDocument();
});   // applyToTourRule = mocks/rules/applications.ts의 applyToTour를 별칭 import
it('확정 코스면 지도·쿠폰 버튼과 오픈채팅', async () => {
  await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
  expect(await screen.findByText('승인 · 코스 확정')).toBeInTheDocument();
  /* 상세로 이동 → '코스 지도 보기', '쿠폰 보기', '오픈채팅 바로가기 ↗' href 'https://open.kakao.com/o/demo-khu-design' */
});
it('빈 목록', async () => { await renderApp('/my-tours', { as: 'student' }); expect(await screen.findByText('아직 신청한 탐방이 없어요.')).toBeInTheDocument(); });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/student/MyToursPage.test.tsx` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `hs-a05` `hs-s07` ✅, devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 내 탐방 상태별 목록과 상세(오픈채팅·코스 상태·취소)"`

---

### Task 16: 지도와 코스 지도 화면 (hs-s08)

**Files:**
- Create: `src/features/courses/api.ts`, `src/features/courses/queries.ts`, `src/features/courses/kakaoLoader.ts`, `src/features/courses/components/{MapView,SchematicMap,StoreSheet,StopList}.tsx`, `src/features/coupons/api.ts`, `src/features/coupons/queries.ts`, `src/pages/student/CourseMapPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/features/courses/kakaoLoader.test.ts`, `src/pages/student/CourseMapPage.test.tsx`

**Interfaces:**
- Consumes: Task 3 `circled`, `formatDuration`; Task 10 `BottomSheet`
- Produces:
  - `courses/api.ts`(HTTP 동사 접두): `getCourse(tourId: number)`(학생용 C-04) · `getGuideCourse(tourId)` · `postCourseDraft(tourId)`(AI_TIMEOUT_MS) · `putStopOrder(tourId, stopIds: number[])` · `patchStop(tourId, stopId, description: string)` · `deleteCourseStop(tourId, stopId)` · `postConfirmCourse(tourId)` — 모두 `Promise<Course>`
  - `courses/queries.ts`: `useCourse(tourId: number | undefined)` · `useGuideCourse(tourId)` · `useCreateDraft(tourId)` · `useReorderStops(tourId)` · `useUpdateStop(tourId)` · `useDeleteStop(tourId)` · `useConfirmCourse(tourId)` (변경 성공 → `setQueryData(qk.guideCourse(tourId), course)`, 확정 → invalidate `qk.applicants(tourId)`, `qk.guideTours`)
  - `coupons/api.ts`: `getMyCoupons(applicationId?: number): Promise<Coupon[]>` · `getMyCoupon(id: number): Promise<Coupon>` · `getCouponLookup(code: string): Promise<CouponLookup>` · `postRedeem(code: string): Promise<RedeemResult>` / `coupons/queries.ts`: `useMyCoupons(applicationId?)` · `useMyCoupon(id)`(state가 BEFORE_DAY|USABLE이면 `refetchInterval: 5000`) · `useCouponLookup(code: string)`(6자리일 때만) · `useRedeemCoupon()`
  - `kakaoLoader.ts`: `KAKAO_LOAD_TIMEOUT_MS = 4000` · `loadKakaoMaps(appKey: string | null, timeoutMs?: number): Promise<void>`(키 없음 → `Error('NO_KEY')`, 시간 초과 → `Error('TIMEOUT')`, 로드 실패 · `window.kakao?.maps` 없음 → `Error('LOAD_ERROR')`; 스크립트 `//dapi.kakao.com/v2/maps/sdk.js?appkey=…&autoload=false&libraries=services` 1회만 삽입, `kakao.maps.load` 콜백 후 resolve) · `useKakaoMaps(forceSchematic: boolean): 'loading' | 'ready' | 'fallback'`
  - `MapView({ stops: CourseStop[]; onSelect(stopId: number): void; forceSchematic?: boolean })` — ready면 react-kakao-maps-sdk `Map` + 번호 `CustomOverlayMap` + `Polyline`, fallback이면 `SchematicMap`, loading이면 Skeleton(높이 255px)
  - `SchematicMap({ stops; onSelect })` — 와이어 hs-s08 모양(회색 박스 · 도로 막대 · 검은 원 핀 + `{circled(order)} {짧은 이름}`), 좌표를 박스 안으로 정규화, `data-testid="schematic-map"`, 핀은 `button`(`aria-label="{circled} {name}"`)
  - `StopList({ stops; onSelect })` — 카드 `{circled(order)} {name} · {visitTime}` / 둘째 줄 `description ?? recommendationReason`, 제휴 상점이면 `공공데이터 기반 추천 · 쿠폰 사용 가능`
  - `StoreSheet({ stop: CourseStop | null; coupon: Coupon | null; onOpenChange })` — 제목 `name`, `{visitTime} · {category}`, `AiBadge` `추천 이유` + 이유, 리뷰 있으면 `✦ AI 리뷰 요약` + summary + `별점 {average.toFixed(1)} · 리뷰 {count}개`, count 0이면 `아직 리뷰가 없어요.`, dataSource 문구, 제휴면 `제휴 혜택 · {discount}` + 버튼 `쿠폰 보기`(→ `/coupons/{coupon.id}`)
  - CourseMapPage(hs-s08): `useMyApplication(id)` + `useCourse(app.tour.id)`; 코스 오류 `COURSE_NOT_READY` · FORBIDDEN이면 `EmptyState title="가이드가 코스를 준비 중이에요" description="확정되면 지도와 쿠폰이 열려요."`; TopBar `오늘의 탐방 코스`(back), 제목 `학교에서 동네까지, {formatDuration(startsAt, endsAt)}`, 칩 `{formatTourDate} · {universityShortName} {campusName}`, MapView, StopList, 기본 버튼 `제휴 상점 쿠폰 확인`(→ `/my-tours/{id}/coupons`). 지점을 누르면 StoreSheet.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('키가 없으면 NO_KEY', async () => await expect(loadKakaoMaps(null)).rejects.toThrow('NO_KEY'));
it('확정 코스: 도식 지도 핀 3개와 지점 목록', async () => {
  const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
  await router.navigate(`/my-tours/${findApplicationId('student@demo.kr', 1)}/course`);
  expect(await screen.findByText('오늘의 탐방 코스')).toBeInTheDocument();
  expect(screen.getByText('학교에서 동네까지, 2시간 30분')).toBeInTheDocument();
  expect(within(screen.getByTestId('schematic-map')).getAllByRole('button')).toHaveLength(3);
});
it('지점을 누르면 AI 리뷰 요약 시트', async () => { /* '② 서천 밥상' 클릭 → findByText('✦ AI 리뷰 요약'), '별점 4.6 · 리뷰 5개', '쿠폰 보기' */ });
it('미확정이면 준비 중', async () => { /* checkpoint 'APPROVED' → findByText('가이드가 코스를 준비 중이에요') */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/features/courses src/pages/student/CourseMapPage.test.tsx` / Expected: FAIL
- [ ] **Step 3: 구현** — 테스트 환경엔 키가 없으므로 도식 지도가 기본 경로다.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `hs-s08` ✅(목업 · 도식 지도), 팀 요청 "카카오 JavaScript 키" 상태, devlog, 결정 0004 반영.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 카카오맵+도식 지도 폴백과 코스 지도 화면(상점 시트)"`

---

### Task 17: 고교생 — 쿠폰 목록 · 상세 (hs-s09)

**Files:**
- Create: `src/pages/student/CouponListPage.tsx`, `src/pages/student/CouponDetailPage.tsx`
- Modify: `src/app/routes.tsx`, `src/demo/demoStore.ts`
- Test: `src/pages/student/CouponPages.test.tsx`

**Interfaces:**
- Consumes: Task 16 `useMyCoupons`, `useMyCoupon`; Task 5 `couponStateLabel`; Task 9 `useDemoStore`
- Produces:
  - `demoStore.ts`에 추가: `lastCoupon: { code: string; storeId: number } | null` · `setLastCoupon(c: { code: string; storeId: number }): void`
  - CouponListPage: TopBar `내 쿠폰`(back), 항목 `storeName` · `discount` · `StatusChip`(`couponStateLabel`), 누르면 `/coupons/{id}`, 빈 목록 `EmptyState title="발급된 쿠폰이 없어요." description="코스에 제휴 상점이 있으면 코스 확정 때 쿠폰이 발급돼요."`
  - CouponDetailPage(hs-s09): TopBar `내 쿠폰`(back), 칩 `탐방 당일에만 사용 가능`, 제목 `오늘의 로컬 혜택`, 카드 `{storeName}` / `탐방 코스에 포함된 제휴 상점이에요.`, 카드 `쿠폰 코드` / `사장님께 아래 번호를 보여주세요.` / 코드(`data-testid="coupon-code"`, 숫자 사이 공백: `482169` → `4 8 2 1 6 9`, 큰 글씨), 카드 `{discount}` / `쿠폰 1회 사용 / {formatMonthDay(tourStartsAt)} 당일 만료`, 상태 카드 `couponStateLabel(state, usedAt)` / (BEFORE_DAY|USABLE) `사장님이 코드를 입력하면 사용 완료로 바뀌어요.` · (USED) `리뷰를 남기면 가게 AI 요약에 반영돼요.` · (EXPIRED) `이 쿠폰은 더 이상 쓸 수 없어요.`, 각주 `탐방 취소 시 해당 쿠폰은 자동 만료됩니다.` 화면에 들어오면 `setLastCoupon({ code, storeId })`.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('쿠폰 목록 2장 → 상세 코드와 상태', async () => {
  const { user, router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
  await router.navigate(`/my-tours/${findApplicationId('student@demo.kr', 1)}/coupons`);
  const items = await screen.findAllByRole('link', { name: /할인/ }); expect(items).toHaveLength(2);
  await user.click(items[0]);
  expect(await screen.findByTestId('coupon-code')).toHaveTextContent(/^\d( \d){5}$/);
  expect(screen.getByText('사용 가능')).toBeInTheDocument();
  expect(useDemoStore.getState().lastCoupon?.code).toMatch(/^\d{6}$/);
});
it('사장님이 사용하면 5초 안에 사용 완료로 바뀐다', async () => { /* 상세 표시 → mutate(db => redeemCouponRule(db, owner1Id, code, new Date())) → findByText(/사용 완료 · \d\d:\d\d/, {}, { timeout: 7000 }); 테스트 타임아웃 10초 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/student/CouponPages.test.tsx` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 문구 · 동작 그대로.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/pages/student/CouponPages.test.tsx` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `hs-s09` ✅, devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 쿠폰 목록·상세(6자리 코드, 사용 상태 자동 갱신)"`

---

### Task 18: 가이드 — 내가 개설한 탐방 · 신청자 관리 (guide-a02, guide-s03)

**Files:**
- Create: `src/pages/guide/GuideToursPage.tsx`, `src/pages/guide/ApplicantsPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/pages/guide/ApplicantsPage.test.tsx`

**Interfaces:**
- Consumes: Task 14 `useGuideTours`, `useApplicantsBoard`, `useApprove`, `useReject`
- Produces:
  - 공통: 신청자 카드는 `<article>` 요소(테스트 · E2E가 카드 단위로 찾는다).
  - GuideToursPage(guide-a02): TopBar `내가 개설한 탐방`, 칩 `개설한 탐방 목록`, 진행 중(RECRUITING · CLOSED) 카드: 제목 · `{TOUR_STATUS_LABEL} · 신청 {total}명 · 승인 {approved}명 · {formatShortDate}` · 링크 `신청자 보기`(→ applicants) · `탐방 취소`(→ `/guide/tours/{id}/cancel` 자리), 지난 탐방(COMPLETED · CANCELED) 카드 `지난 탐방 기록` 목록, 기본 버튼 `새 탐방 개설하기`(→ `/guide/tours/new` 자리)
  - ApplicantsPage(guide-s03): TopBar `신청자 관리`(back `/guide/tours`), 칩 `{tour.title} · {TOUR_STATUS_LABEL}`, 요약 카드 `모집 정원 {capacity}명 중 {approved}명 승인` / `대기 {pending}명 · 승인 {approved}명 · 남은 자리 {remaining}명`, 신청자 카드 `{userName} · {grade ? '고'+grade : '학년 미입력'} · {APPLICATION_STATUS_LABEL}`(verified면 `Badge` `✓ 인증`) + `“{motivation}”` + PENDING이면 버튼 `승인` `거절`(진행 중 disabled), APPROVED면 `오픈채팅 링크가 공개된 상태예요.` 승인 성공 `toast('{이름} 님을 승인했어요.')`. 거절은 ConfirmDialog(`이 신청을 거절할까요?` / `거절하면 학생에게 거절로 표시돼요.` / 확인 `거절`). 코스 버튼: 코스 없음 → `AI 코스 만들기`(승인 0이면 disabled + hint 사유 `승인한 신청자가 있어야 코스를 만들 수 있어요.`, 누르면 → `course/draft?generate=1`) · DRAFT → `코스 이어서 편집`(→ `course/edit`) · CONFIRMED → `확정 코스 보기`(→ `course/confirmed`).

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('승인하면 요약 숫자가 바뀐다', async () => {
  const { user } = await renderApp('/guide/tours/1/applicants', { as: 'guide', checkpoint: 'APPLIED' });
  expect(await screen.findByText('대기 2명 · 승인 2명 · 남은 자리 3명')).toBeInTheDocument();
  const card = screen.getByText(/김민지/).closest('article')!;
  await user.click(within(card).getByRole('button', { name: '승인' }));
  expect(await screen.findByText('대기 1명 · 승인 3명 · 남은 자리 2명')).toBeInTheDocument();
});
it('승인 버튼 연타는 요청 1번 (Review Focus 6)', async () => {
  let count = 0; server.events.on('request:start', ({ request }) => { if (request.url.includes('/approve')) count++; });
  /* 같은 버튼 dblClick → waitFor 승인 반영 → expect(count).toBe(1) */
});
it('승인 0명이면 AI 코스 만들기 비활성 + 사유', async () => { /* 탐방 6(신청 없음) → disabled, '승인한 신청자가 있어야 코스를 만들 수 있어요.' */ });
it('가이드 목록에 탐방 1이 먼저 보인다', async () => { await renderApp('/guide/tours', { as: 'guide' });
  expect((await screen.findAllByText('경희대 국제캠퍼스 산업디자인학과 탐방'))[0]).toBeInTheDocument(); });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/guide` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 문구 · 동작 그대로. 승인 · 거절 버튼은 mutation `isPending` 동안 disabled.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/pages/guide` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `guide-a02` `guide-s03` ✅, devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 가이드 탐방 목록과 신청자 관리(승인·거절·코스 버튼 상태)"`

---

### Task 19: 가이드 — AI 코스 초안 · 편집 · 확정 (guide-s04, guide-s05, guide-s06)

**Files:**
- Create: `src/features/campuses/components/InsightCard.tsx`, `src/pages/guide/CourseDraftPage.tsx`, `src/pages/guide/CourseEditPage.tsx`, `src/pages/guide/CourseConfirmedPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/pages/guide/CoursePages.test.tsx`

**Interfaces:**
- Consumes: Task 16 course 훅들, Task 13 `useInsight`
- Produces:
  - `InsightCard({ universityId: number })` — 제목 `방학 상권 인사이트` + text + `출처 · {source}` + (`isPlaceholder`면 `Badge` `예시`)
  - CourseDraftPage(guide-s04): `?generate=1`이고 코스가 없으면 마운트 때 한 번 `useCreateDraft` 실행(StrictMode 이중 실행 방지 ref), 생성 중 `AiLoading steps=['신청자 관심사를 모으고 있어요','주변 상점을 찾고 있어요','코스를 짜고 있어요']`. CONFIRMED면 `course/confirmed`로 Navigate. **배치는 무대 화면 450px 제약(설계 5.7)에 맞춰 와이어프레임과 순서를 바꾼다** — 지점이 위쪽에 와야 한다: TopBar `탐방 코스 초안`(back applicants) → 칩 `✦ 신청자 관심사 + 상권 데이터` → 제목 `신청자들이 궁금해한 주제로\n캠퍼스와 대학가를 연결했어요.` → 한 줄 `입력된 관심사` + `KeywordChips(interests)` → 소제목 `{formatDuration(tour.startsAt, tour.endsAt)} 추천 코스` → 지점 카드(높이 72px 안팎) `{visitTime} {name}`(제휴면 `Badge` `제휴`) / `AiBadge` + 이유 한 줄(말줄임) → 카드 `추천 상점 기준` / `course.criteria` → `InsightCard` → 기본 버튼 `코스 수정하기`(→ edit) → 보조 버튼 `다시 만들기` → ConfirmDialog(`초안을 다시 만들까요?` / `지금 초안과 편집 내용이 새 초안으로 바뀌어요.` / 확인 `다시 만들기`)
  - CourseEditPage(guide-s05): CONFIRMED면 confirmed로 Navigate. TopBar `탐방 코스 편집`, 캡션 `순서를 바꾸고 장소를 교체할 수 있어요.`, 항목 `≡ {circled(order)} {name} · {visitTime}` / `description ?? recommendationReason` / 버튼 `위로`(`aria-label="{name} 위로 이동"`, 첫 항목 disabled) · `아래로`(`aria-label="{name} 아래로 이동"`) · `한줄평`(BottomSheet + Textarea `한줄평` + `저장`) · `삭제`(ConfirmDialog `이 지점을 뺄까요?` / `시간은 남은 지점 순서대로 다시 맞춰져요.` / 확인 `빼기`), 기본 버튼 `최종 코스 확정` → ConfirmDialog(`코스를 확정할까요?` / `확정하면 더 이상 수정할 수 없고, 승인된 신청자에게 지도와 쿠폰이 공개돼요.` / 확인 `확정하기`) → confirmed로 이동, 각주 `확정 후에는 참가자에게 지도와 쿠폰이 공개돼요.` (지점 추가 · 상점 교체는 2단계)
  - CourseConfirmedPage(guide-s06): TopBar `코스를 확정했어요!`, 칩 `✓ 참가자에게 코스 공개 완료`, 소제목 `탐방 정보` + 카드 `{universityShortName} {campusName}` / `{formatMonthDay} {formatTimeRange}` / `{지점 분류를 ' → '로} / 총 {n}개 장소`(분류: CAMPUS `캠퍼스`, 식사 업종 `식사`, 카페 `카페`, 그 밖 category) / `참가 승인 {approved}명 · 쿠폰 {issuedCouponCount}장 발급`, 카드 `확정된 코스는 신청자에게 공개돼요.` / (issued > 0) `승인된 신청자에게 제휴 상점 쿠폰이 발급돼요.` · (0) `코스에 제휴 상점이 없어 발급된 쿠폰이 없어요. 제휴 상점으로 바꾸면 발급돼요.`, 카드 `코스 확정 후에 신청을 승인하면` / `새 승인자에게도 쿠폰을 발급해요.`, 기본 버튼 `신청자 관리로 이동`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('AI 코스 만들기 → 초안(제휴 포함) → 순서 변경 → 확정 → 쿠폰 발급', async () => {
  const { user } = await renderApp('/guide/tours/1/applicants', { as: 'guide', checkpoint: 'APPROVED' });
  await user.click(await screen.findByRole('button', { name: 'AI 코스 만들기' }));
  expect(await screen.findByText('2시간 30분 추천 코스')).toBeInTheDocument();
  expect(screen.getAllByText('제휴').length).toBeGreaterThan(0);
  expect(screen.queryByText('지역 데이터 점수 · 제휴 여부 · 리뷰 요약')).toBeNull();   // 옛 기준 문구 금지
  await user.click(screen.getByRole('button', { name: '코스 수정하기' }));
  const third = (await screen.findAllByRole('button', { name: /아래로 이동/ }))[1];   // ② → ③
  await user.click(third);
  await user.click(screen.getByRole('button', { name: '최종 코스 확정' }));
  await user.click(await screen.findByRole('button', { name: '확정하기' }));
  expect(await screen.findByText('코스를 확정했어요!')).toBeInTheDocument();
  expect(screen.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeInTheDocument();
});
it('순서를 바꿔도 시간은 14:00/15:10/16:00', async () => { /* edit 화면의 시각 텍스트 순서 확인 */ });
it('인사이트 카드의 예시 표시', async () => { /* draft 화면 → '방학 상권 인사이트', '예시' */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/guide` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 문구 · 배치 그대로.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/pages/guide` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `guide-s04` `guide-s05`(순서 · 한줄평 · 삭제) `guide-s06` ✅, 팀 요청 "옛 기준 문구 교체 공유(디자인 · 기획)" 표시, devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: AI 코스 초안·편집(순서·한줄평·삭제)·확정과 쿠폰 발급 결과"`

---

### Task 20: 사장님 — 쿠폰 사용 처리 (owner-s03, owner-a03)

**Files:**
- Create: `src/pages/owner/CouponRedeemPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/pages/owner/CouponRedeemPage.test.tsx`

**Interfaces:**
- Consumes: Task 16 `useCouponLookup`, `useRedeemCoupon`; Task 17 `useDemoStore`
- Produces: CouponRedeemPage — TopBar `쿠폰 사용 처리`, 칩 `6자리 번호 입력`, `CodeInput`(초깃값 `?code=`), 시연 도구가 켜져 있고 `lastCoupon`이 있으면 ghost 버튼 `최근 쿠폰 채우기`. 6자리가 되면 조회 → 결과 카드 `쿠폰 확인 결과` / `탐방일 {formatTourDate}` · `혜택 {discount}` · `학생 {studentName}` · `내 가게 쿠폰`. 기본 버튼 `사용 처리`(조회 state가 USABLE일 때만 enabled, 진행 중 disabled) → 성공 카드 `사용 완료` / `사용 시각 {HH:mm} 기록 · 중복 사용 불가` / `이번 탐방으로 온 학생 {tourVisitorCount}명`. 오류 카드(조회 · 사용 공통, 코드 기준): COUPON_ALREADY_USED 또는 조회 state USED → `이미 사용된 쿠폰` / `재사용 불가 · 사용 시각 {HH:mm}` · COUPON_EXPIRED · COUPON_OTHER_STORE 또는 state EXPIRED → `만료되었거나 다른 가게 쿠폰` / `코드를 다시 확인해 주세요.` · COUPON_NOT_FOUND → `존재하지 않는 6자리 코드` / `입력값을 다시 확인해 주세요.` · COUPON_NOT_YET 또는 state BEFORE_DAY → `아직 사용할 수 없는 쿠폰` / `탐방 당일에만 사용할 수 있어요.` 보조 버튼 `다른 코드 입력`(초기화).

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
async function couponCodeOf(storeId: number) { return getDb().coupons.find((c) => c.storeId === storeId)!.code; }
it('조회 → 사용 처리 → 방문 1명', async () => {
  const { user } = await renderApp('/owner/coupons/redeem', { as: 'owner', checkpoint: 'CONFIRMED' });
  await user.type(screen.getByLabelText('6자리 쿠폰 코드'), await couponCodeOf(1));
  expect(await screen.findByText('쿠폰 확인 결과')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '사용 처리' }));
  expect(await screen.findByText('이번 탐방으로 온 학생 1명')).toBeInTheDocument();
});
it('다른 가게 쿠폰', async () => { /* owner1으로 상점2 쿠폰 → findByText('만료되었거나 다른 가게 쿠폰') */ });
it('없는 코드', async () => { /* '000000' → findByText('존재하지 않는 6자리 코드') */ });
it('이미 사용된 쿠폰은 사용 시각', async () => { /* 먼저 redeem 후 다시 조회 → '이미 사용된 쿠폰', /재사용 불가 · 사용 시각 \d\d:\d\d/ */ });
it('?code=로 미리 채운다', async () => { /* renderApp('/owner/coupons/redeem?code=123456') → 입력값 '123456' */ });
it('사용 처리 연타는 요청 1번 (Review Focus 6)', async () => { /* request:start 카운트 = 1 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/pages/owner` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 문구 · 동작 그대로. 시연 도구 여부는 `isDemoToolsOn()`.
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/pages/owner` / Expected: PASS
- [ ] **Step 5: 진척 문서 갱신** — `owner-s03` ✅, `owner-a03` 쿠폰 오류 3종 ✅(리포트 빈 상태는 P2), devlog.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "feat: 사장님 쿠폰 사용 처리와 오류 상태"`

---

### Task 21: 시연 도구 — 패널 · 역할 전환 · 원클릭 링크 · 발표 모드 · 초기화

**Files:**
- Create: `src/demo/demoParams.ts`, `src/demo/quickLogin.ts`, `src/demo/resetDemo.ts`, `src/demo/DemoPanel.tsx`, `src/demo/RoleBadge.tsx`
- Modify: `src/demo/demoStore.ts`, `src/app/layouts/MobileFrame.tsx`(aside 슬롯), `src/shared/ui/TopBar.tsx`(발표 모드 RoleBadge), `src/features/auth/session.ts`(시연 자동 재로그인), `src/main.tsx`(시연 파라미터 적용), `src/mocks/latency.ts` 연결(`setAiSpeedSource`), `src/pages/student/CourseMapPage.tsx`(`forceSchematic = mapMode === 'schematic'` 연결)
- Test: `src/demo/demoParams.test.ts`, `src/demo/demo.test.tsx`

**Interfaces:**
- Consumes: Task 6 `DEMO_EMAILS`, `DEMO_STORE_OWNERS`; Task 11 `login`, `getLandingPath`; Task 9 `/api/health`, `/api/demo/reset`
- Produces:
  - `demoStore.ts`(확장): `{ enabled: boolean; apiModeOverride: ApiMode | null; presentMode: boolean; aiSpeed: 'normal'|'slow'; mapMode: 'auto'|'schematic'; lastCoupon: {code: string; storeId: number} | null; resetKey: string | null; activeDemoEmail: string | null }` + setter들 · `readDemoOverride()` · `isDemoToolsOn(): boolean`(`env.demoTools || enabled`)
  - `demoParams.ts`: `interface DemoParams { demo: boolean; mode: ApiMode | null; reset: boolean; as: DemoRole | null; present: boolean | null; key: string | null; checkpoint: SeedCheckpoint | null }` · `parseDemoParams(search: string): DemoParams` · `applyDemoParamsBeforeRender(p: DemoParams): void`(demo → enabled, mode → override, present, key → resetKey)
  - `quickLogin.ts`: `quickLogin(target: DemoRole | { email: string }, deps: { queryClient: QueryClient; navigate(to: string): void; next?: string }): Promise<void>` — `queryClient.clear()` → 토큰 비움 → `login({email, password: env.demoPassword})` → 토큰 설정 · `activeDemoEmail` 저장 → `navigate(next ?? getLandingPath(me))` · `switchToCouponOwner(deps): Promise<void>` — `lastCoupon`의 storeId → `DEMO_STORE_OWNERS` → quickLogin 후 `/owner/coupons/redeem?code={code}`
  - `resetDemo.ts`: `resetDemoData(opts: { checkpoint?: SeedCheckpoint }): Promise<void>` — `POST /api/demo/reset`(헤더 `X-Demo-Key: resetKey` 있으면) → `queryClient.clear()`
  - `DemoPanel` — 프레임 옆(폭 ≥ 900px) 또는 프레임 오른쪽 위 떠 있는 버튼(좁을 때). 내용: 역할 버튼 `고교생` `가이드` `사장님` `운영자` · `쿠폰 가게 사장님으로 전환`(lastCoupon 없으면 disabled + 사유 `학생 쿠폰 화면을 먼저 열어 주세요.`) · `최근 쿠폰 {code}` 표시 · `시연 데이터 초기화` + 체크포인트 선택(`처음` `신청 완료` `승인 완료` `코스 확정`) · API 모드 표시(`목업`/`실서버`) + 전환(전환 = override 저장 후 `location.reload()`) · 백엔드 상태(`/api/health` 15초 폴링: `정상`/`응답 없음`) · 지도 `자동`/`도식` · AI 속도 `보통`/`느리게` · 발표 모드 토글. 발표 모드에서는 역할 버튼 4개만 남은 작은 세로 막대.
  - `RoleBadge` — 발표 모드에서 TopBar 오른쪽에 `고교생 화면` · `가이드 화면` · `사장님 화면` · `운영자 화면`(역할별 색: tone info/success/warning/neutral).
  - `handleUnauthorized`(확장): `activeDemoEmail`이 있고 이번 세션에서 재시도 안 했으면 그 계정으로 한 번 재로그인 후 `queryClient.invalidateQueries()`; 아니면 토큰 비움.
  - `main.tsx`: 렌더 전 `const p = parseDemoParams(location.search); applyDemoParamsBeforeRender(p)`; 목업 워커 시작 뒤 `p.reset`이면 `resetDemoData({checkpoint: p.checkpoint ?? undefined})`; 렌더 뒤 `p.as`면 `quickLogin(p.as, …)`; 처리한 파라미터는 `history.replaceState`로 URL에서 지운다(`present`는 남김).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it('원클릭 링크 파싱', () => expect(parseDemoParams('?demo=1&mode=real&reset=1&as=guide&present=1&key=k&checkpoint=CONFIRMED')).toEqual(
  { demo: true, mode: 'real', reset: true, as: 'guide', present: true, key: 'k', checkpoint: 'CONFIRMED' }));
it('알 수 없는 값은 무시', () => expect(parseDemoParams('?as=boss&mode=x').as).toBeNull());
```
```tsx
it('역할 전환은 캐시를 비우고 새 역할 첫 화면으로 (Review Focus 4)', async () => {
  const { user, router, queryClient } = await renderApp('/my-tours', { as: 'student', checkpoint: 'APPLIED' });
  useDemoStore.setState({ enabled: true });
  await screen.findByText('신청 · 가이드 승인 대기');
  const keysBefore = queryClient.getQueryCache().getAll().length; expect(keysBefore).toBeGreaterThan(0);
  const clear = vi.spyOn(queryClient, 'clear');
  await user.click(screen.getByRole('button', { name: '가이드' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/guide/tours'));
  expect(clear).toHaveBeenCalled();
  expect(screen.queryByText('신청 · 가이드 승인 대기')).toBeNull();
});
it('쿠폰 가게 사장님으로 전환하면 코드가 채워진다', async () => { /* CONFIRMED, 학생 쿠폰 상세 열기 → '쿠폰 가게 사장님으로 전환' → 경로 /owner/coupons/redeem, 입력값 = 그 코드 */ });
it('시연 데이터 초기화(체크포인트)', async () => { /* '코스 확정' 선택 → 초기화 → 학생 쿠폰 2장 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:run -- src/demo` / Expected: FAIL
- [ ] **Step 3: 구현** — 위 Interfaces 그대로. `TopBar`는 `useDemoStore`의 `presentMode`일 때만 `RoleBadge`를 오른쪽 기본값으로 둔다(`right`를 넘기면 그쪽이 우선).
- [ ] **Step 4: 통과 확인** — Run: `npm run test:run -- src/demo && npm run test:run` / Expected: PASS
- [ ] **Step 5: 브라우저 확인** — `npm run dev` → `/?demo=1&reset=1&as=student&present=1` → 고교생 홈 + 오른쪽 위 `고교생 화면` 배지 + 세로 역할 막대.
- [ ] **Step 6: 진척 문서 갱신** — devlog, 결정 0007(목업 쪽) 반영.
- [ ] **Step 7: 커밋** — `git add -A && git commit -m "feat: 시연 도구(역할 전환·쿠폰 사장님 전환·원클릭 링크·발표 모드·초기화·헬스)"`

---

### Task 22: E2E 골든 패스 · 무대 해상도 점검 · README

**Files:**
- Create: `e2e/golden-path.spec.ts`, `e2e/stage-viewport.spec.ts`
- Modify: `README.md`, `docs/progress/README.md`

**Interfaces:**
- Consumes: 전 태스크

- [ ] **Step 1: 골든 패스 E2E 작성** — `e2e/golden-path.spec.ts`(목업 · 배포 빌드, AI 속도 보통)

```ts
import { EXAMPLE_QUERIES } from '../src/features/tours/examples';   // examples.ts는 import가 없는 파일이어야 한다
test('시연 골든 패스', async ({ page }) => {
  await page.goto('/?demo=1&reset=1&as=student');
  await page.getByRole('button', { name: EXAMPLE_QUERIES[0] }).click();                // 예시 칩
  await page.getByRole('button', { name: '나에게 맞는 탐방 추천받기' }).click();
  await expect(page.getByText('디자인 분야에 관심이 많군요!')).toBeVisible();
  await page.getByText('경희대학교 국제캠퍼스').first().click();
  await page.getByRole('button', { name: '탐방 신청하기' }).click();
  await page.getByRole('button', { name: '탐방 신청 완료하기' }).click();              // 시연 모드 미리 채움
  await expect(page.getByText('신청이 접수됐어요!')).toBeVisible();

  await page.getByRole('button', { name: '가이드', exact: true }).click();
  await page.getByRole('link', { name: '신청자 보기' }).first().click();
  await page.locator('article', { hasText: '김민지' }).getByRole('button', { name: '승인' }).click();
  await page.getByRole('button', { name: 'AI 코스 만들기' }).click();
  await expect(page.getByText('2시간 30분 추천 코스')).toBeVisible();
  await page.getByRole('button', { name: '코스 수정하기' }).click();
  await page.getByRole('button', { name: /아래로 이동/ }).nth(1).click();
  await page.getByRole('button', { name: '최종 코스 확정' }).click();
  await page.getByRole('button', { name: '확정하기' }).click();
  await expect(page.getByText(/쿠폰 [1-9]\d*장 발급/)).toBeVisible();

  await page.getByRole('button', { name: '고교생', exact: true }).click();
  await page.getByRole('link', { name: '내 탐방' }).click();
  await page.getByRole('link', { name: /코스 지도 보기/ }).click();
  await expect(page.getByText('오늘의 탐방 코스')).toBeVisible();
  await page.getByRole('button', { name: '제휴 상점 쿠폰 확인' }).click();
  await page.getByRole('link', { name: /할인/ }).first().click();
  await expect(page.getByTestId('coupon-code')).toHaveText(/^\d( \d){5}$/);

  await page.getByRole('button', { name: '쿠폰 가게 사장님으로 전환' }).click();
  await page.getByRole('button', { name: '사용 처리' }).click();
  await expect(page.getByText('이번 탐방으로 온 학생 1명')).toBeVisible();
});
```

- [ ] **Step 2: 무대 해상도 점검 작성** — `e2e/stage-viewport.spec.ts` (Review Focus 3): viewport 3종 `{1280,720}`, `{1366,768}`, `{1280,720, deviceScaleFactor: 1.5}`마다 ① `/?demo=1&reset=1&as=student` → 예시 칩 → 추천받기 → 첫 키워드 칩과 첫 카드의 추천 이유가 `toBeInViewport({ ratio: 1 })` ② `/?demo=1&reset=1&checkpoint=APPROVED&as=guide` → `신청자 보기` → `AI 코스 만들기` → 지점 카드 3개가 모두 `toBeInViewport({ ratio: 1 })` ③ `/?demo=1&reset=1&checkpoint=CONFIRMED&as=student` → `내 탐방` → `코스 지도 보기` → `제휴 상점 쿠폰 확인` → 첫 쿠폰 → `coupon-code`가 `toBeInViewport({ ratio: 1 })`. 각 화면 `page.screenshot({ path: 'test-results/stage-{w}x{h}-{n}.png' })`.
- [ ] **Step 3: 실행** — Run: `npm run e2e` / Expected: smoke · golden-path · stage-viewport 전부 PASS. 실패하면 화면 배치(설계 5.7 "무대 450px 제약")를 고친 뒤 다시 실행.
- [ ] **Step 4: README 완성** — 실행 · 테스트 · E2E 명령, 환경변수 표, 시연 계정(`student@demo.kr` 등 · 비밀번호 `demo1234`), 원클릭 시연 링크 예시(`/?demo=1&reset=1&as=student&present=1`, 체크포인트 `&checkpoint=CONFIRMED`), 문서 위치.
- [ ] **Step 5: 진척 문서 갱신** — 체크포인트 "11/8 MVP"의 목업 골든 패스 부분 `✅`(P1 최소판은 2단계), devlog, 열린 질문 정리.
- [ ] **Step 6: 커밋** — `git add -A && git commit -m "test: 시연 골든 패스·무대 해상도 E2E와 README 정리"`
- [ ] **Step 7: [사용자 확인 — 오케스트레이터가 직접]** 푸시 · 배포 갱신 허락을 묻고, 배포 URL에서 `npm run e2e`와 같은 시나리오를 한 번 손으로 확인한다(`?demo=1&reset=1&as=student`).

---

## 다음 계획 (이 계획 범위 밖)

- **MVP 2단계 (P1, 11/6~8)**: 회원가입(이름) · 보호자 동의 페이지 · `/verify`(단계 카드 · 업로드) · `/me` · 리뷰 작성 · 가이드 프로필 · 재학 인증 · 탐방 개설(방학 기간) · 탐방 완료 · 취소 · 주변 상점 선택(추가 · 교체) · 확정 코스 지도 보기 · 사업자 인증 · 가게 연결 · 내 가게(제휴) · 사장님 MY · 운영자 심사 목록 · 상세. Task 10 · 11의 실제 컴포넌트 API를 보고 작성한다.
- **3단계 (11/9~12)**: 백엔드 명세 수령 후 도메인별 실서버 교체(대본 순서) · `/api` 프록시 rewrite · 하이파이 토큰 · 컴포넌트 · 화면 패스 · P2(리포트 · 탐색) · 실서버 응답 픽스처 · 동결 절차.
