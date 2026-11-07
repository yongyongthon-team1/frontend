# MVP 2C — 백엔드 API 명세 전환과 T-01 희망 사항 흐름 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프론트가 백엔드 API 명세(`docs/api/backend-spec.md`, 46개 + 공통규칙)의 경로 · 봉투 · snake_case · 오류 코드로 말하게 바꾸고(도메인 타입 · 화면은 그대로), T-01을 기능 명세대로 "학교 · 학과 · 희망 사항 저장 → 조건에 맞는 모집 중 탐방 + 입력한 원문"으로 다시 만들며, T-07(내 희망 사항) · T-08(고교생 희망 사항) 화면을 더한다. 목업 시연은 T-01 말고는 어느 태스크 뒤에도 지금과 똑같이 돈다.

**Architecture:** 혼합 어댑터(결정 0011, `backend-alignment.md` 7절). `shared/lib/http.ts`가 봉투 벗기기 · 키 변환(요청 snake, 응답 camel) · 백엔드 오류 코드 → `ErrorCode` 해석 · `listAll`을 한 곳에서 하고, `features/<도메인>/wire.ts`가 `Wire*` 타입(명세 필드의 camel판 + 선택 확장)과 순수 함수 `fromWire*`를, `features/<도메인>/api.ts`가 백엔드 경로 호출과 여러 호출의 합성을 맡는다. 목업은 규칙(`mocks/rules/*`, 내부 `ErrorCode`를 던진다)을 그대로 두고, `mocks/wire/<도메인>.ts`의 `toWire*` 뷰와 `mocks/wire/envelope.ts`의 `ok()` · `fail()`(오류 역표)로 백엔드 와이어를 낸다. 도메인 하나씩(커밋 하나씩) 바꾸고 그때마다 골든 패스 · 발표 모드 · 무대 E2E를 다시 통과시킨다.

**Tech Stack:** Vite 7 · React 19 · TypeScript 5.9(strict) · React Router 7 · TanStack Query 5 · Zustand 5 · RHF 7 + Zod 4 · Tailwind 4(V2 토큰) · Radix · MSW 2 · Vitest 3 + Testing Library · Playwright. 새 의존성 없음.

**Spec:** 결정 [`docs/decisions/0011-backend-spec-and-t01-wish-flow.md`](../../decisions/0011-backend-spec-and-t01-wish-flow.md) + 대조 분석 [`docs/api/backend-alignment.md`](../../api/backend-alignment.md)(1-1 · 2 · 3 · 4 · 5 · 7절). 정확한 경로 · 필드 · 코드 · 예시는 [`docs/api/backend-spec.md`](../../api/backend-spec.md), 기능 규칙은 [`docs/reference/feature-spec.md`](../../reference/feature-spec.md)의 T-01 · T-07 · T-08. 2A 계획(전부 구현) · 2B 계획(Task 1~4 구현, 나머지 정지) · 2B errata(`.superpowers/sdd/2026-11-06-mvp2b-p1-screens-v2/errata.md`)의 General 절이 아래 Global Constraints로 이어진다. 대조 분석과 이 계획이 다르면 이 계획의 판정(2C-R)이 앞선다(대조 분석이 틀린 곳은 판정에 적었다).

## Global Constraints

(1단계 · 2A · 2B의 Global Constraints 중 아래와 부딪히지 않는 것은 그대로 적용된다. 다르면 아래가 앞선다.)

- **우선순위(결정 0011):** 팀 합의 · 기능 명세(무엇을) > 백엔드 API 명세(경로 · 요청 · 응답 모양) > V2(배치 · 시각) > 우리 계약 · 계획 · 판정.
- **백엔드 값은 명세 그대로:** 경로 · 필드 이름 · 오류 코드 · 상태 코드는 `backend-spec.md`에서 복사한다. 경로 매개변수 이름은 명세 표의 것(`{tourId}` → MSW `:tourId`, `{couponCode}` → `:couponCode`, `{wishId}` → `:wishId`, `{applicationId}` → `:applicationId`, `{campusId}` → `:campusId`).
- **목업 시연은 지금과 똑같다:** T-01(Task 11) 말고는 어느 태스크 뒤에도 목업 모드 화면의 문구 · 순서 · 숫자 · 이동이 바뀌지 않는다. 바뀌어야 하는 곳은 판정 2C-R12의 목록뿐이다(백엔드 규칙 때문에 피할 수 없는 것). 무대 스크린샷(`test-results/stage-*.png`)을 태스크 전후로 눈으로 비교한다(커밋하지 않음).
- **도메인 하나 = 커밋 하나.** 한 태스크가 두 도메인의 핸들러를 바꾸지 않는다(합성을 위해 다른 도메인의 *와이어 수준 함수*를 더하는 것은 된다 — Task 9의 `listMyCouponRows`).
- **`features/**`는 API 모드를 모른다.** 어댑터는 확장 필드가 있는지만 본다: `wire.x ?? 대체값`. 값이 null일 수 있는 확장은 `wire.x !== undefined`로 있는지를 가른다. 모드(`mock`/`real`)로 분기하지 않는다.
- 의존 방향은 `demo → features → shared`만(목업 · 테스트는 어디든 import 가능). 페이지는 `@/shared/lib/http`와 `@/features/*/api`를 import하지 않는다(ESLint). 페이지는 `ApiError`를 import하지 않고 훅의 오류 타입으로 `error.code` · `error.fieldErrors`를 읽는다(errata G4).
- 색은 토큰으로만, **그림자 금지**(Tailwind `shadow-*` · `ring-*`도 box-shadow다 — 2B Task 3 리뷰). 좌우 여백 20, 기본 버튼 56 · 반경 16, 최소 터치 44.
- **무대 400px 예산:** 판정 뷰포트 1366×620 · 1280×600 · 1280×590@1.5에서 핵심 정보가 스크롤 없이, 하단 탭 위에, 3×3 표본 점이 덮이지 않게 보인다(`e2e/stage-viewport.spec.ts`의 `expectVisibleWithoutScroll`). 대상: ① **탐방 찾기 결과의 희망 원문 카드 + 첫 탐방 행**(Task 11에서 대상이 바뀐다), ② 코스 완성 지점 카드 3개, ③ 쿠폰 코드. 넘치면 장식부터 줄인다(2A-R4). 단언은 느슨하게 하지 않는다.
- 데이터 우선 렌더링(`ErrorState`는 데이터가 없을 때만), 로딩 `Skeleton`, 빈 상태 `EmptyState`, 비활성 버튼은 사유 + 다음 행동(`Button`의 `hint`), 되돌릴 수 없는 버튼은 처리 중 잠그고 연타해도 요청 1번(테스트에 연타 단언).
- 컴포넌트는 시계로 유효 여부를 판단하지 않는다. **어댑터 안의 시계는 허용**한다(`computeCouponState` · `computePartnershipState` · `computeCancellable` — 대조 분석 2절).
- 한글 IME: 한 줄 입력이 있는 새 폼은 `<form onKeyDown={preventImeEnter} noValidate>`.
- **제안 문구**는 이 계획에 적힌 그대로 쓴다(실행자가 지어내지 않는다). 문구가 없는 곳에 문구가 필요하면 NEEDS_CONTEXT로 묻는다.
- **숨은 테스트 의존(errata G2):** 경로 · 문구 · 응답 모양을 바꾸면 그 문자열을 grep해서 쓰는 테스트 · E2E 로케이터를 같은 태스크에서 고친다. 각 태스크의 "숨은 의존" 목록은 시작점이고 전부가 아니다.
- 테스트 도구: `renderApp(path, { as, checkpoint })` · `loginAs` · `server` · `findApplicationId` · `demoCouponCode` + 2C의 `wireOk` · `wirePage` · `wireFail` · `rawFetch` · `expectWireShape`(`src/test/wire.ts`). 시드 계정은 이메일로 찾는다.
- 모든 태스크: `npm run test:run && npm run typecheck && npm run lint && npm run build && npm run e2e`(이하 "전역 검증 명령")가 통과해야 커밋한다. E2E가 깨지면 같은 태스크에서 고친다.
- 마지막 구현 단계 = 진척 문서(`docs/progress/README.md`의 해당 행 + `docs/progress/devlog.md` 2026-11-07(또는 그날) 한 줄). 커밋은 main에 직접, **푸시하지 않는다**(사용자 확인 후, 11/15 15:30 이후 금지).
- 앞 태스크가 고친 파일을 다시 고칠 때는 줄 번호 대신 기호(함수 · 경로 문자열)로 찾는다. 계획의 글머리 기호는 이어진 문장으로 읽는다(errata G1).

## 판정 (이 계획에서 정한 것 — 2C-R)

- **2C-R1 경로 접두사.** 프론트 base는 `/api` 그대로(`VITE_API_BASE_URL` 기본, MSW `api()`, E2E `fixtures.ts`가 `/api/`로 API 요청을 가른다). 경로 문자열은 백엔드 그대로(`/users/me`). 개발 프록시가 `/api`를 뗀다(`vite.config.ts` `rewrite: (p) => p.replace(/^\/api(?=\/|$)/, '')`). Vercel은 백엔드 주소가 정해지면 `{ "source": "/api/:path*", "destination": "https://<백엔드>/:path*" }`를 SPA 규칙 **앞**에 둔다(주소 미정이라 2C에서는 결정 0005 결과에 한 줄만). `VITE_API_BASE_URL`에 백엔드 주소를 바로 넣어도 된다(CORS 필요).
- **2C-R2 봉투 판별.** 본문이 객체이고 `code`가 `/^[SE]\d{3}/`이며 `data` 키가 있으면 봉투다. `timestamp`는 보지 않는다(명세 예시에 없어 픽스처가 못 벗겨진다 — 대조 분석 2절의 "timestamp와 data" 규칙은 틀렸다). 성공 봉투는 `data`를, 그 밖의 성공 본문은 본문 전체를 돌려준다(봉투 판별은 영구 — 프록시가 맨 JSON을 줘도 돈다). 옛 오류 모양(`{ code: ErrorCode, fieldErrors }`) 수용은 전환 기간뿐이고 Task 13에서 지운다.
- **2C-R3 키 변환(`shared/lib/caseKeys.ts`).** 응답은 `toCamel`, 요청 본문은 `toSnake`. 바꾸는 것은 **보통 객체**(프로토타입이 `Object.prototype` 또는 `null`)의 키와 배열의 원소뿐이고 값(문자열 · 열거형)은 그대로다. `FormData` · `Blob`/`File` · `Date` · `URLSearchParams`는 같은 참조로 그대로 둔다. 쿼리 문자열은 호출하는 쪽이 snake 이름으로 직접 쓴다(`withQuery`). `snakeToCamel`: `_` 뒤의 영소문자 · 숫자만 대문자/그대로 붙인다(`address_line_2` → `addressLine2`), 맨 앞 `_`는 그대로(`_meta`). `camelToSnake`: 대문자 앞에만 `_`(`addressLine2` → `address_line2` — 숫자 앞에 `_`를 넣지 않는 비대칭, 명세에 숫자 필드가 없음을 확인함). 둘 다 이미 바뀐 키에 다시 써도 같다(멱등). 목업 `readBody`도 `toCamel`을 해서 목업 내부는 계속 camel로 읽는다.
- **2C-R4 오류 코드 해석.** `ApiError.code`는 계속 `ErrorCode`이고 `ApiError.backendCode`에 받은 코드를 둔다(클라이언트 오류 TIMEOUT · NETWORK · 봉투 아닌 오류는 null). 해석 순서(`resolveErrorCode`): ① 호출별 `errorMap` → ② (전환 기간만) 이미 `ErrorCode` 이름이면 그대로 → ③ 기본 표 `BACKEND_ERROR_MAP`(아래 표) → ④ `E\d{3}_<이름>`의 `<이름>`이 `ErrorCode`면 그것(목업 확장 코드 2C-R6) → ⑤ `UNKNOWN`. `ApiError.message`는 늘 `errorMessage(code)`(화면 문구를 우리 표로 맞춘다 — 백엔드 `message`는 버린다).
- **2C-R5 `errors[]` → `fieldErrors`.** `errors: [{ field, reason }]`을 `{ [fieldMap[field] ?? snakeToCamel(field)]: 문구 }`로 바꾼다. 같은 칸이 여럿이면 첫 항목. `reason`이 대문자 기계값(`/^[A-Z][A-Z_]*$/`, 예 `MISMATCH`)이면 문구로 쓰지 않고 `errorMessage(code)`를 쓴다. 오류 봉투의 `data`가 객체면 `toCamel`해서 `ApiError.details`에 둔다(목업 확장: `E409_ALREADY_USED`의 `used_at`).
- **2C-R6 목업 오류 역표(`mocks/wire/errorCodes.ts`).** 규칙은 지금처럼 `MockApiError(상태, ErrorCode)`를 던지고 핸들러 경계의 `fail()`이 `toBackendError(code, status)`로 백엔드 코드 · 상태를 정한다(아래 표). 백엔드에 짝이 없는 코드는 `E{상태}_{ErrorCode}`(예 `E409_REAPPLY_AFTER_REJECT`, `E409_COUPON_NOT_YET`)인 **목업 확장 코드**로 내고, 클라이언트는 2C-R4 ④로 되찾는다. `MockApiError.details`는 봉투 `data`(snake)로, `fieldErrors`는 `errors[]`(`field`는 `camelToSnake`)로 낸다.
- **2C-R7 합성 대 확장.** 다른 백엔드 엔드포인트로 같은 값을 얻을 수 있으면 **합성**한다(탐방 요약 → `GET /tours/{tourId}`, 내 가게 id · 이름 → `GET /users/me/store`, 가이드 탐방의 초안 여부 → `GET /tours/{tourId}/course`, 쿠폰의 신청 id → `GET /users/me/tours`). 합성할 수 없거나 문자열 조인(캠퍼스 이름)에 기대야 하면 **목업 전용 선택 확장**(아래 2C-R8 표)이다. 확장 이름은 snake이고 `backend-alignment.md` 9절 요청안과 같다 — 목업이 곧 요청안이다. 확장이 없을 때의 대체값은 표대로이고 어댑터 단위 테스트가 명세 예시(확장 없음)로 그 경로를 지킨다.
- **2C-R8 확장 표.** 아래 "확장 필드 · 확장 엔드포인트" 표가 전부다. 표에 없는 확장을 더하지 않는다.
- **2C-R9 캠퍼스 조인.** 탐방을 다루는 api 함수는 마지막 인자로 `campuses: University[]`를 받는다(모듈 캐시를 두지 않는다). 훅은 `loadCampuses(queryClient)`(= `ensureQueryData(campusesQueryOptions())`, `staleTime: Infinity`)로 넣는다. 조인 순서: `campus_id`(확장)로 찾기 → `campus_name`이 `campusLabel(u.name, u.campusName)` 또는 `` `${u.name} ${u.campusName}` ``와 같은 캠퍼스 → 못 찾으면 `campus_name`을 첫 공백에서 나눈다(공백이 없으면 캠퍼스 `본교`), `universityId: 0`. 명세 D-01 예시(`주전캠퍼스`)와 탐방 예시(`죽전캠퍼스`)는 철자가 달라 세 번째 길을 탄다.
- **2C-R10 목업 인증 관용.** 목업은 지금처럼 `GET /tours` · `GET /tours/{tourId}`를 토큰 없이도 준다(앱의 모든 화면이 로그인 뒤라 화면 차이가 없다). 그 밖의 토큰 · 역할 검사는 명세와 같다.
- **2C-R11 목업에 더하는 백엔드 업무 규칙.** 오류 코드 체계는 그대로 두되, 명세가 정한 규칙 중 이것만 목업 규칙에 더한다: 코스 확정 때 탐방 날짜에 유효한 제휴 지점이 0이면 `MockApiError(422, 'COURSE_PARTNER_REQUIRED')`, 코스 수정은 `spots` 1개 이상 · `comment` 100자, 신청 `wish` 100자, 희망 사항 `major` 30자 · `wish` 100자, 가입 · 프로필 길이(이름 20, 고교 이름 50, 관심 학과 30, 가이드 소개 필수 200, 비밀번호 영문+숫자 8자 이상). `E409_DAILY_LIMIT`(같은 날 같은 가게 한 장)는 손님별인지 가게 전체인지 답(9절) 전까지 목업에 넣지 않는다(가게 전체면 시연이 막힌다) — 클라이언트는 코드 대응과 문구만 갖춘다.
- **2C-R12 피할 수 없는 화면 · 타입 변경(목업 시연 화면은 그대로).** ① `CourseStop.campusBuildingId: number | null` 추가(캠퍼스 지점을 PUT에 다시 보내야 한다). ② 지점이 1곳이면 `StopActionSheet`의 `빼기` 비활성 + 사유 `지점은 1곳 이상 있어야 해요.`(제안 문구, `spots` ≥ 1). ③ 한줄평 입력 `maxLength` 100(`COURSE_NOTE_MAX`). ④ 신청서 최대 100자(`APPLY_WISH_MAX`, 지금 300). ⑤ `RedeemResult.tourVisitorCount` · `totalVisitorCount`를 `number | null`로, null이면 O07의 `이번 탐방으로 온 학생 {n}명` 캡션을 숨긴다. ⑥ `StoreSheet`는 `review.summary`가 있으면 리뷰 수가 0이어도 `✦ AI 리뷰 요약` 블록을 보이고 별점 줄은 수가 1 이상일 때만, `아직 리뷰가 없어요.`는 수 0 + 요약 없음일 때만. 목업에서는 확장 필드 덕에 ⑤ · ⑥의 모습이 지금과 같다.
- **2C-R13 코스 지점 PUT 빌더.** 순서 · 한줄평 · 빼기는 `buildSpots(course, edit)`로 전체 `spots` 배열을 만들어 `PUT /tours/{tourId}/course/spots`로 보낸다(Task 8의 알고리즘). 시각은 위치 슬롯(`slotTimes(tour.startsAt, n)`: 시작 + 0 · 70 · 120 · 170 · 220분, 그 뒤 50분씩)이다. 훅은 캐시의 가이드 코스(`qk.guideCourse(tourId)`)를 쓰고 없으면 `getGuideCourse`로 받는다. 목업은 같은 상점(또는 같은 캠퍼스 건물)을 유지한 지점의 id · `reason`을 지키고 새 지점의 `reason`은 null이다(명세 그대로).
- **2C-R14 가이드 코스 조회.** 학생 · 가이드 모두 `GET /tours/{tourId}/course`. 가이드의 응답이 404 또는 `COURSE_NOT_READY`면 "코스 없음"(null). 목업: 그 탐방의 가이드면 초안 · 확정 코스(없으면 404 `E404`), 승인된 신청자면 확정 코스만(아니면 409 `E409_COURSE_NOT_READY`), 그 밖은 403 `E403`.
- **2C-R15 모호한 백엔드 코드 세분(어댑터가 다시 읽어 고른다).** 신청 `E403_VERIFICATION_REQUIRED` → `GET /users/me`의 `verification_status`가 `APPROVED`면 `GUARDIAN_NOT_AGREED`, 아니면 `NOT_VERIFIED`. 신청 `E409_TOUR_FULL` → `GET /tours/{tourId}`의 상태가 `CANCELED` · `COMPLETED`면 `TOUR_NOT_RECRUITING`, 아니면 `TOUR_CLOSED`(대조 분석 4-37의 "RECRUITING이 아니면"은 틀렸다 — CLOSED는 정원 마감이다). 승인 · 거절 `E409_TOUR_FULL` → `CAPACITY_EXCEEDED`(errorMap). 신청 취소 `E409_INVALID_APPLICATION_STATUS` → 그 신청을 다시 읽어 PENDING · APPROVED면 `CANCEL_AFTER_TOUR_DATE`, 아니면 `ALREADY_PROCESSED`. 쿠폰 확인 · 사용 `E404` → `COUPON_NOT_FOUND`, 내 가게 `E404` → `STORE_NOT_LINKED`, 가입 `E409` → `EMAIL_DUPLICATE` + `fieldErrors.email`(errorMap · 어댑터).
- **2C-R16 T-01 흐름.** 홈 제출 → `POST /tour-wishes`(뮤테이션 한 번) → 성공하면 `/tours?school={id}&major=…&wish=…[&date=…]`로 이동하고 그 검색을 `useLastQuery`에 기억한다 → 결과 화면이 `GET /tours?status=RECRUITING&campus_id&major[&date_from]` → 0건이면 `GET /tours?status=RECRUITING&campus_id`로 한 번 더(대체 — 문구로 알린다) → 그것도 0건이면 0건 카드. 정렬은 시작 시각 오름차순(같으면 id). 결과 화면의 원문은 주소의 `wish` 값 그대로다(제출 때 앞뒤 공백만 뺀다, 줄바꿈은 지킨다, `whitespace-pre-wrap`). AI · 추천 이유 · 키워드 · 필터 칩은 없다.
- **2C-R17 희망 날짜.** 날짜가 있으면 `date_from=그 날짜`(그날 이후, 날짜 빠른 순이라 그날 탐방이 맨 앞) — 명세 "이 날짜의 탐방을 우선"의 해석이다. 9절에 확인 질문을 남긴다. 대체 조회는 날짜도 뺀다.
- **2C-R18 라우트 · 탭 · 진입점.** 결과 화면 `/tours`(고교생, `탐색` 탭 — 이미 match에 있다). `/recommendations` 라우트는 지운다(옛 주소는 404). T-07 `/me/wishes` · `/me/wishes/:wishId/edit`(고교생, `MY` 탭 — `to: '/me'`의 접두사), 진입은 `/me` 자리 화면 안의 행 `내 희망 사항`과 결과 화면 원문 카드의 `내 희망 사항 ›`. T-08 `/guide/wishes`(가이드, `내 탐방` 탭 match에 `/guide/wishes` 추가), 진입은 G01의 모든 상태에서 `내가 개설한 탐방 ›` 바로 위 행 `고교생 희망 사항`. 탐방 개설(G04)은 2B 자리라 2C에서 진입을 두지 않는다.
- **2C-R19 시연 미리 채움.** `src/features/tours/examples.ts`(import 없는 파일 — E2E가 import한다)의 `DEMO_WISH = { universityId: 2, major: '산업디자인', wish: '산업디자인 작업실을 구경하고, 학생들이 자주 가는 카페에도 가 보고 싶어요.' }`(제안 문구). 시연 도구가 켜졌고, 입력을 아직 건드리지 않았고, 주소에 검색이 없을 때만 채운다. 학교는 캠퍼스 목록에 그 id가 있을 때만 채운다(실서버 id가 다르면 빈칸). 날짜는 채우지 않는다.
- **2C-R20 지우는 것 · 다시 쓰는 것.** 지운다: 목업 추천 AI(`mocks/ai/recommend.ts` + 테스트), `RecommendationsPage`(+테스트), `features/tours/{filterChips,recommendationParams}.ts`(+테스트), `shared/ui/FilterChips.tsx`(+`ui.test.tsx`의 `FilterChips` describe와 `StatefulChips`), 추천 타입 · `recommend` · `useRecommendations` · `qk.recommendations` · `EXAMPLE_QUERIES` · `POST /recommendations` 핸들러, 코스 목업 규칙 `reorderStops` · `updateStopDescription` · `deleteStop`(+테스트 → `replaceSpots` 테스트로). 남긴다: `mocks/ai/interests.ts`(C-01 코스 초안 목업이 쓴다), `AiLoading`(코스 초안) · `AiBadge` · `AiReasonPrefix`(코스), `lastQuery.ts`(결과 화면 경로를 기억), `KeywordChips`(2C 범위 밖). 테스트는 의도가 남는 것은 다시 쓰고(`HomePage.test` · `applyButtonState.test` · `lastQuery.test` · 핸들러 테스트), 대상이 사라진 것만 지운다(필터 칩 · 추천 이유 · 추천 0건 헤드라인).
- **2C-R21 T-07 수정은 바뀐 칸만.** `PATCH /users/me/tour-wishes/{wishId}`에 `diffWishPatch(before, after)`가 고른 칸만 보낸다. 목록 항목에 `campus_id` · `date`가 없으면(실서버) 학교는 2C-R9 조인으로 채우고(못 찾으면 빈칸), 날짜는 빈칸이며, 손대지 않은 칸은 보내지 않는다.
- **2C-R22 T-08 기본 학교 · 인증 전.** `me.guideProfile.universityId`(목업 확장 `campus_id`)가 있으면 그 학교를 고른 채 시작하고, 없으면 첫 선택지 `내 학교`(값 `''` → `campus_id`를 보내지 않음, 서버 기본 "내 인증 학교"). 가이드 인증이 `APPROVED`가 아니면 API를 부르지 않고 안내 상태를 그린다.
- **2C-R23 `listAll`.** `size=50`(명세 상한)으로 부르고, 응답에 `total`이 있고 모은 수가 그보다 적으면 `page`를 하나씩 올려 이어 부른다. 빈 쪽이 오면 멈추고, 최대 20쪽. `items`만 오면(작은 목록) 한 번으로 끝낸다.
- **2C-R24 레지스트리 전환.** `CONTRACT` · `P1_CONTRACT`를 `BACKEND_CONTRACT`(명세 46개 메서드 · 경로) + `EXTENSIONS`(목업 전용 3개)로 바꾼다. 전환 기간에는 `LEGACY`(아직 안 바꾼 옛 경로)와 `NOT_MOCKED`(아직 목업이 없는 백엔드 경로)를 두고 `등록 핸들러 = (BACKEND_CONTRACT − NOT_MOCKED) ∪ EXTENSIONS ∪ LEGACY`를 단언한다. 도메인 태스크가 자기 줄을 두 목록에서 지운다. 끝나면 `LEGACY`는 없어지고 `NOT_MOCKED`는 2B가 채울 20개다.
- **2C-R25 테스트 전략.** ① 어댑터 계약: `src/test/fixtures/backend/<도메인>.ts`에 `backend-spec.md`의 응답 예시를 **한 글자도 바꾸지 않고** 옮기고(봉투째), `fromWire*(toCamel(픽스처.data))`를 기대 도메인 객체와 비교한다 — 확장 없는 실서버 경로. ② 와이어 일치: 목업 응답을 `rawFetch`로 받아 `expectWireShape(본문.data, 픽스처.data, 확장 키 목록)` — 명세 키는 모두 있고 그 밖에는 확장 키만. ③ `mocks/handlers/handlers.test.ts`는 옛 경로 `request<도메인>()` 대신 `features/*/api` 함수(목업 + 어댑터 끝까지)를 부른다. ④ 화면 테스트의 `server.use` 덮어쓰기는 `wireOk` · `wirePage` · `wireFail`로.
- **2C-R26 목업 뷰 교체.** 도메인 DTO를 만들던 `mocks/rules/views.ts`의 함수는 도메인을 바꿀 때 `mocks/wire/<도메인>.ts`의 `toWire*`로 옮긴다. 테스트 · 다른 목업 코드가 도메인 객체를 계속 써야 하면 그 함수를 `fromWire*(toWire*(…))` 합성으로 다시 구현한다(예 `toMe`, `myStoreOf`) — 목업 안에 같은 값의 출처가 둘이 되지 않게.
- **2C-R27 합성 세부.** 신청자의 `verified`는 늘 true(A-01이 인증 APPROVED를 요구). `GuideTourSummary.counts.total = approved_count + pending_count`(거절 제외 — 시드에서 화면 차이 없음). 학생 `MyApplication.courseStatus = course_confirmed ? 'CONFIRMED' : null`(학생 화면은 초안을 준비 중으로 같이 본다). 가이드 탐방은 확정이 아니면 `getGuideCourseStatus`로 초안 여부를 얻는다. `MyApplication.cancellable = computeCancellable(...)`. 쿠폰의 `applicationId`는 내 탐방 행 중 같은 `tour_id`의 APPROVED 신청(없으면 id가 가장 큰 것).
- **2C-R28 시연 패널의 실서버 처리.** 헬스: `GET /health`가 404면 토큰 없는 `GET /campuses`가 되면 `정상`. 초기화: 미리 알아낼 수 없으므로(시험 호출이 곧 초기화다) 첫 `POST /demo/reset`이 404면 토스트 설명 `실서버에는 시연 초기화가 없어요.`(제안 문구)를 보이고 그 세션 동안 `시연 데이터 초기화` 버튼을 같은 사유로 잠근다.

