# MVP 2A — 하이파이 V2 디자인 시스템 + 골든 패스 화면 V2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MVP 1단계로 만든 앱(골든 패스 + 시연 도구)을 하이파이 V2(UNIRO) 디자인으로 바꾼다 — 토큰 · 글꼴 · 공통 컴포넌트 · 앱 셸을 V2로 갈고, 골든 패스 화면(고교생 탐색 · 신청 · 내 탐방 · 코스 · 쿠폰, 가이드 홈 · 신청자 · 코스 완성 · 확정, 사장님 내 가게 · 쿠폰 처리)을 V2 배치 · 문구로 다시 그린 뒤, 골든 패스 · 발표 모드 · 무대 해상도 E2E를 새 화면으로 다시 통과시킨다.

**Architecture:** 데이터 계층(`features/*/api · queries · model`, 목업)은 그대로 두고 표현 계층만 바꾼다. 색 · 반경 · 크기는 `src/styles/tokens.css`의 V2 변수(`--yy-*`)를 거쳐 Tailwind 테마로 연결한다(결정 0003 · 0010). 공통 컴포넌트는 기존 props를 유지한 채 모양을 V2로 바꾸고, V2에만 있는 부품(목록 행 · 구간 탭 · 단계 목록 · 일러스트 히어로 등)을 `src/shared/ui`에 더한다. 화면은 V2 노드를 기준으로 다시 그리되 기능 규칙(서버 값으로 상태 판단, 비활성 버튼 사유 + 다음 행동, 데이터 우선 렌더링)은 1단계 판정을 그대로 따른다.

**Tech Stack:** Vite 7 · React 19 · TypeScript 5.9 · React Router 7(core) · TanStack Query 5 · Zustand 5 · RHF + Zod 4 · Tailwind 4 · Radix Dialog · sonner · lucide-react · MSW 2 · Vitest 3 · Playwright. 새 의존성: `@fontsource/noto-sans-kr`(Task 1).

**Spec:** `docs/superpowers/specs/2026-11-03-frontend-design.md` + **하이파이 V2 스냅샷 `docs/reference/design-v2.md`**(화면 색인 · 노드 ID · 토큰 · 화면별 문구 · "V2가 바꾼 것") + 결정 0010. 1단계 판정 `docs/superpowers/plans/2026-11-04-mvp1-rulings.md`(G1~G6, C1~C29)은 이 계획에도 그대로 적용된다.

**V2 원본을 보는 법:** 화면 이미지는 `docs/reference/design-v2/<코드>.png`, 문구는 `design-v2.md` "화면별 문구"(그대로 쓴다). 간격 · 아이콘 · 이미지 같은 세부는 개발용 Figma Design 파일(fileKey `xNzkXH89Gc0bCbx8EYlBgk`)의 노드에서 `get_design_context`로 본다(figma-design-to-code 스킬을 먼저 불러온다). 받은 코드는 참고용이다 — 이 레포의 토큰 · 컴포넌트로 다시 쓴다.

## Global Constraints

(1단계 계획의 Global Constraints 전부 + 아래. 다르면 아래가 앞선다.)

- **V2 우선(결정 0010):** V2 화면이 있는 곳은 V2의 배치 · 문구 · 이동을 따른다. 이 계획에 적힌 판정이 V2와 다르면 계획이 앞선다(주로 무대 400px 예산 · 기능 규칙 때문).
- 색은 토큰으로만 쓴다(컴포넌트에 HEX 금지). V2 토큰 이름은 `--yy-*` 그대로, Tailwind 유틸리티 이름은 Task 1 표대로.
- 글꼴은 Noto Sans KR(400 · 500 · 700)을 npm으로 번들한다. 외부 CDN 금지. 로고 워드마크는 이미지(Task 1 에셋).
- 웹에서는 iOS 상태 표시줄(9:41 · 배터리)과 홈 인디케이터를 그리지 않는다. V2 좌표에서 위쪽 50px을 뺀 것이 화면 꼭대기다.
- 좌우 여백 20px, 기본 버튼 높이 56 · 반경 16, 하단 GNB 80, 상단 바 56, 최소 터치 44.
- 그림자는 쓰지 않는다(FLAT & AIRY). 카드는 바탕(`bg-base`) 위 흰 카드, 핵심 정보는 페일 블루 카드.
- 무대 400px 예산(1단계 C20): 판정 뷰포트 1366×620 · 1280×600 · 1280×590@1.5에서 골든 패스 핵심 정보(추천 키워드 칩 · 첫 추천 이유, 코스 초안 지점 3개, 쿠폰 코드)가 스크롤 없이 하단 탭바 위에 보인다. V2 배치가 이것을 어기면 V2보다 예산이 앞선다(판정 2A-R4).
- 데이터 · API 모양은 바꾸지 않는다(새 엔드포인트는 Task 11의 `GET /api/owner/store` 하나). 날짜 · 시간 판단은 서버 값.
- 모든 태스크: `npm run test:run && npm run typecheck && npm run lint && npm run build && npm run e2e`가 통과해야 커밋한다. 화면을 바꾼 태스크는 그 화면을 지나는 E2E 로케이터를 같은 태스크에서 고친다(E2E를 깨진 채 다음 태스크로 넘기지 않는다).
- 마지막 구현 단계 = 진척 문서 갱신(`docs/progress/README.md`의 해당 행 + `docs/progress/devlog.md` 오늘 날짜 한 줄). 커밋은 main에 직접, 푸시는 사용자 확인 후에만.

## 판정 (이 계획에서 정한 것 — 2A-R)

- **2A-R1 홈 입력(V2 V1):** 홈은 V2대로 문장 입력 하나다(학과 · 학교 · 날짜 조건 칸을 없앤다). 추천 요청은 `{ q }`만 보낸다. 시연 도구가 켜져 있으면 입력칸 초깃값은 `EXAMPLE_QUERIES[0]`(무대에서 한글을 치지 않게, 1단계 신청서 미리 채움과 같은 방식). 예시 칩은 없앤다.
- **2A-R2 추천 목록 필터 칩:** `전체` + 결과의 `keywords` 중 탐방 학과(`major`)에 들어 있는 것 최대 1개 + 결과 탐방의 학교 짧은 이름(`universityShortName`) 최대 2개. 칩은 결과를 클라이언트에서 거른다. `전체`가 기본.
- **2A-R3 추천 행 메타 줄:** 각 행의 셋째 줄은 `{MM.DD} · {추천 이유}`(브랜드 색, `✦` 아이콘, 한 줄 말줄임)다. V2 첫 행의 `나와 잘 맞아요` 자리에 실제 AI 이유를 넣는 것이다. 아래 `왜 추천했나요?` 상자는 첫 탐방의 이유 전문을 보인다. 이유: 무대 예산에서 첫 추천 이유가 스크롤 없이 보여야 한다(V2 상자는 640px 아래).
- **2A-R4 무대 예산 우선:** 화면 배치가 판정 뷰포트에서 핵심 정보를 탭바 아래로 밀면, 장식(일러스트 크기 · 히어로 높이 · 여백)부터 줄인다. 문구 · 블록 순서는 바꾸지 않는다.
- **2A-R5 코스 화면(V2 V2, 사용자 결정 11/6):** 첫 화면은 V2 H04(단계 막대 + 시간표 카드), 그 아래에 `지도로 보기` 펼침 영역으로 기존 지도(`MapView`: 카카오맵 · 도식 폴백)를 둔다. 시간표 카드를 누르면 상점 시트(V2 스타일)를 연다.
- **2A-R6 지점 소요 시간:** 카드의 `· N분`은 다음 지점 `visitTime`까지(마지막은 탐방 `endsAt`까지, `endsAt`이 없으면 생략). 단계 막대 라벨은 기존 `stopKindLabel`.
- **2A-R7 쿠폰 코드 표시(V2 V11):** `824 193`처럼 3자리씩. `formatCouponCode(code)`를 `features/coupons/model.ts`에 둔다.
- **2A-R8 가이드 하단 탭(V2 V8):** `내 탐방`(`/guide`, G01 홈) · `코스 편집`(`/guide/course`, 다가오는 탐방의 코스로 보냄) · `MY`(`/guide/me`). 승인 · 프로필이 끝난 가이드의 첫 화면은 `/guide`.
- **2A-R9 사장님 하단 탭(V2 V9):** `내 가게`(`/owner/store`) · `쿠폰`(`/owner/coupons/redeem`). MY 탭이 없으므로 로그아웃은 내 가게 화면 오른쪽 위 `로그아웃` 텍스트 버튼이다.
- **2A-R10 코스 완성 화면(V2 V3):** 가이드의 AI 초안 · 편집은 G03 한 화면(`/guide/tours/:tourId/course/edit`)이다. 지점 카드의 `≡` 버튼(접근 이름 `{지점 이름} 편집`)이 바텀시트를 열고, 시트에 `위로 이동` · `아래로 이동` · `한줄평` · `빼기`가 있다(교체는 2B). `이 코스로 확정하기` → G08 확정 전 점검(`/guide/tours/:tourId/course/confirm`) → `코스 확정하기` → 같은 화면의 완료 상태(`코스를 확정했어요` · `참가 승인 N명 · 쿠폰 N장 발급` · `내가 개설한 탐방으로`). `/course/draft`는 생성 중 로딩 후 `edit`로 바뀌고, `/course/confirmed`는 `confirm`으로 보낸다.
- **2A-R11 신청자 거절:** V2에는 `승인하기`만 있지만 거절(A-04)은 기능이다. 카드의 따옴표 아래 오른쪽에 작은 텍스트 버튼 `거절하기`를 둔다(제안 문구). 확인 창은 1단계 그대로.
- **2A-R12 신청 취소(V2 V10):** 확인 창 대신 H11 화면(`/my-tours/:applicationId/cancel`). 취소 불가(`cancellable=false`)면 H10의 `신청 취소하기`가 비활성 + 사유.
- **2A-R13 쿠폰 사용 완료(O07):** V2 카드 아래에 캡션 한 줄 `이번 탐방으로 온 학생 {n}명`(1단계 문구)을 더한다 — 시연의 상권 효과 장면을 남긴다.
- **2A-R14 지난 탐방(H09):** 내 탐방의 `지난 탐방` 탭(`/my-tours?tab=past`). 끝난 신청(탐방 COMPLETED · CANCELED, 신청 REJECTED · CANCELED)을 모은다. 리뷰 링크(`리뷰 남기기 ›`)는 2B의 리뷰 화면으로 이어지고, 2A에서는 쿠폰 목록으로 보낸다.
- **2A-R15 V2에 없는 상태:** 로딩은 `Skeleton`, 오류는 `ErrorState`(데이터가 없을 때만), 빈 상태는 V2 톤의 `EmptyState`(페일 블루 카드 + 문구 + 행동)로 그린다. 문구는 1단계 화면의 문구를 그대로 쓴다.

