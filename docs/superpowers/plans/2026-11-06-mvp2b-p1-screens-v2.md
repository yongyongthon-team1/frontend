# MVP 2B — P1 화면 V2 (막다른 곳 없는 최소판) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2A가 끝낸 V2 디자인 시스템 위에 골든 패스 밖의 P1 화면을 모두 V2 배치 · 문구로 만든다 — 가입 · 보호자 동의 · 재학 인증 · MY(고교생 · 가이드) · 알림 설정 · 가이드 프로필 · 탐방 개설 · 완료 · 취소 · 확정 코스 보기 · 코스 상점 추가 · 교체 · 방문 리뷰 · 최근 리뷰 · 사업자 인증 · 가게 연결 · 제휴 설정 · 운영자 심사. 그 API 26개(#1~#25 · #27, #26은 2A)를 목업으로 완동시키고, 어떤 역할의 어떤 화면에서도 막다른 곳이 없게 한다.

**Architecture:** 2A와 같다. 데이터 계층은 계약(`docs/api/frontend-needs.md` 3-2절) → 목업 규칙(`src/mocks/rules/*`, 던지는 `MockApiError`) → 핸들러(`withErrors`) → `features/*/api.ts` → `queries.ts` → 페이지 순서로 쌓고, 페이지는 `features/*/queries`만 쓴다. 표현 계층은 2A의 V2 부품(`ListRow` · `SegmentedTabs` · `StepList` · `HeroCard` · `PageHeading` · `StatusChip` · `InfoCard tone` · `Button` 변형)과 V2 토큰만 쓰고 새 부품은 Task 3의 네 개(`FileField` · `ToggleSwitch` · `StarRating` · `VerificationStatusCard`)뿐이다. 시간 판단은 서버가 준 값으로만 그린다.

**Tech Stack:** Vite 7 · React 19 · TypeScript 5.9(strict) · React Router 7(core) · TanStack Query 5 · Zustand 5 · RHF 7 + Zod 4 · Tailwind 4 · Radix Dialog · sonner · lucide-react · MSW 2 · Vitest 3 + Testing Library · Playwright. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-11-03-frontend-design.md`(5.3 P1 행 · 5.4 · 5.5 · 5.10) + **하이파이 V2 스냅샷 `docs/reference/design-v2.md`**(화면 색인 · 노드 ID · 화면별 문구 · "V2가 바꾼 것") + 결정 0010 + **API 계약 `docs/api/frontend-needs.md` 3-2절 #1~#27 · 4절 P1 타입 · 6절 질문**. V2에 없는 화면은 `docs/reference/wireframes.md`의 기능 · 문구를 V2 부품으로 그린다. 1단계 판정 `docs/superpowers/plans/2026-11-04-mvp1-rulings.md`(G1~G6, C1~C29)와 2A 계획 `docs/superpowers/plans/2026-11-06-mvp2a-design-v2-golden-path.md`(2A-R1~R15)는 이 계획에도 그대로 적용된다.

**V2 원본을 보는 법:** 2A와 같다 — 이미지 `docs/reference/design-v2/<코드>.png`, 문구는 `design-v2.md` "화면별 문구"(그대로 쓴다), 세부 간격 · 아이콘은 Design 파일(fileKey `xNzkXH89Gc0bCbx8EYlBgk`)의 노드를 `get_design_context`로 본다(figma-design-to-code 스킬을 먼저). 노드: H12 `2:475` · H16 `2:582` · H17 `2:608` · H18 `2:636` · G04 `2:758` · G05 `2:829` · G07 `2:881` · G09 `2:934` · G10 `2:959` · G12 `2:1008` · G13 `2:1035` · O05 `2:1143` · O06 `2:1171` · A01 `2:1237` · A02 `2:1270` · A03 `2:1294`.

## Global Constraints

(1단계 계획 + 2A 계획의 Global Constraints 전부 + 아래. 다르면 아래가 앞선다.)

- **V2 우선, 없으면 와이어:** V2 화면이 있는 곳은 V2의 배치 · 문구 · 이동을 따른다. V2에 없는 화면(`/signup` · `/consent/:token` · `/verify` · `/guide/verify` · `/owner/verify` · 가이드 확정 코스 보기)은 와이어 문구를 그대로 쓰되 V2 부품으로 그린다. 문구 우선순위: 이 계획 > `design-v2.md` > `wireframes.md`. 계획에 **제안 문구**로 적힌 것은 그대로 쓴다(실행자가 지어내지 않는다).
- 의존 방향은 `demo → features → shared`만. `src/features/**` · `src/shared/**`는 `src/demo/**`를 import하지 않는다. 페이지는 `@/shared/lib/http`와 `@/features/*/api`를 import하지 않는다(ESLint).
- 골든 패스 29개 엔드포인트(+2A의 `GET /api/owner/store`)의 경로 · 요청 · 응답 모양은 바꾸지 않는다. 새 핸들러는 `src/mocks/registry.test.ts`의 `P1_CONTRACT`에 더하고 마지막 API 태스크(Task 20)에서 27개를 단언한다. 공개 엔드포인트(#1 · #7~#9)는 `auth: false`(토큰 없이, 401이 세션을 끊지 않게).
- 목업 규칙은 위에서부터 검사해 처음 걸린 `MockApiError`(필드 오류는 `fieldError`)를 던지고, 다 통과한 뒤에만 DB를 바꾼다. 저장은 핸들러의 `mutate`(트랜잭션).
- **`Me`를 돌려주지 않는 변경**(#5 · #6 · #22 · #24 · #25)은 이동 전에 `refetchMe(queryClient)`를 await한다. 화면은 `queryClient`를 직접 쓰지 않고 훅이 한다.
- 데이터 우선 렌더링: `ErrorState`는 데이터가 없을 때만, 재조회 실패에도 받은 화면은 그대로(1단계 C17 · 2A-R15). 로딩은 `Skeleton`, 빈 상태는 `EmptyState`.
- 비활성 버튼은 사유 + 다음 행동(`Button`의 `hint`). 처리 중 `loading`. **되돌릴 수 없는 버튼**(동의 · 거부 · 승인 · 반려 · 탐방 완료 · 취소 · 상점 적용 · 가게 연결 · 리뷰 등록 · 신청 제출)은 처리 중 잠그고 연타해도 요청 1번이다 — 화면 테스트마다 연타 단언을 둔다(목업 지연을 올리고 `server.events` 리스너는 afterEach에서 지운다, 1단계 Task 18 방식).
- 날짜 · 시각 판단은 서버 값(`GuideTourDetail.cancellable` · `completable`, `Coupon.state`, `Partnership.state`, `GuardianConsentView.status`의 `EXPIRED`). 컴포넌트에서 `new Date()`로 유효 여부를 판단하지 않는다. 예외: 고정 데이터(방학 기간) 범위 검사와 입력 안내(date `min`/`max`, 제휴 기간 기본값).
- **업로드(#5):** multipart `document` + 역할별 필드, jpg · png · heic · heif, 10MB(`10 * 1024 * 1024`, 정확히 10MB는 통과), 형식은 MIME **또는** 확장자(대소문자 무시, HEIC는 MIME이 빌 수 있다), 파일을 고르는 즉시 검사해 틀린 파일은 버린다, 업로드 제한 시간 60초(`UPLOAD_TIMEOUT_MS`), 본문 없는 413은 `FILE_TOO_LARGE`. 목업 사진은 메모리뿐이라 새로고침하면 사라진다(README에 한 줄).
- 한글 IME: 새 한 줄 입력이 있는 폼은 `<form onKeyDown={preventImeEnter} noValidate>`(`src/shared/lib/ime.ts`). Textarea의 Enter는 줄바꿈.
- 테스트 도구: `renderApp(path, { as, checkpoint })`(`as`는 시연 역할 또는 **이메일**), `loginAs`, `server`(MSW), `findApplicationId`, `demoCouponCode`. 시드 계정은 이메일로 찾는다(id를 적지 않는다). 업로드 테스트는 `testImage()`(Task 1)와 `userEvent.setup({ applyAccept: false })`.
- **P0 화면을 건드리는 태스크**(3 · 4 · 10 · 13 · 14 · 16 · 17 · 19 · 21 · 22)는 골든 패스 · 발표 모드 · 무대 해상도 E2E를 같은 태스크에서 다시 통과시킨다. 무대 400px 예산 판정은 2A-R4(장식부터 줄인다)를 따른다.
- 모든 태스크: `npm run test:run && npm run typecheck && npm run lint && npm run build && npm run e2e`(이하 "전역 검증 명령")가 통과해야 커밋한다. 마지막 구현 단계 = 진척 문서 갱신(`docs/progress/README.md`의 해당 행 + `docs/progress/devlog.md` 오늘 날짜 한 줄). 커밋은 main에 직접, 푸시는 사용자 확인 후에만.
- 태스크가 앞 태스크가 고친 파일을 다시 고칠 때 줄 번호 대신 기호(함수 · 경로 문자열)로 찾는다.

## 판정 (이 계획에서 정한 것 — 2B-R)

- **2B-R1 계약 · V2가 정한 필드:** 기준은 `docs/api/frontend-needs.md` 3-2절이다. V2에서 온 변경 — `StudentProfileInput.name`(#2) · `CreateTourInput.title`(#14) · `CourseStoreCandidate.matchedRequest`(#18) · `Partnership.condition`/`PartnershipInput.condition`(#27) · `GET /api/owner/store-candidates?q=`(#23, **구현한다**) · `GuideTourDetail`(#15). 새 에러 코드 5개(`COMPLETE_BEFORE_TOUR_DATE` · `COURSE_STOP_DUPLICATE` · `COURSE_STOP_LIMIT` · `BIZ_NOT_VERIFIED` · `ADDRESS_NOT_FOUND`, `STORE_NOT_LINKED`는 2A)와 `BIZ_CLOSED` 문구 교체는 Task 1.
- **2B-R2 사업자 인증은 자동(U-07, 사용자 결정):** 운영자 화면은 학생증 심사만 다룬다. A01에 `사업자 심사` 카드를 그리지 않는다. 사업자 인증은 #22 한 번으로 끝난다.
- **2B-R3 알림 토글은 기기에만:** H18 · G13 토글은 zustand persist 스토어 `ytt.settings`(`src/features/settings/settingsStore.ts`, 시연 스토어 `demoStore`와 **따로**)에 저장하고 API는 없다. 로그아웃 · 시연 초기화가 지우지 않는다. 기본값은 전부 켜짐.
- **2B-R4 사장님 MY 없음:** `/owner/me`는 `<Navigate to="/owner/store" replace />`로 바꾼다(`OwnerMePage`를 만들지 않는다). 사유: V2 사장님 탭에 MY가 없고 로그아웃은 2A가 `내 가게`에 뒀다. `shell.test`의 `/owner/me` 단언을 이동 단언으로 바꾼다(Task 20).
- **2B-R5 가이드 프로필 경로:** G05는 `/guide/me/profile`이고 `/guide/me`는 G12(MY 홈)다. `getLandingPath`는 가이드의 학과 미작성을 `/guide/me/profile`로 보낸다(Task 10). 프로필을 처음 저장하면 `getLandingPath(새 Me)`로, 수정이면 `/guide/me`로 이동한다.
- **2B-R6 인증 화면 셸:** `/verify` · `/guide/verify` · `/owner/verify`는 TopBar 뒤로 가기 없음 + 하단 탭 표시. 활성 탭은 고교생 · 가이드 모두 `MY`, 사장님은 `내 가게`(2A의 `TABS.OWNER` match에 `/owner/verify` 추가, Task 3).
- **2B-R7 `useSubmitStudentVerification`의 결과는 새 `Me`:** 훅이 `postStudentVerification` → `qk.myVerification` 갱신 → `refetchMe`를 하고 변이 결과로 새 `Me`를 돌려준다. `/guide/verify`가 `getLandingPath(새 Me)`로 이동하려는 것이다.
- **2B-R8 같은 탭 보호자 동의 시연:** `/consent/:token`의 `학생 화면으로 돌아가기`(→ `/verify`)는 이 탭에 세션 토큰이 있을 때만 보인다(시연 도구 여부가 아니라). `/verify` STEP 2는 `demoConsentToken`이 있으면 `보호자 페이지 열기` + 배지 `시연`을 보인다. 동의 · 거부 성공은 `qk.me` · `qk.myVerification`을 무효화한다. 보호자 거부에 확인 창을 두지 않는다.
- **2B-R9 목업 사진:** `mock-file:` 참조는 새로고침 · 원클릭 링크 뒤 사라진다 — 운영자 상세 DTO는 그때 정적 견본 `/mock-docs/student-id-{hs,univ}.svg`를 준다. 운영자 화면은 사진 유무로 승인을 잠그지 않는다.
- **2B-R10 탐방 개설:** 입력은 `title`(탐방 이름 2~30자) · 날짜 · 시간 · 정원(1~8, V2 `최대 8명`) · 소개(10~500자) · 연락 링크(선택, `https://`). "내일 이후"는 서버가 판정한다(`fieldErrors.startsAt` → 날짜 칸 아래). 프론트의 date `min`/`max`와 `방학 기간` 칩은 안내이고, 방학 범위 검사만 고정 데이터(`University.vacations`)라 클라이언트에도 둔다. 개설 차단 판정은 `tourCreateBlock`(Task 4).
- **2B-R11 완료 · 취소는 서버 플래그:** 버튼 활성은 `completable` · `cancellable`, 사유는 `status`로 고른다. 완료 · 취소 화면은 확인 창 없이 화면 자체가 확인 단계다(H11과 같은 구조).
- **2B-R12 코스 추가 · 교체 진입(V2에 UI 없음):** 추가 = G03 `일정 · n개 장소` 소제목 줄 오른쪽의 작은 텍스트 버튼 `+ 장소 추가`(2A의 `다시 만들기`와 같은 줄, `shrink-0`, 소제목은 말줄임)가 `…/course/stops/pick?mode=add`를 연다. 교체 = 2A `StopActionSheet`에 `다른 장소로 교체`(STORE 지점만)를 더해 `…?mode=replace&stopId=`를 연다. 5곳이면 `+ 장소 추가`는 `aria-disabled`이고 누르면 토스트 `errorMessage('COURSE_STOP_LIMIT')`. 후보 지도 · 시각 미리보기 · `useIsPickingStop`은 만들지 않는다.
- **2B-R13 G07 후보 카드:** 서버 순서 그대로(프론트가 다시 정렬하지 않는다). `제휴 상점`/`일반 상점` 칩은 표시일 뿐 순위가 아니다. 줄 문구 `도보 약 {N}분 · {업종}`(N = `Math.ceil(distanceM / 80)`) · `학생 요청: {matchedRequest}`(null이면 줄 없음). 검색칸은 상호 · 업종 · `relatedIntent` 부분 일치 필터다. 카드 전체가 선택 버튼(`aria-pressed`), 코스에 있는 상점은 칩 `코스에 있음`, 교체 대상은 `지금 지점`(둘 다 선택 불가, 제안 문구).
- **2B-R14 리뷰 진입 · 착지:** 진입은 H15 `방문 리뷰 작성하기`(2A 자리 `/reviews/new?couponId=`를 실제 화면으로) · H09 `리뷰 남기기 ›`(→ 쿠폰 목록, 목록의 USED 쿠폰마다 `리뷰 쓰기`) · H10 `리뷰 남기기 ›`(승인 + 탐방 완료) · 상점 시트 `리뷰 쓰기`. 저장 뒤 착지: 신청이 APPROVED면 `/my-tours/{applicationId}/course?storeId={storeId}`(그 지점 시트를 연 채 — AI 요약 갱신이 보이는 곳), 아니면 `/coupons/{id}`. 저장 중 `AiLoading`(제한 시간 `AI_TIMEOUT_MS`), 시연 미리 채움 없음.
- **2B-R15 운영자 심사:** A01(`/admin/verifications`, 탭 `대기 {n}` · `처리 완료` ↔ `?filter=processed`) → A02(`/admin/verifications/:id`) → A03(`/admin/verifications/:id/reject`). 승인 · 반려는 둘 다 사진이 지워져 되돌릴 수 없으므로 확인 창을 둔다(제안). 처리 끝난 건은 사진 자리에 `파일 삭제됨`, 버튼 없음. A01 맨 위 줄에 `로그아웃`(운영자는 탭이 없다).
- **2B-R16 사장님 연결 흐름(V2 O05 → O06):** `이 가게 연결하기 ›`는 후보를 **고르는** 표시(카드에 `✓ 선택됨`), 되돌릴 수 없는 연결은 하단 `다음으로`가 한다 — 확인 창(`내 가게로 연결할까요?`) → #24 → `/owner/store/partnership`(replace). `내 가게 직접 등록 ›`는 같은 화면 안 등록 폼(`상호명 · 주소 · 업종`)을 펼치고 그 안의 `내 가게 등록하기`가 #25 후 같은 곳으로 보낸다. O06은 처음이면 칩 `연결 완료`, 저장하면 `/owner/store`로(토스트).
- **2B-R17 제휴 기간 기본값:** O06의 `혜택 이름` · `할인 조건` 아래에 `제휴 시작일` · `제휴 종료일`을 둔다. 기본값은 기존 제휴가 있으면 그 기간, 없으면 오늘 ~ 오늘+90일(`addDaysKey(seoulDateKey(new Date()), 90)`, 안내용 기본값이라 시계 사용이 허용된다). `condition`은 비우면 `null`.
- **2B-R18 시연 보조:** 시연 패널 **전체 패널에만** `P1 계정` Select + `이 계정으로 전환`(`quickLogin({ email })` 재사용). 발표 막대 · `DemoRole` · 골든 패스 E2E는 불변. 공개 라우트(`/signup` · `/consent/*`)에서는 `RoleBadge`를 숨긴다. 가입 · 수동 로그인으로 토큰이 바뀌면 `activeDemoEmail`을 비운다(`activeDemoToken` 비교).
- **2B-R19 자리 화면 정리:** 2B 뒤 `곧 열려요.`는 `/explore` · `/owner/report`(P2)에만 남는다(`PlaceholderPage` 문구 `MVP 2단계에서 열려요.` → `곧 열려요.`). P1 동선 어디에도 자리 화면이 없다는 것은 Task 23 스모크가 단언한다.
- **2B-R20 11/6 대본 게이트:** 대본에 리뷰 · 상점 교체 · 운영자 심사 · 가입 장면이 들어가면 그 화면을 P0로 올리고 무대 단언을 더한다(컨트롤러가 판정, 계획 본문은 메모만).

## Review Focus

1. **실제 브라우저의 multipart 업로드** — jsdom 테스트는 Node `FormData`로 바꿔 돌므로 서비스 워커를 거치는 업로드 경로는 단위 테스트로 확인되지 않는다 → Task 23 `p1-smoke`가 `newbie@demo.kr`로 jpg 1장을 올려 `심사 중`을 본다.
2. **같은 탭 보호자 동의** — 공개 화면에서 동의한 뒤 `/verify`로 돌아오면 새로고침 없이 `동의 완료`가 보인다 → Task 7 · 8 테스트와 Task 23 스모크.
3. **지난 리허설의 v2 목업 DB** — 새 계정이 없는 옛 저장본이 남아 있어도 앱이 깨지지 않고 v3 시드로 바뀐다 → Task 2 `store.test.ts`.
4. **P0 화면 회귀** — 골든 패스 · 발표 모드 · 무대 E2E가 P0를 건드리는 모든 태스크(3 · 4 · 10 · 13 · 14 · 16 · 17 · 19 · 21 · 22)마다 다시 통과한다. 특히 G03의 `+ 장소 추가`(소제목 줄, 높이 불변)와 `StopActionSheet`의 새 버튼이 지점 카드 3개 무대 점검을 깨지 않는다 → Task 17.
5. **되돌릴 수 없는 버튼 연타** — 동의 · 승인 · 반려 · 완료 · 취소 · 적용 · 연결 · 리뷰 등록이 처리 중 잠기고 요청은 1번 → 각 화면 태스크의 연타 테스트.
6. **막다른 곳** — 2B 뒤 모든 P1 동선에 `곧 열려요.`가 없고, 인증 전 · 심사 중 · 반려 · 가게 없음 계정이 각자 다음 행동을 가진다 → Task 23 스모크 + 각 화면의 상태 표.

> **11/6 대본 게이트(2B-R20):** 컨트롤러 메모. 위 장면이 대본에 들어가면 해당 태스크 뒤에 무대 단언 태스크를 추가한다.

---
### Task 1: 목업 · 테스트 기반 (공통 인프라)

**Files:**
- Create: `src/mocks/db/files.ts`, `src/test/files.ts`
- Modify: `src/mocks/rules/errors.ts`, `src/mocks/handlers/util.ts`, `src/mocks/handlers/demo.ts`(초기화 때 `clearMockFiles()`), `src/shared/lib/errors.ts`, `src/shared/lib/http.ts`, `src/test/setup.ts`, `src/mocks/registry.test.ts`, `src/pages/PlaceholderPage.tsx`, `src/app/shell.test.tsx`, `docs/progress/README.md`
- Test: `src/mocks/handlers/handlers.test.ts`(describe 추가), `src/mocks/db/files.test.ts`, `src/shared/lib/http.test.ts`, `src/shared/lib/errors.test.ts`