### 기본 오류 표 `BACKEND_ERROR_MAP`(2C-R4 ③)

| 백엔드 코드 | ErrorCode | | 백엔드 코드 | ErrorCode |
|---|---|---|---|---|
| `E400` | `VALIDATION` | | `E409_COURSE_CONFIRMED` | `COURSE_NOT_DRAFT` |
| `E401` | `UNAUTHORIZED` | | `E409_COURSE_NOT_READY` | `COURSE_NOT_READY` |
| `E401_INVALID_CREDENTIALS` | `INVALID_CREDENTIALS` | | `E409_ALREADY_USED` | `COUPON_ALREADY_USED` |
| `E403` | `FORBIDDEN` | | `E409_DAILY_LIMIT` | `COUPON_DAILY_LIMIT`(새) |
| `E403_VERIFICATION_REQUIRED` | `NOT_VERIFIED` | | `E409_ALREADY_SUBMITTED` | `ALREADY_PROCESSED` |
| `E403_OTHER_STORE` | `COUPON_OTHER_STORE` | | `E409_CONSENT_EXISTS` | `ALREADY_PROCESSED` |
| `E403_COUPON_NOT_USED` | `REVIEW_NOT_ALLOWED` | | `E409_ALREADY_REVIEWED` | `ALREADY_PROCESSED` |
| `E404` | `NOT_FOUND` | | `E409_STORE_UNAVAILABLE` | `STORE_ALREADY_LINKED` |
| `E409` | `ALREADY_PROCESSED` | | `E410_EXPIRED` | `COUPON_EXPIRED` |
| `E409_TOUR_FULL` | `TOUR_CLOSED` | | `E422_BUSINESS_INVALID` | `BIZ_MISMATCH` |
| `E409_ALREADY_APPLIED` | `DUPLICATE_APPLICATION` | | `E422_PARTNER_REQUIRED` | `COURSE_PARTNER_REQUIRED`(새) |
| `E409_ALREADY_PROCESSED` | `ALREADY_PROCESSED` | | `E502_AI_FAILED` | `AI_FAILED`(새) |
| `E409_INVALID_APPLICATION_STATUS` · `E409_INVALID_TOUR_STATUS` | `ALREADY_PROCESSED` | | `E500` | `UNKNOWN` |
| `E409_GUIDE_PROFILE_REQUIRED` | `GUIDE_PROFILE_REQUIRED` | | `E409_NO_APPROVED_APPLICANT` | `NO_APPROVED_APPLICANTS` |

새 `ErrorCode` 문구(제안 문구): `COURSE_PARTNER_REQUIRED` `제휴 상점을 1곳 이상 넣어 주세요.` · `COUPON_DAILY_LIMIT` `오늘 이 가게에서는 이미 쿠폰을 사용했어요.` · `AI_FAILED` `AI가 코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.`

### 목업 역표 `toBackendError(code, status)`(2C-R6)

| ErrorCode | 백엔드 코드 · 상태 |
|---|---|
| `VALIDATION` | `E400` · 400 |
| `UNAUTHORIZED` · `INVALID_CREDENTIALS` | `E401` · `E401_INVALID_CREDENTIALS` · 401 |
| `FORBIDDEN` | `E403` · 403 |
| `NOT_VERIFIED` · `GUARDIAN_NOT_AGREED` · `BIZ_NOT_VERIFIED` | `E403_VERIFICATION_REQUIRED` · 403 |
| `COUPON_OTHER_STORE` · `REVIEW_NOT_ALLOWED` | `E403_OTHER_STORE` · `E403_COUPON_NOT_USED` · 403 |
| `NOT_FOUND` · `COUPON_NOT_FOUND` · `STORE_NOT_LINKED` · `CONSENT_LINK_INVALID` | `E404` · 404 |
| `EMAIL_DUPLICATE` | `E409` · 409 |
| `TOUR_CLOSED` · `TOUR_NOT_RECRUITING` · `CAPACITY_EXCEEDED` | `E409_TOUR_FULL` · 409 |
| `DUPLICATE_APPLICATION` · `ALREADY_PROCESSED` | `E409_ALREADY_APPLIED` · `E409_ALREADY_PROCESSED` · 409 |
| `CANCEL_AFTER_TOUR_DATE` | `E409_INVALID_APPLICATION_STATUS` · 409 |
| `TOUR_ALREADY_COMPLETED` · `COMPLETE_BEFORE_TOUR_DATE` | `E409_INVALID_TOUR_STATUS` · 409 |
| `GUIDE_PROFILE_REQUIRED` | `E409_GUIDE_PROFILE_REQUIRED` · **409**(지금 403) |
| `NO_APPROVED_APPLICANTS` · `COURSE_NOT_DRAFT` | `E409_NO_APPROVED_APPLICANT` · `E409_COURSE_CONFIRMED` · 409 |
| `COURSE_NOT_READY` | `E409_COURSE_NOT_READY` · **409**(지금 404) |
| `COUPON_ALREADY_USED` · `COUPON_DAILY_LIMIT` | `E409_ALREADY_USED` · `E409_DAILY_LIMIT` · 409 |
| `STORE_ALREADY_LINKED` · `STORE_LIMIT` | `E409_STORE_UNAVAILABLE` · 409 |
| `REVIEW_DUPLICATE` | `E409_ALREADY_REVIEWED` · 409 |
| `COUPON_EXPIRED` · `CONSENT_LINK_EXPIRED` | `E410_EXPIRED` · **410**(지금 409) |
| `BIZ_MISMATCH` · `BIZ_CLOSED` | `E422_BUSINESS_INVALID` · 422 |
| `COURSE_PARTNER_REQUIRED` · `AI_FAILED` | `E422_PARTNER_REQUIRED` · 422 / `E502_AI_FAILED` · 502 |
| `UNKNOWN` | `E500` · 500 |
| 그 밖(`REAPPLY_AFTER_REJECT` · `COUPON_NOT_YET` · `COURSE_EMPTY` · `COURSE_STOP_*` · `OUTSIDE_VACATION` · `FILE_*` · `ADDRESS_NOT_FOUND` · `PARTNERSHIP_PERIOD_INVALID`) | `E{status}_{ErrorCode}` · 받은 상태(목업 확장 코드) |

되돌려 읽으면 정보가 줄어드는 15개(`GUARDIAN_NOT_AGREED` · `BIZ_NOT_VERIFIED` · `TOUR_NOT_RECRUITING` · `CAPACITY_EXCEEDED` · `COUPON_NOT_FOUND` · `STORE_NOT_LINKED` · `CONSENT_LINK_INVALID` · `EMAIL_DUPLICATE` · `CANCEL_AFTER_TOUR_DATE` · `TOUR_ALREADY_COMPLETED` · `COMPLETE_BEFORE_TOUR_DATE` · `STORE_LIMIT` · `REVIEW_DUPLICATE` · `CONSENT_LINK_EXPIRED` · `BIZ_CLOSED`)는 2C-R15의 호출별 세분이 되찾는다(2C 밖의 것은 2B 재계획).

### 확장 필드 · 확장 엔드포인트(2C-R8)

| 어디 | 확장(snake) | 확장이 없을 때(실서버) |
|---|---|---|
| `GET /users/me`(대학생) | `campus_id` | `guideProfile.universityId: null` |
| `GET /tours` 항목 · `GET /tours/{tourId}` | `campus_id` | 2C-R9 이름 조인 → 첫 공백 나누기 |
| `GET /users/me/tours`(고교생 항목) | `wish` · `created_at` · `coupon_count` | `motivation: ''` · `createdAt: ''` · `GET /users/me/coupons`를 `tour_id`로 센다 |
| 코스 스팟(모든 코스 응답) | `spot_id` · `discount_text` · `review_average` · `review_count` | `id = order` · 제휴면 `discount: '쿠폰 사용 가능'`(제안 문구) · `average: null` · `count: 0` |
| `GET /tours/{tourId}/course` | `coupon_count` | CONFIRMED면 승인 수(`capacity − remaining`) × 제휴 지점 수, 아니면 0 |
| `GET /users/me/coupons` 항목의 `store` | `category` | `storeCategory: ''` |
| `GET /coupons/{couponCode}` | `used_at` · `tour_title` · `student_name` | `usedAt: null` · `tourTitle: '탐방'`(제안 문구) · `studentName: ''` |
| `POST /coupons/{couponCode}/redeem` | `tour_visitor_count` · `total_visitor_count` | `null`(캡션 숨김, 2C-R12 ⑤) |
| 오류 봉투 `E409_ALREADY_USED` | `data.used_at` | `details` 없음(`재사용 불가`만) |
| `GET /users/me/tour-wishes` · `GET /tour-wishes` 항목, `PATCH` 응답 | `campus_id` · `date`(목록) · `created_at`(PATCH) | 이름 조인 · `date: null` · `createdAt: null` |
| 확장 엔드포인트 | `GET /health` · `POST /demo/reset` · `GET /campuses/{campusId}/insight` | 헬스 → `GET /campuses`, 초기화 잠금(2C-R28), 인사이트 카드 숨김(지금처럼 오류면 그리지 않는다) |

## 폐기되는 2A 판정(결정 0011)

- **2A-R1**(홈은 문장 하나, 요청 `{ q }`, 미리 채움 `EXAMPLE_QUERIES[0]`) → 2C-R16 · R19(학교 · 학과 · 희망 사항 · 날짜, 미리 채움 `DEMO_WISH`).
- **2A-R2**(추천 목록 필터 칩) → 없음(결과는 조건으로 이미 걸러진다).
- **2A-R3**(추천 행 셋째 줄 `{MM.DD} · {추천 이유}` · `왜 추천했나요?`) → 없음(행 meta는 날짜 · 시각 · 남은 자리, 무대 ①은 원문 카드 + 첫 행).
- 2A-R4(무대 예산 우선) 등 나머지 2A 판정은 그대로다. Task 11이 `docs/reference/design-v2.md` 구현 메모의 세 행에 `폐기(결정 0011 · 2C)`를 적는다.

## Review Focus

1. **확장 필드가 없는 실서버 응답** — 명세 예시 그대로의 응답(확장 없음, 캠퍼스 이름 `주전` · `죽전` 불일치)에서 탐방 제목 · 학교 이름이 비지 않고(나누기 대체), 코스 지점은 `order`를 id로, 제휴 문구 `쿠폰 사용 가능`, AI 리뷰 요약이 리뷰 수 없이도 보인다 → Task 7 `fromWireTourItem` 픽스처 테스트, Task 8 `fromWireCourse` 픽스처 테스트 + `StoreSheet` 요약 테스트.
2. **snake/camel 경계** — `access_token` · `consent_token` · `address_line_2`(숫자) · `_meta`, `FormData` · 쿼리 문자열은 그대로, `errors[{ field: 'school_name' }]`이 폼 칸 `highSchoolName`에 붙는다 → Task 1 `caseKeys.test.ts` · `http.test.ts`, Task 6 `patchMe` 칸 오류 테스트.
3. **한 쪽을 넘는 목록** — `total`이 50보다 크면 다음 쪽을 이어 부르고, 빈 쪽 · `items`만 · `total` 없음에서 멈춘다 → Task 1 `listAll` 테스트, Task 7 `listTours` 51건 테스트.
4. **봉투가 아니거나 세션을 끊는 오류** — 봉투 401(`E401`)은 세션 만료를 한 번만 부르고, 로그인의 `E401_INVALID_CREDENTIALS`는 부르지 않으며, 본문 없는 413은 `FILE_TOO_LARGE`, 프록시의 HTML 502는 상태 502의 `UNKNOWN`이다 → Task 1 `http.test.ts`, Task 6 로그인 실패 테스트.
5. **희망 사항 원문** — 100자 · 줄바꿈 · 앞뒤 공백이 섞인 희망 사항이 결과 카드 · 내 희망 사항 · 고교생 희망 사항에 앞뒤 공백만 빠진 채 줄바꿈까지 그대로 보이고 이름 같은 개인정보는 안 보인다 → Task 11 `TourResultsPage.test.tsx`, Task 12 `WishPages.test.tsx` · `GuideWishesPage.test.tsx`.

---

### Task 1: 공통 HTTP 계층 — 봉투 · 키 변환 · 백엔드 오류 코드 · `listAll` (M)

**Files:**
- Create: `src/shared/lib/caseKeys.ts`, `src/shared/lib/caseKeys.test.ts`, `src/test/wire.ts`
- Modify: `src/shared/lib/http.ts`, `src/shared/lib/http.test.ts`, `src/shared/lib/errors.ts`, `src/shared/lib/errors.test.ts`, `src/mocks/handlers/util.ts`(`readBody`가 `toCamel`), `src/mocks/handlers/handlers.test.ts`(지역 `rawFetch`를 지우고 `@/test/wire`에서 import, `readBody` 테스트 1건), `vite.config.ts`(2C-R1 `rewrite`), `docs/decisions/0005-vercel-api-proxy.md`(결과에 2C-R1 한 줄)

**Interfaces:**
- Consumes: 지금의 `request` · `upload` · `ApiError` · `configureHttp`, `ERROR_CODES` · `ERROR_MESSAGES` · `errorMessage`.
- Produces:
  - `caseKeys.ts`: `snakeToCamel(key: string): string` · `camelToSnake(key: string): string` · `toCamel<T = unknown>(value: unknown): T` · `toSnake<T = unknown>(value: unknown): T`(2C-R3).
  - `errors.ts`: `ErrorCode`에 `COURSE_PARTNER_REQUIRED` · `COUPON_DAILY_LIMIT` · `AI_FAILED`(문구는 위 표), `isErrorCode(code: string): code is ErrorCode`(지금 비공개 → export), `BACKEND_ERROR_MAP: Readonly<Record<string, ErrorCode>>`(위 표), `resolveErrorCode(backendCode: string, errorMap?: Partial<Record<string, ErrorCode>>): ErrorCode`(2C-R4 순서).
  - `http.ts`: `ApiError`에 `backendCode: string | null`(생성자 `extra.backendCode`); `RequestOptions`에 `errorMap?: Partial<Record<string, ErrorCode>>` · `fieldMap?: Record<string, string>`; `withQuery(path: string, query: Record<string, string | number | boolean | null | undefined>): string`(undefined · null · `''`은 빼고 `URLSearchParams`로 붙임, 경로에 `?`가 있으면 `&`로); `PAGE_SIZE_MAX = 50`; `listAll<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T[]>`(2C-R23); `recode(error: ApiError, code: ErrorCode, extra?: { fieldErrors?: Record<string, string> }): ApiError`(상태 · `backendCode` · `details`는 그대로, 문구는 `errorMessage(code)`). `request` · `upload` 시그니처는 그대로이고, 요청 본문은 `toSnake`, 응답은 2C-R2로 벗긴 뒤 `toCamel`, 오류는 2C-R4 · R5.
  - `src/test/wire.ts`: `wireOk(data: unknown, init?: { status?: 200 | 201 }): Response`(봉투 `{ code: 'S200'|'S201', message: '성공', data: toSnake(data), errors: null, timestamp }`) · `wirePage(items: unknown[], meta?: { page?: number; size?: number; total?: number }): Response`(`data: { items, page, size, total }`, 생략하면 1 · 50 · `items.length`) · `wireFail(code: string, init?: { status?: number; errors?: { field: string; reason: string }[]; data?: unknown; message?: string }): Response`(상태 기본값은 코드의 세 자리, 없으면 500) · `rawFetch(path: string, init: { method: string; token?: string; body?: unknown }): Promise<{ status: number; body: any }>`(`/api` + path, JSON 본문 그대로 — 변환하지 않는다).