## Review Focus

1. **무대 400px** — 새 배치에서 추천 키워드 칩 · 첫 추천 이유, 코스 완성 화면 지점 3개, 쿠폰 코드가 판정 뷰포트 3종에서 탭바 위에 보인다 → Task 12 `stage-viewport.spec.ts`.
2. **글꼴 교체 뒤 글자 넘침** — Noto Sans KR은 Pretendard보다 넓다. 버튼 · 칩 · 카드 제목이 한 줄 · 말줄임 규칙을 지킨다 → 각 화면 태스크의 스크린샷 확인(Playwright 1회) + Task 12 무대 스크린샷.
3. **역할 전환 뒤 첫 화면** — 가이드 첫 화면이 `/guide`로 바뀌어도 시연 패널 역할 전환 · 원클릭 링크 · 발표 모드 막대가 그 화면에 도착한다 → Task 3 · 12 테스트.
4. **V2 구조로 바뀐 이동** — 신청 취소 화면 · 코스 완성 → 확정 점검 → 완료 · 코스 편집 탭 · 내 가게 로그아웃에 막다른 곳이 없다 → 각 태스크 테스트.
5. **데이터 우선 렌더링 유지** — 다시 그린 화면도 재조회 실패에 받은 데이터를 그대로 보인다 → `src/pages/student/refetchError.test.tsx`가 계속 통과(화면 문구가 바뀌면 표식만 고친다).

---

### Task 1: V2 토큰 · 글꼴 · 브랜드 · 일러스트 에셋

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/globals.css`(`@theme inline` 매핑), `src/main.tsx`(글꼴 import), `package.json` · `package-lock.json`(`@fontsource/noto-sans-kr` 추가, `pretendard` 제거), `docs/decisions/0003-token-based-styling.md`(결과에 V2 반영 한 줄)
- Create: `src/assets/brand/uniro-icon.png`(2x), `src/assets/brand/uniro-wordmark.svg`(또는 2x png), `src/assets/illustrations/{campus,dining,cafe,bookshop,green,experience,play,daily}.png`(긴 변 400px 이하, 각 250KB 이하), `src/shared/ui/Illustration.tsx`, `src/shared/ui/BrandMark.tsx`
- Test: `src/shared/ui/ui.test.tsx`(추가)

**Interfaces:**
- Produces:
  - CSS 변수 `--yy-color-brand-primary` `#4263EB` · `--yy-color-brand-strong` `#2944B6` · `--yy-color-brand-soft` `#EAF0FF` · `--yy-color-text-primary` `#1C2535` · `--yy-color-text-secondary` `#677389` · `--yy-color-text-inverse` `#FFFFFF` · `--yy-color-accent-local` `#FF9F72` · `--yy-color-accent-soft` `#FFF0E7` · `--yy-color-success` `#16A58B` · `--yy-color-success-soft` `#E1F7F0` · `--yy-color-background-base` `#F7F9FD` · `--yy-color-background-surface` `#FFFFFF` · `--yy-color-border-default` `#E2E8F2` · `--yy-color-neutral-100` `#EFF2F7` · `--yy-color-neutral-300` `#BBC3D0` · `--yy-color-danger` `#D95665` · `--yy-color-danger-soft` `#FFF0F1`(마지막 둘은 변수 없는 V2 색을 이름 지은 것).
  - 기존 의미 토큰을 V2 변수로 다시 묶는다(이름은 그대로 — 화면 코드가 안 깨지게): `--color-bg` → base, `--color-surface` → surface(흰 카드), `--color-border` → border, `--color-text` → text-primary, `--color-text-muted` → text-secondary, `--color-primary` → brand-primary, `--color-on-primary` → text-inverse, `--color-accent` → brand-primary, `--color-success` → success, `--color-warning` → accent-local, `--color-danger` → danger, `--color-backdrop` `#E9EDF5`(프레임 바깥).
  - 새 Tailwind 색 유틸리티(`@theme inline`): `brand`(primary) · `brand-strong` · `brand-soft` · `local`(accent-local) · `local-soft` · `success-soft` · `danger-soft` · `neutral-100` · `neutral-300`.
  - 반경 `--radius-sm 8px` · `--radius-md 12px` · `--radius-lg 16px` · `--radius-xl 20px` · `--radius-pill 999px`. 크기 `--topbar-h 56px` · `--tabbar-h 80px` · `--btn-h 56px` · `--field-h 56px` · `--gutter 20px`(그대로).
  - 글꼴 `--font-sans: 'Noto Sans KR', system-ui, sans-serif`. `main.tsx`가 `@fontsource/noto-sans-kr/400.css` · `500.css` · `700.css`를 import한다.
  - `Illustration({ kind, className, alt? }: { kind: 'campus' | 'dining' | 'cafe' | 'bookshop' | 'green' | 'experience' | 'play' | 'daily'; className?: string; alt?: string })` — `<img>`(alt 기본 `''`, 장식), `loading="lazy"` 금지(무대 첫 화면에 바로 떠야 한다), `decoding="async"`.
  - `BrandMark({ variant }: { variant: 'wordmark' | 'icon' })` — 탭 첫 화면 왼쪽 위 `UNIRO` 워드마크(높이 24, 접근 이름 `UNIRO`), 로그인 화면 아이콘.
- Consumes: 개발용 Figma Design 파일 — CMF 페이지(`1:2`)의 `ORIGINAL 3D LOCATION LIBRARY` 카드 8개 이미지, Logo 페이지(`1:3`)의 앱 아이콘 · 워드마크.

- [ ] **Step 1: 실패하는 테스트** — `ui.test.tsx`에 `Illustration`(kind별 `<img>`가 그려지고 alt 기본값이 빈 문자열) · `BrandMark`(`getByRole('img', { name: 'UNIRO' })`) 테스트를 더한다.
- [ ] **Step 2: 실패 확인** — `npm run test:run -- src/shared/ui` / FAIL(모듈 없음).
- [ ] **Step 3: 에셋 내보내기** — Figma MCP `download_assets`로 CMF 페이지 카드 이미지 8개(원본 raw 이미지)와 Logo 페이지 아이콘 · 워드마크를 받는다. `sips -Z 400`(macOS)으로 긴 변을 줄여 위 경로에 저장한다. 워드마크가 SVG로 나오지 않으면 2x PNG로 저장한다.
- [ ] **Step 4: 토큰 · 글꼴 · 컴포넌트 구현** — 위 표대로 `tokens.css` · `globals.css`를 고치고 `pretendard`를 지운다(`npm uninstall pretendard`, `npm install @fontsource/noto-sans-kr`). `Illustration` · `BrandMark`를 만든다.
- [ ] **Step 5: 통과 확인** — 전역 검증 명령(G1 + build + e2e). 화면은 색 · 글꼴만 바뀌므로 기존 E2E가 그대로 통과해야 한다. `npm run build`의 메인 청크가 800kB 경고 한도 안인지 본다(이미지는 별도 에셋).
- [ ] **Step 6: 눈으로 확인** — `npm run dev`에서 `/login`과 `/`를 열어 글꼴 · 색이 V2와 같은지 Playwright 스크린샷 1장으로 확인한다(커밋하지 않음).
- [ ] **Step 7: 진척 문서** — 대시보드 "디자인 시스템" 행(없으면 체크포인트 표 아래 메모)에 `V2 토큰 · 글꼴 · 에셋 ✅`, devlog 한 줄. 결정 0003 결과에 "11/6 V2 토큰 · Noto Sans KR로 교체(결정 0010)" 한 줄.
- [ ] **Step 8: 커밋** — `feat: V2 디자인 토큰·Noto Sans KR·UNIRO 브랜드·3D 일러스트 에셋`