**Interfaces:**
- Consumes: 현행 `MockApiError`(`src/mocks/rules/errors.ts`), `withErrors` · `readBody`(`src/mocks/handlers/util.ts`), `toApiError`(`src/shared/lib/http.ts`), `ERROR_CODES` · `ERROR_MESSAGES` · `ErrorCode`, `resetDb`, `server`, `PlaceholderPage`; 2A Task 11의 `STORE_NOT_LINKED` · `P1` 엔드포인트 집합(`registry.test.ts`).
- Produces:
  - `MockApiError(status, code, message?, details?, fieldErrors?: Record<string, string>)` — 다섯째 인자 추가. `withErrors` 응답 본문 `{ code, message, details, fieldErrors }`.
  - `fieldError(field: string, message: string, code: ErrorCode = 'VALIDATION', status = 400): MockApiError` — 본문 message는 코드 표 문구, `fieldErrors = { [field]: message }`.
  - `readForm(request: Request): Promise<FormData>`(multipart가 아니거나 파싱 실패면 `MockApiError(400, 'VALIDATION')`) · `formFile(form: FormData, field: string): File | null`(`instanceof File` 대신 `name` · `type` · `size`가 있는 객체인지 본다 — realm이 달라도 통과).
  - `src/mocks/db/files.ts`: `MOCK_FILE_PREFIX = 'mock-file:'` · `putMockFile(file: Blob): string`(`mock-file:{시각36}-{n}`) · `getMockFile(ref): Blob | null` · `mockFileUrl(ref): string | null`(같은 ref는 같은 object URL, 파일이 없거나 `URL.createObjectURL`이 없으면 null) · `deleteMockFile(ref): void`(object URL도 revoke) · `clearMockFiles(): void`. DB에는 참조 문자열만 둔다.
  - `ErrorCode` 5개 + 문구(제안 문구): `COMPLETE_BEFORE_TOUR_DATE` `탐방 날짜 이후에 완료할 수 있어요.` · `COURSE_STOP_DUPLICATE` `이미 코스에 있는 장소예요.` · `COURSE_STOP_LIMIT` `지점은 최대 5곳까지 넣을 수 있어요.` · `BIZ_NOT_VERIFIED` `사업자 인증을 마친 뒤에 가게를 연결할 수 있어요.` · `ADDRESS_NOT_FOUND` `주소를 찾을 수 없어요. 도로명 주소로 다시 입력해 주세요.`. `BIZ_CLOSED` 문구를 `휴업 또는 폐업한 사업자예요. 계속사업자 정보로 다시 입력해 주세요.`로 교체.
  - `UPLOAD_TIMEOUT_MS = 60_000`(`http.ts`) · 본문 없는 413 → `ApiError(413, 'FILE_TOO_LARGE', errorMessage('FILE_TOO_LARGE'))`(다른 상태는 지금처럼 `UNKNOWN`).
  - `testImage(name = 'student-id.jpg', opts: { type?: string; size?: number } = {}): File`(`src/test/files.ts`, `type` 기본 `image/jpeg`, `size`를 주면 그 크기로 보이게 해 10MB 경계를 시험한다).
  - `src/test/setup.ts`: 모듈 맨 위에서 전역 `FormData` · `File` · `Blob`을 Node 구현으로 바꾼다(`new Response(<multipart>).formData()`로 생성자를 꺼내는 방식, `node:buffer` import 없음) + `afterEach`에 `clearMockFiles()`. jsdom `File`을 담은 `FormData`는 Node `Request.formData()`가 끝나지 않기 때문이다.
  - `registry.test.ts`: `CONTRACT`(29개)는 그대로 두고 `P1_CONTRACT: string[]`(2A가 이미 `GET /api/owner/store`를 넣었다)와의 합집합이 등록 핸들러와 같다고 단언. 뒤 태스크가 자기 엔드포인트를 `P1_CONTRACT`에 더한다(쿼리 문자열은 뺀 경로).
  - `PlaceholderPage` 문구 `description="곧 열려요."`. `shell.test.tsx`: 자리 단언을 `/owner/report`(`곧 열려요.` · `와이어프레임: owner-s04`)로 옮기고, `/owner/store` 단언은 2A 화면에 맞게 유지.
  - 진척 문서: API 연동표에 P1 27행(도메인 열 = `MockDomain`, 계약 합의 ⬜ · 목업 ⬜, #26은 2A가 ✅), 팀 요청 19~23행(19 P1 27개 의견 11/8 · 20 업로드 한도 · multipart 필드 · 413(계약 6절 18) · 21 심사 사진 URL(6절 19) · 22 보호자 메일 · `demoConsentToken` · `X-Demo-Key`(6절 21) · 23 11/6 대본 게이트), 열린 질문에 `리뷰 단계 무대 측정`.

- [ ] **Step 1: 실패하는 테스트** — `handlers.test.ts`: `fieldError('email', '…')` 응답 본문에 `fieldErrors.email`, multipart POST를 받는 임시 핸들러(`server.use`)에서 `readForm` → `formFile(form, 'document')`의 `name`/`size`, JSON 요청은 400 `VALIDATION`. `files.test.ts`: put → get → delete, jsdom에서 `mockFileUrl`은 null, `clearMockFiles` 후 get은 null. `http.test.ts`: 빈 본문 413 → `error.code === 'FILE_TOO_LARGE'`, 기존 업로드 테스트(`FormData` 경계)가 그대로 통과. `errors.test.ts`: 새 코드 5개 모두 `errorMessage`가 위 문구.
- [ ] **Step 2: 실패 확인** — `npm run test:run -- src/mocks src/shared/lib` / FAIL.
- [ ] **Step 3: 구현** — 위 Produces 그대로. 테스트 함정: `userEvent.setup({ applyAccept: false })`로 형식 오류 파일을 올린다(새 export 아님).
- [ ] **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — 위 행 추가, devlog.
- [ ] **Step 6: 커밋** — `test: P1 목업 기반(fieldErrors·multipart·목업 파일·Node FormData)과 새 에러 코드`

---

### Task 2: 시드 병합 (MOCK_DB_VERSION 3 · P1 계정 · 동의 토큰 · 견본 사진)

**Files:**
- Modify: `src/mocks/db/schema.ts`(`MOCK_DB_VERSION = 3`, `TourRow.title: string | null`, `PartnershipRow.condition: string | null`, `tokenHash` 주석 "목업은 평문 토큰"), `src/mocks/db/seed.ts`, `src/mocks/db/files.ts`(`MOCK_DOC_SAMPLE`), `src/shared/config/demoAccounts.ts`, `src/mocks/rules/summaries.ts`(`title ?? 파생 제목`), `src/mocks/rules/views.ts`(`toMyStore`에 `condition`), `src/features/stores/model.ts`(2A, `Partnership.condition: string | null`), `README.md`
- Create: `public/mock-docs/student-id-hs.svg`, `public/mock-docs/student-id-univ.svg`("견본" 표시와 가상 이름만)
- Test: `src/mocks/db/seed.test.ts`, `src/mocks/db/store.test.ts`, `src/mocks/rules/summaries.test.ts`

**Interfaces:**
- Consumes: Task 1 `src/mocks/db/files.ts`; 현행 `createSeed` · `ADMIN_ID` 검사 · `isUsable`(`src/mocks/db/store.ts`) · `getLandingPath` · `toMe`.
- Produces:
  - `DEMO_EMAILS`에 `unverifiedGuide: 'guide-new@demo.kr'` · `ownerUnverified: 'owner-new@demo.kr'` · `ownerNoStore: 'owner-nostore@demo.kr'` 추가(`DemoRole` · `DEMO_ROLES`는 그대로).
  - `DEMO_BUSINESS = { match: { businessNumber: '123-45-67890', representativeName: '정해린', openingDate: '2021-03-02' }, mismatch: { businessNumber: '111-11-11111', … }, closed: { businessNumber: '999-99-99999', … } }` — 일치면 후보 상점 5 · 6.
  - `DEMO_CONSENT_TOKENS = { valid: 'demo-consent-valid', expired: 'demo-consent-expired', rejected: 'demo-consent-rejected', agreed: 'demo-consent-agreed' }`(그 밖의 문자열은 404).
  - `DEMO_P1_ACCOUNTS: readonly { email: string; label: string }[]` — 시연 패널 `P1 계정` 선택지(라벨은 제안 문구): `newbie@demo.kr` `고교생 · 인증 전 (최하늘)` · `waiting@demo.kr` `고교생 · 심사 중 · 동의 대기 (강하린)` · `rejected@demo.kr` `고교생 · 반려 · 동의 거부 (윤서아)` · `expired@demo.kr` `고교생 · 동의 링크 만료 (임채원)` · `pending@demo.kr` `고교생 · 심사 중 · 동의 완료 (오지호)` · `guide-new@demo.kr` `가이드 · 인증 전 (윤가온)` · `guide-pending@demo.kr` `가이드 · 심사 중 (한도윤)` · `guide-rejected@demo.kr` `가이드 · 반려 (서지안)` · `owner-new@demo.kr` `사장님 · 사업자 인증 전 (정해린)` · `owner-nostore@demo.kr` `사장님 · 가게 연결 전 (윤가람)`.
  - `MOCK_DOC_SAMPLE = { HIGH_SCHOOL: '/mock-docs/student-id-hs.svg', UNIVERSITY: '/mock-docs/student-id-univ.svg' } as const`.
  - 시드 계정 8명(운영자 id 18 **뒤**, 이 순서, 비밀번호 모두 `demo1234`, 테스트는 이메일로 찾는다):

| 이메일 · 이름 | 역할 | 재학 인증 | 보호자 동의 · 토큰 | 프로필 · 사업자 | 첫 화면 |
|---|---|---|---|---|---|
| `rejected@demo.kr` 윤서아 | 고교생 | REJECTED, 사유 `학생증 사진이 흐려서 학교 이름을 읽을 수 없어요.`, 제출 `stamp(-3,'20:00')` · 처리 `stamp(-2,'10:00')`, 사진 null | REJECTED · `demo-consent-rejected` | 수원영통고등학교 2학년 · 관심 `시각디자인` | `/verify` |
| `waiting@demo.kr` **강하린** | 고교생 | PENDING, 사진 `/mock-docs/student-id-hs.svg`, 제출 어제 22:40 | PENDING(요청 어제 22:45, 만료 +7일) · `demo-consent-valid` | 수원영통고등학교 2학년 · 관심 `경영학` | `/` |
| `expired@demo.kr` 임채원 | 고교생 | APPROVED(처리 `stamp(-9)`) | PENDING, 만료 어제(→ `EXPIRED`) · `demo-consent-expired` | 용인홍천고등학교 3학년 · 관심 `통번역` | `/verify` |
| `guide-new@demo.kr` 윤가온 | 대학생 | 없음 | — | 가이드 프로필 없음 | `/guide/verify` |
| `guide-pending@demo.kr` 한도윤 | 대학생 | PENDING, 대학 3(단국대), 사진 `/mock-docs/student-id-univ.svg`, 제출 어제 18:05 | — | `{ universityId: 3, major: null, introduction: null }` | `/guide/me/profile`(Task 10 뒤) |
| `guide-rejected@demo.kr` 서지안 | 대학생 | REJECTED, 대학 4(명지대), 사유 `학생증 사진이 흐려 학교 이름을 확인할 수 없어요. 밝은 곳에서 다시 찍어 올려 주세요.`, 사진 null | — | `{ universityId: 4, major: '기계공학과', introduction: '기계공학과 실험 수업과 동아리 생활을 편하게 이야기해 드릴게요.' }` | `/guide/verify` |
| `owner-new@demo.kr` 정해린 | 사장님 | — | — | 사업자 행 없음 · 가게 없음 | `/owner/verify` |
| `owner-nostore@demo.kr` 윤가람 | 사장님 | — | — | 사업자 `isVerified: true`(어제) · 가게 없음 | `/owner/store/connect` |

  - 기존 `pending@demo.kr` 오지호: 사진 `/mock-docs/student-id-hs.svg`, 제출 어제 21:30, 보호자 AGREED · `demo-consent-agreed`. 운영자 대기열 START 3건 = 한도윤 → 오지호 → 강하린(제출 오래된 순). 처리 내역 맨 앞 = 서지안 → 윤서아 → 임채원 → 기존 승인 11건. 체크포인트(`START`~`CONFIRMED`) 정의는 건드리지 않는다. 시드 탐방 · 제휴 행의 새 칸은 `title: null` · `condition: null`(제휴 1~4만 `탐방 당일 · 1회 사용 가능`).
  - 비공개 `student()` · `guide()` 시드 도우미를 넓힌다(반려 사유 · 동의 PENDING/REJECTED/만료 · 토큰 · 제출 시각 · 사진 / 인증 상태 · 프로필 유무). 탐방 요약의 제목은 `row.title ?? 파생 제목`.
  - `README.md` 시연 계정 표 8줄 + 고정 동의 링크 4개(`/consent/demo-consent-valid` 유효 · `-expired` 410 · `-rejected` 이미 처리(거부) · `-agreed` 이미 처리(동의)) + 데모 사업자 번호 3종(`123-45-67890` 일치 → 후보 5 · 6 · `111-11-11111` 불일치 · `999-99-99999` 폐업) + "목업 업로드 사진은 새로고침하면 사라진다" 한 줄.

- [ ] **Step 1: 실패하는 테스트** — `seed.test.ts`: 학생 프로필 11 · 가이드 프로필 7 · 사업자 행 5(모두 인증), 새 8명의 상태 · 토큰 · 첫 화면(`getLandingPath(toMe(...))` — guide-pending은 이 태스크에서는 `/guide/me`, Task 10이 바꾼다), `DEMO_P1_ACCOUNTS` 이메일 전부 존재, 운영자 대기열 START 순서(한도윤 → 오지호 → 강하린), 사진 경로. `store.test.ts`: 같은 날 `seedDay`의 v2 저장본 → `getDb()`가 v3 시드로 바꾸고 `waiting@demo.kr`가 있다. `summaries.test.ts`: `title`이 있으면 그 값, null이면 파생 제목.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현**(위 표 그대로, SVG 두 장은 "견본" 글자 + 가상 이름)
- [ ] **Step 4: 통과 확인** — 전역 검증 명령(체크포인트가 그대로라 골든 패스 E2E가 통과해야 한다).
- [ ] **Step 5: 진척 문서** — devlog 한 줄(시드 v3). **Step 6: 커밋** — `feat: 목업 시드 v3(P1 상태 계정 8명·보호자 동의 토큰·견본 학생증)`

---

### Task 3: 공용 부품 · 탭 · 시연 패널 P1 계정 · 공개 라우트 배지

**Files:**
- Create: `src/shared/ui/{FileField,ToggleSwitch,StarRating}.tsx`, `src/features/verification/components/VerificationStatusCard.tsx`, `src/features/auth/components/LogoutButton.tsx`
- Modify: `src/shared/ui/{Button,buttonStyles}`(변형 `dangerSoft`), `src/app/tabs.ts`, `src/demo/{DemoPanel,RoleBadge}.tsx`, `src/pages/PlaceholderPage.tsx`(`LogoutButton` 사용)
- Test: `src/shared/ui/ui.test.tsx`, `src/demo/demo.test.tsx`, `src/app/shell.test.tsx`

**Interfaces:**
- Consumes: Task 2 `DEMO_P1_ACCOUNTS`; 2A `Button`(변형 `danger` · `soft`) · `ListRow` · `StatusChip` · `InfoCard` · `TABS`(`TabItem.match` · `exclude`); 현행 `useLogout`(`src/features/auth/queries.ts`), `quickLogin`(`src/demo/quickLogin.ts`), `FieldMessages` · `useFieldIds`(`src/shared/ui`), `Select`, `ActionLink` · `Tone`.
- Produces:
  - `FileFieldProps { label: string; description?: string; hint?: string; accept: string; file: File | null; error?: string; disabled?: boolean; validate?(file: File): string | null; onChange(next: { file: File | null; error: string | null }): void }` · `FileField(props)` — V2 카드(brand-soft 사각 아이콘 `↑` + 제목 17/Bold + 설명 13). 숨긴 `<input type="file">`의 접근 이름 = `label`. `validate`가 문자열을 주면 그 파일을 버리고 `onChange({ file: null, error })`. 파일이 있으면 `{파일명} · {크기}`(1MB 미만 `820KB`, 이상 `2.4MB`) 줄과 `다시 고르기`(제안 문구). 고른 뒤 `input.value = ''`. 대화상자 취소는 `onChange`를 부르지 않는다. (검사 함수는 받기만 한다 — 업로드 규칙은 `features/verification`이 가진다.)
  - `ToggleSwitchProps { label: string; description?: string; checked: boolean; onChange(next: boolean): void; disabled?: boolean }` · `ToggleSwitch` — 한 줄 흰 카드 행(왼쪽 라벨 15/Bold + 설명 12 muted, 오른쪽 스위치), `<button role="switch" aria-checked>`, 최소 터치 44.
  - `StarRatingProps { label: string; value: number | null; onChange(value: number): void; name?: string; disabled?: boolean; error?: string; hint?: string }` · `StarRating` — `fieldset`/`legend`, 라디오 5개, 접근 이름 `별점 1점`…`별점 5점`(제안 문구), 선택된 별까지 brand로 채운다. `StarDisplay({ value }: { value: number })` — `role="img"` `aria-label="별점 {value}점"`.
  - `VerificationStatusCardProps { title: string; badge?: { label: string; tone: Tone } | null; rejectionReason?: string | null; description?: ReactNode; action?: ActionLink | null; muted?: boolean; children?: ReactNode }` · `VerificationStatusCard` — 흰 카드(muted면 neutral-100), 제목 + 오른쪽 `StatusChip`, `rejectionReason`이 있으면 danger-soft 줄 `반려 사유: {사유}`(제안 문구), `action`은 soft 버튼 모양 링크. (REJECTED일 때만 `rejectionReason`을 넘긴다.)
  - `LogoutButtonProps { variant?: ButtonVariant | 'row'; size?: ButtonSize; className?: string; description?: string }` · `LogoutButton` — 문구 `로그아웃`, `useLogout()`, 처리 중 `loading`. `variant='row'`면 `ListRow` 모양(제목 `로그아웃`, meta = `description`) — H18 · G13이 쓴다. 기본 `secondary`(PlaceholderPage 기존 모양).
  - `Button variant="dangerSoft"`(danger-soft 바탕 · danger 글자 · 높이 56 · 반경 16) — A02 `반려 사유 입력`.
  - `TABS.OWNER` `내 가게` match에 `/owner/verify` 추가. (`TABS.UNIVERSITY` `MY`는 2A가 이미 `['/guide/me', '/guide/verify']`, 고교생 `MY`는 `match: ['/verify']`를 여기서 추가.)
  - `RoleBadge`: 주소가 `/signup`이거나 `/consent/`로 시작하면 그리지 않는다(`useLocation`).
  - `DemoPanel`: 비공개 `Action`에 `'account'`, 비공개 `DemoActions.switchAccount(email: string): void`(`quickLogin({ email }, deps)` 재사용). **전체 패널에만** `Select label="P1 계정"`(선택지 `DEMO_P1_ACCOUNTS`) + `Button size="sm" variant="secondary"` `이 계정으로 전환`(제안 문구). 발표 막대 · `DemoRole`은 그대로.

- [ ] **Step 1: 실패하는 테스트** — `ui.test.tsx`: `FileField`(`getByLabelText(label)`로 파일 선택, `validate` 문자열이면 `onChange({ file: null, error })`, 통과하면 `{파일명} · 2.4MB`, 취소는 콜백 없음), `ToggleSwitch`(`role=switch` 토글 · `aria-checked`), `StarRating`(`별점 4점` 선택 → `onChange(4)`, `StarDisplay` 접근 이름), `VerificationStatusCard`(반려 사유 줄 · action 링크), `Button variant="dangerSoft"`. `demo.test.tsx`: 전체 패널에서 `P1 계정` → `guide-new@demo.kr` → `이 계정으로 전환` → `/guide/verify`; 발표 모드 막대에는 이 Select가 없다; `/signup` · `/consent/x`에서 역할 배지가 없다. `shell.test.tsx`: 고교생 `/verify` · 가이드 `/guide/verify`에서 `MY` 탭 `aria-current="page"`, 사장님 `/owner/verify`에서 `내 가게` 탭 활성.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 전역 검증 명령(`e2e/golden-path.spec.ts`가 전체 패널을 쓰므로 E2E를 재실행한다).
- [ ] **Step 5: 진척 문서** — devlog. **Step 6: 커밋** — `feat: P1 공용 부품(파일 칸·토글·별점·인증 카드·로그아웃)과 시연 패널 P1 계정`

---

### Task 4: auth API #1~#3 · 개설 차단 판정 · `activeDemoEmail` 정리

**Files:**
- Create: `src/features/auth/guide.ts`(+`guide.test.ts`), `src/mocks/rules/auth.ts`(+`auth.test.ts`)
- Modify: `src/features/auth/{model,api,queries}.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/handlers/auth.ts`, `src/demo/{demoStore,quickLogin,resetDemo}.ts`, `src/mocks/registry.test.ts`
- Test: `src/mocks/handlers/handlers.test.ts`(describe 추가), `src/demo/demo.test.tsx`, `src/demo/demoParams.test.ts` · `resetDemo.test.ts`(초기화 필드 `activeDemoToken: null`)

**Interfaces:**
- Consumes: Task 1 `fieldError` · `P1_CONTRACT`; 현행 `login`(`src/features/auth/api.ts`), `useLogin` · `meQueryOptions`(`queries.ts`), `useSession`(`session.ts`), `Role` · `Me` · `LoginResponse` · `GuideProfile`, `ActionLink`, `errorMessage`, `createSession` · `nextId`(`src/mocks/db`), `toMe`, `requireUser` · `readBody`, `useDemoStore`.
- Produces:
  - `model.ts`:
    - `SignupRole = Exclude<Role, 'ADMIN'>`
    - `SIGNUP_ROLES: readonly SignupRole[] = ['HIGH_SCHOOL', 'UNIVERSITY', 'OWNER']`
    - `SignupInput { email; password; name; role: SignupRole }`
    - `StudentProfileInput { name: string; highSchoolName: string | null; grade: number | null; interestedMajor: string | null }`(PUT, 네 키를 모두 보낸다)
    - `GuideProfileInput { major: string; introduction: string | null }`(학교는 받지 않는다)
    - 상수 `PASSWORD_MIN_LENGTH = 8`
    - `EMAIL_MAX_LENGTH = 255`
    - `PROFILE_TEXT_MAX = 100`
    - `GUIDE_MAJOR_MAX = 30`
    - `GUIDE_INTRO_MAX = 300`. JSDoc: `GuideProfile.universityId` = 최근 재학 인증 제출 대학(서버가 #5 때 맞춤)
    - `Me.rejectionReason`은 `REJECTED`일 때만 그린다.
  - `api.ts`: `postSignup(input: SignupInput): Promise<LoginResponse>`(`auth: false`, 응답에 token이 없으면 같은 자격으로 `login()`을 잇는다) · `putStudentProfile(input): Promise<Me>` · `putGuideProfile(input): Promise<Me>`.
  - `queries.ts`: `useSignup()`(성공: `queryClient.clear()` → `setToken` → `setQueryData(qk.me, me)` — `useLogin`과 같은 순서, 이동은 화면) · `useUpdateStudentProfile()`(`setQueryData(qk.me)`) · `useSaveGuideProfile()`(`setQueryData(qk.me)` + `qk.guideTours` · `qk.allApplicants` · `qk.allGuideCourses` · `qk.allTours` 무효화) · `refetchMe(queryClient: QueryClient): Promise<Me>`(`staleTime: 0` `fetchQuery`).
  - `qk.allTours = ['tours']` · `qk.allApplicants = ['applicants']` · `qk.allGuideCourses = ['guideCourse']`(각 `qk.tours`·`qk.tour` / `qk.applicants(id)` / `qk.guideCourse(id)`의 접두사).
  - `guide.ts`: `hasGuideProfile(me: Me): boolean`(`(me.guideProfile?.major ?? '').trim() !== ''`) · `TourCreateBlock { code: 'NOT_VERIFIED' | 'GUIDE_PROFILE_REQUIRED'; chip: string; reason: string; action: ActionLink }` · `tourCreateBlock(me: Me): TourCreateBlock | null` — 위에서부터 첫 조건:

| 조건 | code | chip | reason | action |
|---|---|---|---|---|
| 인증 NONE · REJECTED | `NOT_VERIFIED` | `재학 인증 승인 필요` | `학생증 또는 재학증명서 인증 후에만 탐방을 개설할 수 있어요.` | `역할 인증 단계로 이동` → `/guide/verify` |
| PENDING + 학과 없음 | `NOT_VERIFIED` | 같음 | `승인 전에는 탐방을 개설할 수 없습니다.` | `가이드 프로필 작성하기`(제안 문구) → `/guide/me/profile` |
| PENDING + 학과 있음 | `NOT_VERIFIED` | 같음 | 같음 | `인증 상태 보기`(제안 문구) → `/guide/verify` |
| APPROVED + 학과 없음 | `GUIDE_PROFILE_REQUIRED` | `가이드 프로필 작성 필요`(제안 문구) | `errorMessage('GUIDE_PROFILE_REQUIRED')` | `가이드 프로필 작성하기` → `/guide/me/profile` |
| APPROVED + 학과 있음 | — | — | — | `null` |

  - 목업 `src/mocks/rules/auth.ts`:
    - `signUp(db, input, now): UserRow`(email trim · 소문자 → 형식 · 255자 → password 8자 이상 → name 1~100자 → role ∈ `SIGNUP_ROLES` → 중복(소문자 비교) 순, 고교생은 빈 학생 프로필 · 대학생은 빈 가이드 프로필 행; `fieldError`로 `email` · `password` · `name` · `role` / `EMAIL_DUPLICATE` 409 `fieldErrors.email`)
    - `updateStudentProfile(db, userId, input, now)`(`name` 1~100을 `users.name`에 반영, `highSchoolName` · `interestedMajor` ≤100, `grade` 1~3 또는 null, 행이 없으면 만든다)
    - `saveGuideProfile(db, userId, input, now)`(`major` 1~30 · `introduction` ≤300 `''` → null, `universityId` = 인증 행 ?? 기존 ?? null). 핸들러: `POST /auth/signup`(**201**, `createSession` + `toMe`, `requireUser` 없음)
    - `PUT /me/student-profile`(HIGH_SCHOOL)
    - `PUT /me/guide-profile`(UNIVERSITY). `P1_CONTRACT` += `POST /api/auth/signup`
    - `PUT /api/me/student-profile`
    - `PUT /api/me/guide-profile`.
  - `demoStore`: `activeDemoToken: string | null` · `setActiveDemoToken(token)`. `quickLogin`은 `setToken` 직전에, 비공개 `recoverDemoSession`도 다시 받은 토큰을 넣기 직전에 `setActiveDemoToken(token)`. `connectDemoSession` 구독은 "`activeDemoEmail !== null`이고 (`token === null` 또는 `token !== activeDemoToken`)이면 `activeDemoEmail` · `activeDemoToken`을 비운다". `resetDemo`도 `setActiveDemoToken(null)`.

- [ ] **Step 1: 실패하는 테스트** — `guide.test.ts`(표 5갈래 + `hasGuideProfile`). `auth.test.ts`(검사 순서: 잘못된 이메일 · 짧은 비밀번호 · 빈 이름 · 모르는 역할 · 대소문자만 다른 중복 → `EMAIL_DUPLICATE`, 성공 시 역할별 빈 프로필 행, 프로필 저장의 `name`이 `toMe(...).name`에 반영, 가이드 학과 31자 거부). `handlers.test.ts`: 가입 201 + 토큰, 가입 응답으로 `/me` 조회, `fieldErrors.email`. `demo.test.tsx`: 빠른 로그인 → 가입(또는 수동 로그인)하면 `activeDemoEmail`이 비워지고 401에서 시연 계정으로 되돌려 로그인하지 않는다; 기존 자동 재로그인 · 로그아웃 테스트는 그대로 통과.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령(`quickLogin`을 고쳤으므로 E2E 포함).
- [ ] **Step 5: 진척 문서** — API 표 #1 · #2 · #3 목업 ✅, devlog. **Step 6: 커밋** — `feat: 가입·프로필 API(#1~#3)와 탐방 개설 차단 판정, 가입 뒤 시연 계정 기록 정리`

---

### Task 5: 인증 API #4~#9 · `features/verification`

**Files:**
- Create: `src/features/verification/{model,api,queries}.ts`(+`model.test.ts`), `src/mocks/rules/verification.ts`(+`.test.ts`), `src/mocks/handlers/verification.ts`
- Modify: `src/mocks/rules/views.ts`(`guardianStatusOf` export · `toVerificationOverview` · `toConsentRequest`), `src/mocks/registry.ts`(`verification: verificationHandlers`), `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/handlers/handlers.test.ts`
- Test: 위 `.test.ts`들

**Interfaces:**
- Consumes: Task 1 `readForm` · `formFile` · `fieldError` · `putMockFile` · `UPLOAD_TIMEOUT_MS` · `testImage`; Task 2 시드 · `DEMO_CONSENT_TOKENS`; Task 4 `refetchMe` · `PROFILE_TEXT_MAX` · `EMAIL_MAX_LENGTH`; 현행 `upload` · `request`(`src/shared/lib/http.ts`), `VerificationStatus` · `GuardianStatus` · `Me`, `Tone`, `requireUser`, `mutate` · `getDb`, `nextId`.
- Produces(타입은 계약 4절 그대로): `StudentVerificationView` · `GuardianConsentView` · `VerificationOverview` · `GuardianConsentInput { guardianName; guardianEmail }` · `ConsentRequest` · `ConsentDecision = 'AGREED' | 'REJECTED'` · `StudentVerificationSubmit = { role: 'HIGH_SCHOOL'; highSchoolName: string; grade: number; document: File } | { role: 'UNIVERSITY'; universityId: number; document: File }`.
  - `model.ts` 상수 · 함수:
    - `PROOF_MAX_BYTES = 10 * 1024 * 1024`
    - `PROOF_ACCEPT = 'image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif'`
    - `validateProofFile(f: { name; type; size }): 'FILE_TYPE' | 'FILE_TOO_LARGE' | null`(형식 → 용량, 정확히 10MB 통과)
    - `proofFileError(f): string | null`(`FileField validate`용 `errorMessage`)
    - `canSubmitVerification(status): boolean`(NONE · REJECTED)
    - 라벨 `VERIFICATION_STATUS_LABEL`(`미제출` · `심사 중` · `승인` · `반려`)
    - `GUARDIAN_STATUS_LABEL`(`미요청` · `동의 대기` · `동의 완료` · `거부` · `링크 만료`)
    - 톤 `VERIFICATION_TONE`(neutral · info · success · danger)
    - `GUARDIAN_TONE`(neutral · info · success · danger · warning)
    - `StudentStep = 'FORM' | 'IN_REVIEW' | 'RESUBMIT' | 'DONE'`
    - `GuardianStep = 'FORM' | 'WAITING' | 'REREQUEST' | 'DONE'`
    - `verifySteps(s: { verificationStatus; guardianStatus }): { student: StudentStep; guardian: GuardianStep; done: boolean }`(NONE→FORM · PENDING→IN_REVIEW/WAITING · REJECTED→RESUBMIT/REREQUEST(동의는 REJECTED · EXPIRED) · APPROVED/AGREED→DONE).
  - `api.ts`: `getMyVerification()` · `postStudentVerification(input: StudentVerificationSubmit)`(`upload`, 값은 문자열, `timeoutMs: UPLOAD_TIMEOUT_MS`) · `postGuardianConsent(input)` · `getConsent(token)` · `postAgreeConsent(token)` · `postRejectConsent(token)`(마지막 셋은 `auth: false`).
  - `queries.ts`: `useMyVerification()`(`qk.myVerification`) · `useSubmitStudentVerification(): UseMutationResult<Me, ApiError, StudentVerificationSubmit>`(2B-R7: API → `setQueryData(qk.myVerification)` → `refetchMe`, `ALREADY_PROCESSED`면 `qk.myVerification` · `qk.me` 무효화) · `useRequestGuardianConsent()`(성공: `setQueryData(qk.myVerification)` + `await refetchMe`, 409 무효화) · `useConsent(token)`(`qk.consent(token)`) · `useDecideConsent(token): UseMutationResult<ConsentRequest, ApiError, ConsentDecision>`(성공: `setQueryData(qk.consent(token))` + `qk.me` · `qk.myVerification` 무효화, 실패: `qk.consent(token)` 무효화).
  - `qk.myVerification = ['myVerification']` · `qk.consent(token) = ['consent', token]`.
  - 목업 `rules/verification.ts`:
    - `CONSENT_LINK_DAYS = 7`
    - `submitStudentVerification(db, userId, fields, document: File | null, now)`(역할 아님 403 → PENDING · APPROVED면 409 `ALREADY_PROCESSED` → 파일 없음 `fieldError('document')` → `validateProofFile`: 400 `FILE_TYPE` / 413 `FILE_TOO_LARGE` → 고교생 `highSchoolName` 1~100 · `grade` `'1'`~`'3'` / 대학생 `universityId`(5개교, 문구 `5개교 이외 학교 선택 시 제출할 수 없어요.`) → `putMockFile` → 인증 행 upsert(PENDING, 사유 null, `documentUrl` = 참조, `submittedAt` now, `reviewed*` null) → 고교생은 학생 프로필 학교 · 학년, 대학생은 `guideProfiles.universityId`)
    - `requestGuardianConsent(db, userId, input, now)`(역할 403 → AGREED면 409 → `guardianName` 1~100 · `guardianEmail` 형식 · 255 → upsert: 토큰 `consent-{userId}-{nextId}`, PENDING, 만료 now+7일, 예전 토큰은 404)
    - `findConsent(db, token, now)`(없음 404 `CONSENT_LINK_INVALID` → PENDING이고 기한 지남 410 `CONSENT_LINK_EXPIRED`, 처리된 링크는 만료여도 그 행)
    - `decideConsent(db, token, decision, now)`(PENDING 아니면 409 `ALREADY_PROCESSED`, 토큰은 남긴다). DTO: `toVerificationOverview(db, userId, now)`(`demoConsentToken` = 행의 토큰, 대학생 `guardian` null)
    - `toConsentRequest(db, row)`(`decidedAt`: AGREED = `agreedAt`, REJECTED = `updatedAt`). 핸들러 `verificationHandlers`: `GET /me/verification`(고교생 · 대학생 외 403)
    - `POST /me/student-verification`(`readForm` → `formFile(form, 'document')`)
    - `POST /me/guardian-consent`(HIGH_SCHOOL)
    - `GET /guardian-consents/:token`
    - `POST …/:token/agree`
    - `POST …/:token/reject`(셋 다 `requireUser` 없음). `P1_CONTRACT` += 6.

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`: `validateProofFile` 표(`.JPG` 통과 · MIME 빈 `.heic` 통과 · `application/pdf` → `FILE_TYPE` · 정확히 10MB 통과 · 10MB+1 → `FILE_TOO_LARGE`), `verifySteps` 전 조합, 라벨 · 톤. `verification.test.ts`: 검사 순서(역할 → 409 → 파일 → 형식 → 용량 → 필드), 대학생 제출이 `guideProfiles.universityId`를 맞춘다, 재요청이 예전 토큰을 404로 만든다, 만료 링크 410 · 처리된 만료 링크는 200, `decideConsent` 두 번째는 409. `handlers.test.ts`: multipart 업로드(`testImage`) → `PENDING`, 토큰 없이 `GET /guardian-consents/:token`이 401 없이 200, 413. `http` 계열: `postStudentVerification`이 `Authorization` 헤더를 붙이고 `getConsent`는 붙이지 않는다.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — API 표 #4~#9 목업 ✅, devlog. **Step 6: 커밋** — `feat: 재학 인증·보호자 동의 API(#4~#9)와 features/verification`

---

### Task 6: `/signup` (hs-a01, V2에 없음)

**Files:**
- Create: `src/pages/auth/SignupPage.tsx`(+`SignupPage.test.tsx`)
- Modify: `src/app/routes.tsx`(`/signup` 자리 → `<SignupPage />`), `src/pages/auth/LoginPage.tsx`(`새 계정 만들기` 링크 모양만 V2에 맞게, 문구 유지)

**Interfaces:**
- Consumes: Task 4 `useSignup` · `SIGNUP_ROLES` · `SignupRole` · `PASSWORD_MIN_LENGTH` · `PROFILE_TEXT_MAX` · `EMAIL_MAX_LENGTH`; 2A `PageHeading` · `BrandMark` · `Button` · `TextField` · `InfoCard` · `StatusChip`; 현행 `getLandingPath`, `preventImeEnter`, `ApiError`, `errorMessage`, 로그인 폼 패턴(`LoginPage.tsx`).
- Produces: `SignupPage(): JSX.Element`(역할 라디오 카드는 파일 안 지역 컴포넌트).

| 위치 | 문구 | 출처 |
|---|---|---|
| TopBar(뒤로 없음, 공개 라우트라 탭 없음) | `회원가입 · 역할 선택` | wireframes.md hs-a01 |
| `StatusChip` | `신규 회원가입 · 역할 1개 선택` | hs-a01 |
| 필드 | `이메일 주소` · `비밀번호` · `이름`(제안 위치: 비밀번호 아래) | hs-a01.png · 계약 #1 |
| legend | `가입 유형을 선택해 주세요` | hs-a01 |
| 라디오 카드(기본 고등학생, `name="role"`) | `고등학생` / `캠퍼스 탐방을 추천받고 신청해요.` · `대학생 가이드` / `개인 자율 탐방을 개설하고 관리해요.` · `사장님` / `상점을 연결하고 방문 쿠폰을 처리해요.` | hs-a01 |
| 제출 버튼 | `계정 생성하고 인증하기` | hs-a01.png |
| 링크 | `이미 계정이 있다면 로그인하기` → `/login` | hs-a01 |

- 검증(Zod, 제출 때): 이메일 `이메일 주소를 입력해 주세요.` · `이메일 주소 형식을 확인해 주세요.` · 255자 초과 `이메일 주소가 너무 길어요.`(제안), 비밀번호 `비밀번호를 입력해 주세요.` · `비밀번호는 8자 이상으로 정해 주세요.`(제안), 이름 `이름을 입력해 주세요.` · `이름은 100자 이내로 적어 주세요.`(제안). 서버 `EMAIL_DUPLICATE` → 이메일 칸 아래 `이미 가입된 이메일이에요.` + 같은 줄 링크 `로그인하기`, `VALIDATION`의 `fieldErrors`는 같은 이름 칸 아래(`setError`), 모르는 키 · `NETWORK` · `TIMEOUT`은 버튼 위 `role="alert"` 한 줄(다시 입력하면 지운다). 성공 → `navigate(getLandingPath(me), { replace: true })` — 고교생 `/verify` · 대학생 `/guide/verify` · 사장님 `/owner/verify`. `?next=`는 따르지 않는다.

- [ ] **Step 1: 실패하는 테스트** — 빈 제출 → 세 칸 오류, 짧은 비밀번호, 이미 가입된 이메일(`student@demo.kr`) → 칸 아래 문구 + `로그인하기` 링크, 역할별 성공 이동(고교생 `/verify`, 대학생 `/guide/verify`, 사장님 `/owner/verify`), 성공 뒤 `useSession` 토큰이 새 계정 · `qk.me.name`이 입력한 이름, 이름 칸 한글 IME 조합 중 Enter는 제출하지 않음, 연타해도 가입 요청 1번(목업 지연), `/login`의 `새 계정 만들기` → `/signup`.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — 화면 표 hs-a01 `✅`(V2에 없는 화면: 와이어 + V2 부품), devlog. **Step 6: 커밋** — `feat: 회원가입 화면(/signup)`

---

### Task 7: `/consent/:token` 보호자 동의 (hs-a02, V2에 없음)

**Files:**
- Create: `src/pages/public/ConsentPage.tsx`(+`ConsentPage.test.tsx`)
- Modify: `src/app/routes.tsx`(`/consent/:token` 자리 → `<ConsentPage />`)

**Interfaces:**
- Consumes: Task 5 `useConsent` · `useDecideConsent` · `ConsentRequest` · `ConsentDecision`; Task 2 `DEMO_CONSENT_TOKENS`(테스트); 2A `Button` · `InfoCard tone` · `StatusChip` · `PageHeading`; 현행 `useSession`(`src/features/auth/session.ts`), `formatMonthDay`(`src/shared/lib/date.ts`), `ErrorState`, `Skeleton`, `TopBar`, `ApiError`.
- Produces: `ConsentPage(): JSX.Element` — 공개 라우트(탭 · 로그인 없음), 모든 요청 `auth: false`. 돌아가기 링크는 `useSession((s) => s.token) !== null`일 때만(2B-R8).

| 위치 · 상태 | 문구 | 출처 |
|---|---|---|
| TopBar(뒤로 없음) | `보호자 동의 페이지` | wireframes hs-a02 |
| `StatusChip` | `고교생 보호자 전용 링크` | hs-a02 |
| 카드 | `캠퍼스 탐방 참여 동의` / `재학생 개인 가이드가 진행하는 비공식 자율형 캠퍼스 탐방입니다.` · `탐방 방식 및 안전 안내` / `참가 신청 후 가이드 승인 · 오픈채팅 연결 · 캠퍼스와 주변 상점 방문` | hs-a02.png |
| 소제목 · muted 카드 | `동의 대상` · `학생: {studentName} · 고등학교 {studentGrade}학년`(학년 없으면 `학생: {studentName}`) / `탐방 신청 및 관련 정보 제공에 동의합니다.` | hs-a02 |
| 버튼 | `안내 확인 후 동의하기`(primary) · `동의하지 않기`(secondary, 확인 창 없음) | hs-a02.png |
| 각주 | `링크 만료 시 학생에게 재요청을 안내합니다.` | hs-a02.png |
| 동의함(방금 · 이미) | 결과 카드 `동의를 마쳤어요` / `{M월 D일} 동의했어요.` | 제안 문구 |
| 거부함(방금 · 이미) | `동의하지 않았어요` / `마음이 바뀌면 학생에게 다시 요청해 달라고 해 주세요.` | 제안 문구 |
| 만료(410) | 카드 `errorMessage('CONSENT_LINK_EXPIRED')`, 버튼 없음 | 에러 표 |
| 잘못된 링크(404) | 카드 `errorMessage('CONSENT_LINK_INVALID')` + `메일의 링크를 다시 눌러 보거나, 학생에게 새 링크를 요청해 주세요.` | 제안 문구 |
| 토큰 세션이 있을 때 결과 카드 아래 | 링크 `학생 화면으로 돌아가기` → `/verify` | 제안 문구 |

- 상태: 로딩 = 칩 아래 `Skeleton` 3개, 그 밖 오류(NETWORK · 5xx) = `ErrorState` + `다시 시도`. 처리 중 두 버튼 모두 잠그고 누른 쪽에 스피너. 409 `ALREADY_PROCESSED` → 토스트 + 다시 조회해 결과 카드. 방금 처리와 이미 처리는 같은 카드로 그린다.

- [ ] **Step 1: 실패하는 테스트** — `demo-consent-valid`: 본문 표 전체, 동의 → `동의를 마쳤어요`, 거부 → `동의하지 않았어요`. `-expired` → 만료 카드 · 버튼 없음, `-agreed` · `-rejected` → 처리 완료 카드, `bad-token` → 잘못된 링크 카드. 토큰 세션 없이는 돌아가기 링크가 없다. 연타해도 요청 1번. **통합**: `waiting@demo.kr`로 `/consent/demo-consent-valid`를 열고 동의 → 같은 앱 안 `/verify`로 이동하면 새로고침 없이 STEP 2가 `동의 완료`(Task 8 뒤에 이 단언을 Task 8 테스트로 옮긴다 — 여기서는 `qk.me` · `qk.myVerification`이 무효화됐는지만).
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — hs-a02 ✅, API 표 #7~#9 화면 연결, devlog. **Step 6: 커밋** — `feat: 보호자 동의 페이지(/consent/:token)`

---

### Task 8: `/verify` 재학 인증 · 보호자 동의 (hs-s02, V2에 없음)

**Files:**
- Create: `src/pages/student/VerifyPage.tsx`(+`VerifyPage.test.tsx`)
- Modify: `src/app/routes.tsx`(`/verify`)

**Interfaces:**
- Consumes: Task 5 `useMyVerification` · `useSubmitStudentVerification` · `useRequestGuardianConsent` · `verifySteps` · `VERIFICATION_STATUS_LABEL` · `VERIFICATION_TONE` · `GUARDIAN_STATUS_LABEL` · `GUARDIAN_TONE` · `PROOF_ACCEPT` · `proofFileError` · `StudentVerificationSubmit`; Task 3 `FileField` · `VerificationStatusCard`; Task 4 `PROFILE_TEXT_MAX` · `EMAIL_MAX_LENGTH`; Task 1 `testImage`; Task 2 계정(`newbie` · `waiting` · `rejected` · `expired` · `pending`); 2A `Button` · `TextField` · `Select` · `StatusChip` · `InfoCard`; 현행 `useMe`, `formatMonthDay` · `formatTime`.
- Produces: `VerifyPage(): JSX.Element` — TopBar 뒤로 없음 · 하단 탭(MY 활성, 2B-R6).

| # | 블록 | 문구 | 출처 |
|---|---|---|---|
| 1 | TopBar | `인증하고 탐방 신청하기` | wireframes hs-s02 |
| 2 | `StatusChip` | `STEP 1 · 재학 인증 / STEP 2 · 보호자` | hs-s02.png |
| 3 | 완료 카드(둘 다 DONE일 때만, `InfoCard tone="brand"`) | `인증이 끝났어요` / `이제 탐방을 신청할 수 있어요.` + 링크 `탐방 찾아보기` → `/` | 제안 문구 |
| 4 | 카드 STEP 1 | 제목 `STEP 1 · 재학 인증` + 배지(`VERIFICATION_STATUS_LABEL`) | 설계 5.4 |
| 5 | 카드 STEP 2 | 제목 `STEP 2 · 보호자 동의 요청` + 배지(`GUARDIAN_STATUS_LABEL`) | wireframes hs-s02 |
| 6 | 각주 + 링크 | `인증 전에도 홈과 탐방 목록은 둘러볼 수 있어요.` + `홈 둘러보기` → `/`(제안 문구) | hs-s02 |

- **STEP 1:** FORM · RESUBMIT = 소제목 `학교 · 학년` + `TextField` `학교 이름`(hint `예: 수원영통고등학교`, 제안 문구; 초깃값 `useMe().studentProfile`) + `Select` `학년 선택`(`1학년` · `2학년` · `3학년`) + `FileField`(제목 `학생증 / 재학증명서 업로드`, 설명 `사진 업로드 후 심사 중 상태로 전환`, hint `jpg · png · heic, 10MB 이하`(제안 문구), `accept={PROOF_ACCEPT}`, `validate={proofFileError}`) + 버튼 `재학 인증 제출하기`. RESUBMIT은 맨 위에 `VerificationStatusCard`의 `rejectionReason`(`반려 사유: {사유}`). IN_REVIEW = 폼 없음 + `운영자가 학생증을 확인하고 있어요. 결과는 여기와 내 정보에서 볼 수 있어요.` · `제출 {M월 D일}`(제안 문구). DONE = `학생증 심사 완료`.
- **STEP 2:** FORM = `TextField` `보호자 성함` · `보호자 이메일` + 버튼 `동의 링크 보내기`. WAITING = `{guardianEmail}로 동의 링크를 보냈어요. {M월 D일 HH:mm}까지 열 수 있어요.` + 직전 값이 찬 같은 폼 + 버튼 `동의 링크 다시 보내기` + hint `다시 보내면 예전 링크는 열리지 않아요.`(제안 문구) + `demoConsentToken`이 있으면 링크 `보호자 페이지 열기`(→ `/consent/{token}`) + 배지 `시연`. REREQUEST = REJECTED `보호자가 동의하지 않았어요. 이야기를 나눈 뒤 다시 요청해 주세요.` / EXPIRED `동의 링크가 만료됐어요. 다시 보내 주세요.` + 폼(직전 값) + `동의 링크 보내기`. DONE = `보호자가 동의했어요 · {M월 D일}`(전부 제안 문구). 두 카드는 따로 제출하는 별도 `<form>`이고 순서 제약이 없다.
- 검증: `학교 이름을 입력해 주세요.` · `100자 이내로 적어 주세요.` · `학년을 골라 주세요.` · `학생증 사진을 올려 주세요.` · 파일 오류는 `FileField` 아래 `errorMessage('FILE_TYPE'|'FILE_TOO_LARGE')`(서버 값도 같은 자리, 고른 파일은 비움) · `보호자 성함을 입력해 주세요.` · `보호자 이메일을 입력해 주세요.` · `이메일 주소 형식을 확인해 주세요.`(전부 제안 문구). 409 `ALREADY_PROCESSED` → 토스트 + 다시 조회. 로딩 = 칩 아래 `Skeleton` 2개, 데이터 없는 오류 = `ErrorState`.

- [ ] **Step 1: 실패하는 테스트** — `newbie`: FORM 두 카드, 학교 · 학년 · 사진(`testImage`) 후 제출 → 배지 `심사 중` + 폼 사라짐 + `qk.me`가 PENDING; PDF → 칸 아래 `jpg, png, heic 이미지만 올릴 수 있어요.`, 10MB+1 → `10MB 이하 이미지만 올릴 수 있어요.`, 정확히 10MB 통과; `rejected`: 반려 사유 줄 + 학교 직전 값, 거부된 보호자 안내; `expired`: `동의 링크가 만료됐어요. 다시 보내 주세요.` + 재요청하면 `동의 대기`; `waiting`: `보호자 페이지 열기` → 동의 → 돌아가기 → 새로고침 없이 `동의 완료`(**같은 탭 통합**, Review Focus 2); `pending`/`student`: DONE 완료 카드. 연타해도 제출 1번. 하단 탭 `MY` 활성, TopBar 뒤로 없음.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — hs-s02 ✅, API 표 #4 · #5 · #6 화면 연결, devlog. **Step 6: 커밋** — `feat: 재학 인증·보호자 동의 화면(/verify)`

---
### Task 9: 고교생 MY · 내 정보 수정 · 알림 및 설정 (H16 · H17 · H18)

**Files:**
- Create: `src/pages/student/{MePage,MeEditPage,MeSettingsPage}.tsx`(+테스트 `MePages.test.tsx`), `src/features/settings/settingsStore.ts`(+test), `src/features/auth/profile.ts`(+test)
- Modify: `src/app/routes.tsx`(`/me` 자리 → `MePage`, 새 `/me/edit` · `/me/settings`), `src/features/applications/model.ts`(`completedTourCount`), `src/app/shell.test.tsx` · `src/demo/demo.test.tsx`(`/me`에서 `로그아웃`을 찾던 단언을 `/me/settings`로)

**Interfaces:**
- Consumes: Task 4 `useUpdateStudentProfile` · `StudentProfileInput` · `PROFILE_TEXT_MAX`; Task 3 `ToggleSwitch` · `LogoutButton`(`variant="row"`); Task 5 `verifySteps`; 2A `PageHeading` · `BrandMark` · `ListRow` · `InfoCard` · `StatusChip` · `Button` · `TextField`; 현행 `useMe`, `useMyApplications`(`src/features/applications/queries.ts`), `preventImeEnter`.
- Produces:
  - `profile.ts`: `splitInterests(text: string | null): string[]`(`,` `·` `/` 기준으로 나눠 trim, 빈 것 제외) · `verificationBadge(status: VerificationStatus): { label: string; tone: Tone }` — APPROVED `학생증 인증 완료`(success, V2) · PENDING `학생증 심사 중`(info) · REJECTED `학생증 인증 반려`(danger) · NONE `학생증 인증 전`(neutral)(뒤 셋은 제안 문구).
  - `completedTourCount(apps: MyApplication[]): number` — 신청 APPROVED이고 탐방 COMPLETED인 개수.
  - `settingsStore.ts`: `SettingKey = 'studentApproval' | 'studentSchedule' | 'guideNewApplicant' | 'guidePending' | 'guideSchedule'` · `useSettingsStore`(zustand persist, 이름 `ytt.settings`, `version: 1`, 값 `Record<SettingKey, boolean>` 기본 전부 true, `set(key: SettingKey, value: boolean): void`). 2B-R3.
  - H16(노드 `2:582`, `/me`, TopBar 없음): `BrandMark` · `PageHeading('MY', '내 정보와 탐방 기록을 한곳에서 관리해요.')` · 프로필 카드(이름 첫 글자 원 아바타, 이름, `고교생 · 탐방을 준비하는 중`, `verificationBadge` 글자) · 숫자 카드 둘(`{completedTourCount}회` / `참여한 탐방` · `{splitInterests(interestedMajor).length}개` / `관심 전공`, brand-soft) · 소제목 `나의 활동` · `ListRow` 셋: `지난 탐방` / `완료한 캠퍼스 탐방과 후기를 확인해요.` → `/my-tours?tab=past` · `내 정보 수정` / `이름·학교·관심 분야를 관리해요.` → `/me/edit` · `알림 및 설정` / `탐방 알림과 계정 설정을 변경해요.` → `/me/settings`. 인증이 안 끝났으면(`verifySteps(me).done === false`) 소제목 위에 `InfoCard tone="brand"` `인증을 마치면 탐방을 신청할 수 있어요.` + `인증 이어하기 ›` → `/verify`(제안 문구, 막다른 곳 방지).
  - H17(노드 `2:608`, `/me/edit`): TopBar `내 정보 수정`(뒤로 → `/me`) · `PageHeading('내 정보를 업데이트해요.', '탐방 신청에 사용하는 기본 프로필이에요.')` · 필드 `이름`(필수 1~100) · `학교`(placeholder `재학 중인 고등학교`, ≤100) · `이메일`(읽기 전용) · `관심 전공`(placeholder `예: 디자인 · 산업디자인`, ≤100) · 안내 `코스 추천은 각 탐방 신청서에 작성한 ‘하고 싶은 것’을 기준으로 생성돼요.` · 버튼 `변경사항 저장`. 학년은 칸이 없고 **기존 값을 그대로 PUT**한다(재학 인증 제출이 정한 값을 지우지 않는다). 성공 → 토스트 `내 정보를 저장했어요.`(제안 문구) + `/me`로 이동. 오류 문구(제안): `이름을 입력해 주세요.` · `100자 이내로 적어 주세요.`, `VALIDATION`은 칸 아래.
  - H18(노드 `2:636`, `/me/settings`): TopBar `알림 및 설정`(뒤로 → `/me`) · `PageHeading('내 알림을 설정해요.', '탐방 진행 상황을 놓치지 않도록 알려드려요.')` · 소제목 `알림` · `ToggleSwitch` 둘: `신청 승인 알림` / `가이드 승인·반려 상태를 알려드려요.`(`studentApproval`) · `탐방 일정 알림` / `탐방 전 일정과 장소를 안내해요.`(`studentSchedule`) · 소제목 `계정 관리` · `ListRow` `인증 상태 확인` / `학생증 인증 및 보호자 동의 현황` → `/verify` · `LogoutButton variant="row" description="다른 계정으로 UNIRO 사용하기"`.

- [ ] **Step 1: 실패하는 테스트** — `profile.test.ts`(`splitInterests('디자인 · 산업디자인')` → 2개, 빈 문자열 · null → `[]`, 배지 4갈래). `completedTourCount`(체크포인트 · 직접 만든 탐방 COMPLETED 신청). `settingsStore.test.ts`(토글 → `localStorage['ytt.settings']`에 JSON, 새 스토어 인스턴스가 값을 복원, 기본 전부 true). `MePages.test.tsx`: `student@demo.kr` — H16 문구 · 숫자 · 링크 세 개 · `학생증 인증 완료`, 완료 카드 없음; `newbie` — `학생증 인증 전` + `인증 이어하기 ›` → `/verify`; H17 — 이메일이 `readOnly`, 이름 지우고 제출 → `이름을 입력해 주세요.`, 저장하면 `/me`에 새 이름 · PUT 본문의 `grade`가 기존 값; H18 — 토글하면 `aria-checked` 반전 + 새로고침(재렌더) 뒤 유지, `인증 상태 확인` → `/verify`, `로그아웃` → `/login`. 이름 칸 IME Enter 제출 안 됨, 저장 연타 1회.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령(`/me`를 지나는 시연 · 셸 테스트가 새 위치를 본다).
- [ ] **Step 5: 진척 문서** — hs-a03 ✅ · H18 행 추가, API 표 #2 화면 연결, devlog. **Step 6: 커밋** — `feat: 고교생 MY·내 정보 수정·알림 및 설정 V2(알림 토글은 기기에만)`

---

### Task 10: 가이드 재학 인증 · 프로필 · MY · 설정 (`/guide/verify` · G05 · G12 · G13)

**Files:**
- Create: `src/pages/guide/{GuideVerifyPage,GuideProfilePage,GuideMyPage,GuideSettingsPage}.tsx`(+테스트 `GuideIdentityPages.test.tsx`)
- Modify: `src/app/routes.tsx`(`/guide/verify` · `/guide/me` 자리 교체, 새 `/guide/me/profile` · `/guide/me/settings`), `src/features/auth/landing.ts`(+`landing.test.ts`), `src/mocks/db/seed.test.ts`(guide-pending 첫 화면 단언), `src/app/shell.test.tsx` · `src/demo/demo.test.tsx`(`/guide/me`에서 `로그아웃`을 찾던 단언)

**Interfaces:**
- Consumes: Task 5 `useSubmitStudentVerification`(role `UNIVERSITY`) · `canSubmitVerification` · `VERIFICATION_STATUS_LABEL` · `VERIFICATION_TONE` · `PROOF_ACCEPT` · `proofFileError`; Task 3 `FileField` · `VerificationStatusCard` · `ToggleSwitch` · `LogoutButton`; Task 4 `useSaveGuideProfile` · `hasGuideProfile` · `GUIDE_MAJOR_MAX` · `GUIDE_INTRO_MAX` · `PROFILE_TEXT_MAX`; Task 9 `useSettingsStore`; Task 2 계정(`guide-new` · `guide-pending` · `guide-rejected`); 2A `PageHeading` · `BrandMark` · `ListRow` · `InfoCard` · `StatusChip` · `TextField` · `Textarea` · `Select`; 현행 `useUniversities`(`src/features/campuses/queries.ts`), `useGuideTours`, `getLandingPath`, `useMe`.
- Produces:
  - `landing.ts`: 대학생 인증 NONE · REJECTED → `/guide/verify`, **학과 없음 → `/guide/me/profile`**(2B-R5), 학과 있음 → `/guide`(2A). `guideVerificationBadge(status): { label: string; tone: Tone }`(`src/features/auth/profile.ts`) — APPROVED `재학 인증 완료`(V2 G12) · PENDING `재학 인증 심사 중` · REJECTED `재학 인증 반려` · NONE `재학 인증 전`(뒤 셋은 제안 문구).
  - **`/guide/verify`**(V2에 없음, TopBar 뒤로 없음 · 하단 탭 MY 활성):
    - TopBar `대학생 재학 인증`
    - `StatusChip` `가이드 권한 인증`
    - REJECTED면 맨 위 `VerificationStatusCard`(`재학 인증 상태 · 반려`, `반려 사유: {사유}`, `승인 전에는 탐방을 개설할 수 없습니다.`)
    - `Select`(라벨 · 첫 옵션 `용용톤 참여 대학 선택`, 옵션 `{shortName} {campusName}`, REJECTED면 `guideProfile.universityId` 미리 선택)
    - `FileField`(`학생증·재학증명서 이미지 업로드` / `이미지 형식·용량 확인 후 운영자 심사 대기`)
    - `InfoCard muted` `심사 중 → 승인 / 반려` / `승인 전에는 탐방을 개설할 수 없습니다.`
    - 버튼 `재학 인증 제출하기`
    - 각주 `5개교 이외 학교 선택 시 제출할 수 없어요.`. PENDING
    - APPROVED는 폼 대신 상태 카드(`재학 인증 상태 · 심사 중|승인` / `{대학}` / 심사 중 `승인 전에는 탐방을 개설할 수 없습니다.`, 승인 `학생증 심사 완료 · 인증 배지 노출`) + 다음 행동 링크: 학과 없음 `가이드 프로필 작성하기` → `/guide/me/profile`(제안 문구), PENDING + 학과 `내가 개설한 탐방` → `/guide/tours`, APPROVED + 학과 `새 탐방 개설하기` → `/guide/tours/new`. 검증 `용용톤 참여 대학을 선택해 주세요.`
    - `학생증 또는 재학증명서 사진을 올려 주세요.`(제안 문구) + 파일 오류는 `FileField` 아래. 제출 성공 → 토스트 `재학 인증을 제출했어요.`(제안 문구) + `navigate(getLandingPath(새 Me), { replace: true })`. 대학 목록 로딩 = Select 자리 `Skeleton`(높이 56), 데이터 없는 오류 = `ErrorState`.
  - **G05**(노드 `2:829`, `/guide/me/profile`): TopBar `가이드 프로필 등록`(뒤로 → `/guide/me`) · `PageHeading('내 이야기를 소개해 주세요.', '탐방 참가자에게 보여줄 가이드 정보예요.')` · 필드 `전공`(≤30, 비면 `전공 / 학과를 입력해 주세요.`, 31자 `30자 이내로 입력해 주세요.` — 제안 문구) · `학교 · 캠퍼스`(읽기 전용 `{name} {campusName}`, 값이 없으면 placeholder `재학 인증 후 채워져요`(제안 문구)) · `소개 한마디`(`Textarea`, placeholder `디자인 전공의 실제 하루를 함께 보여드릴게요.`, ≤300, 비면 null) · 버튼 `프로필 저장`. 처음 저장(`hasGuideProfile` false였음) → 토스트 `가이드 프로필을 저장했어요.`(제안 문구) + `getLandingPath(새 Me)`, 수정이면 `/guide/me`로. 학과 입력에 `preventImeEnter`(Textarea는 줄바꿈).
  - **G12**(노드 `2:1008`, `/guide/me`, TopBar 없음): `BrandMark` · `PageHeading('MY', '내 가이드 활동과 프로필을 관리해요.')` · 프로필 카드(이름 첫 글자 아바타, `{name} 가이드`, `{학교 정식 이름} · {학과}`(학과 없으면 `가이드 프로필을 등록해 주세요`), `guideVerificationBadge`) · 숫자 카드 둘(`{전체 탐방 수}회` / `개설한 탐방` · `{모집 중 · 마감 탐방 수}회` / `진행 예정`, `useGuideTours`) · 소제목 `가이드 관리` · `ListRow` 넷: `가이드 프로필 수정` / `전공·학교·소개를 관리해요.` → `/guide/me/profile` · `내가 개설한 탐방` / `모집 상태와 참가자를 확인해요.` → `/guide/tours` · `내 정보·인증 상태` / `계정과 재학 인증 정보를 확인해요.` → `/guide/verify` · `알림 및 설정` / `신청 알림·일정 안내를 설정해요.` → `/guide/me/settings`. 학과가 없으면 소제목 위에 `InfoCard tone="brand"` `가이드 프로필을 먼저 등록해 주세요.` + `프로필 등록하기 ›`(제안 문구).
  - **G13**(노드 `2:1035`, `/guide/me/settings`): TopBar `알림 및 설정`(뒤로 → `/guide/me`) · `PageHeading('탐방 알림을 관리해요.', '가이드 활동에 필요한 알림을 받아보세요.')` · 소제목 `알림` · `ToggleSwitch` 셋: `새로운 탐방 신청` / `참가자가 신청할 때 알려드려요.`(`guideNewApplicant`) · `승인 대기 알림` / `검토할 참가자 신청을 안내해요.`(`guidePending`) · `탐방 일정 알림` / `탐방 시작 전 일정을 알려드려요.`(`guideSchedule`) · 소제목 `계정 관리` · `ListRow` `인증 상태 확인` / `재학 인증·계정 정보 보기` → `/guide/verify` · `LogoutButton variant="row" description="다른 계정으로 UNIRO 사용하기"`.

- [ ] **Step 1: 실패하는 테스트** — `landing.test.ts`: 인증 NONE → `/guide/verify`, PENDING + 학과 없음 → `/guide/me/profile`, APPROVED + 학과 있음 → `/guide`. `GuideIdentityPages.test.tsx`: `guide-new` — 폼 표시, 대학 · 사진(`testImage`) 후 제출 → `/guide/me/profile`; `guide-rejected` — 반려 사유 · 직전 대학 미리 선택 · 재제출 → PENDING 카드 + `/guide`로 이동(학과 있음), PDF → 파일 오류; `guide-pending` — 폼 없음 + 카드 `재학 인증 상태 · 심사 중` + 링크 `가이드 프로필 작성하기`; G05 — 빈 전공 · 31자 오류, 저장하면 `Me.guideProfile.major` 반영 · 첫 저장은 landing으로, 수정은 `/guide/me`로, 학교 칸 `readOnly`; G12 — 숫자 카드(`guide@demo.kr` 시드: 개설 3회 · 진행 예정 2회에 맞춰 시드 값으로 단언), 링크 넷, 학과 없는 계정은 안내 카드; G13 — 토글 유지, `로그아웃` → `/login`. 연타 1회, 탭 `MY` 활성.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령(가이드 첫 화면 규칙이 바뀌므로 E2E 포함).
- [ ] **Step 5: 진척 문서** — guide-s01 · guide-a01 ✅ · G12 · G13 행 추가, API 표 #3 · #5(대학생) 화면 연결, devlog. **Step 6: 커밋** — `feat: 가이드 재학 인증·프로필 등록·MY 홈·알림 설정 V2`

---

### Task 11: 운영자 심사 API #10~#13

**Files:**
- Create: `src/mocks/rules/verificationReview.ts`(+test), `src/mocks/handlers/admin.ts`
- Modify: `src/features/verification/{model,api,queries}.ts`(+`model.test.ts`), `src/mocks/rules/views.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/registry.ts`(`admin: adminHandlers`), `src/mocks/registry.test.ts`, `src/mocks/handlers/handlers.test.ts`

**Interfaces:**
- Consumes: Task 1 `fieldError` · `deleteMockFile` · `mockFileUrl` · `MOCK_FILE_PREFIX`; Task 2 `MOCK_DOC_SAMPLE` · 대기열 시드; Task 5 `src/features/verification/*`; 현행 `requireUser`, `mutate` · `getDb`, `VerificationRow`(`src/mocks/db/schema.ts`), `toMe`, `qk`.
- Produces:
  - `model.ts`:
    - `VerificationSubjectRole = 'HIGH_SCHOOL' | 'UNIVERSITY'`
    - `VerificationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'`
    - `VerificationFilter = 'PENDING' | 'PROCESSED'`
    - `VerificationRequestSummary { id; role; userName; email; schoolName; status; submittedAt; reviewedAt: string | null; rejectionReason: string | null }`
    - `VerificationRequestDetail extends VerificationRequestSummary { documentUrl: string | null }`(계약 4절)
    - `REJECTION_REASON_MAX = 200`
    - `SUBJECT_ROLE_LABEL = { HIGH_SCHOOL: '고교생', UNIVERSITY: '대학생' }`
    - `VERIFICATION_REQUEST_STATUS_LABEL = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }`
    - `DocumentView = 'IMAGE' | 'MISSING' | 'DELETED'`
    - `documentView(r: Pick<VerificationRequestDetail, 'status' | 'documentUrl'>): DocumentView`(status ≠ PENDING → DELETED, url이 와도 · url 있음 IMAGE · 없음 MISSING).
  - `api.ts`: `getVerificationRequests(filter)`(`GET /admin/student-verifications?status={filter}`) · `getVerificationRequest(id)` · `postApproveVerification(id)` · `postRejectVerification(id, reason)`. `queries.ts`: `useVerificationRequests(filter)` · `useVerificationRequest(id)` · `useApproveVerification(id): UseMutationResult<VerificationRequestDetail, ApiError, void>` · `useRejectVerification(id): UseMutationResult<…, ApiError, string>`(성공: `setQueryData(qk.verificationRequest(id))` + `qk.verificationRequestLists` 무효화, 실패: 상세 · 목록 무효화, `qk.me`는 건드리지 않는다).
  - `qk.verificationRequests(filter) = ['verificationRequests', 'list', filter]` · `qk.verificationRequest(id) = ['verificationRequests', 'detail', id]` · `qk.verificationRequestLists = ['verificationRequests', 'list']`.
  - 목업 `listVerificationRequests(db, filter): VerificationRow[]`(PENDING: `submittedAt` 오름차순 → id, PROCESSED: `reviewedAt` 내림차순 → id 내림차순) · `findVerificationRequest(db, verificationId)`(404 `NOT_FOUND`) · `approveVerification(db, adminId, verificationId, now)`(404 → PENDING 아님 409 `ALREADY_PROCESSED` → APPROVED, 사유 null, `reviewedAt` · `reviewedBy`, `documentUrl` null + 참조가 `MOCK_FILE_PREFIX`면 `deleteMockFile`) · `rejectVerification(db, adminId, verificationId, reason: unknown, now)`(404 → 409 → 사유가 문자열 아니거나 trim 뒤 빈 값 · 200자 초과면 `fieldError('reason')` → REJECTED, 사유 trim, 사진 삭제). DTO `toVerificationRequestSummary(db, row)` · `toVerificationRequestDetail(db, row)`(`documentUrl`: PENDING일 때만, `mock-file:` 참조면 `mockFileUrl(ref) ?? MOCK_DOC_SAMPLE[role]`(2B-R9), 정적 경로는 그대로). 핸들러 `adminHandlers` 4개 모두 `requireUser(…, 'ADMIN')`, 목록은 `?status=` 없으면 PENDING · 모르는 값 400 `VALIDATION`. `P1_CONTRACT` += 4.

- [ ] **Step 1: 실패하는 테스트** — 규칙: START 대기열 순서(한도윤 → 오지호 → 강하린) · 처리 내역 순서(서지안 → 윤서아 → 임채원 …), 승인 뒤 `toMe(...).verificationStatus === 'APPROVED'`와 사진 삭제, 반려 사유 필수 · 201자 거부, 두 번째 처리 409. `documentView` 3갈래. 핸들러: 비운영자 403, 모르는 status 400, 새로고침으로 사라진 `mock-file:` 참조가 견본 SVG 경로로 대체된다.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — API 표 #10~#13 목업 ✅, devlog. **Step 6: 커밋** — `feat: 운영자 학생증 심사 API(#10~#13)`

---

### Task 12: 운영자 인증 심사 (A01 · A02 · A03)

**Files:**
- Create: `src/pages/admin/{VerificationListPage,VerificationReviewPage,VerificationRejectPage}.tsx`(+`AdminPages.test.tsx`)
- Modify: `src/app/routes.tsx`(`/admin/verifications` · `/:id` 자리 교체, 새 `/admin/verifications/:id/reject`)

**Interfaces:**
- Consumes: Task 11 `useVerificationRequests` · `useVerificationRequest` · `useApproveVerification` · `useRejectVerification` · `VerificationFilter` · `documentView` · `REJECTION_REASON_MAX` · `SUBJECT_ROLE_LABEL` · `VERIFICATION_REQUEST_STATUS_LABEL`; Task 3 `LogoutButton` · `Button variant="dangerSoft"`; 2A `BrandMark` · `PageHeading` · `SegmentedTabs` · `ListRow`(또는 카드) · `InfoCard` · `StatusChip` · `Button`(`danger` · `soft`) · `ConfirmDialog` · `Textarea`; 현행 `formatShortDate` · `formatTime`(`src/shared/lib/date.ts`), `preventImeEnter`.
- Produces(운영자는 탭 없음, 첫 화면 `/admin/verifications`):
  - **A01**(노드 `2:1237`): 맨 위 줄 `BrandMark` + 오른쪽 `LogoutButton variant="ghost" size="sm"` · `PageHeading('인증 심사', '제출된 인증 자료를 검토해 주세요.')` · `SegmentedTabs`(`대기 {n}` · `처리 완료`, 주소 `?filter=processed`와 동기, n은 PENDING 목록 길이) · 카드 = 칩 `학생증 심사` · `{userName} · {고교생|대학생}` · 줄 `{MM.DD} 제출 · 재학 확인`(고교생) / `{MM.DD} 제출 · 학교 확인`(대학생) · 오른쪽 `자료 확인하기 ›` → `/admin/verifications/{id}`. 처리 완료 탭 카드 = 칩 `학생증 심사` + 결과 칩(`승인` success · `반려` danger) · 같은 제목 줄 · `{MM.DD} 처리 · 파일 삭제됨`(제안 문구). 대기 0건 `EmptyState` `심사할 요청이 없어요.` / `새 인증 요청이 오면 여기에 보여요.`, 처리 0건 `아직 처리한 요청이 없어요.`(제안 문구). 사업자 심사 카드는 없다(2B-R2).
  - **A02**(노드 `2:1270`):
    - TopBar `인증 상세 · 승인/반려`(뒤로 → 목록, 직접 열면 `/admin/verifications`)
    - `PageHeading('제출 자료 확인', '이름과 재학 정보를 확인해 주세요.')`
    - 카드 칩 `학생증 심사`
    - `{userName} · {고교생|대학생}`
    - `{schoolName}`
    - `제출 일시 {MM.DD} · 학교명·이름 확인 필요`
    - 증빙 카드 `↑` + `제출된 증빙 자료`(설명 줄 자리에 사진 `<img>`, 가로 꽉 · 최대 높이 240 · `object-contain` · alt `{이름} 님이 올린 학생증 사진`(제안 문구))
    - `InfoCard tone="brand"` `인증 완료 후에는 원본 증빙 사진을 삭제하도록 처리해요.`
    - 하단 고정 `승인 처리하기`(primary) + `반려 사유 입력`(`dangerSoft`, → A03). 사진이 안 열리면(`onError`) 자리에 `사진을 불러오지 못했어요.` + `다시 불러오기`(제안 문구), 사진 없음 `제출된 사진이 없어요.` — **승인은 잠그지 않는다**(2B-R9). `승인 처리하기` → `ConfirmDialog` `{이름} 님의 재학 인증을 승인할까요?` / `승인하면 인증 배지가 표시되고 사진 파일은 바로 삭제돼요.`(확인 `승인하기`, 제안 문구) → #12 → 토스트 `{이름} 님을 승인했어요.`. 처리 끝난 건(`status !== 'PENDING'`): 칩 `심사 완료`, 사진 자리 `파일 삭제됨`, 하단 버튼 대신 결과 카드(승인 `승인 완료` / `{MM.DD HH:mm} 처리 · 인증 배지가 표시돼요`, 반려 `반려` / `반려 사유: {사유}` + `학생이 사유를 보고 다시 제출할 수 있어요`) + 버튼 `목록으로`(전부 제안 문구). 409 `ALREADY_PROCESSED` → 확인 창 닫기 + 토스트 + 상세 재조회 → 처리 끝난 건 화면.
  - **A03**(노드 `2:1294`, `/admin/verifications/:id/reject`): TopBar `인증 반려 사유 입력`(뒤로 → A02) · `PageHeading('반려 사유를 입력해 주세요.', '사용자가 수정해 재제출할 수 있도록 안내해요.')` · 카드 `심사 대상` / `{userName} · {고교생|대학생}` / `학생증 사진 · 재학 확인` · `Textarea` 라벨 `반려 사유`(placeholder `학교명과 이름이 선명하게 보이도록 다시 올려 주세요.`) · `InfoCard tone="brand"` `반려 사유가 내 정보 화면에 표시되고, 사용자는 재제출할 수 있어요.` · `danger` 버튼 `반려 처리하기`. 검증(제출 때) `반려 사유를 입력해 주세요.` · `200자 이내로 적어 주세요.`(제안 문구) → `ConfirmDialog` `재학 인증을 반려할까요?` / `반려 사유가 학생에게 보이고 사진 파일은 바로 삭제돼요.`(확인 `반려하기`) → #13 → 토스트 `{이름} 님의 인증을 반려했어요.` + `/admin/verifications/{id}`(replace, 처리 끝난 건 화면). 이미 처리된 건으로 들어오면 A02로 replace.
  - 로딩 `Skeleton`, 데이터 없는 오류 `ErrorState`(없는 id는 `errorMessage('NOT_FOUND')` + 행동 `목록으로`), 재조회 실패는 받은 화면 그대로.

- [ ] **Step 1: 실패하는 테스트**(`renderApp(path, { as: 'admin' })`) — A01: START `대기 3` · 첫 카드 한도윤(대학생 `학교 확인`) · `처리 완료` 탭에 서지안 반려 칩 · `?filter=processed` 동기 · `로그아웃` → `/login` · 탭 없음(1단계 `shell.test`의 운영자 단언 그대로 통과). A02: 강하린 상세 · 승인 → 확인 → `{이름} 님을 승인했어요.` · 대기 2건 · 승인 연타 1회; 사진 `onError`에서도 `승인 처리하기`가 켜져 있다; 처리 끝난 건 `파일 삭제됨`. A03: 빈 사유 · 201자 오류, 반려 → A02 처리 끝난 건에 사유 표시, 이미 처리된 id → A02로 replace, 반려 연타 1회. 학생 쪽 전파: 승인 뒤 `waiting@demo.kr`의 `Me.verificationStatus`가 APPROVED(목업).
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — owner-s06 · owner-a02 ✅ · A03 행 추가, 대시보드 팀 요청 6(운영자 심사 시연 여부) 비고 `화면 완료 · 골든 패스는 미리 승인된 계정`, devlog. **Step 6: 커밋** — `feat: 운영자 인증 심사 V2(목록·상세·반려 사유)`

---

### Task 13: 탐방 생애 API #14~#17

**Files:**
- Create: `src/mocks/rules/tours.ts`(+test)
- Modify: `src/features/tours/{model,api,queries}.ts`, `src/mocks/rules/applications.ts`(`setStatus` → export `setApplicationStatus`), `src/mocks/rules/views.ts`(`toGuideTourDetail`), `src/mocks/handlers/tours.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/registry.test.ts`, `src/mocks/handlers/handlers.test.ts`

**Interfaces:**
- Consumes: Task 1 `fieldError` · `P1_CONTRACT` · `COMPLETE_BEFORE_TOUR_DATE`; Task 2 `TourRow.title`; 현행 `GuideTourSummary`(`src/features/applications/model.ts`), `toGuideTourSummary`(`views.ts`), `expireCouponsForApplication`(`src/mocks/rules/coupons.ts`), `requireOwnTour` · `requireUser`, `seoulDateKey` · `toSeoulIso`, `nextId`, `TourRow`.
- Produces:
  - `features/tours/model.ts`: `CreateTourInput { title: string; startsAt: string; endsAt: string; capacity: number; introduction: string; openChatUrl: string | null }`(학교는 보내지 않는다) · `GuideTourDetail extends GuideTourSummary { cancellable: boolean; completable: boolean; courseStopCount: number }` · `TOUR_TITLE_MIN = 2` · `TOUR_TITLE_MAX = 30` · `TOUR_CAPACITY_MAX = 8` · `TOUR_INTRO_MIN = 10` · `TOUR_INTRO_MAX = 500`.
  - `api.ts`: `postGuideTour(input): Promise<GuideTourDetail>`(201) · `getGuideTour(id)` · `postCompleteTour(id)` · `postCancelTour(id)`. `queries.ts`: `useGuideTour(tourId)`(`qk.guideTour(tourId)`) · `useCreateTour()`(성공: `setQueryData(qk.guideTour(id))` + `{ queryKey: qk.guideTours, exact: true }` 무효화, 403 계열이면 `qk.me` 무효화) · `useCompleteTour(tourId)` · `useCancelTour(tourId)`(둘 다 성공: `setQueryData(qk.guideTour(id))` + `qk.guideTours`(exact) · `qk.applicants(id)` · `qk.tour(id)` 무효화, 실패: `qk.guideTour(id)` 무효화). `qk.guideTour(id) = ['guideTours', id]`.
  - 목업 `createTour(db, guideId, input, now): TourRow` — ① 인증 APPROVED 아님 403 `NOT_VERIFIED` ② 프로필 `major` · `universityId` 없음 403 `GUIDE_PROFILE_REQUIRED` ③ 형식 400 `fieldError`(`title` 2~30 · `startsAt` · `endsAt` · `capacity` 1~8 · `introduction` 10~500 · `openChatUrl` null 또는 `https://`) ④ 날짜 ≤ 오늘(서울)이면 `fieldError('startsAt', '내일 이후 날짜를 골라 주세요.')`(제안 문구, 서버 판정 — 2B-R10) ⑤ 그 학교 방학 밖 400 `OUTSIDE_VACATION` + `fieldErrors.startsAt` ⑥ `TourRow`(RECRUITING, `universityId` = 프로필 학교, `title` = 입력). `completeTour(db, guideId, tourId, now)`(404 · 403 → COMPLETED 409 `TOUR_ALREADY_COMPLETED` → CANCELED 409 `ALREADY_PROCESSED` → 날짜 전 409 `COMPLETE_BEFORE_TOUR_DATE` → COMPLETED, 신청 · 쿠폰 그대로) · `cancelTour(db, guideId, tourId, now)`(404 · 403 → COMPLETED 409 → CANCELED 409 → PENDING · APPROVED 신청 `CANCELED` + 그 신청의 `ISSUED` 쿠폰 `EXPIRED`(`USED` 그대로), REJECTED 그대로, 탐방 CANCELED) · `isTourCancellable(tour): boolean`(RECRUITING · CLOSED) · `isTourCompletable(tour, now): boolean`(취소 가능 + 오늘(서울) ≥ 탐방 날짜) · `setApplicationStatus(app, status, at): void`(export) · `toGuideTourDetail(db, tour, now)`. 핸들러 `POST /guide/tours`(**201**) · `GET /guide/tours/:id` · `POST …/complete` · `POST …/cancel`, 모두 `requireUser(…, 'UNIVERSITY')`(조회는 `requireOwnTour`). `P1_CONTRACT` += 4.

- [ ] **Step 1: 실패하는 테스트**(고정 시각) — `tours.test.ts`: 검사 순서(미인증 · 프로필 없음 · 형식 · 오늘 · 방학 밖 · 정상), `title`이 `TourSummary.title`로 돌아온다, `guide-pending`은 `NOT_VERIFIED`, 완료는 날짜 전 `COMPLETE_BEFORE_TOUR_DATE`(내일 탐방) · 오늘 탐방 성공 · 두 번째는 `TOUR_ALREADY_COMPLETED`, 취소는 승인 신청 · 쿠폰이 함께 바뀌고 `USED` 쿠폰은 그대로 · 완료된 탐방 취소는 409. 핸들러: 남의 탐방 403, 개설 201.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령(신청 상태 변경 함수를 바꿨으므로 E2E 포함).
- [ ] **Step 5: 진척 문서** — API 표 #14~#17 목업 ✅, devlog. **Step 6: 커밋** — `feat: 탐방 개설·조회·완료·취소 API(#14~#17)`

---

### Task 14: 탐방 개설 · 완료 · 취소 (G04 · G09 · G10) + 진입 링크 + 학생 완료 상태

**Files:**
- Create: `src/pages/guide/{TourCreatePage,TourCompletePage,TourCancelPage}.tsx`(+`TourLifecyclePages.test.tsx`)
- Modify: `src/app/routes.tsx`(`/guide/tours/new` · `/complete` · `/cancel` 자리 교체), `src/features/tours/model.ts`, `src/features/campuses/model.ts`(+test), `src/features/applications/model.ts`(`myTourDisplay` 분기), `src/pages/guide/{ApplicantsPage,GuideToursPage}.tsx`(진입 링크), `src/pages/student/{MyTourDetailPage,MyToursPage}.tsx`(완료 탐방 표시)

**Interfaces:**
- Consumes: Task 13 `useGuideTour` · `useCreateTour` · `useCompleteTour` · `useCancelTour` · `GuideTourDetail` · `CreateTourInput` · `TOUR_*`; Task 4 `tourCreateBlock` · `TourCreateBlock`; 2A `PageHeading` · `StepList` · `InfoCard` · `StatusChip` · `Button`(`danger`) · `TextField` · `Textarea`(G04 입력 카드); 현행 `useUniversities`, `Vacation`, `useMe`, `useApplicantsBoard`, `myTourDisplay`, `seoulDateAt` · `seoulDateKey` · `formatShortDate` · `formatMonthDay` · `formatTime`(`src/shared/lib/date.ts`), `Button` `hint`, `preventImeEnter`.
- Produces:
  - `features/tours/model.ts`: `TourActionState { enabled: boolean; reason: string | null; action: ActionLink | null }` · `completeActionState(tour: GuideTourDetail): TourActionState`(서버 `completable` + `status`로 사유) · `cancelActionState(tour): TourActionState`(`cancellable` + `status`) · `courseSummaryLabel(tour): string`(`코스 {n}개 장소`(코스 있음) · `코스 미확정`(DRAFT) · `코스 없음`).

| 상태 | 완료 사유 · 행동 | 취소 사유 · 행동 |
|---|---|---|
| 가능 | — | — |
| COMPLETED | `이미 완료된 탐방이에요.` · `내가 개설한 탐방` → `/guide/tours` | `완료된 탐방은 취소할 수 없습니다.` · 같음 |
| CANCELED | `취소된 탐방은 완료할 수 없어요.`(제안) · 같음 | `이미 취소된 탐방이에요.`(제안) · 같음 |
| 날짜 전(완료) / 그 밖(취소) | `탐방 날짜({formatShortDate}) 이후에 완료할 수 있어요.`(제안) · `신청자 관리로 이동` → `/guide/tours/{id}/applicants` | `지금은 취소할 수 없어요.`(제안) · `내가 개설한 탐방` |

  - `features/campuses/model.ts`(인자 순서 `(vacations, dayKey)`로 통일): `isWithinVacation(vacations: Vacation[], dayKey: string): boolean`(시작 · 종료일 포함) · `upcomingVacations(vacations, fromDayKey): Vacation[]` · `tourDateBounds(vacations, todayKey): { min: string; max: string } | null`(안내용 date `min`/`max`).
  - **G04**(노드 `2:758`, `/guide/tours/new`, 하단 탭 `내 탐방`):
    - TopBar `새 탐방 만들기`(뒤로 → `/guide/tours`)
    - `PageHeading('어떤 하루를 보여줄까요?', '방학 중 열 수 있는 작은 캠퍼스 투어를 만들어 봐요.')`
    - 입력 카드(작은 라벨 + 값, V2 `학교`/`일정` 카드 모양) 순서: `탐방 이름`(제안 문구 라벨, placeholder `예: 디자인 전공자의 하루`, 2~30자)
    - `학교`(읽기 전용 `{name} {campusName}` + ✓, 값은 `guideProfile.universityId`)
    - `일정`(날짜 `type="date"`(`min`/`max` = 안내) + 시작 · 종료 시간 `type="time"` 두 칸, 오른쪽 칩 `방학 기간`(success, 고른 날짜가 `isWithinVacation`일 때만))
    - `정원`(숫자 `inputMode="numeric"`, placeholder `최대 8명`)
    - `탐방 소개`(placeholder `전공 선배와 둘러보는 우리 캠퍼스`)
    - `연락 링크`(`type="url"`, 선택, 도움말 `승인된 신청자에게만 공개돼요.`)
    - `InfoCard tone="brand"` `ⓘ 학교별 방학 기간에만 탐방을 개설할 수 있어요.`
    - 하단 버튼 `모집 시작하기`. 검증(제안 문구): `탐방 이름을 2자 이상 적어 주세요.`
    - `30자 이내로 적어 주세요.`
    - `방학 날짜를 골라 주세요.`
    - `방학 기간 안의 날짜만 고를 수 있어요.`(클라이언트 방학 검사, 서버 `OUTSIDE_VACATION`도 같은 문구)
    - `시작 시간을 골라 주세요.`
    - `종료 시간을 골라 주세요.`
    - `종료 시간은 시작 시간보다 늦어야 해요.`
    - `모집 정원은 1~8명으로 적어 주세요.`
    - `탐방 소개를 10자 이상 적어 주세요.`
    - `500자 이내로 적어 주세요.`
    - `https://로 시작하는 링크를 넣어 주세요.`. 서버 `VALIDATION`의 `fieldErrors`(`title` · `startsAt`(→ 날짜 칸) · `endsAt` · …)는 칸 아래, `NOT_VERIFIED`
    - `GUIDE_PROFILE_REQUIRED`
    - `FORBIDDEN`은 토스트 + `qk.me` 무효화(차단 화면으로 다시 그림). **차단**(`tourCreateBlock(me)`): 칩 + 입력 `<fieldset disabled>` + 버튼 비활성 `hint={{ reason, action }}`. 남은 방학이 없으면 버튼 비활성 + `앞으로 열리는 방학 기간이 없어 지금은 개설할 수 없어요.`(제안 문구) + `내가 개설한 탐방` → `/guide/tours`. 본문 `{ title, startsAt: seoulDateAt(date, start), endsAt: seoulDateAt(date, end), capacity, introduction, openChatUrl: trim || null }`. 성공 → 토스트 `탐방을 개설했어요.`(제안 문구) + `/guide/tours`(replace). 대학 목록 로딩 `Skeleton`, 데이터 없는 오류 `ErrorState`(방학 검사를 못 하므로 폼을 그리지 않는다).
  - **G09**(노드 `2:934`, `/guide/tours/:tourId/complete`): TopBar `탐방 종료 · 완료 처리`(뒤로 → `/guide/tours/{id}/applicants`) · `PageHeading('탐방을 마쳤나요?', '실제 진행이 끝난 후 완료 처리해 주세요.')` · 카드(칩 `진행 중`, `{tour.title}`, `{MM.DD (요일)} · {HH:mm}–{HH:mm}`, `참가자 {approved}명 · 코스 {courseStopCount}개 장소`) · `StepList(['탐방이 실제로 종료됐는지 확인', '완료 시 참가자에게 리뷰 작성 안내', '가이드의 지난 탐방 목록에 저장'])` · 캡션 `완료 처리 후에는 참가자의 리뷰 작성이 가능해져요.` · 버튼 `탐방 완료 처리`(`completeActionState` 불가면 비활성 + `hint`). 확인 창 없음. 성공 → 토스트 `탐방을 완료 처리했어요.`(제안 문구) + `/guide/tours`(replace); 실패 → 토스트 `errorMessage(code)` + `qk.guideTour` 재조회.
  - **G10**(노드 `2:959`, `/guide/tours/:tourId/cancel`): TopBar `탐방 취소 확인` · `PageHeading('탐방을 취소할까요?', '참가자에게 취소 안내가 전달돼요.')` · danger-soft 카드(`!` · `탐방 전체가 취소돼요` / `승인된 신청과 발급된 쿠폰도 함께 무효화돼요.`) · 카드(칩 `취소 대상`, `{tour.title}`, `{MM.DD (요일)} · 참가자 {approved}명`) · 캡션 `취소 후 같은 일정으로 복구하려면 새 탐방을 개설해야 해요.` · `danger` 버튼 `탐방 취소 확정` + 보조 `돌아가기`(이전 화면, 주소로 바로 들어왔으면 `/guide/tours`). 처리 중 두 버튼 모두 잠금. 성공 → 토스트 `탐방을 취소했어요.`(제안 문구) + `/guide/tours`(replace).
  - 공통 상태: 로딩 `Skeleton`, `FORBIDDEN` · `NOT_FOUND` = `EmptyState`(`errorMessage(code)` + `내가 개설한 탐방` → `/guide/tours`), 그 밖 `ErrorState`.
  - **진입 링크:** 신청자 승인(G02) 하단 버튼 아래 텍스트 링크 줄 `탐방 완료`(→ `/complete`) · `탐방 취소`(→ `/cancel`) — `board.tour.status`가 RECRUITING · CLOSED일 때만(날짜 전에도 보인다, 판정은 서버). 내가 개설한 탐방(G06) 카드의 작은 링크 `탐방 취소`는 그대로이고 같은 줄에 `탐방 완료`를 더한다(RECRUITING · CLOSED). 완료 · 취소 탐방의 G02는 승인 · 거절 버튼을 숨긴다(읽기 전용).
  - **학생 완료 상태:** `myTourDisplay`에 "신청 PENDING + 탐방 COMPLETED" 분기 — 라벨 `승인 전에 종료됐어요`(neutral, 제안 문구) · 다음 행동 `탐방 기록 보기` → `/my-tours/{id}`. 내 탐방 상세(H10)는 탐방 COMPLETED면 설명 줄을 `탐방이 끝났어요.`로 바꾸고 취소 버튼을 숨긴다(2A는 끝난 신청에 이미 숨김 — 단언 유지).

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`(`completeActionState`/`cancelActionState` 표 전 조합, `courseSummaryLabel`), `campuses/model.test.ts`(`isWithinVacation` 경계 포함, `tourDateBounds`). `TourLifecyclePages.test.tsx`: G04 — `guide-new` 차단(칩 `재학 인증 승인 필요` + 비활성 + 행동 링크), `guide-pending` PENDING + 학과 없음 → 행동 `가이드 프로필 작성하기`, `guide@demo.kr` 정상 개설 → `/guide/tours`에 새 제목 카드, 방학 밖 날짜 · 오늘 날짜(서버 `fieldErrors.startsAt`)가 날짜 칸 아래, 종료 ≤ 시작, 정원 9, 칩 `방학 기간`, 연타 1회, 이름 칸 IME Enter 무시. G09 — 오늘 탐방(시드 1) 완료 성공 → 목록의 지난 탐방, 내일 탐방(시드 6)은 비활성 + 사유 + 행동, 이미 완료된 탐방(시드 7), 연타 1회. G10 — 취소 성공 → 학생 `내 탐방`의 해당 신청이 취소됨, 완료된 탐방은 비활성 + 사유, 연타 1회. `ApplicantsPage.test`: 링크 줄 표시 · 완료 탐방에서 숨김. 학생: PENDING + COMPLETED 라벨.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: E2E** — 골든 패스 가이드 단계가 지나는 G02 · G06에 링크가 더해졌어도 로케이터(`승인하기` · `승인 완료 후 코스 만들기`)가 안 깨지는지 확인한다. **Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 진척 문서** — guide-s02 · guide-s07 · guide-a04 ✅(G04 · G09 · G10), hs-s07 완료 상태, API 표 #14~#17 화면 연결, devlog. **Step 7: 커밋** — `feat: 탐방 개설·완료·취소 V2와 진입 링크, 학생 완료 상태`

---

### Task 15: 가이드 확정 코스 보기 (`/guide/tours/:tourId/course`, V2에 없음)

**Files:**
- Create: `src/pages/guide/GuideCourseMapPage.tsx`(+`GuideCourseMapPage.test.tsx`)
- Modify: `src/app/routes.tsx`(`/guide/tours/:tourId/course` 자리 교체), `src/pages/guide/CourseConfirmPage.tsx`(2A, 완료 상태에 보조 링크 `확정 코스 지도 보기`), `src/pages/guide/CoursePages.test.tsx`

**Interfaces:**
- Consumes: 2A Task 7 `CourseStepBar` · `CourseTimeline`(`src/features/courses/components`) · `stopDurations`(`src/features/courses/model.ts`) · `StoreSheet`(V2 스타일, `coupon={null}`); 2A Task 10 `CourseConfirmPage` · `guideCoursePath`; 현행 `useGuideCourse`(`src/features/courses/queries.ts`), `MapView`(`src/features/courses/components/MapView.tsx`), `useDemoStore((s) => s.mapMode)`(선례 `CourseMapPage`), `formatDuration` · `formatTourDate`, `Course`.
- Produces: `GuideCourseMapPage(): JSX.Element`(`CourseMapBody`로 추출하지 않고 위 부품을 직접 조립한다). 구성은 H04와 같다 — TopBar `확정 코스 지도 보기`(뒤로: 이전 화면, 주소로 바로 열면 `/guide/tours/{id}/applicants`) · 페일 블루 카드(`우리의 {N시간} 코스` + 칩 `{n}개 장소` + `CourseStepBar`) · 캡션 `{n}개 장소 · 일정을 위아래로 스크롤해 확인하세요` · `CourseTimeline`(카드 → `StoreSheet`, 쿠폰 없이 `제휴 혜택 · {discount}`만) · 펼침 `지도로 보기`(`MapView`, 시연 패널 지도 `도식`을 `forceSchematic`으로) · 하단 고정 버튼 `신청자 관리로 이동`(guide-s06) → `/guide/tours/{id}/applicants`. 코스 없음(null) → `/guide/tours/{id}/applicants` replace, DRAFT → `/course/edit` replace(확정 화면과 같은 규칙). 로딩 `Skeleton`, 데이터 없는 오류 `ErrorState`.

- [ ] **Step 1: 실패하는 테스트** — `checkpoint: 'CONFIRMED'` + `guide@demo.kr`: 단계 막대 · 시간표 카드 3장, `지도로 보기` 펼치면 도식 지도, 카드 → 시트에 `제휴 혜택` 있고 `쿠폰 보기` 없음; DRAFT는 edit로, 코스 없음은 applicants로 이동; G08 완료 상태의 `확정 코스 지도 보기` → 이 화면. 탭 `코스 편집` 활성(2A match).
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — 확정 코스 지도 보기 행 ✅, devlog. **Step 6: 커밋** — `feat: 가이드 확정 코스 보기(/guide/tours/:tourId/course)`

---
### Task 16: 주변 상점 API #18~#20 · `StoreReviewSummary`

**Files:**
- Create: `src/features/reviews/model.ts`
- Modify: `src/features/courses/{model,api,queries}.ts`, `src/mocks/rules/{courses,coupons,views}.ts`, `src/mocks/ai/course.ts`, `src/mocks/handlers/courses.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/registry.test.ts`
- Test: `src/mocks/rules/courses.test.ts`, `src/mocks/rules/coupons.test.ts`, `src/mocks/ai/course.test.ts`(그대로 통과), `src/features/courses/model.test.ts`, `src/mocks/handlers/handlers.test.ts`

**Interfaces:**
- Consumes: Task 1 `COURSE_STOP_DUPLICATE` · `COURSE_STOP_LIMIT` · `P1_CONTRACT`; 현행 `guideTour` · `draftCourse` · `stopsOf` · `renumber`(`src/mocks/rules/courses.ts`, 같은 파일 안), `editCourse`(`src/mocks/handlers/courses.ts`), `COURSE_RADIUS_M`(`src/mocks/ai/course.ts`), `extractInterests` · `LifestyleIntent` · `LIFESTYLE_INTENTS`(`src/mocks/ai/interests.ts`), `distanceMeters`(`src/mocks/db/geo.ts`), `useCourseMutation`(`src/features/courses/queries.ts`), `Course` · `CourseStop`.
- Produces:
  - `features/reviews/model.ts`(새): `StoreReviewSummary { average: number | null; count: number; summary: string | null }`(0건 = `{ average: null, count: 0, summary: null }`). `CourseStop.review` 타입을 `StoreReviewSummary | null`로(같은 모양).
  - `features/courses/model.ts`: `CourseStoreCandidate { storeId; name; category; address; lat; lng; distanceM: number; relatedIntent: string | null; matchedRequest: string | null; partnership: { discount: string } | null; review: StoreReviewSummary; dataSource: string | null }`(계약 4절) · `MAX_COURSE_STOPS = 5` · `walkingMinutes(distanceM: number): number`(`Math.ceil(distanceM / 80)`, 2B-R13) · `walkingLabel(distanceM: number): string`(`도보 약 {N}분`).
  - `api.ts`:
    - `getCourseStoreCandidates(tourId)`(`GET /guide/tours/:id/course/store-candidates`)
    - `postCourseStop(tourId, storeId): Promise<Course>`(`POST …/course/stops { storeId }`, 200)
    - `postReplaceCourseStop(tourId, stopId, storeId): Promise<Course>`(`POST …/stops/:stopId/replace`). `queries.ts`: `useCourseStoreCandidates(tourId)`(`qk.courseStoreCandidates(tourId)`)
    - `useAddCourseStop(tourId): UseMutationResult<Course, ApiError, number>`
    - `useReplaceCourseStop(tourId): UseMutationResult<Course, ApiError, { stopId: number; storeId: number }>`(둘 다 성공: `setQueryData(qk.guideCourse(tourId), course)`, 실패: `qk.guideCourse(tourId)` 무효화 — 접두사라 후보도 다시 받는다). `qk.courseStoreCandidates(tourId) = ['guideCourse', tourId, 'storeCandidates']`.
  - 목업:
    - `tourDayPartnership(db, storeId, tourDay): PartnershipRow | undefined`(`rules/coupons.ts`, 지금 세 곳(`coupons.ts` · `views.ts` · `ai/course.ts`)의 "탐방 날짜에 유효한 제휴" 판정을 이 함수로 합친다, 동작 불변)
    - `ai/course.ts`: `byNameThenId(a, b)` export
    - `approvedIntents(db, tourId): LifestyleIntent[]`(승인 신청자 동기의 생활 의도, 기본 의도 식사 · 카페는 넣지 않는다)
    - `matchedRequestFor(db, tourId, intent): string | null`(승인 신청자(id 순) 중 `extractInterests`에 그 의도가 있는 첫 `하고 싶은 것`, 30자 넘으면 29자 + `…`). `rules/courses.ts`: `CourseStoreCandidateRow { store; distanceM; relatedIntent; matchedRequest; partnership }`
    - `listStoreCandidates(db, guideId, tourId)`(404 · 403 → 반경 `COURSE_RADIUS_M` 안 → 정렬: `relatedIntent` 있음 먼저 → 거리 → `byNameThenId`)
    - `addStoreStop(db, guideId, tourId, storeId)`(`draftCourse`(404 · 403 · 409 `COURSE_NOT_DRAFT`) → storeId 정수 아님 400 → 상점 없음 404 → 반경 밖 400 → 같은 상점 409 `COURSE_STOP_DUPLICATE` → 지점 ≥ 5 409 `COURSE_STOP_LIMIT` → 맨 끝에 넣고 `renumber`로 방문 시간 재계산)
    - `replaceStopStore(db, guideId, tourId, stopId, storeId)`(`draftCourse` → 지점 없음 404 → CAMPUS 400 → storeId 400 · 404 · 반경 400 → 같은 상점(자기 포함) 409 → `storeId` · `partnershipId` 교체, `description` · `recommendationReason` null, 순서 · 시각 그대로). DTO `toCourseStoreCandidate(db, row)`. 핸들러 `GET …/store-candidates`(`requireUser(…, 'UNIVERSITY')`)
    - `POST …/course/stops`(`editCourse`)
    - `POST …/stops/:stopId/replace`(`editCourse`). `P1_CONTRACT` += 3.

- [ ] **Step 1: 실패하는 테스트** — `walkingMinutes(139)` → 2 · `walkingMinutes(480)` → 6 · `walkingLabel(321)` → `도보 약 5분`. `courses.test.ts`: 탐방 1 후보 정렬 `[2, 1, 3, 4]` · 탐방 2(단국대) `[6, 5]`(시드 기댓값), 상점 5곳이면 추가 409 `COURSE_STOP_LIMIT`, 같은 상점 추가 · 교체 409, 교체는 순서 · 시각 유지 + 한줄평 · 추천 이유 비움, CAMPUS 지점 교체 400, CONFIRMED 코스 409 `COURSE_NOT_DRAFT`, 남의 탐방 403, 반경 밖 상점 400. `matchedRequestFor`(30자 초과 줄임 · 관련 없음 null). `coupons.test.ts`(`tourDayPartnership` 기간 경계), 초안 생성 · 쿠폰 발급 기존 테스트가 그대로 통과.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령(쿠폰 발급 · 초안 생성 경로를 리팩터링했으므로 E2E 포함).
- [ ] **Step 5: 진척 문서** — API 표 #18~#20 목업 ✅, devlog. **Step 6: 커밋** — `feat: 코스 상점 후보·추가·교체 API(#18~#20)와 제휴 판정 공용화`

---

### Task 17: 코스 상점 선택 (G07) — 추가 · 교체 + 진입점

**Files:**
- Create: `src/pages/guide/CoursePickPage.tsx`(+`CoursePickPage.test.tsx`)
- Modify: `src/features/courses/model.ts`(+test), `src/features/courses/components/StopActionSheet.tsx`(2A, `onReplace`), `src/pages/guide/CourseEditPage.tsx`(2A G03, `+ 장소 추가`), `src/app/routes.tsx`(`/guide/tours/:tourId/course/stops/pick` 자리 교체), `src/pages/guide/CoursePages.test.tsx`, `e2e/golden-path.spec.ts` · `e2e/stage-viewport.spec.ts`(필요 시 로케이터)

**Interfaces:**
- Consumes: Task 16 `useCourseStoreCandidates` · `useAddCourseStop` · `useReplaceCourseStop` · `CourseStoreCandidate` · `MAX_COURSE_STOPS` · `walkingLabel`; 2A Task 10 `StopActionSheet`(`{ stop, isFirst, isLast, busy, onMoveUp, onMoveDown, onEditNote, onRemove, onClose }`) · G03 `CourseEditPage` · `PageHeading` · `StatusChip` · `InfoCard tone` · `Button` · `TextField` · `EmptyState`; 현행 `useGuideCourse` · `useIsCreatingDraft`(`src/features/courses/queries.ts`), `circled`(`src/shared/lib/date.ts`), `errorMessage`, `preventImeEnter`.
- Produces:
  - `model.ts`: `PickTarget = { kind: 'add' } | { kind: 'replace'; stop: CourseStop } | { kind: 'invalid' }` · `pickTarget(course: Course, mode: string | null, stopId: string | null): PickTarget`(replace + 코스의 STORE 지점 id → replace, replace인데 없거나 CAMPUS · stopId 없음 → invalid, 그 밖 → add) · `CandidateStatus = 'SELECTABLE' | 'IN_COURSE' | 'CURRENT'` · `candidateStatus(c: CourseStoreCandidate, course: Course, target: PickTarget): CandidateStatus` · `matchesCandidate(c: CourseStoreCandidate, query: string): boolean`(공백 · 대소문자 무시 부분 일치, 대상 상호 · 업종 · `relatedIntent`).
  - `StopActionSheet`에 `onReplace?: () => void` 추가 — 있으면 버튼 `다른 장소로 교체`(`위로 이동` · `아래로 이동` · `한줄평` 다음, `빼기` 앞). `busy`면 비활성.
  - G03(2A): 소제목 줄 `일정 · {n}개 장소` 오른쪽 작은 텍스트 버튼 `+ 장소 추가`(2B-R12, `다시 만들기`와 같은 줄) → `navigate('…/course/stops/pick?mode=add')`. 지점이 5곳이면 `aria-disabled` + 누르면 토스트 `errorMessage('COURSE_STOP_LIMIT')`. 지점 카드 `≡` → `StopActionSheet`에 STORE 지점만 `onReplace`(→ `…/stops/pick?mode=replace&stopId={id}`). **소제목 줄 높이 · 지점 카드 수 · `<article>` 수는 그대로**(골든 패스 로케이터 보존).
  - **G07**(노드 `2:881`, `/guide/tours/:tourId/course/stops/pick`, 하단 탭 `코스 편집`):
    - TopBar `코스 상점 교체`(add 모드 `코스 상점 추가`, 제안 문구; 뒤로 → `…/course/edit`)
    - `PageHeading('장소를 바꿔볼까요?', '학생들의 하고 싶은 것과 연결되는 곳을 골라요.')`(add 모드 제목 `장소를 추가해 볼까요?`, 제안 문구)
    - `TextField` 라벨 `주변 상점 검색`(placeholder `문화체험 · 동네 카페 · 점심`, `type="search"`, 상호 · 업종 필터, `preventImeEnter`)
    - 소제목 `관련 있는 주변 후보`
    - 후보 카드 `<ul aria-label="후보 상점">`(서버 순서, 카드 전체가 `aria-pressed` 선택 버튼): 칩 `제휴 상점`(success) / `일반 상점`(info)
    - 이름 19/Bold
    - `{walkingLabel} · {업종}`
    - `학생 요청: {matchedRequest}`(null이면 줄 없음)
    - 상태 칩 `코스에 있음` / `지금 지점`(제안 문구, 선택 불가)
    - `InfoCard tone="brand"` `제휴 여부로 추천 순위를 정하지 않아요. 최종 코스에는 제휴 상점 1곳 이상이 필요해요.`
    - 하단 고정 버튼 `이 장소로 교체`(add 모드 `이 장소 추가`, 제안 문구). 선택 없음 → 비활성 + hint `후보를 하나 고르면 적용할 수 있어요.`(제안 문구).
  - 상태:
    - 로딩 `Skeleton`(검색 칸 · 카드 3)
    - 코스 오류 = `ErrorState`
    - 후보 오류 = 목록 자리에만 `ErrorState`
    - 데이터 우선
    - 코스 null → `…/course/draft` replace, CONFIRMED → `…/course/confirm` replace
    - `invalid` = `EmptyState` `바꿀 지점을 찾을 수 없어요` / `코스 편집에서 다시 골라 주세요.` + `코스 편집으로 돌아가기`
    - 후보 0 = `EmptyState` `학교 주변에서 고를 수 있는 상점이 없어요` + 같은 행동
    - 검색 0건 = `'{검색어}'에 맞는 상점이 없어요` + `검색어 지우기`
    - 고를 후보 없음(전부 `IN_COURSE`) = 버튼 비활성 + `고를 수 있는 후보가 없어요.` + `코스 편집으로 돌아가기`
    - add 모드 5곳 = 버튼 비활성 + `errorMessage('COURSE_STOP_LIMIT')` + `코스 편집에서 지점 빼기`
    - AI 초안 생성 중(`useIsCreatingDraft`) = 카드
    - 버튼 비활성 + `AI 초안을 만드는 중이에요.`(제안 문구)
    - 적용 중 모든 카드
    - 버튼 잠금(연타 1회)
    - 적용 성공 → 토스트 `코스에 반영했어요.`(제안 문구) + `…/course/edit`(replace)
    - 적용 실패 → `toast(errorMessage(code))` + 선택 유지 + 코스
    - 후보 재조회(409 `COURSE_NOT_DRAFT`면 재조회한 코스가 CONFIRMED라 확정 화면으로, 409 중복 · 한도는 칩 · 사유가 갱신). 선택한 후보가 검색으로 가려져도 선택은 유지된다.

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`: `pickTarget` 5갈래(replace 정상 · replace + CAMPUS · replace + 없는 id · mode 없음 · add), `candidateStatus` 3갈래, `matchesCandidate`(`카페` · `식사` · 공백 무시). `CoursePickPage.test.tsx`(`guide@demo.kr` + `APPROVED` + 초안 생성): replace 모드 — 카드 선택 → `이 장소로 교체` → 편집으로 이동 + 그 지점 이름이 새 상점으로 · 순서 · 시각 유지; add 모드 → 지점 +1 · 맨 끝; `코스에 있음` 카드는 선택 불가; 5곳이면 add 버튼 비활성 + 사유; 선택 없음 비활성 + hint; 검색 필터 · 0건 · `검색어 지우기`; `invalid` EmptyState; 적용 연타 요청 1번; CONFIRMED 코스로 열면 확정 화면으로 replace. `CoursePages.test.tsx`: G03 `+ 장소 추가` → add 주소, 시트 `다른 장소로 교체`가 STORE 지점에만 있고 캠퍼스 지점에는 없다, 5곳에서 `+ 장소 추가` 누르면 토스트, 기존 지점 수 · `article` 수 · 편집 잠금 테스트가 그대로 통과.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: E2E** — 골든 패스의 `≡`(`{지점 이름} 편집`) → `아래로 이동` 흐름이 새 버튼 때문에 안 깨지는지, 무대 ②(G03 지점 카드 3개, 1366×620 · 1280×600 · 1280×590@1.5)가 소제목 줄의 `+ 장소 추가`로 높이가 늘지 않는지 확인한다. **Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 진척 문서** — guide-a03 ✅(G07), guide-s05 비고 `지점 추가 · 교체 ✅`, 대시보드 `guide-s05` 설명줄의 "2단계에서 만든다" 문장 갱신, API 표 #18~#20 화면 연결, devlog. **Step 7: 커밋** — `feat: 코스 상점 추가·교체(G07)와 코스 편집 진입점`

---

### Task 18: 리뷰 API #21

**Files:**
- Create: `src/features/reviews/{api,queries}.ts`(+`model.test.ts`), `src/mocks/rules/reviews.ts`(+test), `src/mocks/ai/reviewSummary.ts`(+test), `src/mocks/handlers/reviews.ts`
- Modify: `src/features/reviews/model.ts`, `src/mocks/rules/views.ts`(`toMyReview`), `src/mocks/registry.ts`(`reviews: reviewHandlers`), `src/mocks/registry.test.ts`, `src/test/renderApp.tsx`, `src/mocks/handlers/handlers.test.ts`

**Interfaces:**
- Consumes: Task 16 `features/reviews/model.ts`; Task 1 `fieldError` · `P1_CONTRACT`; 현행 `redeemCoupon`(`src/mocks/rules/coupons.ts`), `findApplicationId` · `demoCouponCode`(`src/test/renderApp.tsx`), `DEMO_STORE_OWNERS` · `DEMO_EMAILS`(`src/shared/config/demoAccounts.ts`), `delayAi`(`src/mocks/latency.ts`), `AI_TIMEOUT_MS`(`src/shared/lib/http.ts`), `ReviewRow` · `ReviewSummaryRow`(`src/mocks/db/schema.ts`), `qk.course` · `qk.allMyCoupons`.
- Produces:
  - `model.ts`: `CreateReviewInput { couponId: number; rating: number; content: string }` · `MyReview { id; couponId; tourId; storeId; rating; content; createdAt }` · `REVIEW_CONTENT_MIN = 5` · `REVIEW_CONTENT_MAX = 100` · `normalizeReviewContent(text: string): string`(공백 · 줄바꿈을 한 칸으로, trim — 화면과 목업이 같이 쓴다).
  - `api.ts`: `postReview(input): Promise<MyReview>`(`POST /reviews`, `timeoutMs: AI_TIMEOUT_MS`). `queries.ts`: `useCreateReview(): UseMutationResult<MyReview, ApiError, CreateReviewInput>`(성공: `qk.course(review.tourId)` · `qk.allMyCoupons` 무효화(기본 `refetchType`), 실패: `qk.allMyCoupons` 무효화 — 화면 상태가 서버 기준으로 바뀐다).
  - 목업 `createReview(db, userId, input, now): ReviewRow`(형식 400 `fieldError`(`rating` 정수 1~5 · `content` `normalizeReviewContent` 뒤 5~100) → 없거나 남의 쿠폰 404 `NOT_FOUND` → `USED` 아님 403 `REVIEW_NOT_ALLOWED` → 같은 쿠폰 또는 같은 (user, tour, store) 409 `REVIEW_DUPLICATE` → `ReviewRow` 추가 → `refreshStoreSummary`) · `refreshStoreSummary(db, storeId, now)`(그 상점 리뷰 전부로 `summarizeReviews` → 요약 행을 고쳐 쓰거나 추가, 0건이면 아무것도 안 함) · `summarizeReviews(reviews): string | null`(`src/mocks/ai/reviewSummary.ts`, 2~3문장 템플릿, 0건 null — 문구는 임시, 실서버 LLM이 대신한다) · `toMyReview(row)`. 핸들러 `POST /reviews`(`delayAi()`, `requireUser(…, 'HIGH_SCHOOL')`, **201**). `P1_CONTRACT` += 1.
  - `src/test/renderApp.tsx`: `redeemDemoCoupon(storeId: number): number` — 김민지 탐방 1 신청의 그 상점 `ISSUED` 쿠폰을 그 가게 사장님(`DEMO_STORE_OWNERS`)으로 `redeemCoupon`해 `USED`로 만들고 쿠폰 id를 돌려준다(`checkpoint: 'CONFIRMED'` 이후).
  - 시드 리뷰 시각을 작성자마다 다르게 한다(R-02 `recent` 순서를 시각으로 정하려는 것, Task 22가 쓴다).

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`(`normalizeReviewContent('  좋아요 \n 맛있어요  ')` → `'좋아요 맛있어요'`). `reviews.test.ts`: 검사 순서(별점 0 · 6 · 소수 → `fieldErrors.rating`, 내용 4자 · 101자 → `fieldErrors.content`, 남의 쿠폰 404, `USABLE` 쿠폰 403 `REVIEW_NOT_ALLOWED`, 두 번째 작성 409), 저장 뒤 그 상점 `review.count`가 +1 · `summary`가 바뀐다, 요약이 개인 정보(작성자 이름)를 담지 않는다. `reviewSummary.test.ts`(0건 null · 문장 수). `handlers.test.ts`: `redeemDemoCoupon` → 201 + 본문, 학생이 아니면 403.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — API 표 #21 목업 ✅, devlog. **Step 6: 커밋** — `feat: 리뷰 작성 API(#21)와 AI 요약 갱신 목업`

---

### Task 19: 방문 리뷰 작성 (H12) + 진입점 + 착지

**Files:**
- Create: `src/pages/student/ReviewNewPage.tsx`(+`ReviewNewPage.test.tsx`), `src/features/reviews/components/ReviewEntryLink.tsx`
- Modify: `src/features/reviews/model.ts`(+test), `src/app/routes.tsx`(`/reviews/new` 자리 교체), `src/features/courses/components/StoreSheet.tsx`, `src/pages/student/{CourseMapPage,CouponDetailPage,CouponListPage,MyTourDetailPage}.tsx`(+테스트), `e2e/golden-path.spec.ts` · `e2e/stage-viewport.spec.ts`(필요 시)

**Interfaces:**
- Consumes: Task 18 `useCreateReview` · `CreateReviewInput` · `REVIEW_CONTENT_MIN` · `REVIEW_CONTENT_MAX` · `normalizeReviewContent` · `redeemDemoCoupon`; Task 3 `StarRating`; 2A H15 `CouponDetailPage`(`방문 리뷰 작성하기` 자리) · H04 `CourseMapPage` · V2 `StoreSheet` · `PageHeading` · `StatusChip` · `InfoCard` · `Button` · `Textarea` · `EmptyState` · `AiLoading`(현행 `src/shared/ui/AiLoading.tsx`); 현행 `useMyCoupon` · `useMyCoupons`(`src/features/coupons/queries.ts`), `useMyApplication`, `useTour`(`src/features/tours/queries.ts`), `Coupon` · `couponStateLabel`, `ApplicationStatus`, `errorMessage`, `preventImeEnter`.
- Produces:
  - `model.ts`:
    - `reviewNewPath(couponId: number): string`(`/reviews/new?couponId={id}`)
    - `courseStorePath(applicationId: number, storeId: number): string`(`/my-tours/{applicationId}/course?storeId={storeId}`)
    - `ReviewEntry = { kind: 'WRITE'; to: string } | { kind: 'DONE' } | null`
    - `reviewEntry(coupon: Pick<Coupon, 'id' | 'state' | 'reviewWritten'> | null): ReviewEntry`(쿠폰 없음 · USED 아님 null, USED + 미작성 WRITE, USED + 작성 DONE)
    - `reviewLandingPath(coupon: Pick<Coupon, 'id' | 'applicationId' | 'storeId'>, applicationStatus: ApplicationStatus | null): string`(APPROVED면 `courseStorePath`, 아니면 `/coupons/{id}`)
    - `reviewBlock(coupon: Pick<Coupon, 'id' | 'state' | 'reviewWritten' | 'applicationId' | 'storeId'>, applicationStatus: ApplicationStatus | null): { reason: string; action: ActionLink } | null`(USED 아님 → `errorMessage('REVIEW_NOT_ALLOWED')` · `쿠폰 보기` → `/coupons/{id}`, 작성됨 → `errorMessage('REVIEW_DUPLICATE')` · APPROVED면 `코스 지도 보기` → `courseStorePath` 아니면 `쿠폰 보기`, 쓸 수 있으면 null).
  - `ReviewEntryLink({ coupon, size, label }: { coupon: Coupon | null; size?: ButtonSize; label?: string }): JSX.Element | null` — WRITE: primary 링크(기본 `리뷰 쓰기`, H15는 `label="방문 리뷰 작성하기"`), DONE: 체크 + `리뷰 작성 완료`(버튼 아님), null: 그리지 않음.
  - **H12**(노드 `2:475`, `/reviews/new?couponId=`, 하단 탭 `내 탐방`):
    - TopBar `방문 리뷰 작성`(뒤로: 앞 화면이 있으면 뒤로, 주소로 바로 들어왔으면 `/coupons/{id}` 또는 `/my-tours`)
    - `PageHeading('오늘 탐방은 어땠나요?', '경험을 남기면 다른 학생에게도 도움이 돼요.')`
    - 카드(칩 `참여 완료`(USED, success) 아니면 `couponStateLabel`, `{coupon.storeName}`, `{universityName} {campusName} 주변`(`useTour(coupon.tourId)`))
    - 카드 `방문 경험을 평가해 주세요` + `StarRating`
    - 라벨 `좋았던 점과 아쉬웠던 점` + `Textarea`(placeholder `방문한 가게나 코스에서 느낀 점을 적어 주세요.`)
    - `InfoCard tone="brand"` `리뷰는 개인 정보 없이 가게의 경험 요약에 활용될 수 있어요.`
    - 하단 버튼 `리뷰 등록하기`. 검증(제안 문구): `별점을 선택해 주세요.`
    - `한 줄 평을 5자 이상 적어 주세요.`(정규화 뒤)
    - `100자 이내로 적어 주세요.`. 저장 중 `AiLoading` `리뷰를 저장하고 있어요` → `AI가 가게 리뷰 요약을 고치고 있어요`(제안 문구), 입력 비활성. 성공 → 토스트 `리뷰를 등록했어요.`(제안 문구) + `reviewLandingPath`(replace). 시연 미리 채움 없음.
  - H12 상태: 잘못된 `couponId`(양의 정수 아님, 요청 안 함) · 없는 · 남의 쿠폰(404 · 403) = `EmptyState` `리뷰를 쓸 쿠폰을 찾을 수 없어요.` + `내 탐방 확인하기` → `/my-tours` · 로딩 `Skeleton` · 그 밖 오류 `ErrorState` · `reviewBlock` 있음 = 별 · 입력 `fieldset disabled` + 버튼 비활성 + `hint`(`USABLE` 쿠폰은 5초 폴링으로 사장님이 처리하면 폼이 저절로 열린다) · 서버 오류 `VALIDATION`(`fieldErrors.rating` · `content` → 칸 아래) · `REVIEW_NOT_ALLOWED` · `REVIEW_DUPLICATE` · `NOT_FOUND`는 토스트 + 쿠폰 재조회로 위 상태가 된다 · `TIMEOUT`은 토스트 + 입력 유지(서버에는 저장됐을 수 있어 재조회가 "이미 작성"으로 바꿀 수 있다).
  - **진입점:** ① H15(`CouponDetailPage` USED) `방문 리뷰 작성하기`를 실제 화면으로(`ReviewEntryLink`, 작성됐으면 `리뷰 작성 완료`) ② H09 `리뷰 남기기 ›`는 쿠폰 목록(2A 대상 유지)이고 `CouponListPage`의 USED 쿠폰 행 아래 형제 링크 `리뷰 쓰기`(행 전체가 링크라 링크 안에 링크를 넣지 않는다) · 작성됐으면 칩 `{상태} · 리뷰 작성 완료` ③ H10(`MyTourDetailPage`) 신청 APPROVED + 탐방 COMPLETED면 링크 행 `리뷰 남기기 ›` / `다녀온 상점에 리뷰를 남겨 주세요`(기존 문구) → `/my-tours/{id}/coupons` ④ V2 `StoreSheet`의 제휴 상자에 `ReviewEntryLink`(USED면 `쿠폰 보기`를 secondary로), `StoreDetail key={stop.id}`로 펼침 상태 초기화 ⑤ `CourseMapPage`: `?storeId=`가 있고 그 상점 지점이 있으면 그 시트를 연 채 시작, 시트를 닫으면 `/my-tours/{id}/course`로 replace해 매개변수를 지운다.

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`: `reviewEntry` 3갈래 + null, `reviewLandingPath`(APPROVED vs null · CANCELED), `reviewBlock` 4갈래, 경로 함수. `ReviewNewPage.test.tsx`(`student@demo.kr` + `CONFIRMED` + `redeemDemoCoupon(1)`): 별 4점 + 내용 → 등록 → 코스 지도가 그 상점 시트를 연 채 시작하고 시트의 `✦ AI 리뷰 요약`이 바뀐 요약, 별점 없이 제출 · 4자 · 101자 오류, `USABLE` 쿠폰은 비활성 + hint `쿠폰 보기`, 이미 작성한 쿠폰(시드 `seojun@demo.kr` 탐방 7 상점 1)은 비활성 + `코스 지도 보기`, 잘못된 id · 남의 쿠폰 EmptyState, 등록 연타 요청 1번, 저장 중 `AiLoading` 문구. `CouponPages.test`: H15에서 `방문 리뷰 작성하기` → H12, 목록 `리뷰 쓰기` 링크 · 작성 뒤 칩. `CourseMapPage.test`: 시트 `리뷰 쓰기`, `?storeId=` 착지 · 닫으면 주소 정리. `MyToursPage`/H10 테스트: 완료 탐방 `리뷰 남기기 ›`.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: E2E** — 골든 패스의 쿠폰 사용 완료 단언(`쿠폰을 사용했어요!`)과 무대 ③(쿠폰 코드)이 `StoreSheet` · 쿠폰 화면 변경으로 안 깨지는지 확인. **Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 진척 문서** — hs-s10 ✅(H12), hs-s08 · hs-s09 비고 `리뷰 진입 ✅`, API 표 #21 화면 연결, 열린 질문 `리뷰 단계 무대 측정`은 11/6 대본 게이트 결과 대기, devlog. **Step 7: 커밋** — `feat: 방문 리뷰 작성 V2(H12)와 리뷰 진입점·저장 뒤 착지`

---

### Task 20: 사장님 API #22~#25 · #27 (+ `q` 검색 · `condition`)

**Files:**
- Create: `src/features/stores/api.test.ts`
- Modify: `src/mocks/rules/stores.ts`(2A, 조회 규칙에 더함), `src/features/stores/{model,api,queries}.ts`(2A), `src/mocks/rules/views.ts`, `src/mocks/handlers/stores.ts`(2A), `src/shared/api/queryKeys.ts`, `src/mocks/registry.test.ts`, `src/app/routes.tsx`(`/owner/me` → `Navigate`), `src/app/shell.test.tsx`, `src/mocks/handlers/handlers.test.ts`
- Test: `src/features/stores/model.test.ts`, `src/mocks/rules/stores.test.ts`

**Interfaces:**
- Consumes: Task 2 `DEMO_BUSINESS` · `DEMO_EMAILS.ownerUnverified` · `ownerNoStore` · `PartnershipRow.condition`; Task 4 `refetchMe`; Task 1 `fieldError` · `BIZ_NOT_VERIFIED` · `P1_CONTRACT`; 2A Task 11 `getMyStore` · `useMyStore` · `qk.myStore` · `myStoreOf` · `toMyStore` · `MyStore` · `Partnership` · `PartnershipState` · `STORE_NOT_LINKED`; 현행 `StoreRow` · `PartnershipRow` · `BusinessVerificationRow`(`src/mocks/db/schema.ts`), `DEMO_UNIVERSITY_ID`, `nextId`, `requireUser`, `seoulDateKey`, `loginAs`.
- Produces:
  - `model.ts`:
    - `BusinessVerificationInput { businessNumber: string; representativeName: string; openingDate: string }`(숫자 10자리 · `YYYY-MM-DD`)
    - `OwnerStoreCandidate { storeId: number; name: string; address: string; category: string; linkable: boolean }`
    - `BusinessVerificationResult { verifiedAt: string; candidates: OwnerStoreCandidate[] }`
    - `StoreRegistrationInput { name: string; address: string; category: string; lat?: number; lng?: number }`
    - `PartnershipInput { discount: string; condition: string | null; startDate: string; endDate: string }`
    - `STORE_CATEGORIES = ['한식', '분식', '중식', '일식', '양식', '카페', '보드게임카페', '노래방', '공방', '기타'] as const`
    - `normalizeBusinessNumber(raw: string): string`(숫자만)
    - `businessNotice(code: string | undefined): { title: string; description: string } | null` — `BIZ_MISMATCH` → `사업자 정보가 일치하지 않아요` / `사업자등록증에 적힌 등록번호 · 대표자명 · 개업일자를 그대로 다시 입력해 주세요.`, `BIZ_CLOSED` → `휴업 또는 폐업한 사업자예요` / `계속사업자(영업 중)인 사업자 정보로 다시 입력해 주세요.`(설명은 제안 문구), 그 밖 null
    - `computePartnershipState(p: { startDate: string; endDate: string }, now: Date): PartnershipState`(오늘(서울) 기준 시작 ≤ 오늘 ≤ 종료면 ACTIVE, 목업 · 어댑터 전용 — 2A가 `myStoreOf`에 쓴 상태 계산이 비공개면 이 함수로 합친다). `Partnership.condition`은 Task 2가 넣었다.
  - `api.ts`: `postBusinessVerification(input): Promise<BusinessVerificationResult>`(`POST /me/business-verification`) · `getOwnerStoreCandidates(q?: string): Promise<OwnerStoreCandidate[]>`(`GET /owner/store-candidates`, `q`가 있으면 쿼리 문자열) · `postLinkStore(storeId): Promise<MyStore>` · `postRegisterStore(input): Promise<MyStore>`(201) · `putPartnership(input): Promise<MyStore>`.
  - `queries.ts`:
    - `useOwnerStoreCandidates(q: string, enabled: boolean)`(`qk.ownerStoreCandidates(q)`)
    - `useVerifyBusiness()`(성공: `setQueryData(qk.ownerStoreCandidates(''), r.candidates)` + `await refetchMe`)
    - `useLinkStore()`
    - `useRegisterStore()`(성공: `setQueryData(qk.myStore, s)` + `removeQueries({ queryKey: qk.allOwnerStoreCandidates })` + `await refetchMe`, 실패: `STORE_ALREADY_LINKED` → 후보 무효화, `STORE_LIMIT` · `BIZ_NOT_VERIFIED` → `qk.me` 무효화)
    - `useSavePartnership()`(성공: `setQueryData(qk.myStore, s)`, 실패 `STORE_NOT_LINKED` → `qk.me` · `qk.myStore` 무효화). `qk.ownerStoreCandidates(q: string) = ['ownerStoreCandidates', q]`
    - `qk.allOwnerStoreCandidates = ['ownerStoreCandidates']`.
  - 목업 `rules/stores.ts`:
    - `DEMO_CANDIDATE_STORE_IDS: readonly number[] = [5, 6]`
    - `verifyBusiness(db, userId, body, now): StoreRow[]`(번호 숫자 10자리 · 대표자명 · 개업일 형식 `fieldError` → `DEMO_BUSINESS.closed` 400 `BIZ_CLOSED` → `match` 아님 400 `BIZ_MISMATCH` → 사업자 행 upsert(`isVerified: true`, `verifiedAt: now`) → 후보 5 · 6. 실패해도 이미 받은 인증은 그대로)
    - `storeCandidates(db, userId, q?: string): StoreRow[]`(미인증 403 `BIZ_NOT_VERIFIED` → `q` 없으면 후보 5 · 6, `q`가 있으면 상호 부분 일치(공백 · 대소문자 무시)를 이름순 최대 20개(다른 사장님이 연결한 가게도 `linkable: false`로 포함), `q` 50자 초과 400 `fieldError('q')`)
    - `linkStore(db, userId, storeId: unknown, now)`(403 `BIZ_NOT_VERIFIED` → 이미 가게 있음 409 `STORE_LIMIT` → 없는 상점 404 → 다른 사장님 가게 409 `STORE_ALREADY_LINKED` → `ownerId = userId`)
    - `registerStore(db, userId, body, now)`(403 → 409 `STORE_LIMIT` → 400 `fieldError`(`name` 1~150 · `address` 1~255 · `category` ∈ `STORE_CATEGORIES`) → `nextId` 상점, 좌표가 없으면 경희대 중심 북쪽 약 780m)
    - `savePartnership(db, userId, body, now)`(404 `STORE_NOT_LINKED` → 400 `fieldError`(`discount` 1~50 · `condition` ≤50, `''` → null · 날짜 `YYYY-MM-DD`) → 시작 > 종료 400 `PARTNERSHIP_PERIOD_INVALID` + `fieldErrors.endDate` → 그 가게 제휴 행을 고친다(id 유지, 없으면 추가)). `ADDRESS_NOT_FOUND`는 목업이 던지지 않는다(서버 좌표 변환 전용). DTO `toOwnerStoreCandidate(store)`(`linkable = ownerId === null`)
    - `toBusinessVerificationResult(db, userId, candidates)`. 핸들러(2A `GET /api/owner/store`에 더함, 모두 `requireUser(…, 'OWNER')`): `POST /me/business-verification`
    - `GET /owner/store-candidates`
    - `POST /owner/store/link`
    - `POST /owner/store`(**201**)
    - `PUT /owner/store/partnership`. `P1_CONTRACT` += 5 그리고 `expect(P1_CONTRACT).toHaveLength(27)`(#26 포함).
  - `/owner/me` 라우트: `<Navigate to="/owner/store" replace />`(2B-R4). `shell.test`의 `/owner/me` 단언을 "사장님이 `/owner/me`로 가면 `/owner/store`"로.

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`(`normalizeBusinessNumber('123-45-67890')`, `businessNotice` 3갈래, `computePartnershipState` 경계: 시작일 · 종료일 당일 ACTIVE · 하루 전 SCHEDULED · 하루 뒤 ENDED). `stores.test.ts`: 일치 번호 → 후보 5 · 6 + 인증 영속, 불일치 → `BIZ_MISMATCH` · 폐업 → `BIZ_CLOSED`(이미 인증된 계정은 그대로), 번호 9자리 `fieldErrors.businessNumber`, 미인증 후보 조회 403, `q='카페'` 이름순 · 51자 400, 연결 순서(미인증 403 → 이미 가게 409 `STORE_LIMIT` → 없는 상점 404 → 남의 가게 409), 등록 좌표 기본값, 제휴 저장 id 유지 · 시작 > 종료 `fieldErrors.endDate` · `condition ''` → null. `api.test.ts`: `getOwnerStoreCandidates('카페')` 쿼리 문자열. 핸들러: 비사장님 403, 등록 201.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령.
- [ ] **Step 5: 진척 문서** — API 표 #22~#25 · #27 목업 ✅(이로써 P1 27행이 모두 ✅), devlog. **Step 6: 커밋** — `feat: 사장님 사업자 인증·가게 연결·등록·제휴 API(#22~#25·#27)`

---

### Task 21: 사업자 인증 · 가게 연결(O05) · 제휴 설정(O06) + 쿠폰 가게 없음 가드

**Files:**
- Create: `src/pages/owner/{BusinessVerifyPage,StoreConnectPage,PartnershipPage}.tsx`(+`OwnerStorePages.test.tsx`)
- Modify: `src/app/routes.tsx`(`/owner/verify` · `/owner/store/connect` 자리 교체, 새 `/owner/store/partnership`), `src/pages/owner/MyStorePage.tsx`(2A, 제휴 수정 링크), `src/pages/owner/CouponRedeemPage.tsx`(+test), `e2e/golden-path.spec.ts`(필요 시)

**Interfaces:**
- Consumes: Task 20 `useVerifyBusiness` · `useOwnerStoreCandidates` · `useLinkStore` · `useRegisterStore` · `useSavePartnership` · `businessNotice` · `normalizeBusinessNumber` · `STORE_CATEGORIES` · `OwnerStoreCandidate` · `PartnershipInput`; 2A `useMyStore` · `MyStore` · `MyStorePage` · `PageHeading` · `BrandMark` · `HeroCard` · `InfoCard tone` · `StatusChip` · `Button`(`soft`) · `TextField` · `Select` · `ConfirmDialog`; Task 2 `DEMO_BUSINESS`(테스트 · 시연 채우기); 현행 `useMe`, `useDemoToolsOn`(`src/demo/demoStore.ts`), `addDaysKey` · `seoulDateKey`(`src/shared/lib/date.ts`), `preventImeEnter`, `useCouponLookup`.
- Produces(전 화면 하단 탭 `내 가게` 활성):
  - **`/owner/verify`**(V2에 없음, TopBar 뒤로 없음):
    - TopBar `사업자 인증`
    - `StatusChip` `사업자 정보 확인`
    - 필드 `사업자등록번호`(`inputMode="numeric"` · `maxLength={12}`, hint `'-' 없이 숫자 10자리로 적어도 돼요.`)
    - `대표자명`
    - `개업일자`(date, `max` = 오늘, 칸 위 캡션 같은 문구)
    - 결과 카드(`aria-live="polite"`, 기본 `국세청 진위확인 API 연동` / `정보 일치 · 계속사업자 여부 확인`, 실패하면 `businessNotice` 제목 · 설명으로 바뀌고 입력값 유지 · 다시 입력하면 기본으로)
    - 버튼 `사업자 정보 확인`
    - 시연 도구가 켜졌을 때만 ghost `시연 사업자 정보 채우기`(`DEMO_BUSINESS.match`로 채움, 제안 문구). 이미 인증됨 → 폼 대신 `사업자 인증 완료` / `국세청 진위확인으로 확인된 사업자예요.` + 링크 `가게 연결하기`(`storeId` null) 또는 `내 가게 보기`(→ `/owner/store`). 검증(제안 문구): `사업자등록번호를 입력해 주세요.`
    - `사업자등록번호 10자리를 입력해 주세요.`
    - `대표자명을 입력해 주세요.`
    - `개업일자를 입력해 주세요.`. 성공 → 토스트 `사업자 인증을 마쳤어요.` + `/owner/store/connect`(replace). 연타 1회.
  - **O05**(노드 `2:1143`, `/owner/store/connect`):
    - TopBar `가게 찾기 · 연결`(뒤로 → `/owner/store`)
    - `PageHeading('우리 가게를 연결해요.', '캠퍼스 주변 가게를 검색하거나 직접 등록해요.')`
    - 검색 폼(`role="search"`, `TextField` 라벨 `가게 이름 검색`, placeholder `예: 책방 옆 작은 카페`, 제출 버튼 `aria-label="검색"`, 50자)
    - 소제목 `주변 가게 후보`
    - 후보 카드(칩 `후보 상점`(검색어가 없을 때) / `검색 결과`, 이름 19/Bold, `{address} · {category}`, soft 버튼 `이 가게 연결하기 ›`(선택 표시, 선택되면 `✓ 선택됨`(제안 문구), `aria-label="{name} 이 가게 연결하기"`), `linkable === false`는 버튼 비활성 + hint `이미 다른 사장님 계정에 연결된 가게예요.`)
    - `InfoCard tone="brand"` `검색되지 않는 가게는 상호와 위치를 직접 입력할 수 있어요.`
    - 링크 행 `내 가게 직접 등록 ›` / `상호명 · 주소 · 업종 입력`(누르면 같은 화면에 등록 폼: `TextField` `상호명 직접 입력` · `가게 주소`(hint `도로명 주소로 적어 주세요.`) · `Select` `업종` + 버튼 `내 가게 등록하기`)
    - 각주 `이미 다른 사장님 계정에 연결된 가게는 선택 불가`
    - 하단 고정 버튼 `다음으로`(선택이 없으면 비활성 + hint `연결할 가게를 먼저 골라 주세요.`) → `ConfirmDialog` `내 가게로 연결할까요?` / `{name} · {address} — 계정당 가게는 1개만 연결할 수 있어요.`(확인 `연결하기`, 취소 `돌아가기`, 제안 문구) → #24 → `/owner/store/partnership`(replace). 등록 성공도 같은 곳. 검증(제안 문구): `상호명을 입력해 주세요.`
    - `가게 주소를 입력해 주세요.`
    - `업종을 골라 주세요.`, 서버 `ADDRESS_NOT_FOUND`는 주소 칸 아래.
  - O05 상태: 이미 가게 있음 = `InfoCard` `이미 연결된 가게가 있어요` / `계정당 가게는 1개만 연결할 수 있어요.` + `내 가게 보기` · 미인증 = 검색 · 등록 비활성 + `다음으로` hint `사업자 인증을 마치면 가게를 연결할 수 있어요.` + 행동 `사업자 인증하기` → `/owner/verify`(후보는 조회하지 않는다) · 후보 로딩 `Skeleton` 2 · 후보 0건 `InfoCard` `사업자 정보로 찾은 가게가 없어요` / `상호로 검색하거나 아래에서 직접 등록해 주세요.` · 검색 0건 `검색 결과가 없어요` / `상호를 다시 확인하거나 아래에서 직접 등록해 주세요.` · 후보 조회 실패(데이터 없음) = 목록 자리 `ErrorState`(직접 등록은 쓸 수 있다) · 409 `STORE_ALREADY_LINKED` = 토스트 + 후보 재조회(그 카드가 비활성) · 409 `STORE_LIMIT` · 403 `BIZ_NOT_VERIFIED` = 토스트 + `qk.me` 재조회로 위 상태 · 연결 · 등록 처리 중 모든 연결 버튼 잠금(연타 1회). 검색은 `placeholderData: keepPreviousData`.
  - **O06**(노드 `2:1171`, `/owner/store/partnership`):
    - TopBar `제휴 할인 설정`(뒤로 → `/owner/store`)
    - `PageHeading('제휴 혜택을 설정해요.', '참가자에게 제공할 혜택을 등록해 주세요.')`
    - 카드(칩 `연결 완료`, 가게 이름, `{address} · {category}`)
    - `혜택 이름`(placeholder `예: 음료 10% 할인`, 1~50자)
    - `할인 조건`(placeholder `탐방 당일 · 1회 사용 가능`, ≤50, 선택)
    - `제휴 시작일`
    - `제휴 종료일`(date, 칸 위 캡션, 2B-R17 기본값)
    - `InfoCard tone="brand"` `제휴 여부 자체가 AI 추천 순위에 영향을 주지는 않아요.`
    - 버튼 `제휴 혜택 저장`. 검증(제안 문구): `제휴 혜택 이름을 입력해 주세요.`
    - `50자 이내로 적어 주세요.`
    - `제휴 시작일을 골라 주세요.`
    - `제휴 종료일을 골라 주세요.`
    - `종료 날짜는 시작 날짜와 같거나 뒤여야 해요.`(서버 `PARTNERSHIP_PERIOD_INVALID`의 `fieldErrors.endDate`도 종료일 칸 아래). 성공 → 토스트 `제휴 혜택을 저장했어요.`(제안 문구) + `/owner/store`(replace). 가게 없음(404 `STORE_NOT_LINKED` · `useMyStore` null) = 칸 비활성 + 버튼 비활성 + hint `가게를 연결하면 제휴 혜택을 설정할 수 있어요.` + 행동 `가게 연결하기`(미인증이면 `사업자 인증하기`). 이미 이 가게에 제휴가 있으면 칸 초깃값은 기존 값(칩은 `연결 완료` 대신 숨김).
  - `MyStorePage`(2A): 제휴가 있으면 `쿠폰 사용 방법` 아래에 텍스트 링크 `제휴 혜택 수정 ›` → `/owner/store/partnership`(**`쿠폰 코드 입력하기` 위치는 그대로 — 무대 예산**), 제휴가 없는 카드의 `제휴 혜택을 설정해 주세요`는 같은 주소로.
  - `CouponRedeemPage`: 바깥 컴포넌트가 `me.storeId === null`이면 가드 `InfoCard` `연결된 가게가 없어요` / `가게를 연결하면 학생 쿠폰을 사용 처리할 수 있어요.` + 링크 버튼(인증했으면 `가게 연결하기` → `/owner/store/connect`, 미인증 `사업자 인증하기` → `/owner/verify`), 아니면 지금 본문(2A V2 화면, 비공개 `RedeemForm`으로 이름만 바꿈 — export는 그대로).

- [ ] **Step 1: 실패하는 테스트**(`as`는 이메일) — `owner-new`: 첫 화면 `/owner/verify`, 일치 번호 → `/owner/store/connect`에 후보 2개, 불일치 · 폐업 카드 문구, 번호 9자리 오류, `시연 사업자 정보 채우기`(시연 도구 켠 상태만), 연타 1회. `owner-nostore`: O05 후보 2개 · 하나 고르고 `다음으로` → 확인 창 → O06(`연결 완료` 칩) → 저장 → `/owner/store`에 `{혜택}` · 가게 이름, 다음으로 비활성 + hint, 직접 등록(상호 · 주소 · 업종) → O06, 검색 `카페` · 검색 0건, 남의 가게(시드 owner1 가게 검색) 비활성 + hint, `STORE_ALREADY_LINKED` 경합(목업에서 다른 사장님이 먼저 연결) → 토스트 + 비활성, 연결 연타 요청 1번. O06: 종료 < 시작 → 칸 아래 문구, `condition` 비움 허용, 기본값 오늘 ~ +90일, 가게 없는 계정 가드. `owner1`: O01의 `제휴 혜택 수정 ›` → O06에 기존 값, 저장 뒤 O01 갱신. `CouponRedeemPage`: `owner-nostore` → 가드 카드 + 링크 2종, 가게 있는 사장님은 그대로. 사장님 첫 화면 규칙(`landing.test`)은 그대로 통과.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: E2E** — 골든 패스 사장님 단계와 무대 ③ 사장님 화면(`MyStorePage`)이 링크 추가로 안 깨지는지 확인한다. **Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 진척 문서** — owner-s01 · owner-a01 ✅ · O05 · O06 행, owner-s02 비고 `제휴 설정 ✅`, `/owner/me` 행 `→ /owner/store 이동(V2 MY 없음)`, API 표 #22~#25 · #27 화면 연결, 팀 요청 12(진위확인 API 키)는 그대로, devlog. **Step 7: 커밋** — `feat: 사업자 인증·가게 연결·제휴 설정 V2와 쿠폰 화면 가게 없음 가드`

---

### Task 22: R-02 최근 리뷰

**Files:**
- Create: `src/features/reviews/components/RecentReviews.tsx`(+`RecentReviews.test.tsx`)
- Modify: `src/features/reviews/model.ts`, `src/features/courses/model.ts`(`CourseStop.review` → `StoreReview | null`), `src/features/courses/components/StoreSheet.tsx`, `src/mocks/rules/views.ts`(`toStoreReview`), `src/mocks/handlers/handlers.test.ts`(기존 `review` 기대값에 `recent`), `src/pages/student/CourseMapPage.test.tsx`, `src/pages/guide/GuideCourseMapPage.test.tsx`

**Interfaces:**
- Consumes: Task 16 `StoreReviewSummary`; Task 3 `StarDisplay`; Task 18 시드 리뷰 시각 · `createReview`; 2A V2 `StoreSheet`; 현행 `formatShortDate`, `toCourseStop`(`src/mocks/rules/views.ts`).
- Produces: `RecentReview { rating: number; content: string; createdAt: string }` · `StoreReview extends StoreReviewSummary { recent: RecentReview[] }`(0건 = `recent: []`) · `toStoreReview(db, storeId): StoreReview`(`recent` = `createdAt` 내림차순, 같으면 id 내림차순 최대 3개 `{ rating, content, createdAt }` — 학생 · 가이드 코스 응답 모두) · `RecentReviews({ reviews }: { reviews: RecentReview[] }): JSX.Element | null` — 토글 `최근 리뷰`(`aria-expanded`, 처음 접힘), 항목 = `StarDisplay` + 내용 + `formatShortDate(createdAt)`, 빈 배열이면 null. `StoreSheet`는 평점 줄 뒤에 `RecentReviews`를 둔다(가이드 시트 · 학생 시트 공통, 한 줄 약 44px만 더한다).

- [ ] **Step 1: 실패하는 테스트** — `toStoreReview` 순서(같은 시각이면 id 내림차순) · 최대 3개, 0건 `recent: []`; 학생 코스 시트: 리뷰 있는 상점에서 `최근 리뷰` 토글이 접힌 채 시작 → 펼치면 별점 · 내용 · 날짜, 리뷰 0건 상점은 토글 없음 + `아직 리뷰가 없어요.`; 가이드 확정 코스 시트에서도 같은 토글(쿠폰 없음); Task 19로 리뷰를 쓰면 시트의 `최근 리뷰` 맨 앞이 새 리뷰. 기존 `handlers.test.ts`의 코스 `review` `toEqual`이 `recent`를 포함한 값으로 통과.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** — 전역 검증 명령(`StoreSheet`는 골든 패스 코스 화면이 쓴다).
- [ ] **Step 5: 진척 문서** — hs-s08 상점 시트 `최근 리뷰(R-02)` ✅(대시보드 메모 "프론트 타입 · 목업 · 화면은 MVP 2단계에서" 문장 갱신), devlog. **Step 6: 커밋** — `feat: 상점 시트 최근 리뷰(R-02)`

---

### Task 23: 마감 — P1 스모크 E2E · 골든 패스 · 무대 재실행 · 문서

**Files:**
- Create: `e2e/p1-smoke.spec.ts`
- Modify: `docs/progress/README.md`, `docs/progress/devlog.md`, `README.md`, `docs/reference/design-v2.md`(구현 메모: 2B 판정 링크 한 줄), `e2e/{golden-path,stage-viewport}.spec.ts`(남은 로케이터만)

**Interfaces:**
- Consumes: Task 3 패널 `P1 계정` Select · `이 계정으로 전환`; Task 2 `DEMO_P1_ACCOUNTS`(이메일은 e2e 안에 문자열로 적는다 — e2e는 앱 소스를 import하지 않는다); Task 8 `/verify` 문구(`재학 인증 제출하기` · 배지 `심사 중` · `보호자 페이지 열기` · `동의 완료`); Task 7 동의 화면 문구(`안내 확인 후 동의하기` · `학생 화면으로 돌아가기`); Task 1 `곧 열려요.`; 모든 화면 태스크의 라우트.
- Produces: `e2e/p1-smoke.spec.ts` — `e2e/fixtures.ts`의 `test` 사용(`goto` 1회, 앱 안 이동, 시연 패널은 전체 패널).
  - ① **막다른 곳 없음**: 역할마다 P1 계정으로 들어가(패널 `P1 계정` → `이 계정으로 전환`) P1 라우트를 링크로 열며 `곧 열려요.`가 없고 `h1`(또는 TopBar 제목)이 있다 — 고교생(`newbie` → `/verify`, MY → `/me` · `/me/edit` · `/me/settings`), 가이드(`guide-new` → `/guide/verify`, `guide-pending` → `/guide/me/profile` · `/guide/me` · `/guide/me/settings`, `guide@demo.kr` → `/guide/tours/new` · 탐방 완료 · 취소 · 코스 상점 선택 진입), 사장님(`owner-new` → `/owner/verify`, `owner-nostore` → `/owner/store/connect` → `/owner/store/partnership`), 운영자(`/admin/verifications` → 상세 → 반려 사유). 자리 화면은 `/explore` · `/owner/report`만.
  - ② **업로드**: `newbie@demo.kr`로 `/verify`에서 학교 · 학년 · jpg 1장(`setInputFiles` 버퍼) → `심사 중`(서비스 워커를 거치는 실제 multipart 경로, Review Focus 1).
  - ③ **같은 탭 보호자 동의**: `waiting@demo.kr` → `/verify` → `보호자 페이지 열기` → `안내 확인 후 동의하기` → `학생 화면으로 돌아가기` → `동의 완료`(Review Focus 2).

- [ ] **Step 1: 스모크 작성 · 통과** — 위 3개 시나리오. 실패하면 해당 화면 태스크의 문구 · 로케이터를 고친다.
- [ ] **Step 2: 전체 E2E 재실행** — 골든 패스 2변형 · 발표 모드 · 무대 9개(`stage-viewport`) · smoke · p1-smoke가 모두 통과. 무대 스크린샷(`test-results/stage-*.png`)을 열어 G03(`+ 장소 추가` 추가분) · 쿠폰 · 사장님 화면을 확인한다(커밋하지 않음).
- [ ] **Step 3: 문서** — `docs/progress/README.md`: 화면 표 P1 행 전부 ✅(V2 적용, `/owner/me`는 이동) · V2 신규 행 H16~H18 · G05 · G12 · G13 · A03 · O05 · O06 확인, API 연동표 #1~#27 목업 ✅ 일치 확인, 팀 요청 19~23 상태, `docs/progress/README.md`의 판정 뷰포트 실측표 G03 줄 갱신, 열린 질문(리뷰 단계 무대 측정 · 11/6 대본 게이트). `README.md`: 시연 계정 표 · 동의 링크 · 데모 사업자 번호 · `P1 계정` 패널 설명 · 목업 사진 한 줄 최종 확인. `docs/reference/design-v2.md`: 구현 메모에 이 계획의 2B-R 링크 한 줄. devlog.
- [ ] **Step 4: 전역 검증 · 커밋** — 전역 검증 명령, `test: P1 스모크 E2E와 2B 마감 문서`

---