- [ ] **Step 1: 실패하는 테스트 — `caseKeys.test.ts`**
  - `snakeToCamel`: `access_token`→`accessToken`, `consent_token`→`consentToken`, `review_average`→`reviewAverage`, `address_line_2`→`addressLine2`, `_meta`→`_meta`, `tourId`→`tourId`(멱등).
  - `camelToSnake`: `accessToken`→`access_token`, `campusBuildingId`→`campus_building_id`, `addressLine2`→`address_line2`, `store_id`→`store_id`(멱등).
  - `toCamel({ user: { verification_status: 'HIGH_SCHOOL' }, items: [{ tour_id: 1 }] })` → `{ user: { verificationStatus: 'HIGH_SCHOOL' }, items: [{ tourId: 1 }] }`(값은 그대로). `FormData` · `Blob` · `Date` · `URLSearchParams` 인스턴스는 `toBe`(같은 참조). `null` · 숫자 · 문자열은 그대로. `toSnake`도 같은 꼴로.
- [ ] **Step 2: 실패하는 테스트 — `http.test.ts`(기존 테스트는 그대로 두고 추가)**
  - `봉투(S200)면 data만 돌려주고 키를 camelCase로`: `server.use(http.get('/api/x', () => wireOk({ access_token: 't', user: { verification_status: 'NONE' } })))` → `request('/x')`가 `{ accessToken: 't', user: { verificationStatus: 'NONE' } }`.
  - `봉투가 아닌 성공 본문(옛 모양)도 camelCase로 그대로` · `data: null 봉투는 null, 빈 204는 undefined` · `code가 S/E 세 자리가 아니면 봉투가 아니다`(`{ code: '483920', state: 'USABLE' }` → 그대로).
  - `요청 본문은 snake_case, FormData와 쿼리 문자열은 그대로`: 받은 본문 `{ campus_id: 1, interest_major: 'a', spots: [{ stop_type: 'STORE', store_id: 2 }] }`; `upload` 본문의 필드 이름 그대로; `withQuery('/tours', { campus_id: 2, major: '산업디자인', date_from: undefined })` → 받은 URL의 `searchParams`가 `campus_id=2`, `major=산업디자인`, `date_from` 없음.
  - `오류 봉투의 백엔드 코드 → ErrorCode, backendCode, 문구는 우리 표`(표 주도): `E409_TOUR_FULL`→`TOUR_CLOSED` · `E401_INVALID_CREDENTIALS`(401)→`INVALID_CREDENTIALS` · `E422_PARTNER_REQUIRED`→`COURSE_PARTNER_REQUIRED` · `E502_AI_FAILED`→`AI_FAILED` · `E410_EXPIRED`→`COUPON_EXPIRED` · `E409_COUPON_NOT_YET`→`COUPON_NOT_YET`(접미사 규칙) · `E418_TEAPOT`→`UNKNOWN` · `E404`→`NOT_FOUND`; 각각 `error.backendCode`가 받은 코드, `error.message === errorMessage(error.code)`(봉투의 `message`가 `'x'`여도).
  - `호출별 errorMap이 기본 표보다 앞선다`: `{ errorMap: { E409_TOUR_FULL: 'CAPACITY_EXCEEDED' } }` → `CAPACITY_EXCEEDED`.
  - `errors[] → fieldErrors(camelCase 또는 fieldMap, 첫 항목, 대문자 기계값은 코드 문구)`: `wireFail('E400', { errors: [{ field: 'school_name', reason: '50자 이내' }, { field: 'school_name', reason: '둘째' }, { field: 'business_number', reason: 'MISMATCH' }] })` + `fieldMap: { school_name: 'highSchoolName' }` → `fieldErrors` `{ highSchoolName: '50자 이내', businessNumber: '입력값을 다시 확인해 주세요.' }`.
  - `오류 봉투의 data 객체는 details(camelCase)로`: `wireFail('E409_ALREADY_USED', { data: { used_at: '2027-01-15T13:40:00+09:00' } })` → `details.usedAt`.
  - `전환 기간: 옛 오류 모양도 받는다`: `HttpResponse.json({ code: 'TOUR_CLOSED', message: 'x', fieldErrors: { a: 'b' } }, { status: 409 })` → `code 'TOUR_CLOSED'`, `fieldErrors { a: 'b' }`, `backendCode null`(Task 13이 이 테스트를 뒤집는다).
  - **Review Focus 4:** `봉투 401은 onUnauthorized를 한 번, auth:false의 401은 부르지 않는다`: `configureHttp({ onUnauthorized: spy })`, `wireFail('E401')` → `UNAUTHORIZED` · spy 1회; `request('/auth/login', { method: 'POST', auth: false })` + `wireFail('E401_INVALID_CREDENTIALS')` → `INVALID_CREDENTIALS` · spy 0회. `봉투 아닌 오류: 본문 없는 413은 FILE_TOO_LARGE, HTML 502는 상태 502의 UNKNOWN(backendCode null)`.
  - **Review Focus 3:** `listAll: total이 한 쪽보다 크면 다음 쪽을 이어 부른다`(1쪽 50개 `total: 51`, 2쪽 1개 → 51개, 받은 요청 `page=1&size=50` · `page=2&size=50`), `items만 오면 한 번`, `빈 쪽이 오면 total이 남아도 멈춘다`, `total이 없으면 한 쪽으로 끝`, `경로에 쿼리가 있으면 &page=로 잇는다`.
- [ ] **Step 3: 실패하는 테스트 — `errors.test.ts` · `handlers.test.ts`** — 새 코드 3개의 `errorMessage`가 위 문구. `resolveErrorCode`: errorMap > 이미 `ErrorCode` 이름 > 표 > 접미사 > `UNKNOWN`(각 한 줄). `handlers.test.ts` `P1 목업 도구` describe에 `readBody는 snake 본문을 camelCase로 읽는다`(임시 POST 핸들러가 `readBody` 결과를 그대로 돌려줌 → `{ interestMajor: 'a' }`).
- [ ] **Step 4: 실패 확인** — `npm run test:run -- src/shared/lib src/mocks/handlers` / FAIL.
- [ ] **Step 5: 구현** — 위 Produces. `send()`가 봉투 판별(2C-R2) · `toCamel` · `toApiError(res, options)`(2C-R4 · R5)를 하고 `request`가 `toSnake(body)`를 한다. `readBody`는 파싱한 객체에 `toCamel`. Vite 프록시 `rewrite`. 결정 0005 결과에 "11/7 백엔드 경로에는 접두사가 없다 — 프록시가 `/api`를 뗀다(2C-R1). Vercel rewrite는 주소가 정해지면 SPA 규칙 앞에 둔다." 한 줄.
- [ ] **Step 6: 통과 확인** — 전역 검증 명령. 목업은 아직 옛 모양을 내므로 화면 · E2E는 그대로 통과해야 한다(요청 본문이 snake가 돼도 `readBody`가 되돌린다 — `stopIds` · `highSchoolName` · `checkpoint`).
- [ ] **Step 7: 진척 문서** — devlog 한 줄(공통 계층 · 2C 시작). **Step 8: 커밋** — `feat: 공통 HTTP 계층(봉투 · snake/camel · 백엔드 오류 코드 · listAll)과 개발 프록시 /api 떼기`

---

### Task 2: 목업 공통 — `ok` · `fail` 봉투 · 오류 역표 · 레지스트리 · 와이어 검사 도구 (M)

**Files:**
- Create: `src/mocks/wire/envelope.ts`, `src/mocks/wire/errorCodes.ts`, `src/mocks/wire/envelope.test.ts`, `src/test/wire.test.ts`(`expectWireShape` 자체 테스트), 폴더 `src/test/fixtures/backend/`(도메인 태스크가 파일을 더한다 — 규칙은 2C-R25 ①)
- Modify: `src/test/wire.ts`(+`expectWireShape`), `src/mocks/registry.test.ts`

**Interfaces:**
- Consumes: Task 1 `toSnake` · `camelToSnake` · `resolveErrorCode` · `wireOk` · `wireFail`; `MockApiError`; `withErrors`의 `Resolver` 꼴; `mockNow` · `toSeoulIso`.
- Produces:
  - `envelope.ts`: `ok(data: unknown, status: 200 | 201 = 200): Response` · `okPage(items: unknown[], search: URLSearchParams): Response`(`page` 기본 1, `size` 기본 20 · 최대 50, 자른 `items`와 `{ page, size, total }`) · `okItems(items: unknown[]): Response`(`{ items }`만) · `fail(error: MockApiError): Response` · `withWire(resolver: Resolver): HttpResponseResolver`(`MockApiError`를 `fail`로, 다른 오류는 그대로 던진다). 모든 성공 본문은 `{ code, message: '성공', data: toSnake(data), errors: null, timestamp: toSeoulIso(mockNow()) }`.
  - `errorCodes.ts`: `toBackendError(code: ErrorCode, status: number): { code: string; status: number }`(위 역표), `LOSSY_CODES: readonly ErrorCode[]`(위 15개).
  - `expectWireShape(actual: unknown, example: unknown, ext: readonly string[] = []): void` — 객체는 `keys(example) ⊆ keys(actual)`이고 `keys(actual) − keys(example) ⊆ ext`, 같은 키끼리 다시 비교(배열은 둘 다 비어 있지 않으면 첫 원소끼리, 한쪽이 null이면 그 키는 넘어간다). 실패 메시지에 경로(`data.items[0].guide`)를 넣는다.
  - `registry.test.ts` 상수(경로는 `/api`를 뗀 꼴, 비교할 때 `label(h).replace(' /api/', ' /')`):
    - `BACKEND_CONTRACT`(46, 이 순서): `POST /auth/signup` · `POST /auth/login` · `POST /auth/logout` · `GET /users/me` · `PATCH /users/me` · `PUT /users/me/guide-profile` · `POST /verifications/enrollment` · `POST /guardian-consents` · `GET /guardian-consents/:consentToken` · `PATCH /guardian-consents/:consentToken` · `POST /verifications/business` · `GET /admin/verifications` · `GET /admin/verifications/:verificationId` · `PATCH /admin/verifications/:verificationId` · `GET /tours` · `POST /tour-wishes` · `GET /users/me/tour-wishes` · `PATCH /users/me/tour-wishes/:wishId` · `GET /tour-wishes` · `GET /tours/:tourId` · `POST /tours` · `GET /users/me/tours` · `POST /tours/:tourId/cancel` · `POST /tours/:tourId/complete` · `POST /tours/:tourId/applications` · `PATCH /applications/:applicationId/decision` · `POST /applications/:applicationId/cancel` · `GET /tours/:tourId/applications` · `POST /tours/:tourId/course` · `PUT /tours/:tourId/course/spots` · `POST /tours/:tourId/course/confirm` · `GET /tours/:tourId/course` · `GET /stores/search` · `POST /users/me/store` · `GET /users/me/store` · `PATCH /users/me/store` · `GET /stores/nearby` · `PUT /users/me/store/partnership` · `GET /users/me/coupons` · `GET /coupons/:couponCode` · `POST /coupons/:couponCode/redeem` · `GET /users/me/store/report` · `POST /stores/:storeId/reviews` · `GET /stores/:storeId/reviews` · `GET /campuses` · `GET /campuses/:campusId/places`.
    - `EXTENSIONS`(지금): `GET /health` · `POST /demo/reset`(Task 4가 `GET /campuses/:campusId/insight`를 더한다).
    - `NOT_MOCKED`(지금): `BACKEND_CONTRACT` 46개 전부. 끝에 남을 20개(2B 몫)는 `POST /verifications/enrollment` · `POST /guardian-consents` · `GET`·`PATCH /guardian-consents/:consentToken` · `POST /verifications/business` · `GET /admin/verifications` · `GET`·`PATCH /admin/verifications/:verificationId` · `POST /tours` · `POST /tours/:tourId/cancel` · `POST /tours/:tourId/complete` · `GET /stores/search` · `POST /users/me/store` · `PATCH /users/me/store` · `GET /stores/nearby` · `PUT /users/me/store/partnership` · `GET /users/me/store/report` · `POST /stores/:storeId/reviews` · `GET /stores/:storeId/reviews` · `GET /campuses/:campusId/places`.
    - `LEGACY`(31): `POST /auth/login` · `POST /auth/logout` · `GET /me` · `GET /universities` · `GET /universities/:id/insight` · `POST /recommendations` · `GET /tours` · `GET /tours/:id` · `POST /tours/:id/applications` · `GET /me/applications` · `GET /me/applications/:id` · `POST /me/applications/:id/cancel` · `GET /guide/tours` · `GET /guide/tours/:id/applicants` · `POST /guide/applications/:id/approve` · `POST /guide/applications/:id/reject` · `GET /guide/tours/:id/course` · `POST /guide/tours/:id/course/draft` · `PUT /guide/tours/:id/course/order` · `PATCH /guide/tours/:id/course/stops/:stopId` · `DELETE /guide/tours/:id/course/stops/:stopId` · `POST /guide/tours/:id/course/confirm` · `GET /tours/:id/course` · `GET /me/coupons` · `GET /me/coupons/:id` · `GET /owner/coupons/:code` · `POST /owner/coupons/:code/redeem` · `GET /owner/store` · `POST /auth/signup` · `PUT /me/student-profile` · `PUT /me/guide-profile`.

- [ ] **Step 1: 실패하는 테스트 — `envelope.test.ts`**
  - `ok({ tourId: 1 })`의 본문이 `(await wireOk({ tour_id: 1 }).json())`과 `timestamp` 말고 같고 `timestamp`는 `+09:00` ISO; `ok(x, 201)`의 `code === 'S201'`, 상태 201.
  - `okPage([a, b, c], new URLSearchParams('page=2&size=2'))` → `data { items: [c], page: 2, size: 2, total: 3 }`; `size=999` → `size 50`; 매개변수가 없으면 `page 1 · size 20`.
  - `fail`: `MockApiError(409, 'TOUR_NOT_RECRUITING')` → 409 `E409_TOUR_FULL`; `(404, 'COURSE_NOT_READY')` → 409 `E409_COURSE_NOT_READY`; `(403, 'GUIDE_PROFILE_REQUIRED')` → 409; `(409, 'COUPON_EXPIRED')` → 410 `E410_EXPIRED`; `(409, 'REAPPLY_AFTER_REJECT')` → 409 `E409_REAPPLY_AFTER_REJECT`; `fieldError('schoolName', '50자 이내')` → `errors [{ field: 'school_name', reason: '50자 이내' }]`, `data null`; `MockApiError(409, 'COUPON_ALREADY_USED', undefined, { usedAt: 'x' })` → `data { used_at: 'x' }`, `errors null`.
  - `모든 ErrorCode는 되돌려 읽으면 자기 자신이거나 LOSSY_CODES다`: 모든 `ErrorCode` `c`에 대해 `resolveErrorCode(toBackendError(c, 400).code)`가 `c`이거나 `LOSSY_CODES`에 `c`가 있다; `LOSSY_CODES`는 정확히 위 15개.
- [ ] **Step 2: 실패하는 테스트 — `src/test/wire.test.ts`** — `expectWireShape`: 같은 키면 통과, 명세 키가 빠지면 실패(메시지에 경로), 확장이 아닌 키가 더 있으면 실패, `ext`에 든 키는 통과, 배열 첫 원소 · 중첩 객체까지 보고, 한쪽이 null이면 그 키는 넘어간다.
- [ ] **Step 3: 실패하는 테스트 — `registry.test.ts`** — 기존 4개를 바꾼다: `도메인 일부만` · `고른 도메인 그대로`(그대로), `BACKEND_CONTRACT는 46개이고 겹치지 않는다`, `NOT_MOCKED ⊆ BACKEND_CONTRACT · EXTENSIONS ∩ BACKEND_CONTRACT = ∅`, `등록 핸들러 = (BACKEND_CONTRACT − NOT_MOCKED) ∪ EXTENSIONS ∪ LEGACY`(정렬한 배열로 `toEqual`). P1 도메인 테스트는 지운다(`P1_CONTRACT`가 없어진다).
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — 위 Produces. 핸들러는 아직 바꾸지 않는다(`withErrors` 그대로).
- [ ] **Step 6: 통과 확인** — 전역 검증 명령. **Step 7: 진척 문서** — devlog 한 줄. **Step 8: 커밋** — `test: 목업 봉투 ok/fail · 오류 역표 · 백엔드 46개 레지스트리 · 와이어 모양 검사 도구`

---

### Task 3: demo 확장 엔드포인트 — 봉투 전환 · 실서버의 헬스 대체 · 초기화 잠금 (S)

**Files:**
- Create: `src/demo/health.ts`
- Modify: `src/mocks/handlers/demo.ts`, `src/demo/DemoPanel.tsx`, `src/demo/demo.test.tsx`, `src/demo/resetDemo.test.ts`, `src/mocks/handlers/handlers.test.ts`(describe `demo`)

**Interfaces:**
- Consumes: Task 2 `ok` · `withWire`; Task 1 `wireFail` · `wireOk` · `rawFetch` · `ApiError.status`.
- Produces:
  - `checkBackend(): Promise<'health' | 'campuses'>`(`src/demo/health.ts`) — `GET /health`, `ApiError` 404면 `GET /campuses`(`auth: false`)를 불러 되면 `'campuses'`, 그 밖의 오류는 던진다. `HealthBadge`의 `queryFn`이 이것을 쓰고 성공이면 `정상`(어느 쪽이든).
  - `DemoPanel`: 초기화가 `ApiError` 상태 404로 실패하면 컴포넌트 상태 `resetMissing = true` → 토스트 `시연 데이터를 초기화하지 못했어요.` + 설명 `실서버에는 시연 초기화가 없어요.`, 버튼은 `disabled` + `hint={{ reason: '실서버에는 시연 초기화가 없어요.' }}`(2C-R28).
  - 목업: `GET /health` → `ok({ ok: true, mode: 'mock' })`, `POST /demo/reset` → `ok({ ok: true })`, 모르는 체크포인트 → `E400`(`withWire`).
- 숨은 의존: `resetDemo.test.ts`의 `server.use` 2곳(옛 모양 401 · 403 → `wireFail('E401')` · `wireFail('E403')`), `demo.test.tsx`의 `/api/health` `HttpResponse.error()`(그대로).

- [ ] **Step 1: 실패하는 테스트** — `handlers.test.ts` demo: `rawFetch('/health', { method: 'GET' })`의 `body.code === 'S200'`, `body.data` `{ ok: true, mode: 'mock' }`; 모르는 체크포인트 → `status 400`, `body.code === 'E400'`, DB 그대로(기존 단언 유지). `demo.test.tsx`: `헬스가 404면 캠퍼스 조회로 연결을 확인한다`(`/api/health` → `wireFail('E404')`, `/api/campuses` → `wireOk({ items: [] })` → 패널 배지 `정상`); `초기화가 404면 버튼을 잠그고 사유를 보인다`(`/api/demo/reset` → `wireFail('E404')` → `시연 데이터 초기화` 클릭 → 토스트 설명 · 버튼 `disabled` · `toHaveAccessibleDescription('실서버에는 시연 초기화가 없어요.')`). `resetDemo.test.ts` 덮어쓰기를 `wireFail`로(단언 그대로).
- [ ] **Step 2: 실패 확인 · Step 3: 구현** — 위 Produces.
- [ ] **Step 4: 통과 확인** — 전역 검증 명령(원클릭 링크 `reset=1`이 봉투를 받아도 그대로 돈다).
- [ ] **Step 5: 진척 문서** — API 표 `GET /api/health` · `POST /api/demo/reset` 행 비고 `확장(목업 전용, 봉투)`, devlog. **Step 6: 커밋** — `feat(demo): 시연 확장 엔드포인트 봉투 전환과 실서버의 헬스 대체 · 초기화 잠금`

---

### Task 4: campuses — `GET /campuses` · 인사이트 확장 경로 (S)