---

### Task 2: 공통 컴포넌트 V2

**Files:**
- Modify: `src/shared/ui/{Button,buttonStyles,TopBar,BottomTabBar,StatusChip,Badge,AiBadge,InfoCard,EmptyState,ErrorState,TextField,Textarea,Select,fieldStyles,KeywordChips,BottomSheet,ConfirmDialog,CodeInput,Skeleton,Page}.tsx|ts`
- Create: `src/shared/ui/{ListRow,SegmentedTabs,StepList,NumberedList,HeroCard,FilterChips,PageHeading}.tsx`
- Test: `src/shared/ui/ui.test.tsx`

**Interfaces:**
- Consumes: Task 1 토큰 · `Illustration`.
- Produces(기존 props는 바꾸지 않는다 — 모양만 V2):
  - `Button` 변형: `primary`(brand 배경 · 흰 글자 17/Bold · 높이 56 · 반경 16), `secondary`(brand-soft 배경 · brand 글자), `ghost`(투명 · text-secondary 글자), **새** `danger`(danger 배경 · 흰 글자), **새** `soft`(카드 안 작은 버튼: brand-soft · 높이 36 · 반경 12 · 13/Bold · 오른쪽 `›`). `size='sm'`은 높이 44.
  - `TopBar`: 높이 56, 왼쪽 24px 셰브런(`뒤로 가기`), 제목 18/Bold(`h1`). 배경 base.
  - `BottomTabBar`: 높이 80, 흰 바탕 + 위 1px border, 탭마다 아이콘(22) 위 · 라벨(12) 아래 세로 배치, 활성 brand(라벨 Bold) · 비활성 text-secondary. `aria-current` 규칙은 그대로.
  - `StatusChip` tone → V2 칩: `success`(success-soft/success) · `info`(brand-soft/brand) · `warning`(local-soft/accent-local) · `neutral`(`#F2F4F8` 대신 neutral-100/text-secondary) · `danger`(danger-soft/danger). 높이 27, 12/Bold, 알약.
  - `InfoCard`: 흰 카드 · 반경 16 · 안쪽 여백 16 · 테두리 없음. `muted`면 neutral-100 바탕. **새** prop `tone?: 'default' | 'brand' | 'local'`(brand = brand-soft 바탕, local = accent-soft 바탕).
  - `TextField` · `Textarea` · `Select`: 흰 바탕 · border · 반경 12 · 높이 56(Textarea 최소 120), 라벨 13/Bold 위, 오류 danger.
  - `ListRow({ to, eyebrow, title, meta, metaTone?, right? }: { to?: string; eyebrow?: string; title: string; meta?: ReactNode; metaTone?: 'muted' | 'brand'; right?: ReactNode })` — V2 `Tour List Row`: 흰 카드 반경 18 · 높이 90 안팎 · eyebrow 12/Medium muted · 제목 17/Bold · meta 12 · 오른쪽 `›`. `to`가 있으면 행 전체가 `Link`.
  - `SegmentedTabs({ tabs, value, onChange, label }: { tabs: { value: string; label: string }[]; value: string; onChange(v: string): void; label: string })` — 흰 바탕 반경 16 높이 50 안에 선택 칸 brand 반경 13. `role="tablist"` · 탭마다 `role="tab"` · `aria-selected`.
  - `FilterChips({ chips, value, onChange, label })` — 같은 모양의 알약 칩 줄(선택 = brand · 흰 글자, 첫 번째가 아닌 키워드 칩 = brand-soft, 학교 칩 = neutral-100). `role="radiogroup"`.
  - `StepList({ steps, current? }: { steps: string[]; current?: number })` — `01 신청 접수` 꼴 번호 목록(현재 단계 brand, 나머지 muted). H08 · H14 · G09에 쓴다.
  - `NumberedList({ items }: { items: string[] })` — 원 숫자(28px brand-soft, 마지막 항목은 local 색) + 15/Medium. H03 `이런 경험을 해요`.
  - `HeroCard({ eyebrow?, title, illustration, tone?, children? })` — 페일 블루(또는 local) 카드 반경 20, 왼쪽 글 · 오른쪽 `Illustration`. H01 · H02 · H03 · H05 · O01에 쓴다. 높이는 내용으로 정하고 일러스트는 `max-h`로 묶는다(2A-R4).
  - `PageHeading({ title, description? }: { title: string; description?: string })` — 화면 제목 26/Bold(`h1`, `\n` 줄바꿈 허용) + 설명 13/Regular muted. TopBar가 없는 탭 첫 화면(H01 · H06 · H16 · G01 · O01)에 쓴다.
- 규칙: `KeywordChips`는 V2 칩 모양으로. `AiBadge`는 brand-soft 바탕 + `✦`. `BottomSheet` · `ConfirmDialog`는 흰 바탕 반경 20(위쪽) · 버튼 V2.

- [ ] **Step 1: 실패하는 테스트** — 새 컴포넌트 7개의 역할 · 접근 이름 테스트(`ListRow`가 `to`면 링크 하나, `SegmentedTabs` `aria-selected`, `FilterChips` 선택 변경 콜백, `StepList` 현재 단계 `aria-current="step"`, `NumberedList` 항목 수, `HeroCard` 제목 · 이미지, `PageHeading` h1). `Button variant="danger"` · `"soft"` 렌더 테스트.
- [ ] **Step 2: 실패 확인** — `npm run test:run -- src/shared/ui` / FAIL.
- [ ] **Step 3: 구현** — 위 Produces 그대로. 세부 간격은 Design 파일 노드(H01 `2:146` · H02 `2:165` · H06 `2:317` · H03 `2:198`)의 `get_design_context`에서 가져온다.
- [ ] **Step 4: 통과 확인** — 전역 검증 명령. 기존 화면 테스트는 문구 · 역할을 바꾸지 않았으므로 그대로 통과해야 한다. E2E의 발표 모드 배지 · TopBar 단언(`e2e/golden-path.spec.ts`)이 높이 변화로 깨지면 같은 태스크에서 고친다.
- [ ] **Step 5: 진척 문서** — devlog 한 줄.
- [ ] **Step 6: 커밋** — `feat: 공통 컴포넌트 V2(버튼·상단 바·탭바·칩·카드·입력)와 V2 전용 부품`

---

### Task 3: 앱 셸 · 역할별 탭 · 첫 화면 규칙 · 로그인 V2

**Files:**
- Modify: `src/app/tabs.ts`, `src/features/auth/landing.ts`(+ test), `src/app/routes.tsx`(+ `routes.test` 류), `src/app/layouts/{MobileFrame,AppShell,RoleTabLayout}.tsx`, `src/pages/auth/LoginPage.tsx`(+ test), `src/demo/demo.test.tsx`(가이드 도착지), `src/app/shell.test.tsx`
- Create: `src/pages/guide/GuideHomePage.tsx`(자리 — Task 9가 채움), `src/pages/guide/GuideCourseRedirect.tsx`
- Test: `src/features/auth/landing.test.ts`, `src/app/shell.test.tsx`, `src/pages/auth/LoginPage.test.tsx`