**Files:**
- Create: `src/features/campuses/wire.ts`, `src/features/campuses/wire.test.ts`, `src/mocks/wire/campuses.ts`, `src/test/fixtures/backend/campuses.ts`(`CAMPUSES_LIST` = D-01 응답 예시)
- Modify: `src/features/campuses/{api,queries}.ts`, `src/mocks/handlers/campuses.ts`, `src/mocks/rules/views.ts`(`toUniversity` 삭제), `src/mocks/registry.test.ts`, `src/mocks/handlers/handlers.test.ts`(describe `campuses`), `src/features/tours/api.test.ts`(`listUniversities · getInsight` 케이스 → `listCampuses`), `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 1 `listAll` · `toCamel`; Task 2 `okItems` · `ok` · `withWire` · `expectWireShape`; `shortUniversityName` · `campusLabel`(`features/tours/model.ts`).
- Produces:
  - `WireCampus { campusId: number; name: string; campusName: string; address: string | null; lat: number; lng: number; vacationPeriods: { startDate: string; endDate: string }[] }` · `WireInsight { campusId: number; title: string; text: string; source: string; isPlaceholder: boolean }`(확장).
  - `fromWireCampus(w: WireCampus): University`(`id ← campusId`, `shortName ← shortUniversityName(name)`, `administrativeDong: null`, `vacations[].label: null`) · `fromWireInsight(w: WireInsight): Insight`(`universityId ← campusId`).
  - `findCampus(campuses: University[], ref: { campusId?: number | null; campusName: string }): University | null` · `splitCampusName(label: string): { universityName: string; campusName: string }`(2C-R9).
  - 픽스처 파일은 명세 예시 `CAMPUSES_LIST` 옆에 테스트용 파생값 `D01: University[] = CAMPUSES_LIST.data.items.map((c) => fromWireCampus(toCamel(c)))`도 export한다(뒤 태스크의 어댑터 테스트가 쓴다).
  - api: `listCampuses(): Promise<University[]>`(`listAll('/campuses', { auth: false })`, 지금의 `listUniversities`를 이름까지 바꾼다) · `getInsight(universityId: number): Promise<Insight>`(`GET /campuses/{id}/insight`).
  - queries: `campusesQueryOptions()`(키 `qk.universities`, `staleTime: Infinity`) · `useUniversities()`(이것을 씀) · `loadCampuses(queryClient: QueryClient): Promise<University[]>`.
  - 목업: `toWireCampus(db, row): WireCampus`(`campusName`은 행의 `campusName`, 방학은 시작일 순), `GET /campuses` → `okItems`(id 순), `GET /campuses/:campusId/insight` → `ok(toWireInsight)`(없으면 404).
- registry: `LEGACY`에서 `GET /universities` · `GET /universities/:id/insight`, `NOT_MOCKED`에서 `GET /campuses`를 지우고 `EXTENSIONS`에 `GET /campuses/:campusId/insight`.

- [ ] **Step 1: 실패하는 테스트** — `wire.test.ts`: `D01[0]`(= `fromWireCampus(toCamel(CAMPUSES_LIST.data.items[0]))`) → `{ id: 1, name: '단국대학교', shortName: '단국대', campusName: '주전캠퍼스', address: '경기 용인시 수지구 주전로 152', lat: 37.3219, lng: 127.1268, administrativeDong: null, vacations: [{ startDate: '2027-01-01', endDate: '2027-02-28', label: null }, { startDate: '2027-06-21', endDate: '2027-08-31', label: null }] }`. `findCampus`(시드 5곳): `{ campusId: 2 }` → 경희대, `{ campusName: '경희대학교 국제캠퍼스' }` → 경희대, `{ campusName: '강남대학교' }` → 강남대(본교), 픽스처 목록 + `{ campusName: '단국대학교 죽전캠퍼스' }` → null. `splitCampusName('단국대학교 죽전캠퍼스')` → `{ universityName: '단국대학교', campusName: '죽전캠퍼스' }`, `('강남대학교')` → 캠퍼스 `본교`. `handlers.test.ts` campuses: `rawFetch('/campuses')` → `expectWireShape(body.data, CAMPUSES_LIST.data)`; `listCampuses()` 5곳 id 순 · `shortName` `경희대` · 방학 2개; `getInsight(2)`의 문구에 행정동; 없는 캠퍼스 인사이트 → `NOT_FOUND`.
- [ ] **Step 2: 실패 확인 · Step 3: 구현** — 위 Produces.
- [ ] **Step 4: 통과 확인** — 전역 검증 명령(코스 편집의 인사이트 카드가 그대로).
- [ ] **Step 5: 진척 문서** — API 표 `campuses` 두 행을 `GET /campuses`(목업 ✅) · `GET /campuses/:campusId/insight`(확장)로, devlog. **Step 6: 커밋** — `feat(campuses): GET /campuses 백엔드 와이어와 인사이트 확장 경로`

---

### Task 5: stores — `GET /users/me/store` (S)

**Files:**
- Create: `src/features/stores/wire.ts`, `src/features/stores/wire.test.ts`, `src/mocks/wire/stores.ts`, `src/test/fixtures/backend/stores.ts`(`MY_STORE` · `MY_STORE_PATCHED` = 내 가게 조회 · 수정 응답 예시)
- Modify: `src/features/stores/api.ts`(+`api.test.ts`), `src/mocks/handlers/stores.ts`, `src/mocks/rules/stores.ts`(`myStoreOf` = 2C-R26 합성), `src/mocks/rules/views.ts`(`toMyStore`의 "지금 쓰는 제휴" 고르기를 `mocks/wire/stores.ts`로), `src/pages/owner/MyStorePage.test.tsx`(`server.use` 3곳 `/api/owner/store` → `/api/users/me/store`, 본문 → `wireFail('E400')`), `src/mocks/registry.test.ts`, `src/mocks/handlers/handlers.test.ts`(describe `사장님 내 가게`), `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 1 · 2 도구; `computePartnershipState`.
- Produces:
  - `WirePartnership { discountText: string; startDate: string; endDate: string }` · `WireMyStore { storeId: number; name: string; address: string; category: string; partnership: WirePartnership | null }`.
  - `fromWireMyStore(w: WireMyStore, now: Date): MyStore`(`partnership.id: 0`, `condition: null`, `state ← computePartnershipState`).
  - `getMyStore(token?: string): Promise<MyStore | null>` — `GET /users/me/store`, `errorMap: { E404: 'STORE_NOT_LINKED' }`, `STORE_NOT_LINKED`면 null. `token`을 주면 `Authorization: Bearer {token}` + `auth: false`(Task 6의 로그인 합성용).
  - 목업: `toWireMyStore(db, store, now): WireMyStore`(지금의 ACTIVE > SCHEDULED > ENDED 고르기), `GET /users/me/store`(사장님만, 가게 없으면 `MockApiError(404, 'STORE_NOT_LINKED')` → `E404`).
- registry: `LEGACY` − `GET /owner/store`, `NOT_MOCKED` − `GET /users/me/store`.

- [ ] **Step 1: 실패하는 테스트** — `wire.test.ts`: `fromWireMyStore(toCamel(MY_STORE.data), new Date('2026-11-07T12:00:00+09:00'))` → `{ id: 201, name: '용인 분식', address: '경기 용인시 처인구 ...', category: '식당', partnership: { id: 0, discount: '음료 1,000원 할인', condition: null, startDate: '2027-01-01', endDate: '2027-02-28', state: 'SCHEDULED' } }`; `MY_STORE_PATCHED`(`partnership: null`) → `partnership: null`. `api.test.ts`: owner1 → `id 1` · `state 'ACTIVE'`; `owner-nostore@demo.kr` → null; 학생 → `FORBIDDEN`(`backendCode 'E403'`). handlers: `rawFetch('/users/me/store', 사장님 토큰)` → `expectWireShape(body.data, MY_STORE.data)`, 가게 없음 → `status 404` · `code 'E404'`.
- [ ] **Step 2: 실패 확인 · Step 3: 구현 · Step 4: 통과 확인** — 전역 검증 명령(O01 · O01-E 그대로).
- [ ] **Step 5: 진척 문서 · Step 6: 커밋** — `feat(stores): GET /users/me/store 백엔드 와이어`

---

### Task 6: auth — 로그인 합성 · `GET`/`PATCH /users/me` · 가입 · 가이드 프로필(2B Task 4 재작업 포함) (M)

**Files:**
- Create: `src/features/auth/wire.ts`, `src/features/auth/wire.test.ts`, `src/mocks/wire/auth.ts`, `src/test/fixtures/backend/auth.ts`(`SIGNUP_OK` · `SIGNUP_DUPLICATE` · `LOGIN_OK` · `LOGIN_FAILED` · `LOGOUT_OK` · `ME_HIGH_SCHOOL` · `ME_UNIVERSITY` · `ME_PATCH_OK` · `GUIDE_PROFILE_OK`)
- Modify: `src/features/auth/{api,model,queries,landing,guide}.ts`, `src/features/auth/{queries.test.tsx,landing.test.ts}`, `src/mocks/handlers/auth.ts`, `src/mocks/rules/auth.ts`(+`auth.test.ts`), `src/mocks/rules/errors.ts`(`fieldError`를 여기로), `src/mocks/handlers/util.ts`(`fieldError` 제거, import 고치기 — `grep -rn "fieldError" src`), `src/mocks/rules/views.ts`(`toMe` = 2C-R26 합성), `src/mocks/handlers/handlers.test.ts`(describe `auth` · `가입 · 프로필`, 파일 맨 위 `login()` 도우미 → `features/auth/api`의 `login`), `src/demo/demo.test.tsx`(`/api/auth/login` 덮어쓰기 → `wireFail('E401_INVALID_CREDENTIALS')`), `src/mocks/registry.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 5 `getMyStore(token?)`; Task 1 `recode` · `errorMessage`; `hasGuideProfile`.
- Produces:
  - `WireLogin { accessToken: string; user: { id: number; name: string; role: Role; verificationStatus: VerificationStatus } }` · `WireMe { id: number; email: string; name: string; role: Role; verificationStatus: VerificationStatus; rejectReason: string | null; schoolName: string | null; grade: number | null; interestMajor: string | null; guardianConsentStatus: GuardianStatus | null; guideProfile: { major: string | null; intro: string | null } | null; campusId?: number | null }` · `WireSignupResult { id: number; email: string; name: string; role: Role; createdAt: string }`.
  - `fromWireMe(w: WireMe, storeId: number | null): Me` — `rejectionReason ← rejectReason`, `guardianStatus ← guardianConsentStatus ?? 'NONE'`, 고교생만 `studentProfile { highSchoolName ← schoolName, grade, interestedMajor ← interestMajor }`, 대학생만 `guideProfile`(있으면) `{ universityId ← campusId ?? null, major, introduction ← intro }`, `businessVerified = role === 'OWNER' && verificationStatus === 'APPROVED'`, `storeId`(인자).
  - api: `login(input): Promise<LoginResponse>`(`POST /auth/login` `auth: false` → `fetchMe(accessToken)` → `{ token, me }`) · `fetchMe(token?: string): Promise<Me>`(`GET /users/me`, 토큰을 주면 헤더 + `auth: false`; 사장님이면 `getMyStore(token)`의 id) · `logout()`(그대로, `data: null`) · `postSignup(input: SignupInput): Promise<LoginResponse>`(`POST /auth/signup` `auth: false`, `errorMap { E409: 'EMAIL_DUPLICATE' }`, 그 코드인데 `fieldErrors`가 없으면 `recode(e, 'EMAIL_DUPLICATE', { fieldErrors: { email: errorMessage('EMAIL_DUPLICATE') } })`, 성공하면 **늘** `login()` — 토큰 분기를 지운다) · `patchMe(input: StudentProfileInput): Promise<Me>`(`putStudentProfile`를 이름까지 바꾼다; `PATCH /users/me` 본문 `{ name, schoolName: highSchoolName, grade, interestMajor: interestedMajor }`, `fieldMap { school_name: 'highSchoolName', interest_major: 'interestedMajor' }` → `fetchMe()`) · `putGuideProfile(input: GuideProfileInput): Promise<Me>`(`PUT /users/me/guide-profile` 본문 `{ major, intro: introduction }`, `fieldMap { intro: 'introduction' }` → `fetchMe()`).
  - model: `PROFILE_TEXT_MAX` 삭제 → `NAME_MAX = 20` · `HIGH_SCHOOL_NAME_MAX = 50` · `INTEREST_MAJOR_MAX = 30`; `GUIDE_INTRO_MAX = 200`; `PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/`(`PASSWORD_MIN_LENGTH` 유지); `GuideProfileInput.introduction: string`(필수). 주석의 계약 경로(`/api/me/...`)를 백엔드 경로로.
  - `getLandingPath`가 학과 판정에 `hasGuideProfile`을 쓴다(2B T4 리뷰 Minor 1 — `guide.ts` JSDoc이 참이 된다).
  - 목업: `toWireMe(db, userId, now): WireMe`(고교생 칸은 고교생만, 대학생 `schoolName` = 인증 · 프로필 대학의 `campusLabel`, `campusId` 확장 = 그 대학 id, 사장님 `verificationStatus` = 사업자 인증이면 `'APPROVED'` 아니면 `'NONE'`, 고교생이 아니면 `guardianConsentStatus: null`); 핸들러 `POST /auth/login` → `ok({ accessToken, user })` · `POST /auth/signup` → `ok(toWireSignupResult, 201)`(토큰 없음) · `POST /auth/logout` → `ok(null)` · `GET /users/me` → `ok(toWireMe)` · `PATCH /users/me`(아무 역할, 고교생이 아니면서 `schoolName` · `grade` · `interestMajor`를 보내면 403 → `ok(toWireMe)`) · `PUT /users/me/guide-profile`(대학생 → `ok({ major, intro })`). 규칙 `signUp` · `updateStudentProfile(db, userId, body: { name?; schoolName?; grade?; interestMajor? }, now)` · `saveGuideProfile(db, userId, body: { major; intro }, now)`는 와이어 이름(camel)으로 읽고 그 이름으로 `fieldError`를 던진다(그래야 `errors[].field`가 명세의 snake 이름이 된다). 목업 칸 오류 문구(제안 문구): `이름은 1~20자로 입력해 주세요.` · `학교 이름은 50자 이하로 입력해 주세요.` · `관심 학과는 30자 이하로 입력해 주세요.` · `비밀번호는 영문과 숫자를 섞어 8자 이상으로 입력해 주세요.` · `소개는 1~200자로 입력해 주세요.`(학과 문구는 그대로).
- registry: `LEGACY` − `POST /auth/login` · `POST /auth/logout` · `GET /me` · `POST /auth/signup` · `PUT /me/student-profile` · `PUT /me/guide-profile`; `NOT_MOCKED` − `POST /auth/signup` · `POST /auth/login` · `POST /auth/logout` · `GET /users/me` · `PATCH /users/me` · `PUT /users/me/guide-profile`.

- [ ] **Step 1: 실패하는 테스트 — `wire.test.ts`** — `fromWireMe(toCamel(ME_HIGH_SCHOOL.data), null)` → `{ id: 1, email: 'hs01@example.com', name: '김하늘', role: 'HIGH_SCHOOL', verificationStatus: 'APPROVED', rejectionReason: null, guardianStatus: 'AGREED', studentProfile: { highSchoolName: '용인고등학교', grade: 2, interestedMajor: '컴퓨터공학' }, guideProfile: null, businessVerified: false, storeId: null }`; `ME_UNIVERSITY` → `guardianStatus 'NONE'`, `studentProfile null`, `guideProfile { universityId: null, major: '컴퓨터공학과', introduction: '신입생 때부터 동아리 활동을 했어요' }`; 사장님(`role 'OWNER'`, `verification_status 'APPROVED'`) + `201` → `businessVerified true`, `storeId 201`.
- [ ] **Step 2: 실패하는 테스트 — 핸들러 · api(`handlers.test.ts`)**
  - `login('student@demo.kr')` → `me.studentProfile.highSchoolName '수원영통고등학교'`, 그 토큰으로 `fetchMe()`가 된다; 요청은 `POST /auth/login` → `GET /users/me` 두 번(`server.events`로 센다). `owner1@demo.kr` → `me.storeId 1` · `businessVerified true`, 요청 셋(+`GET /users/me/store`); `owner-nostore@demo.kr` → `storeId null`; `guide-dku@demo.kr` → `guideProfile.universityId 3`.
  - **Review Focus 4:** 틀린 비밀번호 → `INVALID_CREDENTIALS`, `backendCode 'E401_INVALID_CREDENTIALS'`, `onUnauthorized` 0회.
  - 와이어: `rawFetch('/auth/login', …)` → `expectWireShape(body.data, LOGIN_OK.data)`; `rawFetch('/users/me', 학생 토큰)` → `expectWireShape(body.data, ME_HIGH_SCHOOL.data)`, 가이드 → `expectWireShape(body.data, ME_UNIVERSITY.data, ['campus_id'])`; 로그아웃 → `status 200`, `body.code 'S200'`, `body.data null`, 그 토큰으로 `/users/me` → 401 `E401`.
  - 가입: `rawFetch('/auth/signup', …)` → `status 201`, `expectWireShape(body.data, SIGNUP_OK.data)`(`access_token` 없음); `postSignup(...)` → 토큰 + `Me`, 요청 셋(가입 · 로그인 · 내 정보) — 2B T4 Minor 2; 중복 → `code 'EMAIL_DUPLICATE'` · `backendCode 'E409'` · `fieldErrors.email '이미 가입된 이메일이에요.'`; 비밀번호 `abcdefgh` → `VALIDATION` · `fieldErrors.password`; 이름 21자 → `fieldErrors.name`.
  - **Review Focus 2:** `patchMe`: 고교생 학교 51자 → `fieldErrors.highSchoolName`(백엔드 `school_name` → `fieldMap`), 정상 → 새 `Me.studentProfile`; 가이드가 학교를 보내면 `FORBIDDEN`. `putGuideProfile`: 소개 `''` → `fieldErrors.introduction`, 정상 → `me.guideProfile.introduction`.
- [ ] **Step 3: 실패하는 테스트 — 나머지** — `queries.test.tsx`: `useSignup` 성공 순서 `clear` → `setToken` → `setQueryData(qk.me)`를 스파이 호출 순서로 단언(2B T4 Minor 3). `landing.test.ts`: 학과가 `'  '`인 승인 가이드 → `/guide/me`. `auth.test.ts`(규칙): 새 길이 · 패턴 · 와이어 이름의 칸 오류, `toMe`(합성)가 기존 단언 그대로.
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — 위 Produces. `fieldError` 이동(2B T4 Minor 5)은 `grep -rn "fieldError" src`로 모든 import를 고친다.
- [ ] **Step 6: 통과 확인** — 전역 검증 명령(빠른 로그인 · 원클릭 링크 · 401 자동 재로그인이 합성 로그인을 탄다).
- [ ] **Step 7: 진척 문서** — API 표 auth 6행을 백엔드 경로로(목업 ✅), devlog(2B T4 재작업 · Minor 1 · 2 · 3 · 5 처리). **Step 8: 커밋** — `feat(auth): 로그인 합성 · GET/PATCH /users/me · 가입 · 가이드 프로필 백엔드 와이어(2B T4 재작업)`

---

### Task 7: tours — `GET /tours` · `GET /tours/{tourId}` (M)

**Files:**
- Create: `src/features/tours/wire.ts`, `src/features/tours/wire.test.ts`, `src/mocks/wire/tours.ts`, `src/test/fixtures/backend/tours.ts`(`TOURS_LIST` · `TOUR_DETAIL`)
- Modify: `src/features/tours/{api,model,queries}.ts`, `src/features/tours/api.test.ts`, `src/shared/api/queryKeys.ts`(`qk.tours(filter: TourFilter)`), `src/mocks/handlers/tours.ts`(두 핸들러만 — `POST /recommendations`는 `withErrors` 그대로), `src/mocks/rules/views.ts`(`toTourSummary` · `toTourDetail` 삭제, `buildTourSummary`는 추천 · 쿠폰이 써서 남김), `src/mocks/handlers/handlers.test.ts`(describe `tours`의 목록 · 상세 테스트), `src/pages/student/refetchError.test.tsx`(`'/api/tours/:id'` 세 행 → `'/api/tours/:tourId'` + `wireFail('E403')`), `src/mocks/registry.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 4 `findCampus` · `splitCampusName` · `loadCampuses`; `tourTitle` · `shortUniversityName` · `campusLabel`.
- Produces:
  - `TourFilter { status?: TourStatus; universityId?: number; major?: string; dateFrom?: string; dateTo?: string }`(`features/tours/model.ts`).
  - `WireTourGuide { name: string; verified: boolean; major?: string; intro?: string | null }` · `WireTourItem { tourId: number; campusName: string; major: string | null; date: string; startTime: string; capacity: number; remaining: number; status: TourStatus; guide: WireTourGuide; campusId?: number }` · `WireTourDetail extends WireTourItem { endTime: string | null; intro: string; openChatUrl: string | null; myApplication: { applicationId: number; status: ApplicationStatus } | null }`.
  - `joinDateTime(date: string, hhmm: string): string`(`${date}T${hhmm}:00+09:00`) · `fromWireTourItem(w: WireTourItem, campuses: University[]): TourSummary` · `fromWireTourDetail(w: WireTourDetail, campuses: University[]): TourDetail` · `summaryOf(detail: TourDetail): TourSummary`(요약 칸만 고른다 — 다른 도메인의 합성이 쓴다).
  - 픽스처 파일은 `TOURS_LIST` · `TOUR_DETAIL` 옆에 파생값 `TOUR_31: TourDetail = fromWireTourDetail(toCamel(TOUR_DETAIL.data), D01)`도 export한다(Task 8 · 9 · 10의 어댑터 테스트가 쓴다).
  - 매핑: `id ← tourId`; 캠퍼스 2C-R9로 `universityId · universityName · universityShortName · campusName`; `title ← tourTitle(universityName, campusName, major)`; `guideName ← guide.name`; `guideVerified ← guide.verified`; `startsAt ← joinDateTime(date, startTime)`; `endsAt ← endTime ? joinDateTime(date, endTime) : null`(목록은 null); `approvedCount ← capacity − remaining`; `remainingSeats ← remaining`; 상세 `introduction ← intro`, `guideIntroduction ← guide.intro ?? null`, `openChatUrl`, `myApplication ← { id: applicationId, status } | null`.
  - api: `listTours(filter: TourFilter, campuses: University[]): Promise<TourSummary[]>`(`listAll(withQuery('/tours', { status, campus_id: universityId, major, date_from: dateFrom, date_to: dateTo }))`, 시작 시각 오름차순 · 같으면 id) · `getTour(id: number, campuses: University[]): Promise<TourDetail>`. `status`를 빼면 백엔드 기본(RECRUITING)이다.
  - queries: `useTours(filter: TourFilter)` · `useTour(id: number)` — `queryFn` 안에서 `loadCampuses(queryClient)`.
  - 목업: `toWireTourItem(db, tour): WireTourItem`(`campusName = campusLabel(u.name, u.campusName)`, `major` = 가이드 프로필 학과, `date = seoulDateKey(startsAt)`, `startTime = formatTime(startsAt)`, `remaining = remainingSeats`, `guide { name, verified: 인증 APPROVED }`, 확장 `campusId`), `toWireTourDetail(db, tour, viewerId): WireTourDetail`(+ `endTime`, `intro`, `guide.major` · `guide.intro`, `openChatUrl`은 승인된 신청자 **또는 그 탐방의 가이드**(명세), `myApplication`은 최근의 취소 아닌 신청). `GET /tours`: `status`(없으면 `RECRUITING`) · `campus_id` · `major`(부분 일치) · `date_from` · `date_to`(서울 날짜) → 시작 순 → `okPage`. `GET /tours/:tourId` → `ok` | 404. 토큰은 있으면 쓴다(2C-R10).
- registry: `LEGACY` − `GET /tours` · `GET /tours/:id`, `NOT_MOCKED` − `GET /tours` · `GET /tours/:tourId`.
- 숨은 의존: `useTour`를 쓰는 `TourDetailPage` · `ApplyPage` · `ApplyDonePage` 테스트, 홈의 모집 중 목록(`useTours({ status: 'RECRUITING' })`), `refetchError.test.tsx`. 가이드에게도 `openChatUrl`을 주지만 `TourDetailPage`는 그 칸을 그리지 않는다(확인함 — 화면 차이 없음).