**Interfaces:**
- Produces:
  - `TabItem` 확장(`src/shared/ui/BottomTabBar.tsx` · `tabActive.ts`): `match?: (string | RegExp)[]`(RegExp는 경로 전체에 `test`), **새** `exclude?: RegExp[]`(맞으면 비활성). 기존 문자열 접두 규칙은 그대로.
  - `TABS.UNIVERSITY = [{ to: '/guide', label: '내 탐방', icon: List, end: true, match: ['/guide/tours'], exclude: [/^\/guide\/tours\/\d+\/course(\/|$)/] }, { to: '/guide/course', label: '코스 편집', icon: Route, match: ['/guide/course', /^\/guide\/tours\/\d+\/course(\/|$)/] }, { to: '/guide/me', label: 'MY', icon: CircleUser, match: ['/guide/me', '/guide/verify'] }]` — V2 G07 · G08처럼 코스 화면에서는 `코스 편집`이 활성이다.
  - `TABS.OWNER = [{ to: '/owner/store', label: '내 가게', icon: Store, match: ['/owner/store'] }, { to: '/owner/coupons/redeem', label: '쿠폰', icon: TicketCheck, match: ['/owner/coupons'] }]`.
  - 고교생 탭은 라벨 그대로(`탐색` · `내 탐방` · `MY`), 아이콘만 V2 느낌(검색 · 목록 · 원).
  - `getLandingPath`: 대학생 승인 + 학과 있음 → `/guide`(나머지 규칙 그대로).
  - 라우트: `/guide` → `GuideHomePage`, `/guide/course` → `GuideCourseRedirect`, `/my-tours/:applicationId/cancel` → 자리(Task 6), `/guide/tours/:tourId/course/confirm` → 자리(Task 10). 라우트 등록 테스트(1단계 37개 + 새 라우트)를 고친다.
  - `pickFocusTour(tours: GuideTourSummary[]): GuideTourSummary | null`(`src/features/applications/model.ts`) — RECRUITING · CLOSED 중 `startsAt`이 가장 이른 탐방.
  - `guideCoursePath(tour: GuideTourSummary): string`(같은 파일) — 코스 CONFIRMED → `/guide/tours/{id}/course/confirm`, DRAFT → `/guide/tours/{id}/course/edit`, 코스 없음 + 승인 ≥ 1 → `/guide/tours/{id}/course/draft?generate=1`, 승인 0 → `/guide/tours/{id}/applicants`.
  - `GuideCourseRedirect` — `useGuideTours()` + `pickFocusTour`로 고른 탐방의 `guideCoursePath`로 `replace` 이동, 다가오는 탐방이 없으면 `/guide/tours`. 로딩 중 Skeleton.
  - `MobileFrame`: 프레임 안 바탕 `bg-bg`(base), 프레임 바깥 `--color-backdrop`.
  - `LoginPage`(hs-s01, V2에 없음 → 2단계 원칙 2): 위에 `BrandMark icon` + `유니로 UNIRO` 워드마크 + 슬로건 `“ 대학으로, 동네로, 유니로. ”`(Logo 페이지 문구), 그 아래 기존 문구 · 폼(TextField · Button V2). 기존 테스트의 문구 · 역할 단언은 유지한다.
- Consumes: Task 2 컴포넌트, `useGuideTours`(`src/features/applications/queries.ts`).

- [ ] **Step 1: 실패하는 테스트** — `landing.test.ts`: 승인 + 학과 있는 가이드 → `/guide`. `tabActive` 테스트: `/guide`에서 `내 탐방`, `/guide/tours/1/applicants`에서 `내 탐방`, `/guide/tours/1/course/edit` · `/guide/course`에서 `코스 편집`만 활성. `shell.test.tsx`: 가이드 탭 3개 `내 탐방` · `코스 편집` · `MY`, 사장님 탭 `내 가게` · `쿠폰` 두 개. `pickFocusTour` · `guideCoursePath` 단위 테스트. `GuideCourseRedirect`: 체크포인트 APPROVED(탐방 1 승인 2명 · 코스 없음) → `/guide/tours/1/course/draft?generate=1`, CONFIRMED → `/guide/tours/1/course/confirm`. `demo.test.tsx`: 패널 `가이드` → `/guide`.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 위 Produces. `GuideHomePage` 자리 화면은 `PlaceholderPage` 모양에 링크 `내가 개설한 탐방`(→ `/guide/tours`) 하나를 둔다(Task 9가 G01로 바꾼다).
- [ ] **Step 4: E2E 로케이터** — 가이드 역할 전환 뒤 도착지가 `/guide`가 되므로, 골든 패스 E2E의 가이드 단계는 자리 화면의 `내가 개설한 탐방` 링크를 눌러 `/guide/tours`로 간 뒤 1단계 흐름을 그대로 탄다(Task 9에서 다시 고친다).
- [ ] **Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 진척 문서** — 대시보드 화면 표에 `/guide`(G01) · `/guide/course` 행 추가(🟨), devlog.
- [ ] **Step 7: 커밋** — `feat: V2 역할별 하단 탭·가이드 첫 화면 /guide·코스 편집 탭 이동·로그인 V2`

---

### Task 4: 고교생 탐색 V2 — 홈 · 추천 목록 · 예외 (H01 · H02 · H13)

**Files:**
- Modify: `src/pages/student/HomePage.tsx`(+test), `src/pages/student/RecommendationsPage.tsx`(+test), `src/features/tours/recommendationParams.ts`(조건 키는 남기되 홈은 `q`만), `src/features/tours/components/TourCard.tsx`(→ `ListRow` 기반으로 바꾸거나 제거), `e2e/golden-path.spec.ts`, `e2e/stage-viewport.spec.ts`
- Create: `src/features/tours/filterChips.ts`(+test)

**Interfaces:**
- Consumes: `useTours({ status: 'RECRUITING' })`, `useRecommendations`, `useLastQuery` · `recommendationsPath`, `EXAMPLE_QUERIES`, `useDemoToolsOn`, Task 2 `HeroCard` · `ListRow` · `FilterChips` · `PageHeading` · `AiBadge`.
- Produces:
  - `buildFilterChips(result: RecommendationResult): { value: string; label: string; kind: 'all' | 'keyword' | 'school' }[]` · `filterItems(items, chipValue): Recommendation[]` — 2A-R2.
  - H01(노드 `2:146`): `BrandMark` · `PageHeading`(`내가 궁금한 대학 생활,\n직접 만나보세요.` / `전공 이야기부터 동네 맛집까지 함께 걸어요.`) · `HeroCard`(제목 `어떤 전공이\n궁금한가요?`, 일러스트 campus, 안에 입력칸) · 입력칸(라벨 `하고 싶은 것` — 시각적으로 숨긴 라벨, placeholder `예: 제품을 만들고 디자인해보고 싶어요`, 5자 미만이면 1단계 오류 문구) · 버튼 `나에게 맞는 탐방 추천받기` · 소제목 `이번 방학, 이런 탐방은 어때요?` · 모집 중 탐방 최대 3개 `ListRow`(eyebrow 학교 정식 이름, 제목 탐방 제목, meta `{MM.DD (요일)} · {n}자리 남음`, → `/tours/{id}`). 2A-R1.
  - H02(노드 `2:165`): TopBar 없이 뒤로 셰브런(→ `/?{search}`) · 제목 `{n}개의 탐방을\n추천해요.`(n = 결과 수) · 설명 = `result.headline` · 오른쪽 작은 일러스트 campus · `FilterChips` · 결과 카드(흰 카드 안 행들, 구분선) · 행 meta 2A-R3 · `왜 추천했나요?` 상자(brand-soft, `AiBadge` + 첫 탐방 이유). fallback이면 제목 위 `StatusChip warning`에 `조건에 맞는 추천이 없어요`(1단계 판정 유지). 결과 0건이면 H13 `추천 0건` 카드(`아직 맞는 탐방이 없어요` / `관심 문장을 바꿔 다시 검색해 보세요.` / `다시 추천받기 ›` → `/?{search}`).
  - 1단계 판정(Task 13 · C9 · C10)의 로딩(`AiLoading`) · 재시도 · `lastQuery` 저장은 그대로.

- [ ] **Step 1: 실패하는 테스트** — `filterChips.test.ts`(경희대 2개 + 강남대 1개 결과 → `전체` · `디자인` · `경희대` · `강남대`; 학교 칩으로 거르면 그 학교만). `HomePage.test.tsx`: 입력 → `나에게 맞는 탐방 추천받기` → `/recommendations?q=…`(조건 키 없음), 모집 중 탐방 행이 링크, 시연 도구 켜짐이면 입력칸에 `EXAMPLE_QUERIES[0]`. `RecommendationsPage.test.tsx`: 제목 `/개의 탐방을/`, 첫 행 meta에 첫 추천 이유, `왜 추천했나요?`, 칩 `경희대` 선택 시 다른 학교 행 없음, 0건 카드.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 골든 패스: 예시 칩 클릭 대신 입력칸 `fill(EXAMPLE_QUERIES[0])`(발표 모드 변형은 시연 도구 미리 채움을 그대로 쓴다), 추천 결과 확인 단언을 `디자인 분야에 관심이 많군요!`(이제 설명 줄) 그대로 두고, 첫 행 클릭으로 상세로. 무대 점검 ①: 대상은 `FilterChips`의 첫 키워드 칩과 첫 행의 이유 줄.
- [ ] **Step 5: 통과 확인** — 전역 검증 명령(무대 ① 3개 뷰포트 통과).
- [ ] **Step 6: 진척 문서** — 화면 표 hs-s03 · hs-s04 · hs-a06 행 비고에 `V2(H01 · H02 · H13)`, devlog.
- [ ] **Step 7: 커밋** — `feat: 고교생 홈·추천 목록 V2(문장 입력·필터 칩·추천 이유)`

---