- [ ] **Step 1: 실패하는 테스트 — `wire.test.ts`(Review Focus 1)** — `fromWireTourItem(toCamel(TOURS_LIST.data.items[0]), D01)` → `{ id: 31, title: '단국대 죽전캠퍼스 컴퓨터공학과 탐방', universityId: 0, universityName: '단국대학교', universityShortName: '단국대', campusName: '죽전캠퍼스', major: '컴퓨터공학과', guideName: '이준호', guideVerified: true, startsAt: '2027-01-15T13:00:00+09:00', endsAt: null, capacity: 5, approvedCount: 2, remainingSeats: 3, status: 'RECRUITING' }`. 같은 항목에 `campusId: 3` + 시드 캠퍼스 → `universityId 3`, `universityName '단국대학교'`, `campusName '죽전캠퍼스'`. `fromWireTourDetail(toCamel(TOUR_DETAIL.data), D01)` → 위 + `endsAt '2027-01-15T16:00:00+09:00'`, `introduction '캠퍼스와 근처 맛집을 함께 둘러봐요'`, `guideIntroduction '신입생 때부터 동아리 활동을 했어요'`, `openChatUrl null`, `myApplication { id: 77, status: 'PENDING' }`. `summaryOf(detail)`의 키가 `TourSummary` 키와 정확히 같다.
- [ ] **Step 2: 실패하는 테스트 — api · 핸들러** — `listTours({}, campuses)` → 모집 중 5개(START: 탐방 1 · 3 · 4 · 5 · 6)만, 시작 순; `{ status: 'CLOSED' }` → 탐방 2만; `{ universityId: 2, major: '산업디자인' }` → id `[1, 6]`; `{ universityId: 2, dateFrom: <탐방 6의 날짜> }` → `[6]`; `getTour(1, campuses)` → `title '경희대 국제캠퍼스 산업디자인학과 탐방'`; START에서 승인 학생(`seojun@demo.kr`)과 가이드(`guide@demo.kr`)는 `openChatUrl`이 있고 대기 학생(`yujin@demo.kr`)은 null; 없는 탐방 → `NOT_FOUND`. `rawFetch('/tours?size=2')` → `data.items` 2개, `data.total 5`, `expectWireShape(body.data, TOURS_LIST.data, ['campus_id'])`; `rawFetch('/tours/1')` → `expectWireShape(body.data, TOUR_DETAIL.data, ['campus_id'])`. **Review Focus 3:** `server.use`로 `/api/tours` 1쪽 50개(`total: 51`) · 2쪽 1개 → `listTours({}, campuses)` 51개.
- [ ] **Step 3: 실패 확인 · Step 4: 구현** — 위 Produces.
- [ ] **Step 5: 통과 확인** — 전역 검증 명령(홈 목록 · 탐방 상세 · 신청서 · 신청 완료 · 골든 패스 그대로).
- [ ] **Step 6: 진척 문서** — API 표 `GET /tours`(쿼리 `status · campus_id · major · date_from · date_to`) · `GET /tours/:tourId` 목업 ✅, devlog. **Step 7: 커밋** — `feat(tours): GET /tours · GET /tours/{tourId} 백엔드 와이어와 캠퍼스 조인`

---

### Task 8: courses — 코스 조회 · AI 초안 · 스팟 PUT 빌더 · 확정 422 · 초안 502 (L)

**Files:**
- Create: `src/features/courses/wire.ts`, `src/features/courses/wire.test.ts`, `src/features/courses/spots.ts`, `src/features/courses/spots.test.ts`, `src/mocks/wire/courses.ts`, `src/test/fixtures/backend/courses.ts`(`COURSE_DRAFT` · `COURSE_SPOTS_OK` · `COURSE_CONFIRM_OK` · `COURSE_VIEW` · `COURSE_NOT_READY`)
- Modify: `src/features/courses/{api,model,queries}.ts`(+`api.test.ts`), `src/features/courses/components/{StopActionSheet,StoreSheet}.tsx`(+`StopActionSheet.test.tsx`, StoreSheet 테스트는 `CourseMapPage.test.tsx`에), `src/pages/guide/CourseEditPage.tsx`, `src/mocks/handlers/courses.ts`, `src/mocks/rules/courses.ts`(+`courses.test.ts`), `src/mocks/ai/course.ts`(+`course.test.ts` — `COURSE_CRITERIA`를 `features/courses/model`에서 import), `src/mocks/rules/views.ts`(`toCourse` · `toCourseStop` · `reviewOf` · `STORE_DATA_SOURCE` 이동), `src/mocks/handlers/handlers.test.ts`(describe `courses`), `src/pages/guide/CoursePages.test.tsx`(초안 실패 덮어쓰기 → `wireFail('E500')`, `지점을 모두 빼면…` 다시 쓰기), `src/pages/student/CourseMapPage.test.tsx`(덮어쓰기 3곳 → 새 경로 · `wireFail`), `src/pages/student/refetchError.test.tsx`(코스 행 → `'/api/tours/:tourId/course'` · `wireFail('E403')`), `src/mocks/registry.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 7 `getTour` · `TourDetail` · `loadCampuses` · `TOUR_31`; Task 4 `D01`; `slotTimes` · `partnerStopCount`.
- Produces:
  - model: `CourseStop.campusBuildingId: number | null`(2C-R12 ①), `COURSE_CRITERIA`(목업에서 옮김, 문구 그대로), `STORE_DATA_SOURCE = '공공데이터(인허가) 기반'`, `COURSE_NOTE_MAX = 100`, `PARTNER_DISCOUNT_FALLBACK = '쿠폰 사용 가능'`.
  - wire: `WireSpot { order: number; stopType: StopType; storeId: number | null; campusBuildingId: number | null; name: string; category: string | null; address: string | null; lat: number; lng: number; startTime: string; reason: string | null; comment: string | null; isPartner: boolean; reviewSummary: string | null; spotId?: number; discountText?: string | null; reviewAverage?: number | null; reviewCount?: number }` · `WireCourse { tourId: number; status: CourseStatus; spots: WireSpot[]; couponCount?: number }` · `WireConfirm { tourId: number; status: CourseStatus; couponCount: number }` · `SpotInput { stopType: StopType; storeId?: number; campusBuildingId?: number; startTime: string; comment?: string }`.
  - `fromWireCourse(w: WireCourse, tour: TourDetail): Course` — 스팟: `id ← spotId ?? order`, `visitTime ← startTime`, `type ← stopType`, `category ← category ?? '캠퍼스'`, `description ← comment`, `recommendationReason ← reason`, `partnership ← isPartner ? { discount: discountText ?? PARTNER_DISCOUNT_FALLBACK } : null`, `review ← STORE ? { average: reviewAverage ?? null, count: reviewCount ?? 0, summary: reviewSummary } : null`, `dataSource ← STORE ? STORE_DATA_SOURCE : null`; 코스: `tour ← { id, title, universityId, universityShortName, campusName, startsAt, endsAt }`(상세에서), `interests: []`, `criteria: COURSE_CRITERIA`, `confirmedAt: null`, `issuedCouponCount ← couponCount ?? (CONFIRMED ? tour.approvedCount × partnerStopCount(stops) : 0)`.
  - `spots.ts`: `SpotEdit = { kind: 'reorder'; stopIds: number[] } | { kind: 'note'; stopId: number; description: string } | { kind: 'remove'; stopId: number }` · `buildSpots(course: Course, edit: SpotEdit): SpotInput[]` — 이 알고리즘대로:

    ```text
    stops = course.stops를 order 순으로
    next  = reorder: stopIds가 지금 id들의 순열이 아니면 throw Error('reorder: 지점 id가 맞지 않아요')
                     아니면 stopIds 순서대로 stops에서 꺼낸다
            note:    그 지점만 description = trim(description) === '' ? null : trim(description)
            remove:  그 지점을 뺀다(빈 배열도 만든다 — 서버 E400이 막고, 화면은 2C-R12 ②로 미리 막는다)
    times = slotTimes(course.tour.startsAt, next.length)   // 위치 슬롯: 0·70·120·170·220분, 그 뒤 50분씩
    next[i] → STORE  면 { stopType: 'STORE',  storeId,          startTime: times[i], comment? }
              CAMPUS 면 { stopType: 'CAMPUS', campusBuildingId, startTime: times[i], comment? }
              comment 키는 description이 null이 아닐 때만 넣는다(전체 교체라 빠지면 한줄평 없음)
    ```
  - api: `getCourse(tourId, campuses): Promise<Course>`(`GET /tours/{tourId}/course` + `getTour` 병렬) · `getGuideCourse(tourId, campuses): Promise<Course | null>`(같은 경로, 404 또는 `COURSE_NOT_READY` → null, 2C-R14) · `getGuideCourseStatus(tourId: number): Promise<CourseStatus | null>`(같은 경로의 `status`만, 같은 null 규칙 — Task 9가 쓴다) · `postCourseDraft(tourId, campuses)`(`POST /tours/{tourId}/course`, `AI_TIMEOUT_MS`) · `putCourseSpots(tourId, spots: SpotInput[], campuses)`(`PUT /tours/{tourId}/course/spots` 본문 `{ spots }`) · `postConfirmCourse(tourId, campuses)`(`POST …/confirm` → `getGuideCourse` → `{ ...course, issuedCouponCount: res.couponCount }`). `putStopOrder` · `patchStop` · `deleteCourseStop`은 지운다.
  - queries: 훅 시그니처 그대로(`useReorderStops(tourId)` 변수 `number[]`, `useUpdateStop(tourId)` 변수 `{ stopId; description }`, `useDeleteStop(tourId)` 변수 `number`). 각 `mutationFn`은 `const current = queryClient.getQueryData<Course | null>(qk.guideCourse(tourId)) ?? (await getGuideCourse(tourId, campuses))`(null이면 `new ApiError(404, 'NOT_FOUND', errorMessage('NOT_FOUND'))`) → `putCourseSpots(tourId, buildSpots(current, edit), campuses)`. `useCourse` · `useGuideCourse` · `useCreateDraft` · `useConfirmCourse`는 `loadCampuses`를 넣는다.
  - 화면: `StopActionSheetProps.canRemove: boolean` — false면 `빼기` 비활성 + 그 아래 사유 `지점은 1곳 이상 있어야 해요.`(버튼의 `aria-describedby`). `CourseEditPage`가 `canRemove={stops.length > 1}`, 한줄평 `Textarea`에 `maxLength={COURSE_NOTE_MAX}`. `StoreSheet` 2C-R12 ⑥.
  - 목업: `toWireCourse(db, tourId): WireCourse`(스팟: CAMPUS는 `category null` · `address null` · `storeId null`, STORE는 `campusBuildingId null`, `startTime = visitTime ?? 슬롯`, `isPartner` = 탐방 날짜에 유효한 제휴, `reviewSummary` = 최근 요약 | null, 확장 `spotId` · `discountText`(제휴만) · `reviewAverage` · `reviewCount`; 코스 확장 `couponCount` = 지금의 `issuedCouponCount` 계산). 규칙 `replaceSpots(db, guideId, tourId, spots: SpotInput[], now): void` — `draftCourse` 검사(404 · 403 · `COURSE_NOT_DRAFT`) → `spots`가 비면 `fieldError('spots', '지점을 1곳 이상 넣어 주세요.')` → 각 항목: STORE는 있는 `storeId`, CAMPUS는 그 탐방 대학의 `campusBuildingId`(아니면 `fieldError('spots', '고를 수 없는 장소예요.')`), `startTime` `/^\d{2}:\d{2}$/`, `comment`는 문자열 100자 이하(아니면 `fieldError('spots', '한줄평은 100자 이내로 적어 주세요.')`) → 행 다시 쓰기: i번째 항목마다 아직 안 쓴 기존 행 중 같은 (유형, 상점 | 건물)의 첫 행이면 id · `recommendationReason` 유지, 없으면 새 행(`nextId`, 이유 null), `stopOrder = i + 1`, `visitTime = startTime`, `description = trim(comment) || null`; 코스 `updatedAt`. `confirmCourse`는 빈 코스 검사 뒤 제휴 지점(탐방 날짜 기준)이 0이면 `MockApiError(422, 'COURSE_PARTNER_REQUIRED')`(2C-R11). 지운다: `reorderStops` · `updateStopDescription` · `deleteStop`. 핸들러: `GET /tours/:tourId/course`(2C-R14), `POST /tours/:tourId/course`(대학생, `delayAi`, `createDraft` → `ok(toWireCourse, 201)`), `PUT /tours/:tourId/course/spots`(대학생, `replaceSpots` → `ok(toWireCourse)`), `POST /tours/:tourId/course/confirm`(→ `ok({ tourId, status: 'CONFIRMED', couponCount: 확정이 발급한 수 })`).
- registry: `LEGACY` − `GET /guide/tours/:id/course` · `POST /guide/tours/:id/course/draft` · `PUT /guide/tours/:id/course/order` · `PATCH /guide/tours/:id/course/stops/:stopId` · `DELETE /guide/tours/:id/course/stops/:stopId` · `POST /guide/tours/:id/course/confirm` · `GET /tours/:id/course`; `NOT_MOCKED` − `POST /tours/:tourId/course` · `PUT /tours/:tourId/course/spots` · `POST /tours/:tourId/course/confirm` · `GET /tours/:tourId/course`.

- [ ] **Step 1: 실패하는 테스트 — `spots.test.ts`** — 코스(시작 `2027-01-15T14:00:00+09:00`, 지점 id 1 CAMPUS 건물 3 한줄평 없음 · id 2 STORE 201 한줄평 `a` · id 3 STORE 202): reorder `[3, 1, 2]` → `[{ stopType: 'STORE', storeId: 202, startTime: '14:00' }, { stopType: 'CAMPUS', campusBuildingId: 3, startTime: '15:10' }, { stopType: 'STORE', storeId: 201, startTime: '16:00', comment: 'a' }]`; note id 3 `'  학식 맛집  '` → 셋째 `comment '학식 맛집'`, 시각 그대로; note `'   '` → `comment` 키 없음; remove id 1 → 2개 `14:00` · `15:10`; reorder `[1, 2]` → throw.
- [ ] **Step 2: 실패하는 테스트 — `wire.test.ts`(Review Focus 1)** — `fromWireCourse(toCamel(COURSE_VIEW.data), TOUR_31)`: `stops[0]` = `{ id: 1, order: 1, visitTime: '13:00', type: 'STORE', name: '용인 분식', category: '식당', lat: 37.3219, lng: 127.1268, description: '학생들이 즐겨 가는 분식집이에요', recommendationReason: '신청자들이 맛집을 가고 싶다고 적었어요', storeId: 201, campusBuildingId: null, partnership: { discount: '쿠폰 사용 가능' }, review: { average: null, count: 0, summary: '양이 많고 가격이 착하다는 평이 많아요' }, dataSource: '공공데이터(인허가) 기반' }`; `stops[1]` CAMPUS → `category '캠퍼스'`, `campusBuildingId 3`, `partnership null`, `review null`, `dataSource null`; `issuedCouponCount 2`(승인 2 × 제휴 1), `criteria === COURSE_CRITERIA`, `interests []`. 확장 `spotId: 900` · `discountText: '음료 1,000원 할인'` · `reviewAverage: 4.5` · `reviewCount: 11` · 코스 `couponCount: 6` → 그 값들.
- [ ] **Step 3: 실패하는 테스트 — 화면 부품** — `StopActionSheet.test.tsx`: `canRemove={false}`면 `빼기` 비활성 + `toHaveAccessibleDescription('지점은 1곳 이상 있어야 해요.')`. `CourseMapPage.test.tsx`: `GET /api/tours/:tourId/course`를 `wireOk`(확장 없는 `COURSE_VIEW.data`, 상점 1곳의 시트)로 덮어 시트를 열면 `✦ AI 리뷰 요약`과 요약 문장이 보이고 `리뷰 0개` · `아직 리뷰가 없어요.`는 없다.
- [ ] **Step 4: 실패하는 테스트 — 목업 규칙 · api** — `courses.test.ts`: `replaceSpots` — 같은 상점은 id · 이유 유지, 새 상점은 이유 null, 순서 · 시각은 입력대로, 빈 배열 → `VALIDATION` · `fieldErrors.spots`, 한줄평 101자 → `VALIDATION`, 확정 뒤 → `COURSE_NOT_DRAFT`, 남의 탐방 → `FORBIDDEN`; `관련 업종 상점이 모두 비제휴면…확정 시 쿠폰 0장`을 `…확정은 422 COURSE_PARTNER_REQUIRED`로 다시 쓴다. `handlers.test.ts` courses(api 경유): 코스 없는 가이드 → `getGuideCourse` null; 확정 전 학생 → `COURSE_NOT_READY`(`status 409`, `backendCode 'E409_COURSE_NOT_READY'`); 남 → `FORBIDDEN`; APPROVED 체크포인트 초안 → 지점 3 · `rawFetch` 본문 `expectWireShape(data, COURSE_DRAFT.data, ['spot_id', 'discount_text', 'review_average', 'review_count', 'coupon_count'])`, 상태 201; `putCourseSpots(buildSpots(c, reorder [둘째, 첫째, 셋째]))` → 시각 `14:00` · `15:10` · `16:00`, 지점 id 보존; 한줄평 → 카드 값; 빼기 → 지점 2; 확정 → `issuedCouponCount 6`, 확정 뒤 PUT → `COURSE_NOT_DRAFT`; 승인 0명 초안 → `NO_APPROVED_APPLICANTS`(`backendCode 'E409_NO_APPROVED_APPLICANT'`); 확정 코스 지점의 이름 · 분류 · 제휴 · 리뷰 요약 · 출처(기존 단언 그대로). `api.test.ts`: `server.use(… wireFail('E502_AI_FAILED'))` → `postCourseDraft`가 `AI_FAILED`; `wireFail('E422_PARTNER_REQUIRED')` → `postConfirmCourse`가 `COURSE_PARTNER_REQUIRED`.
- [ ] **Step 5: 화면 테스트 다시 쓰기** — `CoursePages.test.tsx` `지점을 모두 빼면…`을 `마지막 한 곳은 뺄 수 없다 — 두 곳을 빼면 일정 · 1개 장소, 남은 지점의 빼기는 비활성 + 사유, 포커스는 이웃 지점 · 소제목으로`로(빼기 두 번, 포커스 단언 그대로, 0개 장소 단언은 대상이 사라져 지운다 — 백엔드가 0개를 막는다). 나머지(순서 · 시간 · 한줄평 · 다시 만들기 · 확정 · 0장 문구)는 단언 그대로 통과해야 한다.
- [ ] **Step 6: 실패 확인 · Step 7: 구현** — 위 Produces.
- [ ] **Step 8: 통과 확인** — 전역 검증 명령. 무대 ② 3개 뷰포트 통과, 골든 패스의 `아래로 이동` → 셋째 지점 단언 통과. 무대 스크린샷 ②를 바꾸기 전과 비교.
- [ ] **Step 9: 진척 문서** — API 표 courses 7행 → 백엔드 4행(목업 ✅), guide-s05 비고 `백엔드는 지점 단위 편집이 없어 전체 스팟 PUT(빌더)`, devlog. **Step 10: 커밋** — `feat(courses): 코스 조회 · 초안 · 스팟 PUT 빌더 · 확정 백엔드 와이어(제휴 0곳 422, 초안 502)`

---

### Task 9: applications — 내 탐방 · 신청 · 취소 · 승인/거절 · 신청자 목록 (L)

**Files:**
- Create: `src/features/applications/wire.ts`, `src/features/applications/wire.test.ts`, `src/features/coupons/wire.ts`(`WireCoupon` 타입만 — 어댑터는 Task 10), `src/mocks/wire/applications.ts`, `src/test/fixtures/backend/applications.ts`(`MY_TOURS_HIGH_SCHOOL` · `MY_TOURS_UNIVERSITY` · `APPLY_OK` · `APPLY_NOT_VERIFIED` · `APPLY_FULL` · `APPLY_DUPLICATE` · `DECISION_OK` · `DECISION_FULL` · `CANCEL_OK` · `CANCEL_INVALID` · `APPLICANTS_LIST`)
- Modify: `src/features/applications/{api,model,queries}.ts`(+`api.test.ts`, `model.test.ts`), `src/features/coupons/api.ts`(`listMyCouponRows` 추가만), `src/pages/student/ApplyPage.tsx`(`APPLY_WISH_MAX = 100`), `src/mocks/handlers/applications.ts`, `src/mocks/rules/views.ts`(`toMyApplication` · `toApplicantsBoard` · `toGuideTourSummary` → 와이어), `src/mocks/handlers/handlers.test.ts`(describe `applications`, tours의 `추천 → 신청 → 내 탐방`의 신청 · 내 탐방 부분), `src/pages/student/{ApplyPage,CancelApplicationPage}.test.tsx`, `src/pages/guide/{GuideToursPage,GuideHomePage,CoursePages}.test.tsx`, `src/pages/student/refetchError.test.tsx`(`/api/me/applications` · `/api/me/applications/:id` 세 행 → `/api/users/me/tours` + `wireFail('E403')`), `src/mocks/registry.test.ts`, `docs/progress/README.md`
- 숨은 의존(grep): `/api/guide/tours'`(`GuideToursPage.test` 1곳 — `toGuideTourSummary` import도), `GuideHomePage.test` 2곳, `/api/guide/tours/:id/applicants`(`CoursePages.test` 2곳 → `/api/tours/:tourId/applications`), `/api/tours/:id/applications`(`ApplyPage.test` 2곳), `/api/me/applications/:id/cancel`(`CancelApplicationPage.test` 1곳 → `/api/applications/:applicationId/cancel` · `wireFail('E409_INVALID_APPLICATION_STATUS')`), `MyToursPage` · `MyTourDetailPage` · `ApplicantsPage` · `GuideCourseRedirect` 테스트.

**Interfaces:**
- Consumes: Task 7 `getTour` · `summaryOf` · `TOUR_31`; Task 8 `getGuideCourseStatus`; Task 6 `fetchMe`; Task 1 `recode` · `listAll` · `withQuery`.
- Produces:
  - wire: `WireMyTourRow { tourId: number; campusName: string; date: string; tourStatus: TourStatus; applicationId: number; applicationStatus: ApplicationStatus; courseConfirmed: boolean; wish?: string; createdAt?: string; couponCount?: number }` · `WireGuideTourRow { tourId: number; date: string; tourStatus: TourStatus; capacity: number; approvedCount: number; pendingCount: number; courseConfirmed: boolean }` · `WireApplicant { applicationId: number; name: string; grade: number | null; wish: string; status: ApplicationStatus; createdAt: string }` · `WireApplyResult { applicationId: number; tourId: number; status: ApplicationStatus; createdAt: string }` · `WireCoupon { couponId: number; code: string; tourId: number; store: { storeId: number; name: string; category?: string }; discountText: string; status: CouponStatus; validUntil: string; usedAt: string | null; reviewed: boolean }`(`features/coupons/wire.ts` — 여기서는 `tourId`로 세기만 한다).
  - `fromWireMyTourRow(row: WireMyTourRow, tour: TourDetail, couponCount: number, now: Date): MyApplication`(`motivation ← wish ?? ''`, `createdAt ← createdAt ?? ''`, `tour ← summaryOf(tour)`, `courseStatus ← courseConfirmed ? 'CONFIRMED' : null`, `openChatUrl ← tour.openChatUrl`, `cancellable ← computeCancellable(applicationStatus, tour.startsAt, now)`) · `fromWireGuideTourRow(row, tour: TourDetail, courseStatus: CourseStatus | null): GuideTourSummary`(`counts { total: approved + pending, pending, approved }`) · `fromWireApplicants(items: WireApplicant[], tour: TourDetail, courseStatus: CourseStatus | null): ApplicantsBoard`(CANCELED 빼고, `createdAt` 오름차순 · 같으면 id, `verified: true`, `counts { pending, approved, remaining: tour.remainingSeats }`, `course ← courseStatus ? { status } : null`).
  - model: `computeCancellable(status: ApplicationStatus, tourStartsAt: string, now: Date): boolean`(PENDING · APPROVED이고 `seoulDateKey(now) < seoulDateKey(tourStartsAt)` — 어댑터 전용, 목업 `isCancellable`과 같은 규칙).
  - api: `listMyTourRows(): Promise<WireMyTourRow[]>`(`listAll('/users/me/tours')`, export — 쿠폰이 쓴다) · `getMyApplications(campuses): Promise<MyApplication[]>`(행 순서 그대로, 탐방마다 `getTour` 한 번, `couponCount ← row.couponCount ?? listMyCouponRows({ tourId })`의 개수 — 2C-R8) · `getMyApplication(id, campuses)`(행에서 찾고 없으면 `ApiError(404, 'NOT_FOUND')`) · `postApplication(tourId, motivation, campuses): Promise<MyApplication>`(본문 `{ wish: motivation }` → 201 `applicationId` → `getMyApplication`; 오류 세분 2C-R15) · `postCancelApplication(id, campuses)`(→ `getMyApplication`; `E409_INVALID_APPLICATION_STATUS` 세분) · `getGuideTours(campuses): Promise<GuideTourSummary[]>`(행마다 `getTour`, 확정이 아니면 `getGuideCourseStatus`, 시작 순) · `getApplicantsBoard(tourId, campuses)`(`listAll('/tours/{tourId}/applications')` · `getTour` · `getGuideCourseStatus` 병렬) · `patchDecision(tourId: number, applicationId: number, decision: 'APPROVED' | 'REJECTED', campuses): Promise<ApplicantsBoard>`(`PATCH /applications/{applicationId}/decision`, `errorMap { E409_TOUR_FULL: 'CAPACITY_EXCEEDED' }` → `getApplicantsBoard`). `postApprove` · `postReject`는 지운다.
  - `features/coupons/api.ts`: `listMyCouponRows(query?: { tourId?: number; storeId?: number }): Promise<WireCoupon[]>`(`listAll(withQuery('/users/me/coupons', { tour_id, store_id }))`).
  - queries: 훅 시그니처 그대로(`useApprove(tourId)` · `useReject(tourId)` 변수 `number`가 `patchDecision`을 부른다).
  - `ApplyPage`: 최대 길이 상수 `APPLY_WISH_MAX = 100`(2C-R12 ④, 문구 `100자 이내로 적어 주세요.`는 기존 문구 틀 그대로).
  - 목업: `GET /users/me/tours`(고교생 → 내 신청 최근 순 행 + 확장 `wish` · `createdAt` · `couponCount`; 대학생 → 내 탐방 시작 순 행; 그 밖 403; `status`(탐방 상태) 거르기 → `okPage`), `POST /tours/:tourId/applications`(`applyToTour(db, user.id, tourId, body.wish, now)` → `ok(..., 201)`; 규칙에 `wish` 100자 검사 `fieldError('wish', '100자 이내로 적어 주세요.')`), `POST /applications/:applicationId/cancel` → `ok({ applicationId, status })`, `GET /tours/:tourId/applications`(본인 탐방, `?status=`, 취소 포함 전부를 `createdAt` 순 → `okItems`), `PATCH /applications/:applicationId/decision`(`decision`이 `APPROVED` · `REJECTED`가 아니면 `fieldError('decision', '승인 또는 거절을 골라 주세요.')` → `ok({ applicationId, status, tourStatus })`).
- registry: `LEGACY` − `POST /tours/:id/applications` · `GET /me/applications` · `GET /me/applications/:id` · `POST /me/applications/:id/cancel` · `GET /guide/tours` · `GET /guide/tours/:id/applicants` · `POST /guide/applications/:id/approve` · `POST /guide/applications/:id/reject`; `NOT_MOCKED` − `GET /users/me/tours` · `POST /tours/:tourId/applications` · `PATCH /applications/:applicationId/decision` · `POST /applications/:applicationId/cancel` · `GET /tours/:tourId/applications`.

- [ ] **Step 1: 실패하는 테스트 — `wire.test.ts` · `model.test.ts`** — `fromWireMyTourRow(toCamel(MY_TOURS_HIGH_SCHOOL.data.items[0]), TOUR_31, 0, new Date('2026-11-07T12:00:00+09:00'))` → `{ id: 77, status: 'APPROVED', motivation: '', createdAt: '', tour: summaryOf(TOUR_31), courseStatus: 'CONFIRMED', openChatUrl: null, couponCount: 0, cancellable: true }`. `fromWireGuideTourRow(MY_TOURS_UNIVERSITY 항목, TOUR_31, null)` → `counts { total: 5, pending: 3, approved: 2 }`, `courseStatus null`. `fromWireApplicants(APPLICANTS_LIST 항목들 + CANCELED 한 줄, TOUR_31, null)` → `applicants` 1명 `{ id: 77, userName: '김하늘', grade: 2, motivation: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요', status: 'PENDING', verified: true }`, `counts { pending: 1, approved: 0, remaining: 3 }`, `course null`. `computeCancellable`: 탐방 전날 PENDING → true, 탐방 당일 → false, REJECTED → false.
- [ ] **Step 2: 실패하는 테스트 — api · 핸들러** — 신청 201 와이어 `expectWireShape(data, APPLY_OK.data)` · `getMyApplication` 결과 PENDING; 세분(2C-R15): `newbie@demo.kr` → `NOT_VERIFIED`, `expired@demo.kr`(인증 APPROVED · 동의 만료) → `GUARDIAN_NOT_AGREED`, 탐방 2(CLOSED) → `TOUR_CLOSED`, 탐방 7(COMPLETED) → `TOUR_NOT_RECRUITING`, 중복 → `DUPLICATE_APPLICATION`, 거절된 탐방 재신청 → `REAPPLY_AFTER_REJECT`(`backendCode 'E409_REAPPLY_AFTER_REJECT'`), `wish` 101자 → `fieldErrors.wish`; 내 탐방 목록 최근 순 · 탐방 제목 · `couponCount`; 남의 신청 id → `NOT_FOUND`; 미래 탐방(6) 취소 → CANCELED 후 재신청 됨; 오늘 탐방(1) 취소 → `CANCEL_AFTER_TOUR_DATE`(`backendCode 'E409_INVALID_APPLICATION_STATUS'`); 가이드 탐방 시작 순 · 집계 · `createDraft` 뒤 `courseStatus 'DRAFT'`(합성); 신청자 보드 순서 · 학년 · `verified`; 승인 → 보드 갱신; 정원 찬 탐방 승인 → `CAPACITY_EXCEEDED`; 거절 → 보드에 남음; 학생이 가이드 API → `FORBIDDEN`. 와이어: `rawFetch('/users/me/tours', 학생)` → `expectWireShape(data, MY_TOURS_HIGH_SCHOOL.data, ['wish', 'created_at', 'coupon_count'])`, 가이드 → `MY_TOURS_UNIVERSITY.data`; `/tours/1/applications` → `APPLICANTS_LIST.data`. 대체 경로: `server.use`로 `/api/users/me/tours` → `wirePage`(확장 없는 `MY_TOURS_HIGH_SCHOOL` 항목), `/api/users/me/coupons` → `wireOk({ items: [쿠폰 tour_id 31] })`, `/api/tours/:tourId` → `wireOk(TOUR_DETAIL.data)` → `getMyApplications(campuses)[0].couponCount === 1`.
- [ ] **Step 3: 화면 테스트** — `ApplyPage.test.tsx`: 최대 길이 테스트를 101자 → `100자 이내로 적어 주세요.`로, 덮어쓰기 2곳을 `wireOk` · `wireFail('E409_TOUR_FULL')`로(단언 그대로 — 탐방 1은 모집 중이라 `TOUR_CLOSED` 문구). 나머지 숨은 의존 파일은 경로 · 본문만 바꾸고 단언은 그대로.
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — 위 Produces.
- [ ] **Step 6: 통과 확인** — 전역 검증 명령(골든 패스: 신청 → 승인 → 코스 만들기 → 내 탐방 → 코스 확인하기, 무대 ②의 신청자 관리 진입).
- [ ] **Step 7: 진척 문서** — API 표 applications 8행 → 백엔드 5행(목업 ✅, 신청 단건은 합성이라 행 없음), devlog. **Step 8: 커밋** — `feat(applications): 내 탐방 · 신청 · 취소 · 승인/거절 · 신청자 목록 백엔드 와이어와 합성`

---

### Task 10: coupons — 내 쿠폰 · 코드 확인 · 사용 처리 · 하루 한 장 코드 (M)