### Task 5: 탐방 상세 · 신청서 · 신청 완료 V2 (H03 · H07 · H08 · H13 일부)

**Files:**
- Modify: `src/pages/student/{TourDetailPage,ApplyPage,ApplyDonePage}.tsx`(+tests), `src/features/tours/model.ts`(`tourHighlights` 추가), `e2e/golden-path.spec.ts`
- Test: `src/features/tours/model.test.ts`

**Interfaces:**
- Produces:
  - `tourHighlights(introduction: string): string[]` — 소개를 줄바꿈 · `·` · 마침표로 나눠 빈 것 빼고 최대 3개. 한 덩어리뿐이면 그 한 개.
  - H03(노드 `2:198`): TopBar `탐방 상세`(뒤로) · `HeroCard`(eyebrow 학교 정식 이름, 제목 `전공자와 함께\n캠퍼스를 걸어요`, 일러스트 campus) · 제목(탐방 제목 24/Bold) · `{MM.DD (요일)} {HH:mm}~{HH:mm} · {정원}명 정원` · 가이드 카드(아바타 원 · `{이름} 가이드` · 인증이면 success 색 `재학 인증 완료 · {학과}`) · 소제목 `이런 경험을 해요` + `NumberedList(tourHighlights(introduction))` · 캡션 `학교가 운영하는 공식 프로그램은 아니에요.` · 기본 버튼 `이 탐방 신청하기`(1단계 `applyButtonState`의 enabled/hint 그대로; label이 `탐방 신청하기`면 `이 탐방 신청하기`로 바꿔 그림 — 판정: 상태별 다른 라벨(`신청됨` · `정원 마감` …)은 그대로). 비활성 사유 + 다음 행동은 H13 카드 문구로: 정원 마감 `이번 탐방은 자리가 없어요` / `다른 탐방 보기 ›`, 이미 신청 `이미 신청한 탐방이에요` / `내 탐방 확인 ›`(사유 · 행동 링크 대상은 1단계 `applyButtonState` 그대로).
  - H07(노드 `2:349`): TopBar `탐방 신청서 · 하고 싶은 것` · 제목 `탐방을 신청할까요?` / `가이드에게 전할 관심사를 적어 주세요.` · 카드(칩 `신청할 탐방`, 제목, `{학교} · {MM.DD (요일)}`) · Textarea 라벨 `탐방에서 하고 싶은 것`, placeholder `예: 전공 수업을 듣고, 학생 식당도 가보고 싶어요.` · 안내 상자 `작성한 내용은 승인 후 AI 코스 초안의 추천 기준으로만 활용돼요.` · 하단 고정 버튼 `신청 완료하기`. 검증 · 미리 채움 · 연타 방지 · 실패 처리는 1단계 그대로.
  - H08(노드 `2:370`): TopBar `신청 완료 · 승인 대기`(뒤로 없음) · `신청이 접수됐어요!` / `가이드가 신청 내용을 확인하고 있어요.` · 페일 블루 카드(✓ · `승인 대기 중` · `확정되면 내 탐방에서 바로 확인할 수 있어요.`) · 카드(칩 `신청 완료`, 제목, `{MM.DD (요일)} · {학교}`) · `StepList(['신청 접수', '가이드 승인 대기', '승인 후 오픈채팅·코스 확인'], current=1)` · 버튼 `내 탐방으로 가기`(→ `/my-tours`).

- [ ] **Step 1~2: 실패하는 테스트 · 실패 확인** — `tourHighlights`(줄 3개 → 3개, 한 문장 → 1개, 빈 줄 무시). 화면 테스트의 문구를 위 V2 문구로 바꾼다(신청 흐름 테스트 `이 탐방 신청하기` → 신청서 → `신청 완료하기` → `신청이 접수됐어요!`).
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 골든 패스의 `탐방 신청하기` → `이 탐방 신청하기`, `탐방 신청 완료하기` → `신청 완료하기`.
- [ ] **Step 5: 통과 확인 · Step 6: 진척 문서(hs-s05 · hs-a04 · hs-s06 비고 V2) · Step 7: 커밋** — `feat: 탐방 상세·신청서·신청 완료 V2`

---

### Task 6: 내 탐방 V2 — 예정 · 지난 탐방 · 신청 상세 · 신청 취소 (H06 · H09 · H10 · H11)

**Files:**
- Modify: `src/pages/student/{MyToursPage,MyTourDetailPage}.tsx`(+tests), `src/features/applications/model.ts`(`myTourDisplay` → V2 분류), `src/app/routes.tsx`(취소 화면)
- Create: `src/pages/student/CancelApplicationPage.tsx`(+test)

**Interfaces:**
- Produces:
  - `groupMyApplications(apps: MyApplication[]): { upcoming: MyApplication[]; pending: MyApplication[]; past: MyApplication[] }` — upcoming = APPROVED이고 탐방이 RECRUITING · CLOSED, pending = PENDING이고 탐방이 끝나지 않음, past = 나머지(탐방 COMPLETED · CANCELED 또는 신청 REJECTED · CANCELED). 각 묶음은 `tour.startsAt` 순(past는 최근 먼저).
  - H06(노드 `2:317`, `/my-tours`): `BrandMark` · `PageHeading('내 탐방', '신청한 탐방과 참여 현황을 확인해요.')` · `SegmentedTabs`(`예정된 탐방` · `지난 탐방`, 주소 `?tab=past`와 동기) · 예정 탭: 소제목 `다가오는 탐방` + 개수 칩 `{n}건` + 카드(칩 `참여 확정`(success), 오른쪽 `MM.DD (요일)`, 제목 20/Bold, 학교, `{HH:mm}–{HH:mm}  ·  {정원}명 정원`, 구분선, soft 버튼 `코스 확인하기` → `/my-tours/{id}/course`) · 소제목 `승인 대기` + 카드(칩 `승인 대기`(neutral), 제목, `신청 접수 완료  ·  가이드 승인 대기 중`, `›` → `/my-tours/{id}`) · 둘 다 없으면 빈 상태(1단계 문구 `아직 신청한 탐방이 없어요.` / `추천받으러 가기`).
  - H09(`?tab=past`, 노드 `2:397`): 제목 `지난 탐방` / `지금까지 다녀온 캠퍼스를 모아봤어요.`(PageHeading 문구가 탭 따라 바뀜) · 카드(칩: 탐방 COMPLETED이고 리뷰 쓸 쿠폰이 있으면 `참여 완료` + `리뷰 작성 가능`, 취소 · 거절은 `취소됨` · `신청 거절`(neutral)) · 링크 `리뷰 남기기 ›`(2A-R14: `/my-tours/{id}/coupons`) 또는 `탐방 기록 보기 ›`(→ `/my-tours/{id}`).
  - H10(노드 `2:426`, `/my-tours/:applicationId`): TopBar `신청 내역 상세` · `신청 내역` / `참여 일정을 확인하고 준비해 주세요.` · 카드(상태 칩, 제목, 시간, 학교) · 행 `가이드 승인 상태` + 상태 칩 · 링크 행 `가이드 오픈채팅 ›`(openChatUrl 있을 때, 새 창, `rel="noopener noreferrer"`) + `승인된 참가자만 입장할 수 있어요.` · 링크 행 `코스 보기 ›`(APPROVED + CONFIRMED만, 1단계 판정 22) + `캠퍼스 · 전공 Q&A · 로컬 상점` · 캡션 `신청을 취소하면 참여 권한과 발급 쿠폰이 무효화돼요.` · 버튼 `신청 취소하기`(PENDING · APPROVED만; `cancellable`이 아니면 비활성 + 1단계 사유) → `/my-tours/{id}/cancel`. 끝난 신청(1단계 판정 18)은 진행 상태 · 취소 버튼 없음.
  - H11(노드 `2:453`, `CancelApplicationPage`): TopBar `신청 취소 확인` · `정말 신청을 취소할까요?` / `취소 후에는 다시 신청해야 해요.` · danger-soft 카드(`!` · `참여 일정이 취소돼요` / `이미 승인된 신청과 연결된 쿠폰도 무효화돼요.`) · 카드(칩 `취소 대상`, 제목, 날짜 · 시간) · 캡션 `정원 마감 시 다시 신청하지 못할 수 있어요.` · danger 버튼 `신청 취소 확정`(처리 중 비활성 · 연타 1회) → 성공 시 `toast('신청을 취소했어요.')` + `/my-tours/{id}`로 replace. 취소할 수 없는 신청으로 들어오면 `/my-tours/{id}`로 replace.