**Files:**
- Create: `src/features/coupons/wire.test.ts`, `src/mocks/wire/coupons.ts`, `src/test/fixtures/backend/coupons.ts`(`MY_COUPONS` · `COUPON_LOOKUP` · `COUPON_OTHER_STORE` · `REDEEM_OK` · `REDEEM_ALREADY_USED` · `REDEEM_EXPIRED` · `REDEEM_DAILY_LIMIT`)
- Modify: `src/features/coupons/{wire,api,model,queries}.ts`(+`api.test.ts`, `model.test.ts`), `src/pages/owner/CouponRedeemPage.tsx`(+test), `src/mocks/handlers/coupons.ts`, `src/mocks/rules/coupons.ts`(`findOwnCoupon` export만), `src/mocks/rules/views.ts`(`toCoupon` → 와이어), `src/mocks/handlers/handlers.test.ts`(describe `coupons`), `src/pages/student/CouponPages.test.tsx`(`/api/me/coupons/:id` 덮어쓰기 → `/api/users/me/coupons` `wireFail('E403')`), `src/pages/student/CourseMapPage.test.tsx`(시트의 쿠폰), `src/mocks/registry.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 9 `listMyTourRows` · `listMyCouponRows` · `WireCoupon`; Task 7 `getTour` · `summaryOf` · `TOUR_31`; Task 5 `getMyStore`; `computeCouponState`.
- Produces:
  - wire: `WireCouponLookup { couponId: number; code: string; discountText: string; tourDate: string; status: CouponStatus; validUntil: string; usedAt?: string | null; tourTitle?: string; studentName?: string }` · `WireRedeem { couponId: number; status: CouponStatus; usedAt: string; tourVisitorCount?: number; totalVisitorCount?: number }`.
  - `fromWireCoupon(w: WireCoupon, ctx: { applicationId: number; tour: TourSummary }, now: Date): Coupon`(`state ← computeCouponState({ status, tourStartsAt: tour.startsAt, expiresAt: validUntil }, now)`, `storeCategory ← store.category ?? ''`, `reviewWritten ← reviewed`) · `fromWireLookup(w: WireCouponLookup, storeName: string, now: Date): CouponLookup`(`tourStartsAt ← ${tourDate}T00:00:00+09:00`, `tourTitle ← tourTitle ?? '탐방'`, `studentName ← studentName ?? ''`, `usedAt ← usedAt ?? null`, `state` 계산).
  - model: `RedeemResult.tourVisitorCount: number | null` · `totalVisitorCount: number | null`(2C-R12 ⑤); `couponNotice`에 `errorCode === 'COUPON_DAILY_LIMIT'` → `{ title: '오늘 이미 쿠폰을 처리한 가게', description: '같은 날 한 가게에서는 쿠폰 한 장만 사용할 수 있어요.' }`(제안 문구).
  - api: `getMyCoupons(applicationId: number | undefined, campuses): Promise<Coupon[]>`(신청 id가 있으면 내 탐방 행에서 그 `tourId`를 찾아 `listMyCouponRows({ tourId })`, 없는 신청이면 `[]`; 신청 id는 2C-R27; 탐방은 고유 `tourId`마다 `getTour`; id 오름차순) · `getMyCoupon(id, campuses)`(목록에서 찾고 없으면 `ApiError(404, 'NOT_FOUND')`) · `getCouponLookup(code: string): Promise<CouponLookup>`(`GET /coupons/{code}` `errorMap { E404: 'COUPON_NOT_FOUND' }` + `getMyStore()`의 이름) · `postRedeem(code: string): Promise<RedeemResult>`(`POST /coupons/{code}/redeem` 같은 errorMap → `getCouponLookup(code)`에 `usedAt`을 덮어 `coupon`, 방문 수는 확장 `?? null`).
  - queries: 시그니처 그대로, `loadCampuses`를 넣는다(5초 폴링도 그대로).
  - `CouponRedeemPage`: `이번 탐방으로 온 학생 {n}명`은 `result.tourVisitorCount !== null`일 때만.
  - 목업: `GET /users/me/coupons`(학생, `tour_id` · `store_id` 거르기, id 순 → `okItems`; 확장 `store.category`), `GET /coupons/:couponCode`(사장님, `findOwnCoupon` → `ok(toWireCouponLookup)` + 확장 `usedAt` · `tourTitle` · `studentName`), `POST /coupons/:couponCode/redeem`(사장님, `redeemCoupon` → `ok({ couponId, status, usedAt, tourVisitorCount, totalVisitorCount })`; 이미 사용은 `details.usedAt` → 봉투 `data.used_at`, 만료 → `E410_EXPIRED` 410, 당일 전 → `E409_COUPON_NOT_YET`). 하루 한 장 규칙은 넣지 않는다(2C-R11).
- registry: `LEGACY` − `GET /me/coupons` · `GET /me/coupons/:id` · `GET /owner/coupons/:code` · `POST /owner/coupons/:code/redeem` → 이제 `LEGACY`는 `POST /recommendations` 하나; `NOT_MOCKED` − `GET /users/me/coupons` · `GET /coupons/:couponCode` · `POST /coupons/:couponCode/redeem`.

- [ ] **Step 1: 실패하는 테스트 — `wire.test.ts`** — `fromWireCoupon(toCamel(MY_COUPONS.data.items[0]), { applicationId: 77, tour: summaryOf(TOUR_31) }, new Date('2027-01-15T10:00:00+09:00'))` → `{ id: 501, code: '483920', status: 'ISSUED', state: 'USABLE', discount: '음료 1,000원 할인', storeId: 201, storeName: '용인 분식', storeCategory: '', applicationId: 77, tourId: 31, tourTitle: '단국대 죽전캠퍼스 컴퓨터공학과 탐방', tourStartsAt: '2027-01-15T13:00:00+09:00', expiresAt: '2027-01-15T23:59:59+09:00', usedAt: null, reviewWritten: false }`; 같은 쿠폰 `now` 2026-11-07 → `state 'BEFORE_DAY'`. `fromWireLookup(toCamel(COUPON_LOOKUP.data), '용인 분식', 2026-11-07)` → `{ code: '483920', state: 'BEFORE_DAY', discount: '음료 1,000원 할인', storeName: '용인 분식', tourTitle: '탐방', tourStartsAt: '2027-01-15T00:00:00+09:00', studentName: '', usedAt: null }`. `model.test.ts`: `couponNotice({ errorCode: 'COUPON_DAILY_LIMIT' })` → 위 문구.
- [ ] **Step 2: 실패하는 테스트 — api · 핸들러(CONFIRMED)** — 김민지 쿠폰 id 오름차순, `getMyCoupons(신청 id)`는 그 신청 것만, 상세, 남의 쿠폰 id → `NOT_FOUND`; owner1 조회 → `state 'USABLE'`, 다른 가게 → `COUPON_OTHER_STORE`(`backendCode 'E403_OTHER_STORE'`), 없는 코드 → `COUPON_NOT_FOUND`; 사용 처리 → `coupon.state 'USED'` · `usedAt` · `tourVisitorCount 1`; 다시 → `COUPON_ALREADY_USED` + `details.usedAt`; 만료 쿠폰 → `COUPON_EXPIRED`(`status 410`); `server.use(wireFail('E409_DAILY_LIMIT'))` → `COUPON_DAILY_LIMIT`. 와이어: `expectWireShape`(목록 ← `MY_COUPONS.data` + `['category']`, 조회 ← `COUPON_LOOKUP.data` + `['used_at', 'tour_title', 'student_name']`, 사용 ← `REDEEM_OK.data` + `['tour_visitor_count', 'total_visitor_count']`).
- [ ] **Step 3: 화면 테스트** — `CouponRedeemPage.test.tsx`: `사용 처리 응답에 방문 수가 없으면(실서버) 캡션을 숨긴다`(`POST /api/coupons/:couponCode/redeem` → `wireOk({ coupon_id, status: 'USED', used_at })` → `쿠폰 사용이 완료됐어요.` 보임, `이번 탐방으로 온 학생` 없음); `하루 한 장 오류는 O08 카드에 안내`(`wireFail('E409_DAILY_LIMIT')` → `오늘 이미 쿠폰을 처리한 가게`). 기존 덮어쓰기 2곳 → `/api/coupons/:couponCode` + `wireFail('E403')`(단언 그대로).
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령(골든 패스 `이번 탐방으로 온 학생 1명`, 무대 ③ 통과, 스크린샷 비교).
- [ ] **Step 7: 진척 문서 · Step 8: 커밋** — `feat(coupons): 내 쿠폰 · 코드 확인 · 사용 처리 백엔드 와이어와 하루 한 장 코드`

---

### Task 11: T-01 — 희망 사항 등록 · 탐방 찾기 (홈 · 결과 화면 · 시연 미리 채움 · AI 추천 삭제) (L)

**Files:**
- Create: `src/features/wishes/{model,wire,api,queries}.ts`(+`model.test.ts`, `wire.test.ts`), `src/features/wishes/components/WishFields.tsx`, `src/features/tours/wishSearch.ts`(+`wishSearch.test.ts`), `src/pages/student/TourResultsPage.tsx`(+`TourResultsPage.test.tsx`), `src/mocks/rules/wishes.ts`(+`wishes.test.ts`), `src/mocks/handlers/wishes.ts`, `src/mocks/wire/wishes.ts`, `src/test/fixtures/backend/wishes.ts`(`WISH_CREATED` · `MY_WISHES` · `WISH_UPDATED` · `GUIDE_WISHES`)
- Modify: `src/pages/student/HomePage.tsx`(+`HomePage.test.tsx` 다시 쓰기), `src/features/tours/{api,model,queries,examples,lastQuery}.ts`(+`lastQuery.test.ts`, `applyButtonState.test.ts`, `api.test.ts`), `src/pages/student/{TourDetailPage,ApplyPage,MyToursPage}.tsx`(+tests의 문구), `src/app/{routes.tsx,tabs.ts}`, `src/app/shell.test.tsx`, `src/shared/api/queryKeys.ts`, `src/shared/ui/BottomTabBar.tsx`(주석의 `/recommendations` 예), `src/mocks/registry.ts`(tours 도메인 = `[...tourHandlers, ...wishHandlers]`), `src/mocks/handlers/tours.ts`(`POST /recommendations` 삭제), `src/mocks/handlers/handlers.test.ts`(추천 테스트 2개 삭제 · 희망 사항 등록 추가), `src/mocks/registry.test.ts`, `src/shared/ui/ui.test.tsx`, `e2e/golden-path.spec.ts`, `e2e/stage-viewport.spec.ts`, `docs/reference/design-v2.md`(구현 메모 2A-R1 · R2 · R3 행에 `폐기(결정 0011 · 2C)`), `docs/progress/README.md`
- Delete: 2C-R20 목록(`RecommendationsPage.tsx` + test, `filterChips.ts` + test, `recommendationParams.ts` + test, `mocks/ai/recommend.ts` + test, `shared/ui/FilterChips.tsx`)
- 숨은 의존(grep 후 모두 고친다): `EXAMPLE_QUERIES` · `/recommendations` · `recommendationsPath` · `다른 추천 보기` · `추천받으러 가기` · `나에게 맞는 탐방 추천받기` · `RecommendationQuery` · `RecommendationResult` · `useRecommendations` · `qk.recommendations` · `FilterChips` · `recommendation-reason-line` · `디자인 분야에 관심이 많군요!`.

**Interfaces:**
- Consumes: Task 7 `listTours` · `TourFilter` · `fromWireTourItem`; Task 4 `findCampus` · `loadCampuses` · `useUniversities` · `D01`; `campusLabel` · `shortUniversityName`; `shared/lib/date.ts`의 `formatDotDateWeekday` · `formatTime` · `formatMonthDay`(날짜 키는 `${date}T00:00:00+09:00`로 넘긴다); 2A `PageHeading` · `HeroCard` · `ListRow` · `StatusChip` · `Button` · `Select` · `TextField` · `Textarea` · `Skeleton` · `ErrorState` · `Illustration`.
- Produces:
  - `features/wishes/model.ts`: `TourWish { id: number; universityId: number | null; campusLabel: string; major: string; wish: string; date: string | null; createdAt: string | null }` · `TourWishInput { universityId: number; major: string; wish: string; date: string | null }` · `WISH_MAJOR_MAX = 30` · `WISH_TEXT_MAX = 100` · `wishFormSchema`(zod 4: `universityId` 빈 문자열이면 `학교를 골라 주세요.`, `major` 앞뒤 공백을 뺀 길이 0이면 `학과를 적어 주세요.` · 31자 이상 `학과는 30자 이내로 적어 주세요.`, `wish` 0이면 `하고 싶은 것을 한두 문장으로 적어 주세요.` · 101자 이상 `100자 이내로 적어 주세요.`, `date`는 `''` 또는 `YYYY-MM-DD`) · `WishFormValues = z.input<typeof wishFormSchema>`(`{ universityId: string; major: string; wish: string; date: string }`) · `toWishInput(values: WishFormValues): TourWishInput`(major · wish는 앞뒤 공백만 뺀다 — 안쪽 줄바꿈은 그대로, `date ''` → null).
  - `features/wishes/wire.ts`: `WireCreatedWish { wishId: number; campusId: number; major: string; wish: string; date: string | null; createdAt: string }` · `WireWishItem { wishId: number; campusName: string; major: string; wish: string; createdAt: string; campusId?: number; date?: string | null }` · `WireUpdatedWish { wishId: number; campusName: string; major: string; wish: string; date: string | null; updatedAt: string; campusId?: number; createdAt?: string }` · `fromWireCreatedWish(w, campuses): TourWish`(`campusLabel ← campusLabel(찾은 캠퍼스)`, 못 찾으면 `''`) · `fromWireWishItem(w, campuses): TourWish`(`universityId ← campusId ?? findCampus(...)?.id ?? null`, `campusLabel ← campusName`, `date ← date ?? null`) · `fromWireUpdatedWish(w, campuses): TourWish`(`createdAt ← createdAt ?? null`).
  - `features/wishes/api.ts`: `postTourWish(input: TourWishInput, campuses): Promise<TourWish>`(본문 `{ campusId: universityId, major, wish, date }`, `fieldMap { campus_id: 'universityId' }`).
  - `features/wishes/queries.ts`: `useCreateTourWish(): UseMutationResult<TourWish, ApiError, TourWishInput>`(성공하면 `qk.myWishes` 무효화). `qk.myWishes = ['myWishes']`.
  - `WishFields({ form, campuses, disabled }: { form: UseFormReturn<WishFormValues>; campuses: University[] | undefined; disabled?: boolean })` — `Select` `학교`(첫 선택지 `{ value: '', label: '학교를 골라 주세요' }` + 캠퍼스마다 `{ value: String(id), label: campusLabel(name, campusName) }`) · `TextField` `학과`(placeholder `예: 산업디자인`, `maxLength 30`) · `Textarea` `탐방 희망 사항`(placeholder `예: 디자인 작업실을 구경하고 학생 식당에도 가 보고 싶어요.`, hint `한두 문장 · 100자 이내`, `maxLength 100`) · `TextField type="date"` `희망 날짜 (선택)`. 칸 오류는 RHF 오류 → 각 칸의 `error`. 홈과 T-07 수정 화면이 같이 쓴다.
  - `features/tours/wishSearch.ts`: `WishSearch { universityId: number; major: string; wish: string; date: string | null }` · `toWishSearch(s: WishSearch): string`(키 순서 `school` · `major` · `wish` · 있으면 `date`) · `fromWishSearch(search: string): WishSearch | null`(앞 `?` 허용, `school`이 `/^[1-9]\d*$/`가 아니거나 `major` · `wish`가 비면 null, `date`가 `YYYY-MM-DD`가 아니면 null로, `wish`는 받은 그대로).
  - tours: `WishToursResult { tours: TourSummary[]; fallback: boolean }` · `findWishTours(search: WishSearch, campuses): Promise<WishToursResult>`(2C-R16 · R17) · `useWishTours(search: WishSearch | null): UseQueryResult<WishToursResult>`(null이면 꺼짐). 키 `qk.wishTours = (s: WishSearch) => ['tours', 'wish', s] as const`(`qk.allTours` 무효화에 함께 걸린다). `RecommendationQuery` · `Recommendation` · `RecommendationResult` · `recommend` · `useRecommendations` 삭제.
  - `lastQuery.ts`: `tourResultsPath(): string`(`recommendationsPath`를 이름까지 바꾼다 — 저장된 검색이 `fromWishSearch`로 읽히면 `/tours?{search}`, 아니면 `/`). `applyButtonState(me, tour, resultsPath: string)`의 대체 행동 `{ label: '다른 탐방 보기', to: resultsPath }`.
  - `examples.ts`: `DEMO_WISH`(2C-R19, 이 파일은 계속 import가 없다). `EXAMPLE_QUERIES` 삭제.
  - 라우트: `/tours` → `TourResultsPage`(고교생), `/recommendations` 삭제. 탭 `탐색` match `['/', '/tours']`.
  - `MyToursPage` 빈 상태 두 곳의 행동 `추천받으러 가기` → `탐방 찾으러 가기`(제안 문구).
  - 목업: `createWish(db, userId, input: { campusId; major; wish; date }, now): TourWishRow` — 고교생이 아니면 `FORBIDDEN`, 없는 캠퍼스 `fieldError('campusId', '학교를 골라 주세요.')`, `major` 1~30 `fieldError('major', '학과는 1~30자로 적어 주세요.')`, `wish` 1~100 `fieldError('wish', '희망 사항은 1~100자로 적어 주세요.')`, `date`는 null 또는 `YYYY-MM-DD`(`fieldError('date', '날짜를 다시 골라 주세요.')`), 앞뒤 공백만 뺀 값 저장(행 `content` · `preferredDate`). `toWireCreatedWish(row)`. `POST /tour-wishes` → `ok(..., 201)`(확장 없음).

- **홈(H01 대체, 제안 문구 · 배치)** — 위에서부터: `BrandMark wordmark` → `PageHeading('내가 궁금한 대학 생활,\n직접 만나보세요.', '전공 이야기부터 동네 맛집까지 함께 걸어요.')`(그대로) → `<form onKeyDown={preventImeEnter} noValidate>` 안에 `HeroCard`(제목 `어떤 전공이\n궁금한가요?`, 일러스트 campus, `titleTone="brand-strong"`, `footer` = `WishFields`) → `Button type="submit"` `희망 사항 남기고 탐방 찾기`(전송 중 `loading`, 연타 1회) → 캡션 `남긴 희망 사항은 이름 없이 대학생 가이드에게 보여요.`(13 · muted) → 소제목 `이번 방학, 이런 탐방은 어때요?`와 모집 중 목록(지금 그대로). 제출: 검사 통과 → `useCreateTourWish().mutate(toWishInput(values))` → 성공 시 `setSearch(toWishSearch(...))` 후 `/tours?{search}`로 이동; 실패 시 `fieldErrors`(`universityId` · `major` · `wish` · `date`)는 그 칸 오류로, 그 밖은 `toast.error(errorMessage(code))`. 주소에 `fromWishSearch`가 읽히는 검색이 있으면 그 값으로 채운다(`조건 바꾸기`로 돌아온 경우).
- **결과 화면 `/tours`(H02 대체, 제안 문구 · 배치)** — 검색이 없거나 틀리면 `<Navigate to="/" replace />`. 위에서부터: 뒤로 줄(`pt-2` + `h-12` = 56px, `뒤로 가기` → `/?{search}` — 무대 측정 기준선 그대로) → 제목 행(왼쪽 `PageHeading`, 오른쪽 작은 일러스트 campus `max-h-[72px]`): 정상 `조건에 맞는 탐방\n{n}개를 찾았어요.` / `날짜가 빠른 순이에요.`; 대체면 제목 위 `StatusChip tone="warning"` `조건에 맞는 탐방이 없어요` + `같은 학교 탐방\n{n}개를 보여 드려요.` / `학과 · 날짜 조건을 빼고 찾았어요.`; 0건이면 `아직 모집 중인\n탐방이 없어요.` / `다른 학교로 다시 찾아보세요.` → 원문 카드 `<section aria-label="내가 남긴 희망 사항">`(brand-soft · 반경 xl · p-5, 머리 줄 왼쪽 `내가 남긴 희망 사항` 13/Bold brand — 오른쪽 링크 `내 희망 사항 ›`은 화면이 생기는 Task 12가 이 줄에 더한다, 본문 `<p data-testid="wish-text" className="whitespace-pre-wrap break-words">` 15 · ink, 아래 meta `{학교 이름} · {학과}` + 날짜가 있으면 ` · {M월 D일} 희망`) → 목록 `<ul aria-label="모집 중 탐방">`(흰 카드, 행 구분선은 지금 H02와 같은 방식) 행마다 `ListRow`(eyebrow `campusLabel`, 제목 탐방 제목, meta `{MM.DD (요일)} {HH:mm} · {n}자리 남음`, → `/tours/{id}`) → 0건이면 목록 자리에 흰 카드(`StatusChip tone="info"` `0건`, 제목 `{학교 짧은 이름}에 모집 중인 탐방이 없어요`, 설명 `학교를 바꿔 다시 찾아보세요.`, 링크 `조건 바꾸기 ›` → `/?{search}`). 로딩은 `Skeleton`(원문 카드는 주소 값이라 바로 보인다), 오류는 데이터가 없을 때 `ErrorState` + 다시 시도. 들어오면 `setSearch(search)`(탐방 상세의 `다른 탐방 보기`가 여기로 돌아온다).

- [ ] **Step 1: 실패하는 테스트 — 단위** — `model.test.ts`: 스키마 문구 넷(학교 빈칸 · 학과 31자 · 희망 101자 · 희망 공백뿐), `toWishInput({ universityId: '2', major: ' 산업디자인 ', wish: '  가\n나  ', date: '' })` → `{ universityId: 2, major: '산업디자인', wish: '가\n나', date: null }`. `wire.test.ts`: `fromWireCreatedWish(toCamel(WISH_CREATED.data), D01)` → `{ id: 5, universityId: 1, campusLabel: '단국대학교 주전캠퍼스', major: '컴퓨터공학', wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요', date: '2027-01-15', createdAt: '2026-11-06T10:14:00+09:00' }`. `wishSearch.test.ts`: 왕복, 빠진 칸 · `school=x` → null, 틀린 날짜 → `date null`, 줄바꿈 원문 보존. `lastQuery.test.ts`: 저장 없음 → `/`, 옛 `q=밥` → `/`, 희망 검색 → `/tours?school=2&…`. `applyButtonState.test.ts`: 대체 행동 `{ label: '다른 탐방 보기', to: '/tours?school=2&major=a&wish=b' }`. `wishes.test.ts`(규칙): 위 검사들, 저장 값은 앞뒤 공백만 뺀 것.
- [ ] **Step 2: 실패하는 테스트 — api · 핸들러** — `rawFetch('/tour-wishes', POST)` → 201, `expectWireShape(body.data, WISH_CREATED.data)`; `postTourWish` 캠퍼스 999 → `fieldErrors.universityId`; 가이드가 등록 → `FORBIDDEN`. `findWishTours`(START): `{ universityId: 2, major: '산업디자인' }` → 탐방 `[1, 6]`, `fallback false`; `{ universityId: 2, major: '기계공학' }` → `[1, 6]`, `fallback true`; `date: <탐방 6의 날짜>` → `[6]`; `{ universityId: 3, major: '디자인' }`(단국대는 마감 탐방뿐) → `{ tours: [], fallback: true }`.
- [ ] **Step 3: 실패하는 테스트 — `HomePage.test.tsx`(다시 쓰기)** — 문구(브랜드 · 제목 · 설명 · 히어로 제목 · 칸 라벨 넷 · 버튼 · 캡션 · 소제목, 뒤로 가기 없음); 시연 도구 꺼짐이면 칸이 비어 있고, 켜짐이면 `학교` 값 `'2'` · `학과` `산업디자인` · `탐방 희망 사항` `DEMO_WISH.wish` · 날짜 빈칸; 빈 제출 → 학교 · 학과 · 희망 사항 오류 문구, 주소 `/` 그대로, 요청 0; 정상 제출 → `POST /api/tour-wishes` 1번(`server.events`) → `/tours`, 검색 키 `['school', 'major', 'wish']`, `useLastQuery`에 기억; 연타 → 등록 1번; `wireFail('E400', { errors: [{ field: 'campus_id', reason: '학교를 골라 주세요.' }] })` → `학교` 칸 아래 문구; `/?school=2&major=…&wish=…` → 칸이 채워짐; 한글 조합 중 Enter 막힘; `탐색` 탭 활성; 모집 중 목록 최대 3행(그대로).
- [ ] **Step 4: 실패하는 테스트 — `TourResultsPage.test.tsx`(Review Focus 5)** — `/tours?school=2&major=산업디자인&wish=…` → h1 `조건에 맞는 탐방 2개를 찾았어요.`, `region '내가 남긴 희망 사항'` 안 `wish-text`의 `textContent`가 정확히 원문(`'첫 줄\n둘째 줄 '`처럼 줄바꿈 포함 100자 원문 — 주소로 들어온 값 그대로), meta `경희대학교 국제캠퍼스 · 산업디자인`; 목록 첫 행 `href '/tours/1'`, 둘째 `/tours/6`, meta가 `/^\d\d\.\d\d \([일월화수목금토]\) \d\d:\d\d · \d+자리 남음$/`; 학과 `기계공학` → 경고 칩 + `같은 학교 탐방 2개를 보여 드려요.`; `school=3` → `단국대에 모집 중인 탐방이 없어요` + `조건 바꾸기` `href '/?school=3&…'`; 검색 없음 → `/`; 뒤로 가기 `href`가 `/?{search}`; 목록 조회 실패(`wireFail('E500')`) → `ErrorState`, 다시 시도 → 목록; 탐방 상세(마감 탐방)의 `다른 탐방 보기`가 이 주소.
- [ ] **Step 5: 실패 확인 · Step 6: 구현** — 위 Produces와 두 화면. 삭제 목록을 지우고 숨은 의존을 grep으로 0건까지 고친다(`shell.test.tsx` 라우트 표 `/recommendations` → `/tours`, `ui.test.tsx`의 `FilterChips` describe · `StatefulChips`, `MyToursPage.test`의 `추천받으러 가기`, `ApplyPage.test`의 `다른 추천 보기`).
- [ ] **Step 7: E2E** — `golden-path.spec.ts`: `import { DEMO_WISH } from '../src/features/tours/examples'`(주석 그대로). 첫 장면을 `await page.goto(link)` → `await expect(page.getByLabel('탐방 희망 사항', { exact: true })).toHaveValue(DEMO_WISH.wish)` · `getByLabel('학교', { exact: true })` → `String(DEMO_WISH.universityId)` · `getByLabel('학과', { exact: true })` → `DEMO_WISH.major` → `checkRoleBadge('고교생 화면')` → `희망 사항 남기고 탐방 찾기` 클릭 → `getByRole('region', { name: '내가 남긴 희망 사항' })`이 `DEMO_WISH.wish`를 담음 → `page.getByRole('list', { name: '모집 중 탐방' }).getByRole('link').first().click()`(원문 카드 meta에도 `경희대학교 국제캠퍼스`가 있어 글자로 찾지 않는다) → 이후 그대로. `stage-viewport.spec.ts`: 머리 주석의 ① 설명을 `탐방 찾기 결과의 희망 원문 카드 · 첫 탐방 행`으로, 테스트 이름 `① 탐방 찾기: 희망 원문 카드와 첫 탐방 행`, 단계 = 원클릭 링크 → 제출 → 카드 보임 → 대상 `[main.getByRole('region', { name: '내가 남긴 희망 사항' }), main.getByRole('list', { name: '모집 중 탐방' }).getByRole('listitem').first()]`, 측정 이름 `① 탐방 찾기`. 단언 · 뷰포트 · 덮임 검사는 그대로(대상만 바뀐다).
- [ ] **Step 8: 통과 확인** — 전역 검증 명령(골든 패스 2변형 · 무대 9개 · 발표 모드 배지). 무대 ①이 넘치면 일러스트 → 여백 순으로 줄인다(2A-R4).
- [ ] **Step 9: 진척 문서** — 화면 표 `hs-s03`(`홈 · T-01 희망 사항 등록(H01 V2 부품)`), `hs-s04`(라우트 `/tours`, `T-01 탐방 찾기 결과`), `hs-a06`(`/tours` 0건 · 대체); API 표 `POST /recommendations` 행 삭제 · `POST /tour-wishes` 목업 ✅; 무대 실측표 ① 행 이름 `① 탐방 찾기(희망 원문 카드 · 첫 탐방 행)`과 `stage-measure` 수치; `design-v2.md` 구현 메모 2A-R1 · R2 · R3 행 끝에 `폐기(결정 0011 · 2C)`; devlog. **Step 10: 커밋** — `feat(T-01): 학교 · 학과 · 희망 사항 저장 → 조건에 맞는 모집 중 탐방과 원문 표시, AI 추천 삭제`

---

### Task 12: T-07 내 희망 사항 · T-08 고교생 희망 사항 (M)

**Files:**
- Create: `src/pages/student/MyWishesPage.tsx`, `src/pages/student/EditWishPage.tsx`, `src/pages/student/WishPages.test.tsx`, `src/pages/guide/GuideWishesPage.tsx`(+`GuideWishesPage.test.tsx`), `src/features/wishes/components/WishCard.tsx`
- Modify: `src/features/wishes/{model,wire,api,queries}.ts`(+tests), `src/mocks/rules/wishes.ts`(+test), `src/mocks/handlers/wishes.ts`, `src/mocks/wire/wishes.ts`, `src/mocks/db/{schema,seed}.ts`(`MOCK_DB_VERSION = 4`, 시드 희망 사항 4행) + `seed.test.ts`, `src/pages/PlaceholderPage.tsx`(`children`), `src/pages/student/TourResultsPage.tsx`(+test — 원문 카드 머리 줄의 `내 희망 사항 ›`), `src/app/{routes.tsx,tabs.ts}`, `src/app/shell.test.tsx`, `src/pages/guide/GuideHomePage.tsx`(+test), `src/shared/api/queryKeys.ts`, `src/mocks/registry.test.ts`, `docs/reference/design-v2.md`(디자이너 공유 메모), `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 11 `TourWish` · `TourWishInput` · `WishFields` · `wishFormSchema` · `fromWireWishItem` · `fromWireUpdatedWish` · `qk.myWishes`; `useMe` · `useUniversities` · `loadCampuses` · `campusLabel` · `formatDotDate`; `ListRow` · `EmptyState` · `TopBar` · `BottomAction` · `Button` · `Select` · `TextField` · `buttonClass`.
- Produces:
  - model: `GuideWishFilter { universityId?: number; major?: string }` · `diffWishPatch(before: TourWish, after: TourWishInput): Partial<TourWishInput>`(값이 다른 칸만; `before.universityId`가 null이면 `after.universityId`를 넣는다).
  - api: `listMyWishes(campuses): Promise<TourWish[]>`(`listAll('/users/me/tour-wishes')`, 서버 순서 = 최신순) · `patchTourWish(id: number, patch: Partial<TourWishInput>, campuses): Promise<TourWish>`(받은 칸만 `{ campusId?, major?, wish?, date? }`, `fieldMap { campus_id: 'universityId' }`) · `listGuideWishes(filter: GuideWishFilter, campuses): Promise<TourWish[]>`(`listAll(withQuery('/tour-wishes', { campus_id: universityId, major }))`).
  - queries: `useMyWishes()`(`qk.myWishes`) · `useUpdateTourWish(id: number)`(성공하면 `qk.myWishes` 무효화) · `useGuideWishes(filter: GuideWishFilter | null)`(`qk.guideWishes(filter)`, null이면 꺼짐). `qk.guideWishes = (f: GuideWishFilter) => ['guideWishes', f] as const`.
  - `WishCard({ wish, action }: { wish: TourWish; action?: ReactNode })` — `<article>` 흰 카드 · 반경 xl · p-5: eyebrow `{campusLabel} · {major}`(12/Medium muted), 본문 `<p data-testid="wish-text" className="whitespace-pre-wrap break-words">`(15 · ink), 아래 줄 왼쪽 `{MM.DD} 남김`(`createdAt`이 null이면 줄 왼쪽 비움) · 오른쪽 `action`. 학생 이름 등은 그리지 않는다.
  - `PlaceholderPage`에 `children?: ReactNode`(와이어 코드 줄 아래, 로그아웃 위). `/me` 라우트: `<PlaceholderPage title="내 정보 · 인증 상태" wireframe="hs-a03" showLogout><ListRow to="/me/wishes" title="내 희망 사항" meta="남긴 희망 사항을 보고 고쳐요." /></PlaceholderPage>`.
  - 라우트: `/me/wishes` → `MyWishesPage`, `/me/wishes/:wishId/edit` → `EditWishPage`(고교생), `/guide/wishes` → `GuideWishesPage`(가이드). 탭: `UNIVERSITY` `내 탐방` match `['/guide/tours', '/guide/wishes']`.
  - G01: 모든 `<AllToursLink />` 바로 위에 `ListRow`(`to="/guide/wishes"`, 제목 `고교생 희망 사항`, meta `학생들이 남긴 희망 사항을 보고 탐방을 준비해요.`).
  - 결과 화면(`TourResultsPage`)의 원문 카드 머리 줄 오른쪽에 텍스트 링크 `내 희망 사항 ›`(13/Bold brand, 최소 터치 44, 카드 높이를 늘리지 않는다) → `/me/wishes`. `›`는 장식이라 링크 이름은 `내 희망 사항`.
  - 목업: `updateWish(db, userId, wishId, patch, now)`(없으면 `NOT_FOUND`, 남의 것 `FORBIDDEN`, 준 칸만 `createWish`와 같은 검사 · 저장) · `myWishes(db, userId): TourWishRow[]`(`createdAt` 내림차순 · 같으면 id 내림차순) · `wishesForGuide(db, guideId, filter: { campusId?: number; major?: string }): TourWishRow[]`(대학생이 아니면 `FORBIDDEN`, 인증 APPROVED가 아니면 `NOT_VERIFIED`, 캠퍼스 기본 = 인증 행의 대학 ?? 가이드 프로필 대학, 학과 부분 일치, 최신순). 와이어 `toWireWishItem(db, row)`(`campusName = campusLabel`, 확장 `campusId` · `date`) · `toWireUpdatedWish(db, row)`(확장 `campusId` · `createdAt`). 핸들러 `GET /users/me/tour-wishes`(고교생, `okPage`) · `PATCH /users/me/tour-wishes/:wishId`(고교생, `ok`) · `GET /tour-wishes`(대학생, `campus_id` · `major` → `okPage`).
  - 시드(`createSeed` 안의 `stamp` · `rel` 도우미와 학생 변수 `haeun` · `past1` · `seojun` · `yujin`, 행 `TourWishRow`의 `content` · `preferredDate`): 이하은 `haeun@demo.kr` · 대학 2 · `시각디자인` · `디자인 작업실에서 선배들이 과제하는 모습을 보고, 학생 식당도 가 보고 싶어요.` · 날짜 null · `stamp(-3, '19:20')`; 정우진 `past1@demo.kr` · 2 · `산업디자인` · `제품 디자인 수업에서 무엇을 만드는지 궁금해요.\n실기 준비 이야기도 듣고 싶어요.` · null · `stamp(-6, '21:05')`; 박서준 `seojun@demo.kr` · 4 · `컴퓨터공학` · `코딩 동아리가 어떤 프로젝트를 하는지 보고 싶어요.` · `rel(45)` · `stamp(-4, '20:10')`; 최유진 `yujin@demo.kr` · 5 · `통번역` · `통역 실습실을 구경하고 선배에게 어학 공부법을 묻고 싶어요.` · null · `stamp(-2, '18:40')`(모두 제안 문구, 가상의 글). 김민지는 시드하지 않는다(시연에서 처음 남긴다).
- **T-07 `/me/wishes`(제안 문구)** — `TopBar` `내 희망 사항`(뒤로 → `/me`) · 설명 `남긴 그대로 보여요. 고쳐도 이미 본 탐방 결과는 바뀌지 않아요.`(13 · muted) · `<ul aria-label="내 희망 사항">` 항목마다 `WishCard`(action = 링크 `고치기` `buttonClass('soft')` → `/me/wishes/{id}/edit`) · 비면 `EmptyState`(`아직 남긴 희망 사항이 없어요` / `홈에서 학교 · 학과와 하고 싶은 것을 남겨 보세요.` / 행동 `희망 사항 남기러 가기` → `/`).
- **T-07 `/me/wishes/:wishId/edit`(제안 문구)** — `TopBar` `희망 사항 고치기`(뒤로 → `/me/wishes`) · `<form onKeyDown={preventImeEnter} noValidate>` 안 `WishFields`(값은 목록 캐시의 그 항목: 학교 `universityId ?? ''`, 날짜 `date ?? ''`) · 캡션 `고쳐도 이미 본 탐방 결과는 바뀌지 않아요. 새로 찾으려면 홈에서 다시 남겨 주세요.` · `BottomAction` 안 `저장하기`(바뀐 칸이 없으면 비활성 + `hint={{ reason: '바뀐 내용이 없어요.' }}`, 전송 중 `loading`, 연타 1회) → `patchTourWish(id, diffWishPatch(before, toWishInput(values)))` → `toast('희망 사항을 고쳤어요.')` → `/me/wishes`(replace). 목록을 받은 뒤 그 id가 없으면 `<Navigate to="/me/wishes" replace />`.
- **T-08 `/guide/wishes`(제안 문구)** — `TopBar` `고교생 희망 사항`(뒤로 → `/guide`) · 설명 `고교생이 남긴 그대로예요. 이름 같은 개인정보는 보이지 않아요.` · 거르기 폼(`<form onKeyDown={preventImeEnter} noValidate>`): `Select` `학교`(2C-R22: 내 학교를 알면 5곳 중 그 학교를 고른 채, 모르면 첫 선택지 `{ value: '', label: '내 학교' }` + 5곳) · `TextField` `학과 (선택)`(placeholder `예: 산업디자인`) · `Button size="sm" variant="secondary"` `찾기`(누를 때만 조건을 바꾼다) · 소제목 `희망 사항 {n}개`(h2) · `<ul aria-label="고교생 희망 사항">` `WishCard`(action 없음) · 비면 `EmptyState`(`조건에 맞는 희망 사항이 아직 없어요` / `학과를 비우거나 다른 학교로 찾아보세요.`). 인증이 APPROVED가 아니면 폼 · 목록 대신 `EmptyState`(`재학 인증이 승인된 뒤에 볼 수 있어요` / 행동 `인증 상태 보기` → `/guide/verify`)이고 요청하지 않는다.
- registry: `NOT_MOCKED` − `GET /users/me/tour-wishes` · `PATCH /users/me/tour-wishes/:wishId` · `GET /tour-wishes` → 남은 것은 2B 몫 20개.

- [ ] **Step 1: 실패하는 테스트 — 단위 · 목업** — `wire.test.ts`: `fromWireWishItem(toCamel(MY_WISHES.data.items[0]), D01)` → `{ id: 5, universityId: null, campusLabel: '단국대학교 죽전캠퍼스', major: '컴퓨터공학', wish: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요', date: null, createdAt: '2026-11-04T21:00:00+09:00' }`(이름 조인 실패 → null); `fromWireUpdatedWish(WISH_UPDATED)` → `date '2027-01-16'`, `createdAt null`. `model.test.ts` `diffWishPatch`: 그대로 → `{}`, 희망만 → `{ wish }`, `before.universityId null` → `{ universityId }` 포함, 날짜 null ↔ null → 키 없음. `wishes.test.ts`: `updateWish` 남의 것 · 없는 id · 일부 칸; `myWishes` 최신순; `wishesForGuide` 정다은 → 경희대(2) 기본 · 학과 `산업` 부분 일치 · `guide-new@demo.kr` → `NOT_VERIFIED` · 고교생 → `FORBIDDEN`. 와이어: `expectWireShape`(`MY_WISHES.data` + `['campus_id', 'date']`, `WISH_UPDATED.data` + `['campus_id', 'created_at']`, `GUIDE_WISHES.data` + `['campus_id', 'date']`). `seed.test.ts`: 희망 사항 4행 · 버전 4.
- [ ] **Step 2: 실패하는 테스트 — `WishPages.test.tsx`(Review Focus 5)** — `/me`의 `내 희망 사항` 링크 → `/me/wishes`, `MY` 탭 `aria-current`; 결과 화면 원문 카드 안 링크 `내 희망 사항`의 `href '/me/wishes'`(`TourResultsPage.test.tsx`에); 홈에서 `'  첫 줄\n둘째 줄  '`로 남긴 뒤 목록 첫 카드 `wish-text`의 `textContent === '첫 줄\n둘째 줄'`; 비면 빈 상태 문구 · 행동 `/`; `고치기` → 수정 화면 칸 값(학교 `'2'` · 학과 · 희망 · 날짜); 그대로면 `저장하기` 비활성 + 사유; 희망만 고치면 PATCH 본문 키가 `['wish']`뿐(`server.events`로 본문 확인) → 토스트 → 목록에 새 문구; 101자 → 칸 오류; 연타 → PATCH 1번; 없는 id → `/me/wishes`.
- [ ] **Step 3: 실패하는 테스트 — `GuideWishesPage.test.tsx` · `GuideHomePage.test.tsx`** — 정다은: 학교 `'2'`이 고른 채, 이하은 · 정우진 카드의 원문(정우진은 줄바꿈 포함 `textContent` 그대로), `queryByText('이하은')` · `queryByText('정우진')` 없음; 학과 `산업` → `찾기` → 정우진 카드만; 학교 5 → 최유진 카드; 학과 `없는학과` → 빈 상태; `guide-pending@demo.kr` → 안내 + `인증 상태 보기` `/guide/verify`, `GET /api/tour-wishes` 요청 0. G01(START · APPLIED 두 상태)에 `고교생 희망 사항` 링크 `/guide/wishes`, 그 화면에서 `내 탐방` 탭 활성. `shell.test.tsx` 라우트 표에 세 라우트 추가.
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — 위 Produces와 세 화면.
- [ ] **Step 6: 통과 확인** — 전역 검증 명령(무대 ②의 G01 → `내가 개설한 탐방` 진입 · 골든 패스의 `신청자 확인하기`가 그대로 — 새 행이 링크 이름을 가리지 않는다).
- [ ] **Step 7: 디자이너 공유 메모** — `docs/reference/design-v2.md` 맨 아래에 `## 디자이너 공유 메모 — V2 시안이 없는 화면(MVP 2C)` 절: 결정 0011 한 줄, 화면 넷(홈 H01 대체 · 결과 `/tours` H02 대체 · T-07 목록 · 수정 · T-08)마다 라우트 · 쓰는 V2 부품 · 블록 순서 · 이 계획의 제안 문구 · 무대 ① 대상(원문 카드 + 첫 행) · 시안 요청 사항(원문 카드 모양, 0건 · 대체 상태, 희망 사항 카드)을 한 표로.
- [ ] **Step 8: 진척 문서** — 화면 표에 `T-07` `/me/wishes` · `/me/wishes/:wishId/edit`, `T-08` `/guide/wishes` 행(✅ · 목업 ✅ · 하이파이 `V2 부품(시안 없음)`), API 표 세 행 목업 ✅, devlog. **Step 9: 커밋** — `feat(T-07 · T-08): 내 희망 사항 목록 · 수정과 가이드의 고교생 희망 사항`

---

### Task 13: 전환 정리와 문서 — 옛 모양 제거 · 레지스트리 마감 · 명세 대체 표시 · 질문 정리 (M)

**Files:**
- Modify: `src/shared/lib/http.ts`(+`http.test.ts`), `src/shared/lib/errors.ts`(+test), `src/mocks/handlers/util.ts`(`withErrors` 삭제), `src/mocks/handlers/handlers.test.ts`(`P1 목업 도구`의 `withErrors` 테스트 → `withWire`), `src/mocks/registry.test.ts`(`LEGACY` 삭제), `src/test/files.test.tsx`(옛 모양 덮어쓰기가 있으면 `wireOk`), `docs/api/frontend-needs.md`, `docs/api/backend-alignment.md`, `docs/progress/README.md`, `docs/progress/devlog.md`, `README.md`(`/recommendations` · 추천 문구가 있으면)

**Interfaces:**
- Consumes: 앞 태스크 전부.
- Produces:
  - `resolveErrorCode`에서 2C-R4 ②(이미 `ErrorCode` 이름이면 그대로)를 지운다. `toApiError`의 옛 `fieldErrors` 객체 · `details` 읽기를 지운다(봉투 판별 2C-R2는 남긴다).
  - `registry.test.ts`: `등록 핸들러 = (BACKEND_CONTRACT − NOT_MOCKED) ∪ EXTENSIONS`, `NOT_MOCKED`는 Task 2의 20개 그대로(`toHaveLength(20)`), 등록 핸들러 29개.
  - `frontend-needs.md` 제목 아래 첫 줄: `> **백엔드 명세로 대체됨(2026-11-07, 결정 0011).** 실제 계약은 [backend-spec.md](./backend-spec.md)이고, 차이 · 적용 방식 · 백엔드에 물을 것은 [backend-alignment.md](./backend-alignment.md)에 있다. 이 문서는 기록으로만 남긴다.`
  - `backend-alignment.md` 9절을 "2C 뒤 남은 질문(시연 영향 순)"으로 다시 쓴다: 맨 위 문단에 답이 나온 것 — 1 · 2(T-01 팀 합의: AI 없음, 홈이 학교 · 학과를 받는다), 10 · 24 · 26의 앞부분 · 41의 앞부분(1-1절 다), 19(모든 화면이 로그인 뒤), 17(로그인 뒤 `GET /users/me` 합성으로 충분) — 을 적고, 남은 질문을 이 순서로 번호를 새로 매긴다(괄호에 옛 번호): 3 시연 초기화 · 헬스 → 4 시연 계정 시드 → 30 백엔드 주소 · 접두사 · 배포일 → 5 하루 한 장의 단위 → 6 스팟 `spot_id` · `discount_text` · 리뷰 평균 · 수 → 8 가이드의 코스 없음 응답 코드 → 9 `start_time`을 프론트가 계산 · 지점 상한 · 중복 → 7 코스 조회의 `coupon_count` · 확정 시각 → 11 쿠폰 확인의 `used_at` · 탐방 제목, `E409_ALREADY_USED`의 `used_at` → 12 당일 전 사용 코드 · 방문 수 → 13 탐방 `campus_id` · `title` → 45 캠퍼스 이름 표기 → 44 희망 사항 응답 칸(`campus_id` · `date`) 통일 → **새** 희망 날짜가 있을 때 탐방 찾기를 `date_from=그 날짜`로 불러도 되는지(2C-R17) → **새** `GET /tour-wishes`를 인증 전 대학생이 부르면 어떤 코드인지 → 15 · 14 내 탐방 표시 값 → 18 `GET /users/me`의 `campus_id` · `store_id` → 나머지(16 · 20 · 21 · 22 · 23 · 25 · 26 뒷부분(거절 신청도 CANCELED?) · 27 · 28 · 29 · 31 · 32~40 · 41 뒷부분 · 42 · 43 · 46 · 47 · 48 · 49)는 옛 순서. 각 줄의 문장은 옛 9절에서 옮기고, 2C-R8 표에 있는 확장 이름과 같은지 확인한다.
  - 진척 README: API 연동표를 백엔드 경로 기준으로 다시 짠다 — 행 = `BACKEND_CONTRACT` 46 + 확장 3, 열 그대로(도메인은 대조 분석 7-4의 묶음), 목업 ✅ 29행(2C에서 만든 26 + 확장 3), 나머지 20행 목업 ⬜ · 쓰는 화면은 옛 행에서 옮김. P1 `#번호` 메모를 "2B 재계획 전까지 ⬜" 한 줄로. 팀 요청 #4(`tour_wishes` 화면 없음) → `✅ 2C에서 T-01 · T-07 · T-08로 만듦`, #7(추천 0건 대체) → `➖ T-01은 0건이면 같은 학교 탐방(기능 명세)`, #13 비고에 `백엔드 명세 11/6 · 대조 분석 9절`, 새 #24 `백엔드 | backend-alignment.md 9절(2C 뒤 남은 질문, 시연 영향 순) 전달 | 11/8 | ⬜`. 체크포인트 11/8 행 비고에 `2C: 백엔드 와이어 전환 · T-01/T-07/T-08`.
- 숨은 의존: `grep -rn "withErrors" src` → 0, `grep -rn "HttpResponse.json({ code: '" src` → `http.test.ts`의 봉투 아닌 오류 케이스만, `grep -rn "fieldErrors:" src/mocks` → 0, `grep -rn "/recommendations\|EXAMPLE_QUERIES" src e2e README.md docs/progress` → 0.

- [ ] **Step 1: 실패하는 테스트** — `http.test.ts`의 `전환 기간: 옛 오류 모양도 받는다`를 `봉투가 아닌 오류 본문은 code가 있어도 UNKNOWN(fieldErrors 없음)`으로 뒤집는다(`{ code: 'TOUR_CLOSED', fieldErrors: { a: 'b' } }` 409 → `code 'UNKNOWN'`, `fieldErrors undefined`, `status 409`). `errors.test.ts`: `resolveErrorCode('TOUR_CLOSED')` → `UNKNOWN`. `registry.test.ts` 마감 단언. `handlers.test.ts`의 `fieldError` 본문 테스트 3개를 `withWire` 봉투(`errors[]` · `E400`)로.
- [ ] **Step 2: 실패 확인 · Step 3: 구현** — 위 Produces, grep 네 개가 0건(또는 명시한 예외)일 때까지.
- [ ] **Step 4: 통과 확인** — 전역 검증 명령. 무대 스크린샷 셋을 2C 시작 전과 나란히 본다(①만 달라야 한다).
- [ ] **Step 5: 문서** — 위 문서 변경 + devlog `MVP 2C 마감: 백엔드 와이어 전환(도메인 7 + 시연 확장), T-01 · T-07 · T-08, 전환 코드 제거, 9절 질문 정리. 2B는 아래 재계획 메모로 다시 짠다.`
- [ ] **Step 6: 커밋** — `refactor: 전환 코드 제거 · 레지스트리 마감과 백엔드 명세 대체 표시 · 9절 질문 정리`

---

## 부록 — 2B 재계획 메모

2C 뒤 2B의 남은 태스크(T5~T23)를 다시 짤 때의 출발점. 판정: **그대로**(화면 · 범위 유지, 2C 어댑터 위에서) / **백엔드 경로로 재구성** / **빼기**(기능 명세와 백엔드 어디에도 없음).

- **T5 인증 API #4~#9** — 재구성: `POST /verifications/enrollment`(jpg · png 5MB, `campus_id` · `school_name`, 학년 없음) · `POST /guardian-consents` · `GET`/`PATCH /guardian-consents/{consentToken}`. #4 `GET /api/me/verification`은 빼기(백엔드에 없음 — 상태는 `GET /users/me`), `demoConsentToken`은 목업 확장.
- **T6 `/signup`** — 그대로: 2C Task 6이 가입 API와 검증(이름 20 · 영문+숫자)을 이미 맞췄다.
- **T7 `/consent/:token`** — 재구성: 학년 · 처리 시각 줄을 빼고 `school_name` · `guide_text`를 쓴다. 처리된 링크의 응답은 9절 답을 따른다.
- **T8 `/verify`** — 재구성: 학년은 `PATCH /users/me`로 따로, 같은 탭 보호자 동의는 목업 전용, 결정 0011의 시연 '동의 완료' 건너뛰기를 여기에 둔다.
- **T9 고교생 MY · 내 정보 수정 · 설정** — 재구성(일부 빼기): MY(H16)에 2C의 `내 희망 사항` 행을 옮기고 내 정보 수정은 `PATCH /users/me`. 알림 및 설정(H18)은 기능 명세 · 백엔드에 없어 뺀다.
- **T10 가이드 인증 · 프로필 · MY · 설정** — 재구성(일부 빼기): 인증 `campus_id`, 소개 필수 200자, G12 MY. G13 설정은 H18과 같은 이유로 뺀다.
- **T11 운영자 심사 API** — 재구성: `GET /admin/verifications`(페이지 봉투) · 상세 · `PATCH {decision, reject_reason}`(100자). 처리 내역 필터는 9절 답 전까지 뺀다.
- **T12 운영자 심사 화면** — 재구성(일부 빼기): 대기 목록 · 상세 · 반려. `처리 완료` 탭은 백엔드에 처리 내역 · 이메일 · 처리 시각이 없어 뺀다.
- **T13 탐방 생애 API** — 재구성: `POST /tours`(연락 링크 필수, 정원 1~10, 소개 300) · `POST /tours/{tourId}/complete` · `/cancel`, #15 가이드 탐방 상세는 합성. 탐방 제목은 백엔드에 없어 뺀다(파생 제목).
- **T14 탐방 개설 · 완료 · 취소 화면** — 재구성: G04 탐방 이름 칸은 빼고 연락 링크 필수 · 정원 상한 10. 개설 화면에 T-08 `고교생 희망 사항` 진입을 둘 수 있다.
- **T15 가이드 확정 코스 보기** — 그대로: 2C 코스 어댑터 위의 화면.
- **T16 주변 상점 API #18~#20** — 재구성: #18 → `GET /stores/nearby?campus_id`(거리 · 정렬은 프론트), #19 · #20 → 2C `buildSpots`에 `add` · `replace` 편집을 더한다. `StoreReviewSummary`는 T22로.
- **T17 코스 상점 선택(G07)** — 재구성(일부 빼기): 화면 · 진입점은 그대로, `학생 요청:` 줄(`matchedRequest`)은 백엔드 값이 없어 뺀다.
- **T18 리뷰 API #21** — 재구성: `POST /stores/{storeId}/reviews`, 내용 100자, `E403_COUPON_NOT_USED` · `E409_ALREADY_REVIEWED`(→ `REVIEW_DUPLICATE` errorMap).
- **T19 방문 리뷰 작성(H12)** — 그대로 + 착지 뒤 한 번 다시 부르기(요약 갱신이 응답과 별개).
- **T20 사장님 API** — 재구성(일부 빼기): `POST /verifications/business` · `GET /stores/search?keyword` · `POST /users/me/store`(좌표 필수) · `PUT /users/me/store/partnership`. 사업자 대조 후보와 `condition` 저장은 백엔드에 없어 뺀다.
- **T21 사업자 인증 · 가게 연결 · 제휴 화면** — 재구성: O05는 검색 + 직접 등록만, O06 `할인 조건` 칸은 저장되지 않으니 9절 답 전까지 뺀다.
- **T22 R-02 최근 리뷰** — 재구성: 시트를 열 때 `GET /stores/{storeId}/reviews`(실서버에서 리뷰 평균 · 수 확장을 대신한다).
- **T23 마감 스모크** — 그대로 + T-07 · T-08과 환경 변수로 켜는 `?mode=real` 스모크를 더한다.