- [ ] **Step 1~2: 실패하는 테스트** — `groupMyApplications` 단위 테스트(체크포인트별), 화면 테스트를 V2 문구로(1단계 테스트의 의도는 유지: 오늘 탐방은 취소 비활성, 미래 탐방 취소 성공, 확정 코스면 코스 보기 · 오픈채팅, 빈 목록). 취소 화면 연타 1회 테스트.
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 골든 패스의 `내 탐방` → `코스 지도 보기` 단계를 `코스 확인하기`로.
- [ ] **Step 5~7** — 전역 검증 · 진척(hs-a05 · hs-s07 비고 V2, H09 · H11 행 추가) · 커밋 `feat: 내 탐방 V2(예정·지난 탭, 신청 상세, 신청 취소 화면)`

---

### Task 7: 코스 보기 V2 — 준비 중 · 단계 막대 · 시간표 · 지도 펼침 · 상점 시트 (H14 · H04)

**Files:**
- Modify: `src/pages/student/CourseMapPage.tsx`(+test), `src/features/courses/components/{StopList,StoreSheet}.tsx`, `src/features/courses/model.ts`(`stopDurations`)
- Create: `src/features/courses/components/{CourseStepBar,CourseTimeline}.tsx`

**Interfaces:**
- Produces:
  - `stopDurations(stops: CourseStop[], endsAt: string | null): (number | null)[]` — 분 단위, 2A-R6.
  - `CourseStepBar({ stops }: { stops: CourseStop[] })` — 번호 원(1~n) 가로 막대 + 아래 `stopKindLabel` 라벨(V2 H04 상단 카드 안).
  - `CourseTimeline({ stops, durations, onSelect })` — 카드마다 시간 알약(`HH:mm`, brand-soft) + 이름 17/Bold + `{description ?? recommendationReason} · {n}분`(1단계 판정 20: 제휴면 아래 줄 `공공데이터 기반 추천 · 쿠폰 사용 가능` 유지) · 카드 전체가 버튼(`onSelect(stopId)`).
  - H04(노드 `2:248`): TopBar `코스 보기` · `함께 걸을 캠퍼스와 동네` / `{학교 짧은 이름} {탐방 제목} · {M월 D일}` · 페일 블루 카드(`우리의 {소요}시간 코스`(formatDuration을 `N시간`/`N시간 M분`으로) + 칩 `{n}개 장소` + `CourseStepBar` + 작은 카드 `학교에서 동네까지` / `도보로 이어지는 탐방` + 일러스트) · 캡션 `{n}개 장소 · 일정을 위아래로 스크롤해 확인하세요` · `CourseTimeline` · 펼침 `지도로 보기`(버튼 `aria-expanded`, 열면 기존 `MapView` + 도식 폴백, 2A-R5) · 하단 고정 버튼 `내 쿠폰 확인하기`(→ `/my-tours/{id}/coupons`). 카드 → V2 스타일 `StoreSheet`(제목 · 업종 · `AiBadge 추천 이유` · `✦ AI 리뷰 요약` · 별점 · 제휴 혜택 + `쿠폰 보기`).
  - H14(노드 `2:529`, 승인 대기 · 코스 미확정): TopBar `코스 준비 중` · `탐방 코스를 준비하고 있어요.` / `가이드가 신청자들의 관심사를 모으고 있어요.` · 페일 블루 카드(`↗` · `코스 확정을 기다려요` / `가이드가 최종 확정하면 지도와 장소별 설명이 열려요.`) · 카드(칩 `참여 확정`, 제목, `{학교} · {MM.DD (요일)}`) · `StepList(['참여 신청 승인', '하고 싶은 것 취합', '가이드가 코스 초안 검토 · 확정'], current=2)`. 승인 대기 신청(1단계 판정 22)은 기존 문구 `가이드 승인을 기다리고 있어요`를 같은 레이아웃의 제목으로 쓴다.

- [ ] **Step 1~2: 실패하는 테스트** — `stopDurations`(14:00 · 15:10 · 16:00 + 종료 16:30 → 70 · 50 · 30), 1단계 코스 화면 테스트를 V2로(확정 코스: 단계 막대 3개 · 시간표 3장 · `지도로 보기` 펼치면 `schematic-map`, 카드 → 시트 `✦ AI 리뷰 요약`, 미확정 → `탐방 코스를 준비하고 있어요.`).
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 골든 패스 `오늘의 탐방 코스` → `코스 보기`(heading), `제휴 상점 쿠폰 확인` → `내 쿠폰 확인하기`.
- [ ] **Step 5~7** — 전역 검증 · 진척(hs-s08 비고 V2, 결정 0004에 "V2: 지도는 시간표 아래 펼침" 한 줄) · 커밋 `feat: 코스 보기 V2(단계 막대·시간표·지도 펼침·상점 시트)와 코스 준비 중`

---

### Task 8: 쿠폰 V2 — 목록 · 내 쿠폰 · 사용 완료 (H05 · H15)

**Files:**
- Modify: `src/pages/student/{CouponListPage,CouponDetailPage}.tsx`(+tests), `src/features/coupons/model.ts`(`formatCouponCode`), `e2e/golden-path.spec.ts`, `e2e/stage-viewport.spec.ts`

**Interfaces:**
- Produces:
  - `formatCouponCode(code: string): string` — `'824193'` → `'824 193'`(6자리가 아니면 그대로).
  - 목록: TopBar `내 쿠폰` · `ListRow`(eyebrow 업종, 제목 상점 이름, meta 혜택, 오른쪽 상태 칩) → `/coupons/{id}`. 쿠폰이 1장뿐이면 바로 상세로 replace.
  - H05(노드 `2:228`): TopBar `내 쿠폰` · `탐방의 작은 혜택` / `함께 둘러볼 동네 가게에서 사용해요.` · `HeroCard tone="local"`(일러스트 cafe, 무대 예산 때문에 높이 최대 120) · 쿠폰 카드(상태 칩 `couponStateLabel`, 상점 19/Bold, 혜택, 구분선, `쿠폰 코드`, 코드 29/Bold `data-testid="coupon-code"` `formatCouponCode`, `{MM.DD} 탐방 당일에만 사용할 수 있어요.`) · 캡션 `사장님에게 코드를 보여 주세요. 사용 완료 후 리뷰를 쓸 수 있어요.` · 버튼 `코스 지도로 돌아가기`(→ `/my-tours/{applicationId}/course`). 폴링 · 데이터 우선 · `setLastCoupon`은 1단계 그대로. 1단계 블록 순서 판정(Ruling 23: 상점 → 코드)은 V2 카드 안에서도 같다.
  - H15(USED): 제목 `쿠폰을 사용했어요!` / `방문한 가게의 경험을 남겨주세요.` · 페일 블루 카드(✓ · `사용 완료` · `{MM.DD (요일)} {HH:mm} · 사장님 확인 완료`) · 카드(칩 `사용 완료`, 상점, 혜택, `쿠폰 번호 {formatCouponCode}`) · 캡션 `쿠폰은 한 번만 사용할 수 있어요.` · 버튼 `방문 리뷰 작성하기`(2A에서는 `/reviews/new?couponId={id}` 자리 화면 — 2B가 만든다).
- [ ] **Step 1~2: 실패하는 테스트** — `formatCouponCode`, 상세 코드가 `/^\d{3} \d{3}$/`, 사용 처리 뒤 5초 안에 `쿠폰을 사용했어요!`(1단계 폴링 테스트를 V2 문구로), 1장이면 목록 → 상세 replace.
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 골든 패스의 코드 정규식 `/^\d( \d){5}$/` → `/^\d{3} \d{3}$/`, 사장님 화면에 넣는 값은 공백 없는 6자리(`code.replace(/\s/g, '')`). 무대 ③ 대상 그대로(`coupon-code`).
- [ ] **Step 5~7** — 전역 검증 · 진척(hs-s09 비고 V2) · 커밋 `feat: 쿠폰 V2(내 쿠폰·사용 완료, 코드 3자리씩)`

---

### Task 9: 가이드 홈 · 내가 개설한 탐방 · 신청자 승인 V2 (G01 · G11 · G06 · G02)

**Files:**
- Modify: `src/pages/guide/{GuideHomePage,GuideToursPage,ApplicantsPage}.tsx`(+tests), `src/shared/lib/date.ts`(+test), `e2e/golden-path.spec.ts`
- Create: `src/features/applications/guideHome.ts`(+test)

**Interfaces:**
- Produces:
  - `formatLongDate(iso: string): string` — `11월 12일 목요일`. `formatAmPm(iso: string): string` — `오후 2시` · `오후 2시 30분` · `오전 10시`.
  - (Task 3의 `pickFocusTour` · `guideCoursePath`를 쓴다.)
  - `guideTodos(tour: GuideTourSummary): { title: string; description: string; action: ActionLink }[]` — 대기 > 0이면 `대기 중인 신청자 {n}명 확인` / `학생들의 관심사를 확인하고 승인해요.` / `신청자 확인하기` → applicants; 코스 없음 + 승인 > 0 → `코스 초안 만들기 ›` → `/guide/tours/{id}/course/draft?generate=1`; DRAFT → `코스 이어서 편집 ›` → `edit`; CONFIRMED → `확정 코스 보기 ›` → `confirm`.
  - G01(노드 `2:698`, `/guide`): `BrandMark` · `PageHeading('이번 주, 하나의 탐방을\n준비하고 있어요.', '학생들에게 특별한 대학 생활을 보여주세요.')`(진행 예정 탐방이 2개 이상이면 `하나의` → `{n}개의`) · 페일 블루 카드(`{formatLongDate} · {formatAmPm}`, 제목, 학교, 숫자 둘 `{승인}명 승인했어요` · `{남은 자리}자리 남았어요`) · 버튼 `신청자 확인하기` · 소제목 `오늘 해야 할 일` + `guideTodos` 카드. 신청이 0이면 G11(노드 `2:982`): 제목 `아직 신청자가 없어요.` / `학생들이 찾기 쉽도록 탐방 소개를 점검해 봐요.` · 카드(`☺` · `첫 신청을 기다리는 중` / `모집 중인 탐방이 학생의 추천 화면에 노출돼요.`) · 카드(칩 `모집 중`, 제목, `{MM.DD (요일)} · 정원 {n}명`) · 캡션 `승인된 신청자가 1명 이상이면 코스 초안 생성을 진행할 수 있어요.` · 버튼 `탐방 상세 보기`(→ `/tours/{id}`). 진행 예정 탐방이 없으면 빈 상태(1단계 `아직 개설한 탐방이 없어요.` / `새 탐방 개설하기`). 화면 맨 아래 링크 `내가 개설한 탐방 ›`(→ `/guide/tours`).
  - G06(노드 `2:851`, `/guide/tours`): `PageHeading('내가 개설한 탐방', '모집 상태와 참가자를 한곳에서 관리해요.')` · `SegmentedTabs`(`진행 예정` · `지난 탐방`) · 카드(칩 `신청 접수 중`(RECRUITING) · `모집 마감`(CLOSED) · `코스 확정`(코스 CONFIRMED, success), 제목, `{MM.DD (요일)} · {승인}/{정원}명 승인`, soft 버튼 `신청자 관리하기` 또는 `코스 확인하기`, 작은 링크 `탐방 취소`(1단계 그대로)) · 카드 `새 탐방 개설하기 ›` / `학생들과 나누고 싶은 하루를 등록해요.`. 정렬은 1단계 판정 35(시작 순).
  - G02(노드 `2:724`): 뒤로(→ `/guide`) · 제목 `학생 {대기}명이\n승인을 기다려요.`(대기 0이면 `신청자를 모두 확인했어요.` — 제안 문구) / `참가 이유를 읽고 함께할 학생을 선택해요.` · 신청자 카드 `<article>`(아바타 · 이름 `h2` · 오른쪽 soft 버튼 `승인하기` · 따옴표 `“ 고{학년} · {동기} ”` · 2A-R11 `거절하기`; 승인 · 거절된 카드는 버튼 대신 상태 칩) · 캡션 `승인하면 학생에게 오픈채팅 링크가 공개돼요.` · 버튼 `승인 완료 후 코스 만들기`(승인 ≥ 1이면 `GuideCourseRedirect` 규칙의 코스 경로로, 아니면 비활성 + 1단계 hint). 1단계 규칙(처리 중 전부 비활성, 자리 0이면 승인 비활성 + 사유, 실패 시 보드 재조회, 승인 토스트)은 그대로.
- [ ] **Step 1~2: 실패하는 테스트** — 날짜 함수 둘, `pickFocusTour` · `guideTodos`, 화면 테스트(APPLIED: 홈에 `2명 승인했어요` · `대기 중인 신청자 1명 확인`(체크포인트 수치로), START에 신청 없는 탐방이면 G11, 신청자 화면 V2 문구로 1단계 테스트 의도 유지 — 승인하면 숫자 변화, 연타 1회).
- [ ] **Step 3: 구현** — Task 3의 자리 화면을 실제 G01로 바꾼다(자리의 `내가 개설한 탐방` 링크는 G01 맨 아래 링크로 남는다).
- [ ] **Step 4: E2E** — 골든 패스 가이드 단계: `/guide`에서 `신청자 확인하기` → 김민지 카드의 `승인하기` → `승인 완료 후 코스 만들기`.
- [ ] **Step 5~7** — 전역 검증 · 진척(G01 · G11 행 ✅, guide-a02 · guide-s03 비고 V2) · 커밋 `feat: 가이드 홈·내가 개설한 탐방·신청자 승인 V2`

---

### Task 10: 코스 완성 · 확정 V2 (G03 · G08)

**Files:**
- Modify: `src/pages/guide/{CourseDraftPage,CourseEditPage,CourseConfirmedPage}.tsx`(+`CoursePages.test.tsx`), `src/app/routes.tsx`, `e2e/golden-path.spec.ts`, `e2e/stage-viewport.spec.ts`
- Create: `src/pages/guide/CourseConfirmPage.tsx`, `src/features/courses/components/StopActionSheet.tsx`

**Interfaces:**
- Produces(2A-R10):
  - G03(노드 `2:787`, `/guide/tours/:tourId/course/edit`): 뒤로(→ applicants) · 제목 `코스를 완성해 볼까요?` / `승인된 학생의 '하고 싶은 것'만 반영했어요.` · 페일 블루 카드(`AiBadge AI 추천 코스`, `{N시간}`(소요), `KeywordChips` 대신 한 줄 `{지점 분류를 '·'로}`, 일러스트 dining, 무대 예산 때문에 높이 최대 110) · 소제목 `일정 · {n}개 장소` + 캡션 `코스에 제휴 가게 1곳 이상 포함해 주세요.`(제휴 지점이 0이면 warning 칩으로) · 지점 카드(시간 알약 · 이름 · `{description ?? recommendationReason} · {n}분` · 오른쪽 `≡` 버튼 `{name} 편집`) · 하단 고정 `이 코스로 확정하기`(지점 0이면 비활성 + 1단계 hint) → `/course/confirm`. 생성 중(`/course/draft`)은 `AiLoading` 후 `edit`로 replace(1단계 생성 1회 규칙 · 처리 중 잠금 그대로). 1단계의 `다시 만들기`는 소제목 오른쪽 작은 텍스트 버튼으로 남긴다.
  - `StopActionSheet({ stop, isFirst, isLast, busy, onMoveUp, onMoveDown, onEditNote, onRemove, onClose })` — 시트 제목 `{name}`, 버튼 `위로 이동`(첫 지점 비활성) · `아래로 이동`(마지막 비활성) · `한줄평` · `빼기`(확인 창 1단계 문구). 처리 중이면 모두 비활성.
  - G08(노드 `2:911`, `CourseConfirmPage`, `/course/confirm`): 뒤로(→ edit) · `코스를 확정할까요?` / `확정 후 참가자에게 최종 일정이 공개돼요.` · 페일 블루 카드(`↗` · `{N시간} 코스 초안 완성` / `{분류 나열} 등 {n}개 장소로 구성했어요.`) · 점검 행 `승인된 고교생 요청 반영` · `확인 완료`(success) / `제휴 상점 1곳 이상` · `충족`(success, 0이면 `미충족` danger + 버튼 비활성 + 사유 `제휴 상점을 1곳 이상 넣어 주세요.` + 행동 `코스 편집으로`) · 캡션 `확정하면 참가자에게 코스가 공개되고 쿠폰이 자동 발급돼요.` · 버튼 `코스 확정하기`(연타 1회) → 같은 화면 완료 상태: 페일 블루 카드(✓ · `코스를 확정했어요` · `참가 승인 {n}명 · 쿠폰 {n}장 발급`; 0장이면 1단계 문구 `코스에 제휴 상점이 없어 발급된 쿠폰이 없어요.`) + 버튼 `내가 개설한 탐방으로`(→ `/guide/tours`). 이미 CONFIRMED로 들어오면 처음부터 완료 상태.
  - 라우트: `/course/confirmed` → `/course/confirm` replace. `CourseConfirmedPage.tsx`는 지운다.
- [ ] **Step 1~2: 실패하는 테스트** — 1단계 `CoursePages.test.tsx`의 의도(생성 1회 · 재마운트 중복 없음 · 순서 바꿔도 시간 14:00/15:10/16:00 · 한줄평 저장 · 지점 0이면 확정 비활성 · 확정 리다이렉트)를 V2 이동으로 다시 쓴다. 시트: 둘째 지점 `≡` → `아래로 이동` → 순서 바뀜. 확정 → `/쿠폰 [1-9]\d*장 발급/`.
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 골든 패스: `코스 수정하기` · `아래로 이동` · `최종 코스 확정` · `확정하기` → `{둘째 지점} 편집` → `아래로 이동` → `이 코스로 확정하기` → `코스 확정하기` → `/쿠폰 [1-9]\d*장 발급/`. 무대 ②: 대상은 G03의 지점 카드 3개(생성 직후 `edit` 화면). 넘치면 2A-R4로 줄인다.
- [ ] **Step 5~7** — 전역 검증 · 진척(guide-s04 · s05 · s06 비고 V2) · 커밋 `feat: 코스 완성(AI 초안+편집 한 화면)·확정 점검 V2`

---

### Task 11: 사장님 내 가게 · 쿠폰 처리 V2 + `GET /api/owner/store` (O01-E · O01 · O02 · O07 · O08)

**Files:**
- Create: `src/features/stores/{model,api,queries}.ts`, `src/mocks/rules/stores.ts`(+test, 조회만), `src/mocks/handlers/stores.ts`, `src/pages/owner/MyStorePage.tsx`(+test)
- Modify: `src/mocks/rules/views.ts`(`toMyStore`), `src/mocks/registry.ts` · `registry.test.ts`(P1 엔드포인트 집합에 1개), `src/shared/lib/errors.ts`(`STORE_NOT_LINKED`), `src/shared/api/queryKeys.ts`(`myStore`), `src/app/routes.tsx`, `src/pages/owner/CouponRedeemPage.tsx`(+test), `docs/api/frontend-needs.md`(3-2절 신설, 이 엔드포인트 한 행), `e2e/golden-path.spec.ts`

**Interfaces:**
- Produces:
  - 계약 3-2절(새, "P1 엔드포인트 — 동결 대상 아님") 첫 행: `GET /api/owner/store` | — | `MyStore` | `STORE_NOT_LINKED 404` | 내 가게 `/owner/store`. 2B가 나머지 행을 더한다.
  - 타입(`features/stores/model.ts`): `type PartnershipState = 'ACTIVE' | 'SCHEDULED' | 'ENDED'` · `interface Partnership { id: number; discount: string; startDate: string; endDate: string; state: PartnershipState }` · `interface MyStore { id: number; name: string; address: string; category: string; partnership: Partnership | null }`(서버가 오늘(서울)과 기간으로 `state` 계산).
  - `getMyStore(): Promise<MyStore | null>`(404 `STORE_NOT_LINKED`면 null) · `useMyStore(): UseQueryResult<MyStore | null, ApiError>` · `qk.myStore = ['myStore']`.
  - 목업: `myStoreOf(db, ownerId, now): MyStore`(가게 없으면 `MockApiError(404,'STORE_NOT_LINKED')`), 핸들러 `GET /api/owner/store`(사장님 아니면 403).
  - O01-E(노드 `2:1317`): `BrandMark` · 오른쪽 위 `로그아웃`(2A-R9, `useLogout`) · `아직 연결된 가게가 없어요.` / `내 가게를 연결하고 학생들에게 제휴 혜택을 소개해 보세요.` · 페일 블루 카드(`MY LOCAL SHOP` · 일러스트 cafe · `가게 연결을 시작해 볼까요?`) · 캡션 `연결 후에는 제휴 할인과 쿠폰 사용을 관리할 수 있어요.` · 버튼 `내 가게 연결하기`(→ `/owner/store/connect`, 2B 화면).
  - O01(노드 `2:1090`): 같은 머리 · `학생들이 가게를\n더 쉽게 찾고 있어요.` / `동네 탐방과 함께 새로운 손님을 맞이해요.` · `HeroCard tone="local"`(`MY LOCAL SHOP`, 가게 이름, `{discount} 운영 중`, 칩 `● 제휴 운영 중`(ACTIVE) · `제휴 예정`(SCHEDULED) · `제휴 종료`(ENDED) · 제휴 없음이면 `제휴 혜택을 설정해 주세요` + 링크(2B)) · 버튼 `쿠폰 코드 입력하기`(→ `/owner/coupons/redeem`) · 소제목 `쿠폰 사용 방법` + 두 칸 `01 학생이 쿠폰 제시` · `02 코드 입력 후 처리`.
  - O02(노드 `2:1114`): `쿠폰 코드를 입력하면\n바로 확인할 수 있어요.` / `학생이 보여주는 6자리 숫자를 입력해요.` · `CodeInput`(V2 여섯 칸, 라벨 `6자리 쿠폰 코드` 유지) · 조회 카드(칩 `사용 가능`, 상점, 혜택 brand 19/Bold, 구분선, `{탐방 제목} · {MM.DD (요일)}`) · 캡션 `쿠폰은 한 번만 사용할 수 있어요.` · 버튼 `사용 처리하기`. 성공 → O07(같은 화면 상태, 노드 `2:1196`): `쿠폰 사용이 완료됐어요.` / `학생에게 사용 완료를 안내해 주세요.` · 카드(✓ · `쿠폰 처리 성공` / `중복 사용 방지를 위해 사용 완료 상태로 저장했어요.`) · 카드(칩 `사용 완료`, 상점, `{혜택} · 코드 {formatCouponCode}`, `{MM.DD (요일)} · {HH:mm} 사용`, 2A-R13 `이번 탐방으로 온 학생 {n}명`) · 버튼 `다른 쿠폰 확인하기`(초기화). 오류 → O08(노드 `2:1217`): `코드를 다시 확인해 주세요.` / `해당 쿠폰을 사용할 수 없는 상태예요.` · 카드(`!` · 1단계 `couponNotice`의 제목 · 설명) · danger-soft 줄 `확인 항목: 코드 6자리 · 사용 여부 · 탐방 당일 유효 여부` · 링크 카드 `다른 코드 입력하기 ›` / `학생에게 새 코드를 확인해 주세요.` · 버튼 `다시 입력하기`. 1단계 규칙(`?code=` 반응, 최근 쿠폰 채우기 조건, 연타 1회, 데이터 우선)은 그대로.
- [ ] **Step 1~2: 실패하는 테스트** — 목업 규칙(owner1 → 가게 1 · 제휴 ACTIVE, owner-nostore 계정이 없으면 seed의 가게 없는 사장님을 테스트 안에서 `mutate`로 만든다 → 404), 핸들러, `useMyStore`(404 → null), O01 · O01-E 화면, 로그아웃, 쿠폰 화면 V2 문구(1단계 테스트 의도 유지).
- [ ] **Step 3: 구현**
- [ ] **Step 4: E2E** — 사장님 단계: `사용 처리` → `사용 처리하기`, 성공 단언 `쿠폰 사용이 완료됐어요.` + `이번 탐방으로 온 학생 1명`. 발표 모드 `사장님`(최근 쿠폰 없음) 도착지 `/owner/store`가 O01을 그리는지 `demo.test.tsx` 단언 수정.
- [ ] **Step 5~7** — 전역 검증 · 진척(owner-s02 · owner-s03 · owner-a03 비고 V2, API 표에 `GET /api/owner/store` 행 목업 ✅) · 커밋 `feat: 사장님 내 가게·쿠폰 처리 V2와 GET /api/owner/store`

---

### Task 12: 시연 도구 · E2E · 무대 점검 · 문서 마감

**Files:**
- Modify: `src/demo/{DemoPanel,RoleBadge}.tsx`(V2 톤), `e2e/{golden-path,stage-viewport,p1-smoke?}.spec.ts`(남은 로케이터 · 배지 단언), `README.md`(스크린샷 · 무대 링크 설명이 바뀐 곳), `docs/progress/README.md`, `docs/progress/devlog.md`, `docs/reference/design-v2.md`(구현 메모: 판정 2A-R 링크)

**Interfaces:**
- 발표 모드 배지는 V2 톤(고교생 brand-soft/brand · 가이드 success-soft/success · 사장님 local-soft/accent-local · 운영자 neutral). 탭 첫 화면(TopBar 없음)에서는 배지가 `PageHeading` h1 글자를 덮지 않는지 단언한다(1단계 `expectRoleBadgeBesideTitle`을 h1 기준 그대로 쓰되, `BrandMark` 줄 오른쪽에 배지가 오도록 배치).
- 시연 패널 버튼 · 칩을 V2 컴포넌트로(기능 · 문구 그대로).

- [ ] **Step 1: 전체 E2E 정리** — 골든 패스 2변형 · 무대 9개 · smoke를 새 화면으로 모두 통과시킨다. 무대 스크린샷(`test-results/stage-*.png`)을 열어 V2와 나란히 본다(Design 파일 노드 스크린샷과 비교, 커밋하지 않음).
- [ ] **Step 2: 판정 뷰포트 실측표** — 화면 ① · ② · ③의 사용 높이 · 여유를 `docs/progress/README.md` 열린 질문 아래 표로 갱신한다(1단계 Task 22 표 자리).
- [ ] **Step 3: 문서** — README 무대 링크 설명(가이드 첫 화면 `/guide`, 사장님 탭 두 개), 대시보드 체크포인트 "11/8 MVP"의 골든 패스 부분 비고 `V2 적용`, devlog.
- [ ] **Step 4: 전역 검증 · 커밋** — `test: V2 골든 패스·발표 모드·무대 해상도 E2E와 시연 도구 V2`
