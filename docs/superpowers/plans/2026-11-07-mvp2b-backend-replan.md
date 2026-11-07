# MVP 2B′ — 남은 P1 화면을 백엔드 와이어 위에서 다시 짠 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2C가 남긴 백엔드 경로 20개(`src/mocks/registry.test.ts`의 `NOT_MOCKED`)를 목업 와이어 · 어댑터 · 화면으로 채운다. 순서는 11/15 심사(문제 · 데이터 · AI · 기술 · 디자인/UX 각 20점)에 보이는 값 순이다 — R-02 상점 리뷰와 AI 요약 → S-07 사장님 리포트(R-03 요약) → T-03 · T-05 · T-06 탐방 생애 → R-01 리뷰 쓰기 → C-02 장소 추가 · 교체, 그다음 U-05 · U-06 · U-08 인증 · 동의 · 심사, 그다음 사장님 흐름(U-07 · S-01 · S-03 · 가게 수정), 마지막으로 MY. **자르는 선 위(Task 1~12)는 11/12까지, 아래(Task 13~16)는 시간이 되면.** 목업 시연은 판정 2B′-R5의 새 진입점 말고는 지금과 같다.

**Architecture:** 2C와 같다(혼합 어댑터, 결정 0011). 새 엔드포인트마다 `features/<도메인>/{model,wire,api,queries}.ts`(와이어 타입 · `fromWire*` · 백엔드 경로 호출 · 합성) + `mocks/{rules,wire,handlers}/<도메인>.ts`(규칙은 `MockApiError`를 던지고 `withWire`가 봉투로) + `src/test/fixtures/backend/<도메인>.ts`(명세 예시를 한 글자도 바꾸지 않고). 화면은 옛 2B 계획의 화면 절을 참조하고 바뀐 것(델타)만 이 계획에 적는다.

**Tech Stack:** Vite 7 · React 19 · TypeScript 5.9(strict) · React Router 7 · TanStack Query 5 · Zustand 5 · RHF 7 + Zod 4 · Tailwind 4(V2 토큰) · Radix · MSW 2 · Vitest 3 + Testing Library · Playwright. 새 의존성 없음.

**Spec:** 무엇을 = [`docs/reference/feature-spec.md`](../../reference/feature-spec.md)(결정 [0011](../../decisions/0011-backend-spec-and-t01-wish-flow.md)로 백엔드 명세 · V2보다 앞선다). 경로 · 필드 · 코드 · 예시 = [`docs/api/backend-spec.md`](../../api/backend-spec.md). 명세가 말하지 않는 곳은 [`backend-alignment.md`](../../api/backend-alignment.md) 9절의 질문 번호를 붙여 이 계획의 판정으로 정했다. 화면 문구 · 배치 = 옛 2B 계획 [`2026-11-06-mvp2b-p1-screens-v2.md`](2026-11-06-mvp2b-p1-screens-v2.md)의 Task 6~22 화면 절 + [`design-v2.md`](../../reference/design-v2.md). 아키텍처 · 도구 = 2C 계획 [`2026-11-07-mvp2c-backend-alignment.md`](2026-11-07-mvp2c-backend-alignment.md)(Global Constraints · 2C-R1~R28 · 부록 · 실행 결과). 옛 2B Task 1~4는 끝났고 다시 짜지 않는다(2C Task 6이 가입 · 프로필 API를 맞췄다).

## Global Constraints

(2C 계획의 Global Constraints는 그대로 적용된다 — 백엔드 값은 명세에서 복사, `features/**`는 API 모드를 모름, 의존 방향 · ESLint, 색 토큰 · 그림자 금지 · 여백 20 · 버튼 56 · 터치 44, 무대 400px 예산, 데이터 우선 · `Skeleton` · `EmptyState`, 비활성 사유 + 다음 행동, 되돌릴 수 없는 버튼 잠금 + 연타 1회, 시계는 어댑터 안에서만, 한글 IME, 제안 문구 그대로, 숨은 테스트 의존, 테스트 도구, 진척 문서, 기호로 찾기. 다른 줄은 아래가 앞선다.)

- **우선순위(결정 0011):** 팀 합의 · 기능 명세 > 백엔드 명세 > V2 > 옛 계약 · 계획 · 판정. 명세가 말하지 않으면 명세 문장 그대로 구현하고, 시연에 값이 꼭 필요할 때만 목업 전용 선택 확장(2C-R8 방식, 아래 확장 표)을 두며 9절 번호를 적는다.
- **목업 시연은 그대로(errata G5):** 2B′-R5의 진입점 말고는 목업 모드 화면의 문구 · 순서 · 숫자 · 이동이 바뀌지 않는다. `e2e/stage-viewport.spec.ts`의 대상 · 뷰포트 · 단언은 절대 느슨하게 하지 않는다(넘치면 2A-R4대로 장식부터 줄인다). P0 화면을 건드리는 태스크(2 · 3 · 5 · 6 · 8 · 14)는 무대 스크린샷(`test-results/stage-*.png`)을 앞뒤로 비교한다(커밋하지 않음).
- **태스크 하나로 배포 가능:** 어느 태스크 뒤에도 앱이 돈다. 아직 없는 라우트로 가는 링크를 새로 두지 않는다(지금 `PlaceholderPage`인 라우트는 된다).
- **옛 화면 절 참조:** "옛 2B Task N 화면 절"은 옛 2B 계획의 그 태스크 Produces 안 화면 항목(문구표 · 배치 · 상태 · 검증 문구 · 진입점)이다. 실행자는 그 절을 읽고 이 계획의 델타만 바꾼다. 옛 절의 옛 계약 이름(`#번호` · `GET /api/me/verification` · `postApproveVerification` 등)은 이 계획의 이름으로 읽는다. 옛 절과 이 계획이 다르면 이 계획이 앞선다.
- **errata G1~G4(2B):** G1 글머리는 이어진 문장으로 읽는다 · G2 경로 · 문구 · 응답을 바꾸면 그 문자열을 쓰는 테스트를 같은 태스크에서 고친다(각 태스크 "숨은 의존"은 시작점) · G3 2A · 2B T3 부품을 다시 만들지 않는다(`ListRow` · `SegmentedTabs` · `StatusChip` · `BottomAction` · `Skeleton` · `FileField` · `StarRating`/`StarDisplay` · `VerificationStatusCard` · `LogoutButton variant="row"` · `StopActionSheet` · `ConfirmDialog`) · G4 페이지는 `ApiError`를 import하지 않고 훅 오류의 `code` · `fieldErrors`를 읽는다.
- **errata G5~G13(2C):** G6 읽기 합성은 `Promise.all`로 병렬(쓰기 뒤 다시 읽기는 차례로) · G7 `any` 금지 · G8 선택 인자가 있는 함수를 `queryFn`에 넣을 때는 `() => f()`로 감싼다 · G9 `seoulDateAt` · `computeCancellable`을 다시 만들지 않는다 · G10 어댑터 · 봉투 테스트는 명세 예시 그대로의 픽스처와 비교한다 · G11 목업 전용 확장 엔드포인트는 `auth: false` · G12 바뀐 파일의 `npx prettier --check`가 게이트다 · G13 캠퍼스를 조인하는 api 함수는 `CampusesInput`(`University[] | Promise<University[]>`)을 받아 `Promise.all` 안에서 기다리고, 훅은 `loadCampuses(queryClient)`를 기다리지 않고 넘긴다.
- **옛 2B Global Constraints 중 묶는 것:** 공개 엔드포인트(보호자 동의 조회 · 결정)는 `auth: false`. 목업 규칙은 위에서부터 검사해 처음 걸린 오류를 던지고, 다 통과한 뒤에만 `mutate` 안에서 DB를 바꾼다. `Me`를 돌려주지 않는 변경은 이동 전에 훅이 `refetchMe(queryClient)`를 await한다. 업로드 테스트는 `testImage()` + `userEvent.setup({ applyAccept: false })`. 목업 사진은 메모리뿐이다(2B-R9).
- **목업 도메인 배치(2B′-R3)**와 레지스트리 갱신(2B′-R6)은 판정대로. 새 오류 문구 · 칸 오류 문구는 이 계획에 적힌 것만 쓴다.
- **전역 검증 명령:** `npm run test:run && npm run typecheck && npm run lint && npm run build && npm run e2e` + 바뀐 파일 `npx prettier --check`. 모든 태스크가 통과해야 커밋한다(E2E가 깨지면 같은 태스크에서 고친다).
- 마지막 구현 단계 = 진척 문서(`docs/progress/README.md`의 해당 행 + `docs/progress/devlog.md` 그날 한 줄). 커밋은 main에 직접, **푸시하지 않는다**(사용자 확인 후, 11/15 15:30 이후 금지).

## 판정 (이 계획에서 정한 것 — 2B′-R)

- **2B′-R1 순서와 자르는 선.** 아래 "태스크 순서" 표대로 한다. 선 위 12개는 11/12까지, 선 아래 4개는 시간이 되면. 선 위의 뜻: AI가 보이는 기능(R-02 · R-03 · R-01)과 시연 흐름에 붙는 기능(T-03 · T-05 · T-06 · C-02)이 먼저, 그다음 미성년자 안전 장치(U-05 · U-06 · U-08 — 문제 정의 점수). G05 가이드 프로필(U-04)은 MY지만 G04 개설 차단(`tourCreateBlock`)의 다음 행동이 그 화면이라 Task 11에 둔다. **선 아래 실행 순서는 15 → 13 → 14 → 16이다**(번호는 그대로 둔다). 심사위원이 직접 눌러 보면 고교생 · 가이드의 `MY` 탭 자리 화면이 먼저 보이고, `/signup`이 있어야 Task 10의 인증 흐름을 처음부터 보일 수 있다. 사장님 온보딩은 시드 계정 덕에 시연에 드러나지 않는다. Task 15는 Task 11에만 기대고, Task 13 · 14와는 `shell.test.tsx`만 같이 고친다.
- **2B′-R2 명세 그대로, 확장은 하나.** 새 엔드포인트의 응답에서 얻을 수 없는 값은 합성으로 얻는다(리포트의 AI 요약 = `GET /stores/{storeId}/reviews`, 가게 id = `GET /users/me/store`, 탐방 생애의 화면 값 = `GET /tours/{tourId}` + 코스). 새 목업 전용 확장은 아래 표의 `guardian_consent_token` 하나뿐이다.
- **2B′-R3 목업 도메인 · 기능 폴더 배치**(`backend-alignment.md` 7-4 · 진척 API 표의 도메인 열): reviews ← `GET`/`POST /stores/:storeId/reviews`(`src/mocks/handlers/reviews.ts`, `features/reviews`). stores ← 리포트 · 주변 상점 · 상점 검색 · 가게 등록/수정 · 제휴 · 사업자 인증(`src/mocks/handlers/stores.ts`, `features/stores` — 주변 상점의 소비자는 `features/courses`). campuses ← `GET /campuses/:campusId/places`(`src/mocks/handlers/campuses.ts`, 소비자 `features/courses`). applications ← `POST /tours` · `/cancel` · `/complete`(새 `src/mocks/handlers/tourLifecycle.ts`, registry `applications: [...applicationHandlers, ...tourLifecycleHandlers]`, `features/applications` — 가이드 탐방 합성이 이미 여기 있고 `tours/api` ↔ `courses/api` 순환을 피한다). verification ← 재학 인증 · 보호자 동의(`features/verification`). admin ← `/admin/*`(`features/admin`).
- **2B′-R4 목업이 명세 코드를 그대로 내기.** 역표(`toBackendError`)로 명세 코드가 나오지 않는 경우만 `backendError(status, backendCode, code)`(`src/mocks/rules/errors.ts`, Task 4)를 던진다: 재학 인증 재제출 `E409_ALREADY_SUBMITTED`, 동의 재요청 `E409_CONSENT_EXISTS`, 취소된 탐방의 완료 · 취소 `E409_INVALID_TOUR_STATUS`, 운영자 재처리 `E409_ALREADY_REVIEWED` — 모두 내부 코드 `ALREADY_PROCESSED`. 규칙 단위 테스트는 계속 `ErrorCode`를 단언한다.
- **2B′-R5 목업 시연에 새로 보이는 것(이것뿐).** ① 상점 시트(학생 코스 지도 · 가이드 확정 코스): 별점 줄의 값이 R-02 응답, 그 아래 접힌 `최근 리뷰 {n}개`(Task 2), `USED` 쿠폰이면 `리뷰 쓰기` / `리뷰 작성 완료`(Task 6). ② G08 완료 상태의 `확정 코스 지도 보기`(Task 2). ③ O01: `방문 · 리뷰 리포트 ›`(Task 3), `제휴 혜택 수정 ›` · `가게 정보 수정 ›`(Task 14) — `쿠폰 코드 입력하기` 자리는 그대로. ④ G02 하단 링크 줄 `탐방 완료` · `탐방 취소`, G06 카드의 `탐방 완료`(Task 5). ⑤ H10 `리뷰 남기기 ›` 행, 쿠폰 목록 `USED` 행의 `리뷰 쓰기`, H15 `방문 리뷰 작성하기`가 실제 화면으로(Task 6). ⑥ G03 소제목 줄 `+ 장소 추가`, 지점 시트 `다른 장소로 교체`(Task 8). ⑦ 자리 화면이 실제 화면으로 바뀌는 것(골든 패스 밖의 라우트). 골든 패스 E2E의 로케이터 · 단언은 하나도 바꾸지 않는다.
- **2B′-R6 레지스트리.** 각 API 태스크가 자기 줄을 `NOT_MOCKED`에서 지우고 `registry.test.ts`의 두 개수 단언(`NOT_MOCKED` 길이, 등록 핸들러 수)을 고친다: Task 1 → 18 · 31, Task 3 → 17 · 32, Task 4 → 14 · 35, Task 7 → 12 · 37, Task 9 → 8 · 41, Task 12 → 5 · 44, Task 13 → 0 · 49(테스트 이름 `NOT_MOCKED는 비었다(2B′ 마감)`, `toEqual([])`). 선 아래가 안 되면 `NOT_MOCKED`에 사장님 5줄(`POST /verifications/business` · `GET /stores/search` · `POST /users/me/store` · `PATCH /users/me/store` · `PUT /users/me/store/partnership`)이 의도대로 남는다. 통째로 빼는 엔드포인트는 없다.
- **2B′-R7 사진 규칙(9절 33번).** 명세 그대로 jpg · png, 5MB(`5 * 1024 * 1024`, 정확히 5MB는 통과). 형식은 MIME **또는** 확장자(대소문자 무시). `ERROR_MESSAGES.FILE_TYPE` → `jpg, png 이미지만 올릴 수 있어요.`, `FILE_TOO_LARGE` → `5MB 이하 이미지만 올릴 수 있어요.`. 서버 400의 `errors[{ field: 'document', reason }]`은 2C-R5대로 `fieldErrors.document`(문장이라 그대로 보인다).
- **2B′-R8 재학 인증 제출은 쓰기 둘.** 고교생: `POST /verifications/enrollment`(`school_name` · `document`) → 성공하면 `PATCH /users/me`(`patchMe`, 학년만 바꾸고 이름 · 관심 학과는 지금 값) → 새 `Me`. 대학생: enrollment(`campus_id` · `document`) → `refetchMe`. 훅 결과는 새 `Me`(2B-R7). 첫 쓰기가 실패하면 둘째를 부르지 않는다. 대학생 학교는 목업이 제출 때 프로필에 연결한다(9절 33번).
- **2B′-R9 보호자 동의(명세 U-06).** 다시 요청은 동의 상태가 `REJECTED` · `EXPIRED`일 때만(대기 중 다시 보내기 없음). 보호자 이름 · 이메일 · 만료 시각은 `GET /users/me`에 없어(9절 32번) `/verify`는 미리 채우지 않고 일반 문구를 쓴다. 조회 · 결정은 `auth: false`, `errorMap { E404: 'CONSENT_LINK_INVALID', E410_EXPIRED: 'CONSENT_LINK_EXPIRED' }`. 이미 처리된 링크의 조회는 200 + 그 상태(9절 31번 — 목업 규칙), 결정은 409 `E409_ALREADY_PROCESSED`. 링크 기한은 7일.
- **2B′-R10 보호자 동의 시연 기본값(결정 0011).** 시드 시연 계정은 동의 완료 그대로. 동의 대기인 고교생이면 목업이 `GET /users/me`에 확장 `guardian_consent_token`을 붙이고(아래 표), 시연 도구가 켜져 있을 때 `/verify` STEP 2에 `보호자 페이지 열기`(같은 탭, 배지 `시연`)와 `동의 완료로 건너뛰기`(그 토큰으로 `PATCH {agree: true}`)를 보인다. 실서버(확장 없음)에서는 둘 다 그리지 않는다.
- **2B′-R11 운영자 심사(U-08).** 대기 목록 · 상세 · 승인 · 반려만(처리 완료 탭 없음 — 빠지는 것). 목록은 `status` 없이(서버 기본 PENDING) 오래된 제출 순. 승인 · 반려는 사진이 지워져 되돌릴 수 없으므로 확인 창(옛 2B-R15 문구), 끝나면 토스트 + `/admin/verifications`(replace). 반려 사유 1~100자. 처리된 건을 주소로 열면 읽기 전용(`심사 완료` · 결과 칩 · `파일 삭제됨` · `목록으로`). 409는 토스트 + 목록으로.
- **2B′-R12 탐방 개설(T-03).** 본문 `{ date, start_time, end_time, capacity, intro, open_chat_url }`(명세 그대로, 시각 변환 없음). 정원 1~10, 소개 1~300자, 연락 링크 필수(프론트는 `https://`도 검사, 목업은 비었는지만). 제목 칸 없음 — 카드 제목은 지금처럼 파생 제목. 날짜는 가이드 학교의 방학 안(프론트 안내 + 서버 판정). "내일 이후" 규칙은 명세에 없어 두지 않는다(date `min`은 안내). 가이드 학교를 모르면(실서버 — `me.guideProfile.universityId` null) 학교 칸 `재학 인증한 학교` · 방학 안내 없음 · 서버가 판정.
- **2B′-R13 완료 · 취소(T-05 · T-06).** 버튼 활성은 어댑터가 계산한 `computeTourActions`(취소 = RECRUITING · CLOSED, 완료 = 그리고 오늘(서울) ≥ 탐방 날짜 — 당일 허용, 9절 23번). `E409_INVALID_TOUR_STATUS`는 탐방을 다시 읽어 세분한다(2C-R15 방식): 완료 — COMPLETED → `TOUR_ALREADY_COMPLETED`, CANCELED → `ALREADY_PROCESSED`, 그 밖 → `COMPLETE_BEFORE_TOUR_DATE`; 취소 — COMPLETED → `TOUR_ALREADY_COMPLETED`, 그 밖 → `ALREADY_PROCESSED`. 취소는 PENDING · APPROVED 신청을 CANCELED로, 그 신청의 `ISSUED` 쿠폰을 `EXPIRED`로(기능 명세 T-05), `USED` 쿠폰과 REJECTED 신청은 그대로(9절 25번). 완료 · 취소 화면은 화면 자체가 확인 단계라 확인 창이 없다(2B-R11).
- **2B′-R14 코스 지점 추가 · 교체(C-02).** `PlaceRef`로 상점 · 캠퍼스 건물을 같은 모양으로 다룬다. `buildSpots`에 `add`(맨 끝) · `replace`(같은 자리 · 같은 시각 슬롯, 한줄평은 비움) 편집을 더한다. 캠퍼스 지점도 다른 캠퍼스 장소로 교체할 수 있다(옛 2B-R12의 "STORE만"을 넓힘). 5곳 상한(`MAX_COURSE_STOPS`)과 같은 장소 중복은 프론트만 막는다(명세에 없음, 9절 7번 — 목업 서버는 막지 않는다).
- **2B′-R15 주변 상점 · 캠퍼스 장소(S-02 · C-02 보완).** `GET /stores/nearby?campus_id`의 반경 · 순서는 서버 몫이지만 거리 칸이 없어, 프론트가 캠퍼스 중심(`University.lat/lng`)에서 거리를 계산해 가까운 순(같으면 이름)으로 그린다. 목업 반경은 `COURSE_RADIUS_M`, `is_partner`는 오늘 유효한 제휴(9절 38번). 후보 카드의 `학생 요청:` 줄 자리에 `review_summary`를 `✦ {요약}` 한 줄로 보인다(AI가 보이는 자리). 탐방 학교를 모르면(`universityId === 0`, 2C-R9 셋째 길) 조회하지 않고 안내 상태.
- **2B′-R16 상점 시트 R-02.** 상점 지점 시트를 열 때 `GET /stores/{storeId}/reviews?page=1&size=3`을 부르고(캠퍼스 지점은 부르지 않음), 요약 · 평균 · 수는 이 응답이 오면 이것, 오기 전 · 실패하면 코스 지점 값(데이터 우선, 오류 문구 없음). 최근 리뷰는 접힌 토글 안에 별점 · 내용 · 가린 작성자(`김*늘`, 명세) · 날짜. 리뷰 수 · 평균은 전체 기준이다.
- **2B′-R17 R-01 리뷰 쓰기.** 내용 앞뒤 공백만 빼고 1~100자, 별점 1~5. 저장 중 `AiLoading`은 쓰지 않는다(저장은 AI가 아니다). 성공하면 상점 리뷰 · 코스 · 내 쿠폰을 무효화하고, 실서버 요약 갱신이 응답과 별개라 `REVIEW_SUMMARY_REFETCH_MS`(3초) 뒤 상점 리뷰 · 코스를 한 번 더 무효화한다. 진입 · 착지는 옛 2B-R14 그대로(신청 APPROVED면 `/my-tours/{applicationId}/course?storeId=` 시트를 연 채, 아니면 `/coupons/{id}`).
- **2B′-R18 목업 AI 리뷰 요약(R-03 흉내).** 리뷰를 저장하면 그 상점 리뷰 전부로 `summarizeReviews`를 다시 만들어 요약 행을 더한다(가장 최근 행이 쓰인다). 문장 틀(제안 문구, 실서버 LLM이 대신한다): `학생 {n}명이 평균 {평균 소수 첫째}점을 줬어요. 최근 리뷰에서는 "{가장 최근 내용}"라는 이야기가 나왔어요.` — 내용이 30자를 넘으면 앞 29자 + `…`. 이름 같은 개인정보를 넣지 않는다.
- **2B′-R19 S-07 리포트.** `GET /users/me/store/report`(쿼리 없이 — 기간은 서버 기본) + `GET /users/me/store` + `GET /stores/{storeId}/reviews`(AI 요약 · 최근 리뷰)를 합성한다. 목업 기본 기간은 `오늘 − 30일` ~ `오늘`(양 끝 포함, 시드의 지난 탐방 쿠폰이 들어간다), 리뷰 0개면 `average_rating: null`(9절 44번). V2 시안이 없어 V2 부품으로 그리고 디자이너 공유 메모를 남긴다. 화면 · 빈 상태는 Task 3.
- **2B′-R20 사업자 인증(U-07, 2B-R2 유지 — 운영자 심사 없음).** 본문 `{ business_number: 숫자 10자리, representative_name, opened_at }`. 422 `E422_BUSINESS_INVALID`의 `errors[].reason`이 `CLOSED`면 `BIZ_CLOSED`, 그 밖 `BIZ_MISMATCH` — 기계값을 읽으려고 `ApiError.fieldReasons`(받은 `reason` 원문)를 더한다(Task 13). 성공하면 `refetchMe`(사장님 `verification_status` → APPROVED → `businessVerified`).
- **2B′-R21 가게 연결(S-01).** 사업자 대조 후보는 없다(빠지는 것) — O05는 상호 검색(2자 이상) + 직접 등록. 검색 결과에서 고르면 `{ store_id }`, 직접 등록은 `{ name, address, category, latitude, longitude }`이고 좌표는 사장님이 고른 `가까운 학교`의 캠퍼스 중심이다(지오코더 없음, 9절 36번). `E409_STORE_UNAVAILABLE`은 `getMyStore()`를 다시 읽어 있으면 `STORE_LIMIT`, 없으면 `STORE_ALREADY_LINKED`. 연결 · 등록 뒤 `GET /users/me/store`를 다시 읽고 `refetchMe`.
- **2B′-R22 제휴 · 가게 수정(S-03 · S-01).** 제휴 본문 `{ discount_text ≤50, start_date, end_date ≥ start_date }`(조건 칸 없음 — 빠지는 것), 기간 기본값은 2B-R17(기존 기간, 없으면 오늘 ~ +90일). 가게 수정은 바뀐 칸만 `PATCH`(`diffStoreEdit`). `/owner/me`는 `/owner/store`로 이동(2B-R4).
- **2B′-R23 MY.** H18 · G13이 빠지므로 그 화면에 있던 `인증 상태 확인` · `로그아웃` 행을 H16 · G12의 활동 목록 끝으로 옮긴다. 2C의 진입 행(`내 희망 사항`, `고교생 희망 사항`)은 H16 · G12 목록에 남긴다. 가이드 첫 화면은 학과가 없으면 `/guide/me/profile`(2B-R5, Task 11).
- **2B′-R24 자리 화면.** 2B′ 뒤 `곧 열려요.`는 `/explore`(P2)에만 남는다. `shell.test.tsx`의 자리 단언은 Task 3이 `/explore`로 옮긴다.
- **2B′-R25 테스트 전략(2C-R25 그대로).** 새 엔드포인트마다 픽스처(명세 예시, 봉투째) → `fromWire*(toCamel(픽스처.data))`를 기대 도메인 객체와 비교, 목업 응답은 `rawFetch` → `expectWireShape(본문.data, 픽스처.data, 확장 키)`, 핸들러 테스트는 `features/*/api` 함수로, 화면 덮어쓰기는 `wireOk` · `wirePage` · `wireFail`.
- **2B′-R26 거리 계산은 공용.** `distanceMeters`를 `src/mocks/db/geo.ts`에서 `src/shared/lib/geo.ts`로 옮기고(목업 파일은 다시 내보내기), 화면 쪽 거리 · 도보 시간은 이것을 쓴다(Task 7).

### 확장 필드(2C-R8 표에 더하는 것 — 이것뿐)

| 어디 | 확장(snake) | 확장이 없을 때(실서버) |
|---|---|---|
| `GET /users/me`(고교생, 동의가 대기이고 기한 전일 때만) | `guardian_consent_token` | `getDemoConsentToken()`이 null → `/verify`의 `보호자 페이지 열기` · `동의 완료로 건너뛰기`를 그리지 않는다(9절 30번) |

## 빠지는 것

| 무엇 | 왜 | 화면에서 잃는 것 |
|---|---|---|
| `GET /api/me/verification`(옛 #4, `VerificationOverview`) | 백엔드에 없다. 상태는 `GET /users/me`(`verification_status` · `reject_reason` · `guardian_consent_status`) | `/verify`: 보호자 이름 · 이메일 미리 채움, `제출 {M월 D일}` 줄, `{M월 D일 HH:mm}까지 열 수 있어요` 줄, 대기 중 `동의 링크 다시 보내기` 폼(명세도 막는다) |
| H18 · G13 알림 및 설정(`settingsStore`, 2B-R3) | 기능 명세 · 백엔드에 없다 | `/me/settings` · `/guide/me/settings` 화면과 토글이 없다. H16 · G12의 `알림 및 설정` 행 대신 `인증 상태 확인` · `로그아웃` 행 |
| 운영자 `처리 완료` 탭 | 명세 목록에 처리 내역 · 이메일 · 처리 시각 · 반려 사유가 없다(9절 34번) | A01은 대기 목록뿐(`SegmentedTabs` 없음), `{MM.DD} 처리 · 파일 삭제됨` 카드가 없다. 처리된 건은 주소로만 읽기 전용 |
| 탐방 제목 입력(`CreateTourInput.title`, `TOUR_TITLE_*`) | 명세 T-03에 제목이 없다(9절 11번) | G04에 `탐방 이름` 카드가 없다. G06 · G01 · 학생 화면 카드는 V2의 `디자인 전공자의 하루` 같은 이름 대신 파생 제목 `{대학} {캠퍼스} {학과} 탐방` |
| G07 `matchedRequest`(`학생 요청:` 줄) · `relatedIntent` · 서버 추천 순 | 명세 S-02에 없다(9절 38번) | `학생 요청: …` 줄이 없고 그 자리에 `✦ {AI 리뷰 요약}`, 순서는 도보 거리순 |
| 사장님 `condition`(할인 조건) · 사업자 대조 후보(`GET /owner/store-candidates`, 후보 상점 5 · 6) | 명세 S-03 · U-07에 없다(9절 37 · 35번) | O06에 `할인 조건` 칸이 없다. O05가 `주변 가게 후보` 카드 없이 빈 검색으로 시작하고, `/owner/verify` 성공이 바로 검색 화면으로 간다 |
| 학생 "승인 전에 종료됐어요" 라벨(옛 2B Task 14) | 화면 값이 아니라 문구 분기라 비용 대비 효과가 작다 | 대기 신청 + 완료 탐방은 지금처럼 `종료됨` 칩 |
| 리뷰 저장 중 `AiLoading`, 리뷰 최소 5자, 탐방 "내일 이후" 규칙 | 명세에 없다(2B′-R17 · R12) | 저장 중 AI 문구 대신 버튼 로딩. 1자 리뷰 · 당일 날짜 입력이 서버 판정까지 간다 |

## 옛 2B 판정의 처리

2B-R2(사업자 자동 인증) · R4(`/owner/me` 이동) · R5(가이드 프로필 경로) · R6(인증 화면 셸) · R7(인증 훅 결과는 `Me`, 2B′-R8로 다시 씀) · R9(목업 사진) · R11(완료 · 취소는 화면이 확인, 플래그는 2B′-R13) · R12(추가 · 교체 진입, 2B′-R14로 넓힘) · R14(리뷰 진입 · 착지, 2B′-R17) · R17(제휴 기간 기본값) · R18(시연 P1 계정, 구현됨) · R20(대본 게이트, 컨트롤러 메모)은 **유지**. R1(옛 계약) · R3(설정 저장소)은 **폐기**. R8 → 2B′-R10, R10 → R12, R13 → R15, R15 → R11, R16 → R21, R19 → R24로 **대체**.

## Review Focus

1. **실제 브라우저의 multipart 업로드** — jsdom은 서비스 워커를 거치는 업로드를 시험하지 못한다 → Task 10 `e2e/verify.spec.ts` ①(`newbie@demo.kr`가 jpg를 올려 `심사 중`).
2. **같은 탭 보호자 동의 · 시연 건너뛰기가 새로고침 없이 반영** — 공개 화면에서 동의하거나 `동의 완료로 건너뛰기`를 누른 뒤 `/verify`가 옛 `Me`를 그리면 사용자는 막힌다 → Task 10 `VerifyPage.test.tsx` 통합 테스트 + `e2e/verify.spec.ts` ② · ③.
3. **리뷰 뒤 AI 요약이 늦게 바뀌는 실서버** — 요약 갱신이 응답과 별개라 착지 화면이 옛 요약을 보일 수 있다 → Task 1 `queries.test.tsx`(3초 뒤 한 번 더 무효화) + Task 6 `e2e/review-loop.spec.ts`(시트와 사장님 리포트에 새 요약).
4. **전체 스팟 PUT의 추가 · 교체가 다른 지점을 잃음** — 배열 전체 교체라 캠퍼스 지점의 `campus_building_id`나 다른 지점의 한줄평이 빠지면 조용히 사라진다 → Task 7 `spots.test.ts`(캠퍼스 지점 · 한줄평이 있는 코스에 add · replace).
5. **탐방 완료 · 취소의 409 하나와 학생 쪽 전파** — `E409_INVALID_TOUR_STATUS` 하나가 "날짜 전 · 이미 완료 · 취소됨"을 덮고, 취소가 학생의 신청 · 쿠폰에 보여야 한다 → Task 4 api 테스트(세 갈래) + Task 5 학생 `내 탐방` · 쿠폰 단언.

## 태스크 순서 · 자르는 선

| # | 태스크 | 크기 | 엔드포인트(−`NOT_MOCKED`) |
|---|---|---|---|
| 1 | reviews API · 목업 AI 요약 | M | `GET` · `POST /stores/:storeId/reviews` |
| 2 | R-02 상점 시트 리뷰 · 가이드 확정 코스 보기 | M | — |
| 3 | S-07 방문 · 리뷰 리포트 | M | `GET /users/me/store/report` |
| 4 | 탐방 생애 API · 합성 | M | `POST /tours` · `/tours/:tourId/cancel` · `/complete` |
| 5 | G04 · G09 · G10 화면 · 진입 링크 | L | — |
| 6 | H12 리뷰 쓰기 · 진입점 · 착지 · 리뷰 고리 E2E | L | — |
| 7 | 주변 상점 · 캠퍼스 장소 API · 스팟 빌더 추가/교체 | M | `GET /stores/nearby` · `GET /campuses/:campusId/places` |
| 8 | G07 장소 고르기 · G03 진입점 | L | — |
| 9 | 인증 · 동의 API · 보호자 동의 페이지 | L | enrollment · `guardian-consents` 셋 |
| 10 | `/verify` 재학 인증 · 보호자 동의 · 시연 건너뛰기 | L | — |
| 11 | `/guide/verify` · G05 가이드 프로필 · 첫 화면 규칙 | M | — |
| 12 | 운영자 심사 API · A01 · A02 · A03 | L | `/admin/verifications` 셋 |
| — | **자르는 선 (위: 11/12까지 · 아래: 시간이 되면, 실행 순서 15 → 13 → 14 → 16 — 2B′-R1)** | | |
| 13 | 사장님 API(사업자 · 검색 · 연결 · 수정 · 제휴) | M | 다섯 줄 → `NOT_MOCKED` 0 |
| 14 | 사장님 화면(`/owner/verify` · O05 · O06 · 가게 수정 · 가드) | L | — |
| 15 | MY · 가입(`/signup` · H16 · H17 · G12) | L | — |
| 16 | 마감 — P1 스모크 · 실서버 스모크 · 문서 | M | — |

### 의존 표(pre-flight용)

| 태스크 | 인터페이스로 기대는 태스크 | 다른 태스크와 같이 고치는 파일 |
|---|---|---|
| 1 | — | `registry.ts`(4 · 9 · 12) · `registry.test.ts`(3 · 4 · 7 · 9 · 12 · 13) · `queryKeys.ts`(거의 전부) · `envelope.ts`(4) · `handlers.test.ts`(API 태스크 전부) · `renderApp.tsx` · `features/reviews/model.ts`(2 · 6) |
| 2 | 1 | `StoreSheet.tsx`(6) · `routes.tsx`(화면 태스크 전부) · `shell.test.tsx`(3 · 14 · 15) |
| 3 | 1 | `features/stores/*`(13) · `mocks/{rules,wire,handlers}/stores.ts`(7 · 13) · `MyStorePage.tsx`(14) · `tabs.ts` · `design-v2.md`(8 · 16) · `backend-alignment.md` |
| 4 | — | `features/applications/{model,api,queries}.ts`(5) · `features/courses/api.ts`(7) · `features/campuses/model.ts`(5) · `mocks/rules/errors.ts`(9 · 12 이 씀) · `envelope.ts`(1) |
| 5 | 4 | `ApplicantsPage` · `GuideToursPage` · 시작 경로를 바꾸는 테스트 넷 |
| 6 | 1 · 2 · 3(E2E의 리포트) | `StoreSheet.tsx`(2) · `CourseMapPage.tsx` · `features/reviews/model.ts`(1 · 2) |
| 7 | 1(`latestReviewSummary`) | `features/courses/{model,wire,api,queries,spots}.ts`(8) · 목업 stores(3 · 13) · 목업 campuses · `shared/lib/geo.ts` |
| 8 | 7 | `CourseEditPage` · `StopActionSheet` · `design-v2.md` |
| 9 | 4(`backendError`) | `features/auth/wire.ts` · `mocks/wire/auth.ts` · `shared/lib/errors.ts` |
| 10 | 9 | `e2e/verify.spec.ts`(새) |
| 11 | 9 | `features/auth/landing.ts`(+테스트) · `seed.test.ts` |
| 12 | 4(`backendError`) | — |
| 13 | 3 · 4 | `shared/lib/http.ts`(+테스트) · `features/stores/*` · 목업 stores |
| 14 | 13 · 3 | `MyStorePage` · `CouponRedeemPage` · `shell.test.tsx` |
| 15 | 11 | `shell.test.tsx` · `demo.test.tsx` · `GuideCourseRedirect.test.tsx` |
| 16 | 전부 | `e2e/*` · 문서 |

---

### Task 1: reviews — `GET`/`POST /stores/{storeId}/reviews` · 목업 AI 요약 (M)

**Files:**
- Create: `src/features/reviews/{model,wire,api,queries}.ts`(+`wire.test.ts` · `queries.test.tsx`), `src/mocks/rules/reviews.ts`(+test), `src/mocks/ai/reviewSummary.ts`(+test), `src/mocks/wire/reviews.ts`, `src/mocks/handlers/reviews.ts`, `src/test/fixtures/backend/reviews.ts`(`STORE_REVIEWS` · `REVIEW_CREATED` · `REVIEW_NOT_USED` · `REVIEW_ALREADY` — R-01 · R-02 응답 예시 그대로)
- Modify: `src/mocks/wire/envelope.ts`(+test), `src/mocks/registry.ts`(`reviews: reviewHandlers`), `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/test/renderApp.tsx`, `src/mocks/handlers/handlers.test.ts`(describe `reviews`), `docs/progress/README.md`

**Interfaces:**
- Consumes: 2C `request` · `withQuery` · `toCamel` · `ok` · `withWire` · `requireUser` · `mutate` · `fieldError` · `MockApiError` · `redeemCoupon` · `DEMO_STORE_OWNERS` · `getCourse` · `loadCampuses`.
- Produces:
  - model: `StoreReviewItem { id: number; rating: number; content: string; author: string; createdAt: string }` · `StoreReviews { summary: string | null; average: number | null; count: number; items: StoreReviewItem[] }` · `CreateReviewInput { storeId: number; couponId: number; rating: number; content: string }` · `CreatedReview { id: number; storeId: number; rating: number; content: string; createdAt: string }` · `REVIEW_CONTENT_MAX = 100` · `RECENT_REVIEWS_SIZE = 3` · `REVIEW_SUMMARY_REFETCH_MS = 3_000`.
  - wire: `WireReviewItem { reviewId: number; rating: number; content: string; author: string; createdAt: string }` · `WireStoreReviews { summary: string | null; averageRating: number | null; reviewCount: number; items: WireReviewItem[]; page: number; size: number; total: number }` · `WireCreatedReview { reviewId: number; storeId: number; rating: number; content: string; createdAt: string }` · `fromWireStoreReviews(w: WireStoreReviews): StoreReviews` · `fromWireCreatedReview(w: WireCreatedReview): CreatedReview`.
  - api: `getStoreReviews(storeId: number, size: number = RECENT_REVIEWS_SIZE): Promise<StoreReviews>`(`withQuery('/stores/{storeId}/reviews', { page: 1, size })` 한 쪽만 — `listAll` 아님) · `postReview(input: CreateReviewInput): Promise<CreatedReview>`(`POST /stores/{storeId}/reviews` 본문 `{ couponId, rating, content }`, `errorMap { E409_ALREADY_REVIEWED: 'REVIEW_DUPLICATE' }`; `E403_COUPON_NOT_USED` → `REVIEW_NOT_ALLOWED`는 기본 표).
  - queryKeys: `qk.storeReviews(storeId: number) = ['storeReviews', storeId]` · `qk.allStoreReviews = ['storeReviews']` · `qk.allCourses = ['course']`.
  - queries: `useStoreReviews(storeId: number | null): UseQueryResult<StoreReviews, ApiError>`(null이면 `skipToken`) · `useCreateReview(): UseMutationResult<CreatedReview, ApiError, CreateReviewInput>` — 성공: `qk.storeReviews(input.storeId)` · `qk.allCourses` · `qk.allMyCoupons` 무효화 + `REVIEW_SUMMARY_REFETCH_MS` 뒤 `qk.storeReviews(input.storeId)` · `qk.allCourses`를 한 번 더(2B′-R17); 실패가 `REVIEW_NOT_ALLOWED` · `REVIEW_DUPLICATE` · `NOT_FOUND`면 `qk.allMyCoupons` 무효화.
  - 목업 AI: `summarizeReviews(reviews: Pick<ReviewRow, 'id' | 'rating' | 'content' | 'createdAt'>[]): string | null`(2B′-R18, 0개면 null).
  - 목업 규칙: `listStoreReviews(db, storeId: number): ReviewRow[]`(없는 상점 404 `NOT_FOUND`, `createdAt` 내림차순 · 같으면 id 내림차순) · `createReview(db, userId, storeId: number, body: { couponId?: unknown; rating?: unknown; content?: unknown }, now): ReviewRow` — 순서: 없는 상점 404 `NOT_FOUND` → `rating`이 정수 1~5가 아니면 `fieldError('rating', '별점은 1~5점으로 골라 주세요.')` → `content`가 앞뒤 공백을 뺀 1~100자 문자열이 아니면 `fieldError('content', '한 줄 평은 1~100자로 적어 주세요.')` → 쿠폰이 없거나 · 내 신청의 쿠폰이 아니거나 · 이 상점 쿠폰이 아니거나 · `USED`가 아니면 `MockApiError(403, 'REVIEW_NOT_ALLOWED')` → 같은 쿠폰 또는 같은 (사용자 · 탐방 · 상점)의 리뷰가 있으면 `MockApiError(409, 'REVIEW_DUPLICATE')` → 공백을 뺀 내용으로 행 추가 → `refreshStoreSummary(db, storeId, now)`(요약이 null이 아니면 `ReviewSummaryRow`를 `generatedAt: now` · `reviewCount`로 더한다).
  - 목업 와이어: `maskName(name: string): string`(1자 `*` · 2자 첫 글자 + `*` · 3자 이상 첫 글자 + `*`×(길이−2) + 끝 글자) · `latestReviewSummary(db, storeId: number): ReviewSummaryRow | undefined`(`generatedAt` · id 내림차순 첫 행, Task 7이 쓴다) · `toWireStoreReviews(db, storeId, search: URLSearchParams): WireStoreReviews`(요약 = `latestReviewSummary` 문장 | null, 평균 = 소수 첫째 자리 · 0개면 null, 쪽은 `pageOf`) · `toWireCreatedReview(row: ReviewRow): WireCreatedReview`.
  - `envelope.ts`: `pageOf<T>(items: T[], search: URLSearchParams): { items: T[]; page: number; size: number; total: number }`(지금 `okPage`의 자르기 규칙을 꺼낸 것, `okPage`는 `ok(pageOf(items, search))`).
  - 핸들러: `GET /stores/:storeId/reviews`(로그인한 누구나) → `ok(toWireStoreReviews)`; `POST /stores/:storeId/reviews`(고교생) → `ok(toWireCreatedReview(row), 201)`. 둘 다 `delayBase()`.
  - `renderApp.tsx`: `redeemDemoCoupon(storeId: number, email = 'student@demo.kr'): number` — `checkpoint: 'CONFIRMED'` 뒤, 그 학생 탐방 1 신청의 그 상점 `ISSUED` 쿠폰을 `DEMO_STORE_OWNERS[storeId]` 사장님으로 `redeemCoupon`해 `USED`로 만들고 쿠폰 id를 돌려준다.
- registry: `NOT_MOCKED` − `POST /stores/:storeId/reviews` · `GET /stores/:storeId/reviews`(2B′-R6: 18 · 31).

- [ ] **Step 1: 실패하는 테스트 — 단위**
  - `wire.test.ts`: `fromWireStoreReviews(toCamel(STORE_REVIEWS.data))` → `{ summary: '양이 많고 가격이 착하다는 평이 많아요', average: 4.5, count: 11, items: [{ id: 90, rating: 5, content: '양도 많고 맛있었어요', author: '김*늘', createdAt: '2027-01-15T15:00:00+09:00' }] }`; `fromWireCreatedReview(toCamel(REVIEW_CREATED.data))` → `{ id: 90, storeId: 201, rating: 5, content: '양도 많고 맛있었어요', createdAt: '2027-01-15T15:00:00+09:00' }`.
  - `reviewSummary.test.ts`: `[]` → null; 별점 5 · 4이고 가장 최근 내용이 `'a'` → `'학생 2명이 평균 4.5점을 줬어요. 최근 리뷰에서는 "a"라는 이야기가 나왔어요.'`; 최근 내용 31자 → 앞 29자 + `…`.
  - `reviews.test.ts`(규칙): 검사 순서(별점 0 · 6 · 4.5 → `fieldErrors.rating`, 내용 `'   '` · 101자 → `fieldErrors.content`, 남의 쿠폰 · 다른 상점 쿠폰 · `ISSUED` 쿠폰 → `REVIEW_NOT_ALLOWED`, 두 번째 → `REVIEW_DUPLICATE`), 저장 뒤 `latestReviewSummary(db, 1).summary`가 `'학생 6명이'`로 시작; `maskName`: `김하늘` → `김*늘`, `남궁민수` → `남**수`, `이준` → `이*`, `김` → `*`. `envelope.test.ts`: `pageOf([a, b, c], new URLSearchParams('page=2&size=2'))` → `{ items: [c], page: 2, size: 2, total: 3 }`(기존 `okPage` 단언은 그대로 통과).
- [ ] **Step 2: 실패하는 테스트 — api · 핸들러(`handlers.test.ts` describe `reviews`)** — START 학생: `getStoreReviews(1)` → `count 5` · `average 4.6` · `summary`는 시드 문장 · `items` 3개 · `items[0]`이 `{ rating: 4, content: '시험 기간엔 사람이 많지만 음식은 빨리 나와요.', author: '한*영' }`(시드 리뷰는 시각이 같아 id 내림차순); `rawFetch('/stores/1/reviews', 학생 토큰)` → `expectWireShape(body.data, STORE_REVIEWS.data)`; 없는 상점 → `NOT_FOUND`. CONFIRMED + `redeemDemoCoupon(1)`: `postReview({ storeId: 1, couponId, rating: 4, content: '  양이 많아요  ' })` → `content '양이 많아요'`; 이어 `getStoreReviews(1)` → `count 6` · `summary`에 `"양이 많아요"`; `getCourse(1, campuses)`의 상점 1 지점 `review.count 6`; 두 번째 → `REVIEW_DUPLICATE`(`backendCode 'E409_ALREADY_REVIEWED'`); 상점 2의 `ISSUED` 쿠폰 → `REVIEW_NOT_ALLOWED`(`backendCode 'E403_COUPON_NOT_USED'`); 가이드 토큰 → `FORBIDDEN`; `rawFetch` POST → `status 201` · `expectWireShape(body.data, REVIEW_CREATED.data)`.
- [ ] **Step 3: 실패하는 테스트 — `queries.test.tsx`(Review Focus 3 앞 절반)** — 가짜 타이머 + `invalidateQueries` 스파이: `useCreateReview` 성공 직후 `qk.storeReviews(1)` · `qk.allCourses` · `qk.allMyCoupons`가 불렸고, 2,999ms에 `qk.storeReviews(1)` 호출이 1번, 3,000ms에 2번.
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — 위 Produces.
- [ ] **Step 6: 통과 확인** — 전역 검증 명령.
- [ ] **Step 7: 진척 문서 · 커밋** — API 표 reviews 두 행 목업 ✅(비고 `작성자 가림 · 목업 AI 요약은 저장 때 다시 만든다`), devlog. 커밋 `feat(reviews): 상점 리뷰 · 요약 조회와 리뷰 작성 백엔드 와이어, 목업 AI 요약 갱신`

---

### Task 2: R-02 상점 시트 리뷰 · 가이드 확정 코스 보기 (M)

**Files:**
- Create: `src/features/reviews/components/RecentReviews.tsx`(+test), `src/features/reviews/model.test.ts`, `src/pages/guide/GuideCourseMapPage.tsx`(+test)
- Modify: `src/features/reviews/model.ts`, `src/features/courses/components/StoreSheet.tsx`, `src/pages/student/CourseMapPage.test.tsx`, `src/pages/guide/CourseConfirmPage.tsx`(+`CoursePages.test.tsx`), `src/app/routes.tsx`, `src/app/shell.test.tsx`(라우트 표), `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 1 `useStoreReviews` · `StoreReviews` · `StoreReviewItem`; `StarDisplay` · `formatShortDate`; 2C `useGuideCourse`; 옛 2B Task 15가 쓰는 부품(`CourseStepBar` · `CourseTimeline` · `MapView` · `stopDurations`).
- Produces:
  - `mergeStoreReview(stop: CourseStop['review'], fetched: StoreReviews | undefined): { summary: string | null; average: number | null; count: number } | null` — `fetched`가 있으면 그 세 값, 없으면 지점 값, 둘 다 없으면 null.
  - `RecentReviews({ items }: { items: StoreReviewItem[] }): JSX.Element | null` — 버튼 `최근 리뷰 {n}개`(`aria-expanded`, 처음 접힘, 높이 44) → 펼치면 `<ul aria-label="최근 리뷰">`, 항목마다 `StarDisplay` + 내용(15 · ink, `break-words`) + `{author} · {formatShortDate(createdAt)}`(12 · muted). 빈 배열이면 null.
  - `StoreSheet`(2B′-R16): `StoreDetail`이 `useStoreReviews(stop.type === 'STORE' ? stop.storeId : null)`을 부르고, 요약 · 별점 줄은 `mergeStoreReview(stop.review, reviews.data)` 값으로 지금 규칙(2C-R12 ⑥) 그대로 그린다. 별점 줄 아래 `<RecentReviews items={reviews.data?.items ?? []} />`. 로딩 · 실패는 지점 값만(오류 문구 없음).
  - `GuideCourseMapPage`: **옛 2B Task 15 화면 절 그대로**(델타 없음 — 시트가 위 R-02를 함께 얻는다). 라우트 `/guide/tours/:tourId/course` 자리 교체, `CourseConfirmPage` 완료 상태에 보조 링크 `확정 코스 지도 보기`.

- [ ] **Step 1: 실패하는 테스트** — `model.test.ts`: `mergeStoreReview({ average: null, count: 0, summary: 'x' }, { summary: 'y', average: 4.6, count: 5, items: [] })` → `{ summary: 'y', average: 4.6, count: 5 }`; 두 번째 인자 undefined → 지점 값; `(null, undefined)` → null. `RecentReviews.test.tsx`: 처음 `aria-expanded="false"`이고 내용이 안 보임, 누르면 항목 3개 · `getByRole('img', { name: '별점 4점' })` · `한*영 · {날짜}`; `items []` → 아무것도 없음.
- [ ] **Step 2: 실패하는 테스트 — `CourseMapPage.test.tsx`** — CONFIRMED 학생: 상점 1 시트 → `✦ AI 리뷰 요약` + 시드 요약 · `별점 4.6 · 리뷰 5개` · `최근 리뷰 3개`(접힘) → 펼치면 `시험 기간엔 사람이 많지만 음식은 빨리 나와요.`; 캠퍼스 지점 시트 → `/api/stores/` 요청 0(`server.events`); `GET /api/stores/:storeId/reviews` → `wireFail('E500')`면 시트는 지점 요약 그대로이고 `최근 리뷰` 버튼이 없다; 실서버 모양(코스 `wireOk(COURSE_VIEW.data)` + 리뷰 `wireOk(STORE_REVIEWS.data)`) → `별점 4.5 · 리뷰 11개` · `최근 리뷰 1개`.
- [ ] **Step 3: 실패하는 테스트 — 가이드 확정 코스** — 옛 2B Task 15 Step 1 그대로(CONFIRMED + `guide@demo.kr`: 단계 막대 · 카드 3장 · `지도로 보기` 도식 · 시트에 `제휴 혜택`과 `쿠폰 보기` 없음 · DRAFT는 edit · 코스 없음은 applicants로 replace · G08 완료 상태 링크 · `코스 편집` 탭 활성) + 시트의 `최근 리뷰 3개`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령, 무대 스크린샷 비교.
- [ ] **Step 7: 진척 문서 · 커밋** — 화면 표 hs-s08 비고 `상점 시트 R-02(요약 · 별점 · 최근 리뷰) ✅`, 확정 코스 지도 보기 행 ✅, API 표 `GET /stores/:storeId/reviews` 화면 연결, devlog. 커밋 `feat(R-02): 상점 시트 리뷰 요약 · 최근 리뷰와 가이드 확정 코스 보기`

---

### Task 3: S-07 방문 · 리뷰 리포트 (M)

**Files:**
- Create: `src/pages/owner/StoreReportPage.tsx`(+test)
- Modify: `src/features/stores/{model,wire,api,queries}.ts`(+`wire.test.ts` · `api.test.ts`), `src/test/fixtures/backend/stores.ts`(+`STORE_REPORT` — S-07 응답 예시 그대로), `src/mocks/rules/stores.ts`(+`stores.test.ts`), `src/mocks/wire/stores.ts`, `src/mocks/handlers/stores.ts`, `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/pages/owner/MyStorePage.tsx`(+test), `src/app/{routes.tsx,tabs.ts}`, `src/app/shell.test.tsx`(자리 단언 `/owner/report` → `/explore`, 2B′-R24), `docs/reference/design-v2.md`, `docs/api/backend-alignment.md`(9절 44번), `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 1 `getStoreReviews` · `StoreReviews` · `StoreReviewItem`; 2C `getMyStore` · `MyStore` · `ownerStoreOf`; `addDaysKey` · `seoulDateKey` · `formatMonthDay` · `formatShortDate` · `StarDisplay` · `AiBadge`.
- Produces:
  - model: `StoreReport { from: string; to: string; visitCount: number; reviewCount: number; averageRating: number | null }` · `StoreReportView { report: StoreReport; store: MyStore; reviews: StoreReviews }`.
  - wire: `WireStoreReport { from: string; to: string; visitCount: number; reviewCount: number; averageRating: number | null }` · `fromWireStoreReport(w: WireStoreReport): StoreReport`.
  - api: `getStoreReport(): Promise<StoreReport>`(`GET /users/me/store/report`, 쿼리 없음, `errorMap { E404: 'STORE_NOT_LINKED' }`) · `getStoreReportView(): Promise<StoreReportView | null>` — `Promise.all([getStoreReport(), getMyStore().then((store) => store && getStoreReviews(store.id).then((reviews) => ({ store, reviews })))])`, 가게가 없거나 리포트가 `STORE_NOT_LINKED`면 null.
  - queries: `useStoreReportView(): UseQueryResult<StoreReportView | null, ApiError>`(`qk.storeReport = ['storeReport']`).
  - 목업: `storeReport(db, ownerId, query: { from: string | null; to: string | null }, now): WireStoreReport` — `ownerStoreOf`(404) → `from` · `to` 기본 `addDaysKey(오늘, -30)` · 오늘(2B′-R19), `YYYY-MM-DD`가 아니면 `fieldError('from' | 'to', '날짜를 다시 확인해 주세요.')`, `from > to`면 `fieldError('to', '기간을 다시 확인해 주세요.')` → `visitCount` = 그 가게 `USED` 쿠폰 중 `seoulDateKey(usedAt)`가 기간 안인 수, 리뷰는 `seoulDateKey(createdAt)`가 기간 안인 것의 수 · 평균(소수 첫째, 0개면 null). 핸들러 `GET /users/me/store/report`(사장님, `from` · `to` 쿼리).
  - 화면 `/owner/report`(V2 없음, 제안 문구): `TopBar` `방문 · 리뷰 리포트`(뒤로 → `/owner/store`) · `PageHeading('우리 가게를 찾은\n학생들이에요.', '{M월 D일} ~ {M월 D일} 기준이에요.')`(`formatMonthDay(`${from}T00:00:00+09:00`)`) · 숫자 카드 셋(`grid-cols-3`, brand-soft): `{visitCount}명` / `탐방으로 온 학생` · `{averageRating.toFixed(1)}`(null이면 `-`) / `평균 별점` · `{reviewCount}개` / `리뷰` · AI 카드(흰 카드, `AiBadge` `AI 리뷰 요약` + 요약 15 · ink, 요약이 null이면 `리뷰가 더 모이면 AI가 요약해 드려요.`, 요약이 있으면 아래 캡션 `전체 리뷰 {reviews.count}개를 요약했어요.`) · 소제목 `최근 리뷰` + `<ul aria-label="최근 리뷰">`(항목 모양은 `RecentReviews`의 항목과 같다, 비면 `아직 리뷰가 없어요.`). 기간 수 · 전체 리뷰 수가 모두 0이면 숫자 카드 아래 전부 대신 `EmptyState`(`아직 탐방으로 온 학생이 없어요` / `학생들이 쿠폰을 쓰고 리뷰를 남기면 여기에 모여요.` / 행동 `쿠폰 사용 처리하기` → `/owner/coupons/redeem`). 데이터가 null이면 `EmptyState`(`연결된 가게가 없어요` / `가게를 연결하면 리포트를 볼 수 있어요.` / 행동 `내 가게로` → `/owner/store`). 로딩 `Skeleton`, 데이터 없는 오류 `ErrorState` + 다시 시도.
  - `MyStorePage`: 가게가 있을 때 `쿠폰 사용 방법` 아래 텍스트 링크 `방문 · 리뷰 리포트 ›`(13/Bold brand, 높이 44, `›`는 장식 — 링크 이름 `방문 · 리뷰 리포트`) → `/owner/report`. `쿠폰 코드 입력하기` 자리 그대로.
  - 탭: `OWNER` `내 가게` match에 `/owner/report`.
- registry: `NOT_MOCKED` − `GET /users/me/store/report`(17 · 32).

- [ ] **Step 1: 실패하는 테스트 — 단위 · 규칙** — `wire.test.ts`: `fromWireStoreReport(toCamel(STORE_REPORT.data))` → `{ from: '2027-01-01', to: '2027-01-31', visitCount: 18, reviewCount: 11, averageRating: 4.5 }`. `stores.test.ts`(START, 오늘 = 시드 날): owner1 기본 → `{ from: addDaysKey(오늘, -30), to: 오늘, visitCount: 5, reviewCount: 5, averageRating: 4.6 }`; `from = addDaysKey(오늘, -29)` → `visitCount 0` · `reviewCount 5`; `from > to` → `fieldErrors.to`; owner3 → `0 · 0 · null`; `owner-nostore@demo.kr` → `STORE_NOT_LINKED`.
- [ ] **Step 2: 실패하는 테스트 — api** — owner1 `getStoreReportView()` → `report.visitCount 5` · `store.id 1` · `reviews.count 5`, 요청 셋(`/users/me/store/report` · `/users/me/store` · `/stores/1/reviews`); `owner-nostore` → null; `rawFetch('/users/me/store/report', 사장님 토큰)` → `expectWireShape(body.data, STORE_REPORT.data)`; CONFIRMED + `redeemDemoCoupon(1)` 뒤 owner1 → `visitCount 6`.
- [ ] **Step 3: 실패하는 테스트 — `StoreReportPage.test.tsx` · `MyStorePage.test.tsx`** — owner1: 제목 · `5명` · `4.6` · `5개` · AI 카드에 시드 요약 · `전체 리뷰 5개를 요약했어요.` · 최근 리뷰 3개; owner3 → 빈 상태 + 행동 `href '/owner/coupons/redeem'`; `owner-nostore` → `연결된 가게가 없어요`; 리포트 `wireFail('E500')` → `ErrorState`, 다시 시도 → 숫자; `내 가게` 탭 활성; O01의 `방문 · 리뷰 리포트` `href '/owner/report'`, 가게 없는 O01-E에는 없음. `shell.test.tsx`: `/explore` → `곧 열려요.`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령, 무대 스크린샷 비교(③ 이후 사장님 화면).
- [ ] **Step 7: 문서** — `design-v2.md` 맨 아래에 `## 디자이너 공유 메모 — V2 시안이 없는 화면(MVP 2B′)` 절을 만들고 첫 행: 리포트(`/owner/report`, 쓰는 부품 · 블록 순서 · 위 제안 문구 · 시안 요청 `숫자 카드 셋의 모양, AI 요약 카드, 빈 상태`). 9절 44번 줄을 `S-07 리포트: 기본 기간 "최근 30일"이 오늘 포함 30일인지 31일인지, 리뷰 0개일 때 average_rating이 null인지, AI 요약을 리포트 응답에 넣을 계획이 있는지(지금은 GET /stores/{storeId}/reviews로 합성) (옛 48번)`로. 진척: owner-s04 ✅(P2 → P1, V2 부품 · 시안 없음), API 표 행 목업 ✅, devlog.
- [ ] **Step 8: 커밋** — `feat(S-07): 방문 · 리뷰 리포트와 AI 리뷰 요약 합성`

---

### Task 4: 탐방 생애 API — `POST /tours` · `/cancel` · `/complete` · 가이드 탐방 합성 (M)

**Files:**
- Create: `src/mocks/rules/tours.ts`(+`tours.test.ts`), `src/mocks/handlers/tourLifecycle.ts`
- Modify: `src/features/applications/{model,wire,api,queries}.ts`(+`model.test.ts` · `api.test.ts`), `src/features/courses/api.ts`, `src/features/campuses/model.ts`(+`model.test.ts`), `src/mocks/rules/errors.ts`, `src/mocks/wire/envelope.ts`(+test), `src/test/fixtures/backend/tours.ts`(+`TOUR_CREATED` · `TOUR_OUTSIDE_VACATION` · `TOUR_PROFILE_REQUIRED` · `TOUR_CANCELED` · `TOUR_CANCEL_INVALID` · `TOUR_COMPLETED` · `TOUR_COMPLETE_INVALID` — T-03 · T-05 · T-06 예시 그대로), `src/mocks/registry.ts`, `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/handlers/handlers.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: 2C `getTour` · `TourDetail` · `TourSummary` · `CampusesInput` · `recode` · `requireOwnTour` · `expireCouponsForApplication` · `seoulDateAt` · `seoulDateKey` · `addDaysKey` · `nextId`.
- Produces:
  - `src/mocks/rules/errors.ts`: `MockApiError` 여섯째 인자 `backendCode?: string` · `backendError(status: number, backendCode: string, code: ErrorCode): MockApiError`. `fail()`은 `backendCode`가 있으면 그 코드와 `error.status`로 낸다(2B′-R4).
  - `features/campuses/model.ts`: `isWithinVacation(vacations: Vacation[], dayKey: string): boolean`(시작 · 종료일 포함) · `tourDateBounds(vacations: Vacation[], todayKey: string): { min: string; max: string } | null`(내일 이후에 끝나는 방학만 보고 `min = max(내일, 그 첫 방학 시작)` · `max = 마지막 방학 끝`, 없으면 null).
  - `features/applications/model.ts`: `CreateTourInput { date: string; startTime: string; endTime: string; capacity: number; introduction: string; openChatUrl: string }` · `TOUR_CAPACITY_MAX = 10` · `TOUR_INTRO_MAX = 300` · `TourActions { completable: boolean; cancellable: boolean }` · `computeTourActions(tour: Pick<TourSummary, 'status' | 'startsAt'>, now: Date): TourActions`(2B′-R13, 어댑터 전용) · `GuideTourDetail { tour: TourDetail; courseStopCount: number; actions: TourActions }`.
  - wire: `WireTourStatus { tourId: number; status: TourStatus }`(개설 · 취소 · 완료 응답 공통).
  - `features/courses/api.ts`: `getGuideCourseStopCount(tourId: number): Promise<number>`(가이드 코스 와이어의 `spots.length`, 코스 없음(2C-R14)이면 0).
  - api(`features/applications/api.ts`): `postTour(input: CreateTourInput): Promise<number>`(`POST /tours` 본문 `{ date, startTime, endTime, capacity, intro: introduction, openChatUrl }`, `fieldMap { intro: 'introduction' }`, 새 탐방 id) · `getGuideTour(tourId: number, campuses: CampusesInput): Promise<GuideTourDetail>`(`Promise.all([getTour, getGuideCourseStopCount])`, `actions = computeTourActions(tour, new Date())`) · `postCompleteTour(tourId: number, campuses: CampusesInput): Promise<void>` · `postCancelTour(tourId: number, campuses: CampusesInput): Promise<void>`(둘 다 `backendCode === 'E409_INVALID_TOUR_STATUS'`면 `getTour`로 다시 읽어 2B′-R13대로 `recode`).
  - queries: `qk.guideTour(tourId: number) = ['guideTour', tourId]`(따로 된 뿌리 — errata T4) · `useGuideTour(tourId: number): UseQueryResult<GuideTourDetail>` · `useCreateTour(): UseMutationResult<number, ApiError, CreateTourInput>`(성공: `{ queryKey: qk.guideTours, exact: true }` · `qk.allTours` 무효화; 실패가 `NOT_VERIFIED` · `GUIDE_PROFILE_REQUIRED`면 `qk.me` 무효화) · `useCompleteTour(tourId)` · `useCancelTour(tourId)`: `UseMutationResult<void, ApiError, void>`(성공: `qk.guideTour(tourId)` · `qk.guideTours` · `qk.applicants(tourId)` · `qk.allTours` 무효화, 실패: `qk.guideTour(tourId)` 무효화).
  - 목업 규칙(`src/mocks/rules/tours.ts`): `createTour(db, guideId, body: Record<string, unknown>, now): TourRow` — ① 인증 APPROVED 아님 `MockApiError(403, 'NOT_VERIFIED')` ② 프로필 학과가 비었으면 `MockApiError(409, 'GUIDE_PROFILE_REQUIRED')` ③ 형식: `date` `YYYY-MM-DD` 아니면 `fieldError('date', '날짜를 골라 주세요.')` · `startTime` · `endTime` `HH:mm` 아니면 `fieldError('startTime', '시작 시간을 골라 주세요.')` · `fieldError('endTime', '종료 시간을 골라 주세요.')` · 종료 ≤ 시작 `fieldError('endTime', '종료 시간은 시작 시간보다 늦어야 해요.')` · `capacity` 정수 1~10 아니면 `fieldError('capacity', '모집 정원은 1~10명으로 적어 주세요.')` · `intro` 공백을 뺀 1~300자 아니면 `fieldError('intro', '탐방 소개는 1~300자로 적어 주세요.')` · `openChatUrl` 공백을 뺀 빈 값이면 `fieldError('openChatUrl', '연락 링크를 넣어 주세요.')` ④ 날짜가 가이드 학교(인증 행 `universityId` ?? 프로필 `universityId`) 방학 밖이면 `fieldError('date', '방학 기간 안의 날짜만 선택할 수 있어요')`(명세 문장 그대로) ⑤ `TourRow`(`title: null`, RECRUITING, `startsAt`/`endsAt = seoulDateAt(date, 시각)`, 소개 · 링크는 공백 뺌). `completeTour(db, guideId, tourId, now): TourRow`(404 · 403 → COMPLETED `MockApiError(409, 'TOUR_ALREADY_COMPLETED')` → CANCELED `backendError(409, 'E409_INVALID_TOUR_STATUS', 'ALREADY_PROCESSED')` → 오늘 < 탐방 날짜 `MockApiError(409, 'COMPLETE_BEFORE_TOUR_DATE')` → COMPLETED). `cancelTour(db, guideId, tourId, now): TourRow`(404 · 403 → COMPLETED `TOUR_ALREADY_COMPLETED` → CANCELED `backendError(…, 'ALREADY_PROCESSED')` → PENDING · APPROVED 신청 CANCELED(`activeUserId` null) + `expireCouponsForApplication` → 탐방 CANCELED).
  - 핸들러(`tourLifecycleHandlers`, 대학생): `POST /tours` → `ok({ tourId, status }, 201)` · `POST /tours/:tourId/complete` · `POST /tours/:tourId/cancel` → `ok({ tourId, status })`.
- registry: `applications: [...applicationHandlers, ...tourLifecycleHandlers]`, `NOT_MOCKED` − 3(14 · 35).

- [ ] **Step 1: 실패하는 테스트 — 단위** — `campuses/model.test.ts`: `isWithinVacation(v, '2026-12-21')` · `'2027-02-28'` true, `'2026-12-20'` · `'2027-03-01'` false; `tourDateBounds(시드 방학, '2026-11-07')` → `{ min: '2026-12-21', max: '2027-08-31' }`, `'2027-01-10'` → `{ min: '2027-01-11', … }`, 모든 방학이 지났으면 null. `applications/model.test.ts` `computeTourActions`: RECRUITING 오늘 → 둘 다 true; RECRUITING 내일 → 완료 false · 취소 true; CLOSED 어제 → 둘 다 true; COMPLETED · CANCELED → 둘 다 false. `envelope.test.ts`: `fail(backendError(409, 'E409_CONSENT_EXISTS', 'ALREADY_PROCESSED'))` → 409 · `code 'E409_CONSENT_EXISTS'`.
- [ ] **Step 2: 실패하는 테스트 — 규칙(`tours.test.ts`)** — 검사 순서(`guide-pending` → `NOT_VERIFIED`, 학과를 비운 `guide@demo.kr` → `GUIDE_PROFILE_REQUIRED`, 형식 오류 각 칸, `'2027-03-10'` → `fieldErrors.date` 명세 문장, 정상 → RECRUITING · `title null`), 완료(탐방 1 오늘 → COMPLETED, 탐방 6 → `COMPLETE_BEFORE_TOUR_DATE`, 탐방 7 → `TOUR_ALREADY_COMPLETED`, 취소된 탐방 → `ALREADY_PROCESSED`), 취소(CONFIRMED + `redeemDemoCoupon(1)` 뒤 탐방 1: 김민지 신청 CANCELED, 상점 1 쿠폰 `USED` 그대로, 그 탐방의 `ISSUED` 쿠폰은 모두 `EXPIRED`, 미리 `mutate`로 거절해 둔 신청 하나는 REJECTED 그대로; 두 번째 → `ALREADY_PROCESSED`), 남의 탐방 → `FORBIDDEN`.
- [ ] **Step 3: 실패하는 테스트 — api · 핸들러(Review Focus 5 앞 절반)** — `postTour({ date: '2027-01-20', startTime: '13:00', endTime: '16:00', capacity: 5, introduction: '캠퍼스와 근처 맛집을 함께 둘러봐요', openChatUrl: 'https://open.kakao.com/o/x' })`(정다은) → id, `getTour(id, campuses)`의 `title '경희대 국제캠퍼스 산업디자인학과 탐방'` · `startsAt '2027-01-20T13:00:00+09:00'`; 받은 본문 키가 정확히 `['date', 'start_time', 'end_time', 'capacity', 'intro', 'open_chat_url']`; `introduction ''` → `fieldErrors.introduction`; `capacity 11` → `fieldErrors.capacity`; `rawFetch('/tours', POST)` → `status 201` · `expectWireShape(body.data, TOUR_CREATED.data)`. `postCompleteTour(6)` → `COMPLETE_BEFORE_TOUR_DATE`(`backendCode 'E409_INVALID_TOUR_STATUS'`), `(7)` → `TOUR_ALREADY_COMPLETED`, 취소한 탐방 → `ALREADY_PROCESSED`; `server.use`로 `/api/tours/:tourId/complete` → `wireFail('E409_INVALID_TOUR_STATUS')`이고 탐방이 RECRUITING이면 `COMPLETE_BEFORE_TOUR_DATE`. `getGuideTour(1, campuses)`(CONFIRMED) → `courseStopCount 3` · `actions { completable: true, cancellable: true }`; `getGuideTour(6, …)` → `completable false`. 와이어: 완료 · 취소 응답 `expectWireShape(…, TOUR_COMPLETED.data)` · `TOUR_CANCELED.data`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령(신청 · 쿠폰 상태를 바꾸는 규칙이라 E2E 포함).
- [ ] **Step 7: 진척 문서 · 커밋** — API 표 세 행 목업 ✅(비고 `409 하나를 탐방을 다시 읽어 세분`), devlog. 커밋 `feat(T-03 · T-05 · T-06): 탐방 개설 · 취소 · 완료 백엔드 와이어와 가이드 탐방 합성`

---

### Task 5: 탐방 개설 · 완료 · 취소 화면(G04 · G09 · G10) · 진입 링크 (L)

**Files:**
- Create: `src/pages/guide/{TourCreatePage,TourCompletePage,TourCancelPage}.tsx`(+`TourLifecyclePages.test.tsx`)
- Modify: `src/features/applications/model.ts`(+test), `src/pages/guide/{ApplicantsPage,GuideToursPage}.tsx`(+tests), `src/pages/student/MyToursPage.test.tsx`, `src/app/routes.tsx`, `docs/progress/README.md`
- 숨은 의존: `renderApp('/guide/tours/new'`을 "데이터를 부르지 않는 시작 화면"으로 쓰는 `GuideHomePage.test` · `GuideToursPage.test` · `GuideWishesPage.test` · `ApplicantsPage.test` → 시작 경로를 `/explore`로(G04가 이제 데이터를 부른다).

**Interfaces:**
- Consumes: Task 4 `useGuideTour` · `useCreateTour` · `useCompleteTour` · `useCancelTour` · `GuideTourDetail` · `CreateTourInput` · `TOUR_CAPACITY_MAX` · `TOUR_INTRO_MAX` · `isWithinVacation` · `tourDateBounds`; 2B T4 `tourCreateBlock`; `useMe` · `useUniversities` · `formatShortDate` · `formatDotDateWeekday` · `formatTimeRange` · `preventImeEnter`.
- Produces:
  - model: `TourActionState { enabled: boolean; reason: string | null; action: ActionLink | null }` · `completeActionState(d: GuideTourDetail): TourActionState` · `cancelActionState(d: GuideTourDetail): TourActionState` — **옛 2B Task 14의 표 그대로**(가능 판정만 `d.actions.completable` · `cancellable`, 날짜 사유의 날짜는 `formatShortDate(d.tour.startsAt)`).
  - **G04** — 옛 2B Task 14 G04 절 + 델타(2B′-R12): `탐방 이름` 카드 없음(순서 `학교` → `일정` → `정원` → `탐방 소개` → `연락 링크`); `학교`는 `me.guideProfile.universityId`로 캠퍼스를 찾으면 `{name} {campusName}` + ✓, 못 찾으면 `재학 인증한 학교`(제안 문구)이고 그때 date `min`/`max` · `방학 기간` 칩 · 클라이언트 방학 검사가 없다; date `min`/`max` = `tourDateBounds(학교.vacations, seoulDateKey(new Date()))`; 정원 placeholder `최대 10명` · 검증 `모집 정원은 1~10명으로 적어 주세요.`; 소개 검증 `탐방 소개를 입력해 주세요.` · `300자 이내로 적어 주세요.`(10자 하한 없음); 연락 링크 필수 `연락 링크를 넣어 주세요.` · `https://로 시작하는 링크를 넣어 주세요.`(도움말 그대로); 본문은 `CreateTourInput` 그대로(`seoulDateAt` 변환 없음); 서버 칸 오류 `date` · `startTime` · `endTime` · `capacity` · `introduction` · `openChatUrl`은 그 칸 아래(`date` = 날짜 칸). 차단 · 남은 방학 없음 · 성공 이동 · 로딩 · 오류는 옛 절 그대로.
  - **G09** — 옛 절 + 델타: 카드 `{tour.title}` · `{formatDotDateWeekday(startsAt)} · {formatTimeRange(startsAt, endsAt)}` · `참가자 {tour.approvedCount}명 · 코스 {courseStopCount}개 장소`, 버튼은 `completeActionState`.
  - **G10** — 옛 절 + 델타: 카드 `{formatDotDateWeekday(startsAt)} · 참가자 {tour.approvedCount}명`, 버튼은 `cancelActionState`.
  - 진입 링크 — 옛 절의 **진입 링크** 항목 그대로(G02 하단 링크 줄 `탐방 완료` · `탐방 취소`는 `board.tour.status`가 RECRUITING · CLOSED일 때만, G06 카드 `탐방 취소` 옆에 `탐방 완료`, 완료 · 취소 탐방의 G02는 승인 · 거절 버튼을 숨긴다). 옛 절의 **학생 완료 상태** 항목은 빠진다(빠지는 것).

- [ ] **Step 1: 실패하는 테스트 — 단위** — `completeActionState` · `cancelActionState` 표의 모든 칸(문구 · 행동 `to` 정확히).
- [ ] **Step 2: 실패하는 테스트 — `TourLifecyclePages.test.tsx`** — G04: `guide-new` 차단(칩 `재학 인증 승인 필요` · 비활성 · 행동 링크); `guide@demo.kr` `2027-01-20` · 14:00–16:30 · 5 · 소개 · `https://open.kakao.com/o/x` → POST 1번 → `/guide/tours`에 `경희대 국제캠퍼스 산업디자인학과 탐방` 카드(`01.20`); `2027-03-10` → `방학 기간 안의 날짜만 고를 수 있어요.` · 요청 0; `server.use` `wireFail('E400', { errors: [{ field: 'date', reason: '방학 기간 안의 날짜만 선택할 수 있어요' }] })` → 날짜 칸 아래 그 문장; 종료 ≤ 시작, 정원 11, 링크 `''` · `http://x` 오류; `2027-01-20`이면 `방학 기간` 칩; 연타 1회; 연락 링크 칸 한글 조합 중 Enter 제출 안 됨. G09: 탐방 1(오늘) 완료 → `/guide/tours?tab=past`에 그 탐방; 탐방 6 → 비활성 + `탐방 날짜({MM.DD}) 이후에 완료할 수 있어요.` + `신청자 관리로 이동`; 탐방 7 → `이미 완료된 탐방이에요.`; 연타 1회. G10: CONFIRMED 탐방 1 취소 → 토스트 · `/guide/tours`, 이어 `loginAs('student@demo.kr')` → `/my-tours?tab=past`의 그 카드 칩 `취소됨`, 그 신청 쿠폰 목록의 칩이 `couponStateLabel('EXPIRED', null)`(**Review Focus 5**); 완료된 탐방 → 비활성 + 사유; 연타 1회. 공통: 남의 탐방 → `EmptyState` + `내가 개설한 탐방`.
- [ ] **Step 3: 실패하는 테스트 — 진입 링크** — `ApplicantsPage.test`: 탐방 1 링크 줄 `href` 둘, 탐방 7 보드는 링크 줄 · `승인하기` 없음. `GuideToursPage.test`: 진행 예정 카드에 `탐방 완료` `href '/guide/tours/{id}/complete'`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — 숨은 의존 시작 경로를 고친다.
- [ ] **Step 6: 통과 확인** — 전역 검증 명령(골든 패스가 지나는 G02의 `승인하기` · `승인 완료 후 코스 만들기` 로케이터가 그대로), 무대 스크린샷 비교.
- [ ] **Step 7: 진척 문서 · 커밋** — guide-s02 · guide-s07 · guide-a04 ✅, API 표 세 행 화면 연결, devlog. 커밋 `feat(T-03 · T-05 · T-06): 탐방 개설 · 완료 · 취소 화면과 진입 링크`

---

### Task 6: H12 방문 리뷰 쓰기 · 진입점 · 착지 · 리뷰 고리 E2E (L)

**Files:**
- Create: `src/pages/student/ReviewNewPage.tsx`(+test), `src/features/reviews/components/ReviewEntryLink.tsx`, `e2e/review-loop.spec.ts`
- Modify: `src/features/reviews/model.ts`(+test), `src/features/courses/components/StoreSheet.tsx`, `src/pages/student/{CourseMapPage,CouponDetailPage,CouponListPage,MyTourDetailPage}.tsx`(+`CourseMapPage.test` · `CouponPages.test` · `MyTourDetailPage.test`), `src/app/routes.tsx`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 1 `useCreateReview` · `CreateReviewInput` · `REVIEW_CONTENT_MAX` · `redeemDemoCoupon`; Task 2 시트; Task 3 리포트(E2E); `useMyCoupon` · `useMyApplication` · `useTour` · `StarRating` · `couponStateLabel`.
- Produces — **옛 2B Task 19 Produces 그대로** + 델타:
  - model: `reviewNewPath` · `courseStorePath` · `ReviewEntry` · `reviewEntry` · `reviewLandingPath` · `reviewBlock`(옛 시그니처 그대로). `normalizeReviewContent` · `REVIEW_CONTENT_MIN`은 만들지 않는다.
  - `ReviewEntryLink`(옛 그대로).
  - H12 델타(2B′-R17): 검증 `별점을 선택해 주세요.` · 앞뒤 공백을 뺀 0자 `한 줄 평을 입력해 주세요.` · 101자 `100자 이내로 적어 주세요.`; 저장은 `useCreateReview().mutate({ storeId: coupon.storeId, couponId: coupon.id, rating, content: content.trim() })`, 저장 중 `Button loading` + 입력 `fieldset disabled`(`AiLoading` 없음); 착지 `reviewLandingPath(coupon, application?.status ?? null)`(`useMyApplication(coupon.applicationId)`); 카드 둘째 줄 `{campusLabel(universityName, campusName)} 주변`은 `useTour(coupon.tourId)`가 오면. 상태 · 서버 오류 처리 · 진입점 ①~⑤는 옛 절 그대로(⑤의 `?storeId=` 착지 포함).
- 숨은 의존: H15 버튼 문구 `방문 리뷰 작성하기`는 그대로(골든 패스는 누르지 않는다), `CouponListPage` 행 전체 링크 구조(형제 링크).

- [ ] **Step 1: 실패하는 테스트 — 단위 · 화면** — 옛 2B Task 19 Step 1 그대로 + 델타: `ReviewNewPage.test.tsx`(`student@demo.kr` + CONFIRMED + `redeemDemoCoupon(1)`) 별 4점 + `'  양이 많아요  '` → 등록 → `/my-tours/{id}/course?storeId=1`에서 시트가 열린 채 `✦ AI 리뷰 요약`이 `학생 6명이`로 시작; 받은 본문 `{ coupon_id, rating: 4, content: '양이 많아요' }`; 별점 없음 · 공백뿐 · 101자 오류; `USABLE` 쿠폰 → 비활성 + hint 행동 `쿠폰 보기`; 이미 쓴 쿠폰(두 번째 시도) → 비활성 + `코스 지도 보기`; `couponId=abc` · 남의 쿠폰 → `EmptyState`; 연타 → POST 1번.
- [ ] **Step 2: 실패하는 테스트 — 진입점** — `CouponPages.test`: H15 `방문 리뷰 작성하기` → H12, 목록 `USED` 행 `리뷰 쓰기` · 작성 뒤 `리뷰 작성 완료`. `CourseMapPage.test`: `USED` 쿠폰 상점 시트에 `리뷰 쓰기`(그리고 `쿠폰 보기`는 secondary), 시트를 닫으면 주소에서 `storeId`가 빠진다. `MyTourDetailPage.test`: 승인 + 완료 탐방(탐방 7, `seojun@demo.kr`)에 `리뷰 남기기` `href '/my-tours/{id}/coupons'`.
- [ ] **Step 3: E2E — `e2e/review-loop.spec.ts`(Review Focus 3, `./fixtures`의 `test`, `goto` 1번)** — `/?demo=1&reset=1&checkpoint=CONFIRMED&as=student` → 탭 `내 탐방` → `코스 확인하기` → `내 쿠폰 확인하기` → (목록이면 첫 쿠폰) → 패널 `쿠폰 가게 사장님으로 전환` → `사용 처리하기` → `쿠폰 사용이 완료됐어요.` → 패널 `고교생` → 같은 길로 쿠폰 → `쿠폰을 사용했어요!` → `방문 리뷰 작성하기` → `별점 4점` → `좋았던 점과 아쉬웠던 점`에 `사장님이 친절하고 양이 많아요` → `리뷰 등록하기` → 열린 시트(`dialog`)에 `사장님이 친절하고 양이 많아요` → 패널 `쿠폰 가게 사장님으로 전환` → 탭 `내 가게` → `방문 · 리뷰 리포트` → `6명` · AI 카드에 `사장님이 친절하고 양이 많아요`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령(골든 패스 `쿠폰을 사용했어요!` 장면 · 무대 ③), 무대 스크린샷 비교.
- [ ] **Step 7: 진척 문서 · 커밋** — hs-s10 ✅(H12), hs-s08 · hs-s09 비고 `리뷰 진입 ✅`, API 표 `POST /stores/:storeId/reviews` 화면 연결, 열린 질문 `리뷰 단계 무대 측정`에 `review-loop E2E 있음` 한 줄, devlog. 커밋 `feat(R-01): 방문 리뷰 작성과 진입점 · 착지, 리뷰 → AI 요약 → 리포트 E2E`

---

### Task 7: 주변 상점 · 캠퍼스 장소 API · 스팟 빌더 추가/교체 (M)

**Files:**
- Create: `src/shared/lib/geo.ts`(+`geo.test.ts` — `src/mocks/db/geo.test.ts`를 옮긴다)
- Modify: `src/mocks/db/geo.ts`(`export { distanceMeters, type LatLng } from '@/shared/lib/geo';`), `src/features/courses/{model,wire,api,queries,spots}.ts`(+`model.test.ts` · `wire.test.ts` · `spots.test.ts` · `api.test.ts`), `src/mocks/rules/stores.ts`(+test), `src/mocks/wire/{stores,campuses}.ts`, `src/mocks/handlers/{stores,campuses}.ts`, `src/test/fixtures/backend/stores.ts`(+`NEARBY_STORES`), `src/test/fixtures/backend/campuses.ts`(+`CAMPUS_PLACES`), `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/handlers/handlers.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 1 `latestReviewSummary`; 2C `buildSpots` · `SpotEdit` · `SpotInput` · `slotTimes` · `useSpotEdit`(같은 파일) · `listAll` · `withQuery` · `loadCampuses` · `CampusesInput` · `partnershipOn` · `COURSE_RADIUS_M` · `okItems`.
- Produces:
  - `shared/lib/geo.ts`: `LatLng { lat: number; lng: number }` · `distanceMeters(a: LatLng, b: LatLng): number`(옮김, 동작 그대로).
  - model: `PlaceRef = { type: 'STORE'; storeId: number } | { type: 'CAMPUS'; campusBuildingId: number }` · `NearbyStore { storeId: number; name: string; category: string; address: string; lat: number; lng: number; isPartner: boolean; reviewSummary: string | null; distanceM: number }` · `CampusPlace { campusBuildingId: number; name: string; description: string | null; lat: number; lng: number }` · `MAX_COURSE_STOPS = 5` · `walkingMinutes(distanceM: number): number`(`Math.ceil(distanceM / 80)`, 최소 1) · `walkingLabel(distanceM: number): string`(`도보 약 {N}분`).
  - wire: `WireNearbyStore { storeId; name; category; address; lat; lng; isPartner: boolean; reviewSummary: string | null }` · `WireCampusPlace { campusBuildingId; name; description: string | null; lat; lng }` · `fromWireNearbyStore(w: WireNearbyStore, origin: LatLng): NearbyStore` · `fromWireCampusPlace(w: WireCampusPlace): CampusPlace`.
  - api: `getNearbyStores(universityId: number, campuses: CampusesInput): Promise<NearbyStore[]>` — 캠퍼스 목록에 그 id가 없으면 요청 없이 `ApiError(404, 'NOT_FOUND')`, 있으면 `listAll(withQuery('/stores/nearby', { campus_id }))`를 캠퍼스 중심 기준으로 읽어 `distanceM` 오름차순 · 같으면 `name.localeCompare(…, 'ko')`(2B′-R15) · `getCampusPlaces(universityId: number): Promise<CampusPlace[]>`(`listAll('/campuses/{id}/places')`, 서버 순서).
  - `spots.ts`: `SpotEdit`에 `{ kind: 'add'; place: PlaceRef } | { kind: 'replace'; stopId: number; place: PlaceRef }`. `add`는 맨 끝(한줄평 없음), `replace`는 같은 자리에 그 장소(한줄평 없음, 다른 지점 그대로), 없는 `stopId`면 `throw Error('replace: 지점 id가 맞지 않아요')`. 시각은 지금처럼 위치 슬롯. 상한 · 중복은 빌더가 보지 않는다(화면 몫, 2B′-R14).
  - queries: `qk.nearbyStores(universityId: number) = ['nearbyStores', universityId]` · `qk.campusPlaces(universityId: number) = ['campusPlaces', universityId]` · `useNearbyStores(universityId: number | null)` · `useCampusPlaces(universityId: number | null)`(null이면 꺼짐) · `useAddStop(tourId): UseMutationResult<Course, ApiError, PlaceRef>` · `useReplaceStop(tourId): UseMutationResult<Course, ApiError, { stopId: number; place: PlaceRef }>`(둘 다 기존 `useSpotEdit`로).
  - 목업: `nearbyStores(db, campusId: number, category: string | null): StoreRow[]`(없는 캠퍼스 404, 캠퍼스 중심에서 `COURSE_RADIUS_M` 안, `category`가 있으면 같은 업종만, id 순) · `toWireNearbyStore(db, store, now): WireNearbyStore`(`isPartner = partnershipOn(db, id, seoulDateKey(now)) !== undefined`, `reviewSummary = latestReviewSummary(…)?.summary ?? null`) · `campusPlacesOf(db, campusId: number): CampusPlaceRow[]`(없는 캠퍼스 404, `campusBuildingId` 순) · `toWireCampusPlace(row): WireCampusPlace`. 핸들러 `GET /stores/nearby`(로그인한 누구나, `campus_id`가 양의 정수가 아니면 `fieldError('campusId', '캠퍼스를 골라 주세요.')`) → `okItems` · `GET /campuses/:campusId/places`(로그인한 누구나) → `okItems`.
- registry: `NOT_MOCKED` − `GET /stores/nearby` · `GET /campuses/:campusId/places`(12 · 37).

- [ ] **Step 1: 실패하는 테스트 — `spots.test.ts`(Review Focus 4)** — 코스(시작 `2027-01-15T14:00:00+09:00`, id 1 CAMPUS 건물 3 한줄평 없음 · id 2 STORE 201 한줄평 `a` · id 3 STORE 202 한줄평 `b`): add STORE 205 → 4개, 앞 셋은 `{ CAMPUS 3, 14:00 }` · `{ STORE 201, 15:10, comment 'a' }` · `{ STORE 202, 16:00, comment 'b' }` 그대로, 넷째 `{ stopType: 'STORE', storeId: 205, startTime: '16:50' }`(`comment` 키 없음); replace id 2 → STORE 205 → `[{ CAMPUS 3, 14:00 }, { STORE 205, 15:10 }, { STORE 202, 16:00, comment 'b' }]`; replace id 1 → CAMPUS 4 → 첫째 `{ stopType: 'CAMPUS', campusBuildingId: 4, startTime: '14:00' }` · 나머지 한줄평 그대로; replace id 9 → throw.
- [ ] **Step 2: 실패하는 테스트 — 단위** — `walkingMinutes(72)` 1 · `(480)` 6 · `(481)` 7, `walkingLabel(321)` `도보 약 5분`; `fromWireNearbyStore(toCamel(NEARBY_STORES.data.items[0]), { lat: 37.3219, lng: 127.1268 })` → `{ storeId: 202, name: '캠퍼스 카페', category: '카페', address: '경기 용인시 처인구 ...', lat: 37.3225, lng: 127.1271, isPartner: false, reviewSummary: null, distanceM }`이고 `Math.round(distanceM) === 72`; `fromWireCampusPlace(toCamel(CAMPUS_PLACES.data.items[0]))` → `{ campusBuildingId: 3, name: '중앙도서관', description: '24시간 열람실이 있어요', lat: 37.3226, lng: 127.1261 }`; `geo.test.ts`는 옮긴 테스트 그대로.
- [ ] **Step 3: 실패하는 테스트 — api · 핸들러** — `getNearbyStores(3, campuses)` → id `[6, 5]` · `isPartner false`; `getNearbyStores(2, campuses)` → id 집합 `{1, 2, 3, 4}` · `distanceM` 오름차순 · 상점 1 `reviewSummary`는 시드 요약 · 모두 `isPartner true`; `getNearbyStores(0, campuses)` → `NOT_FOUND` · 요청 0; `getCampusPlaces(2)` → 이름 `['예술·디자인대학', '중앙도서관', '학생회관']`; `/campuses/99/places` → `NOT_FOUND`; `rawFetch` → `expectWireShape(body.data, NEARBY_STORES.data)` · `CAMPUS_PLACES.data`; APPROVED + 초안: `putCourseSpots(1, buildSpots(c, { kind: 'add', place: { type: 'CAMPUS', campusBuildingId: 4 } }), campuses)` → 지점 4개 · 끝 `중앙도서관` · `recommendationReason null`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현** — `grep -rn "mocks/db/geo" src`로 import를 확인한다(다시 내보내기라 고칠 필요는 없다).
- [ ] **Step 6: 통과 확인 · Step 7: 진척 문서 · 커밋** — 전역 검증 명령. API 표 두 행 목업 ✅(비고 `거리 · 순서는 프론트`), devlog. 커밋 `feat(C-02 · S-02): 주변 상점 · 캠퍼스 장소 백엔드 와이어와 스팟 빌더 추가 · 교체`

---

### Task 8: G07 장소 고르기 · G03 진입점 (L)

**Files:**
- Create: `src/pages/guide/CoursePickPage.tsx`(+test)
- Modify: `src/features/courses/model.ts`(+test), `src/features/courses/components/StopActionSheet.tsx`(+test), `src/pages/guide/CourseEditPage.tsx`, `src/pages/guide/CoursePages.test.tsx`, `src/app/routes.tsx`, `docs/reference/design-v2.md`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 7 `useNearbyStores` · `useCampusPlaces` · `useAddStop` · `useReplaceStop` · `PlaceRef` · `NearbyStore` · `CampusPlace` · `MAX_COURSE_STOPS` · `walkingLabel`; 2C `useGuideCourse` · `useIsCreatingDraft`; `SegmentedTabs` · `segmentedPanelProps`.
- Produces:
  - model: `PickTarget = { kind: 'add' } | { kind: 'replace'; stop: CourseStop } | { kind: 'invalid' }` · `pickTarget(course: Course, mode: string | null, stopId: string | null): PickTarget`(replace + 코스에 있는 지점 id(유형 무관) → replace, replace인데 id가 없거나 코스에 없음 → invalid, 그 밖 → add) · `CandidateStatus = 'SELECTABLE' | 'IN_COURSE' | 'CURRENT'` · `candidateStatus(place: PlaceRef, course: Course, target: PickTarget): CandidateStatus` · `matchesPlace(texts: (string | null)[], query: string): boolean`(공백 · 대소문자 무시 부분 일치, 빈 검색어는 true).
  - `StopActionSheetProps.onReplace?: () => void` → 버튼 `다른 장소로 교체`(한줄평 다음 · 빼기 앞, `busy`면 비활성). `CourseEditPage`는 모든 지점에 준다(2B′-R14) → `…/course/stops/pick?mode=replace&stopId={id}`.
  - G03: 옛 2B-R12의 `+ 장소 추가`(소제목 줄, `다시 만들기`와 같은 줄, `shrink-0`) → `…/course/stops/pick?mode=add`, 지점이 `MAX_COURSE_STOPS`면 `aria-disabled` + 누르면 토스트 `errorMessage('COURSE_STOP_LIMIT')`. 소제목 줄 높이 · 카드 수 · `<article>` 수 그대로.
  - **G07** — 옛 2B Task 17 G07 절 + 델타(2B′-R14 · R15): TopBar replace `코스 장소 교체` · add `코스 장소 추가`(제안 문구, PageHeading은 옛 그대로); add 모드에만 `SegmentedTabs`(`id="pick-tabs"`, `label="장소 종류"`, `주변 상점` · `캠퍼스 장소`, 주소 `?tab=campus`와 동기, 기본 상점), replace 모드는 그 지점 유형의 목록만(탭 없음); 검색칸 상점 `주변 상점 검색`(placeholder 옛 그대로, 이름 · 업종) · 캠퍼스 `캠퍼스 장소 검색`(placeholder `도서관 · 학생회관`, 이름 · 설명); 상점 카드 = 칩 `제휴 상점`(success) / `일반 상점`(info) · 이름 19/Bold · `{walkingLabel(distanceM)} · {category}` · `reviewSummary`가 있으면 `✦ {요약}`(13 · muted, 한 줄 말줄임) · 상태 칩(`학생 요청:` 줄 없음); 캠퍼스 카드 = 칩 `캠퍼스`(info) · 이름 · `description`(한 줄, 없으면 줄 없음) · 상태 칩; 목록 순서는 api 순서; 적용은 `useAddStop` / `useReplaceStop`; 상한 문구는 `MAX_COURSE_STOPS` 기준; `course.tour.universityId === 0`이면 목록 대신 `EmptyState`(`학교 정보를 찾지 못해 주변 장소를 불러올 수 없어요` / `코스 편집에서 다시 시도해 주세요.` / 행동 `코스 편집으로 돌아가기`). 나머지 상태 · 문구 · 이동은 옛 절 그대로.

- [ ] **Step 1: 실패하는 테스트 — 단위** — `pickTarget` 다섯 갈래(replace STORE · replace CAMPUS(이제 replace) · replace 없는 id · stopId 없음 → invalid · add), `candidateStatus` 셋, `matchesPlace(['카페 모래시계', '카페'], ' 카페 ')` true · `(['학생회관', null], '도서')` false. `StopActionSheet.test.tsx`: `onReplace`가 있으면 `다른 장소로 교체`, `busy`면 비활성.
- [ ] **Step 2: 실패하는 테스트 — `CoursePickPage.test.tsx`**(`guide@demo.kr` + APPROVED + 초안) — 옛 2B Task 17 Step 1 그대로 + 델타: replace(상점 지점) → 카드 선택 → `이 장소로 교체` → 편집 화면 같은 자리에 새 상점 이름; add → `캠퍼스 장소` 탭 → `중앙도서관` → `이 장소 추가` → 지점 4개 · 끝 `중앙도서관`; 코스의 캠퍼스 건물 카드는 `코스에 있음` · 선택 불가; 캠퍼스 지점 replace는 캠퍼스 목록만(탭 없음); 상점 카드에 `✦ ` + 시드 요약, `학생 요청` 없음; `universityId 0`(`server.use`로 `/api/tours/:tourId`에 `campus_name`만 `'없는대학교 본캠퍼스'`로 바꾼 `TOUR_DETAIL.data` — 시드 캠퍼스에 `단국대학교 죽전캠퍼스`가 있어 픽스처 그대로는 조인된다) → 안내 상태 · `/api/stores/nearby` 요청 0; 연타 → PUT 1번.
- [ ] **Step 3: 실패하는 테스트 — `CoursePages.test.tsx`** — `+ 장소 추가` `href`/이동 `?mode=add`, 시트의 `다른 장소로 교체`가 상점 · 캠퍼스 지점 모두에, 5곳에서 `+ 장소 추가` → 토스트; 기존 지점 수 · `article` 수 · 편집 잠금 테스트 그대로.
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령. 무대 ②(G03 지점 카드 3개, 세 뷰포트)와 골든 패스 `≡` → `아래로 이동` 통과, 무대 스크린샷 ② 비교.
- [ ] **Step 7: 문서 · 커밋** — `design-v2.md` 2B′ 메모 표에 G07 행(V2와 다른 점: 캠퍼스 탭, `학생 요청` → `✦ AI 리뷰 요약` 줄, 거리순 · 시안 요청: 두 종류 카드). 진척: guide-a03 ✅, guide-s05 비고 `지점 추가 · 교체 ✅`, devlog. 커밋 `feat(C-02): 코스 장소 추가 · 교체(G07)와 코스 편집 진입점`

---

### Task 9: 인증 · 동의 API · 보호자 동의 페이지(`/consent/:token`) (L)

**Files:**
- Create: `src/features/verification/{model,wire,api,queries}.ts`(+`model.test.ts` · `wire.test.ts`), `src/mocks/rules/verification.ts`(+test), `src/mocks/wire/verification.ts`, `src/mocks/handlers/verification.ts`, `src/test/fixtures/backend/verification.ts`(`ENROLLMENT_OK` · `ENROLLMENT_INVALID` · `ENROLLMENT_SUBMITTED` · `CONSENT_REQUESTED` · `CONSENT_EXISTS` · `CONSENT_VIEW` · `CONSENT_EXPIRED` · `CONSENT_DECIDED` · `CONSENT_PROCESSED` · `CONSENT_DECIDE_EXPIRED` — U-05 · U-06 예시 그대로), `src/pages/public/ConsentPage.tsx`(+test)
- Modify: `src/shared/lib/errors.ts`(+test), `src/shared/lib/http.ts`(`UPLOAD_TIMEOUT_MS` 주석만 `5MB`), `src/features/auth/wire.ts`(`WireMe.guardianConsentToken?: string`), `src/mocks/wire/auth.ts`(확장), `src/mocks/registry.ts`(`verification: verificationHandlers`), `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/app/routes.tsx`, `src/mocks/handlers/handlers.test.ts`, `docs/progress/README.md`
- 숨은 의존: `grep -rn "10MB 이하\|heic" src e2e`(`src/test/files.test.tsx` · `src/shared/ui/ui.test.tsx` · `src/shared/lib/http.test.ts`) — 새 문구 · 5MB로.

**Interfaces:**
- Consumes: Task 4 `backendError`; 2B T1 `readForm` · `formFile` · `putMockFile` · `testImage`; 2B T2 `DEMO_CONSENT_TOKENS`; `upload` · `request` · `refetchMe` · `patchMe` · `Me` · `GuardianStatus` · `VerificationStatus` · `Tone`.
- Produces:
  - model: `PROOF_MAX_BYTES = 5 * 1024 * 1024` · `PROOF_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'` · `validateProofFile(f: Pick<File, 'name' | 'type' | 'size'>): 'FILE_TYPE' | 'FILE_TOO_LARGE' | null`(형식 → 용량) · `proofFileError(f): string | null` · `EnrollmentSubmit = { role: 'HIGH_SCHOOL'; schoolName: string; grade: number; document: File } | { role: 'UNIVERSITY'; universityId: number; document: File }` · `GuardianConsentInput { guardianName: string; guardianEmail: string }` · `GUARDIAN_NAME_MAX = 20` · `ConsentView { studentName: string; schoolName: string | null; guideText: string; status: GuardianStatus; expiresAt: string | null }` · `ConsentDecision = 'AGREED' | 'REJECTED'` · 옛 2B Task 5의 라벨 · 톤 · `StudentStep` · `GuardianStep` · `verifySteps`(그대로).
  - wire: `WireEnrollment { verificationId: number; status: VerificationStatus; submittedAt: string }` · `WireConsentRequested { status: GuardianStatus; expiresAt: string }` · `WireConsentView { studentName; schoolName: string | null; guideText; status: GuardianStatus; expiresAt: string | null }` · `WireConsentDecided { status: GuardianStatus }` · `fromWireConsentView(w): ConsentView`.
  - api: `postEnrollment(input: EnrollmentSubmit): Promise<void>`(`upload('/verifications/enrollment', form)` — 칸 이름은 snake로 직접: 고교생 `school_name`, 대학생 `campus_id`(문자열), 둘 다 `document`) · `postGuardianConsent(input: GuardianConsentInput): Promise<void>` · `getConsent(token: string): Promise<ConsentView>` · `patchConsent(token: string, decision: ConsentDecision): Promise<GuardianStatus>`(본문 `{ agree: decision === 'AGREED' }`; 조회 · 결정 모두 `auth: false` + 2B′-R9 `errorMap`) · `getDemoConsentToken(): Promise<string | null>`(`GET /users/me`의 `guardianConsentToken ?? null`).
  - queryKeys: `qk.consent(token: string) = ['consent', token]` · `qk.demoConsentToken = ['demoConsentToken']`.
  - queries: `useSubmitEnrollment(): UseMutationResult<Me, ApiError, EnrollmentSubmit>`(2B′-R8; `ALREADY_PROCESSED`면 `qk.me` 무효화) · `useRequestGuardianConsent(): UseMutationResult<Me, ApiError, GuardianConsentInput>`(→ `refetchMe`, `qk.demoConsentToken` 무효화; `ALREADY_PROCESSED`면 `qk.me` 무효화) · `useConsent(token: string)` · `useDecideConsent(token: string): UseMutationResult<GuardianStatus, ApiError, ConsentDecision>`(성공: `qk.consent(token)` · `qk.me` · `qk.demoConsentToken` 무효화, 실패: `qk.consent(token)` 무효화) · `useDemoConsentToken(enabled: boolean): UseQueryResult<string | null>`.
  - errors: `FILE_TYPE` · `FILE_TOO_LARGE` 문구(2B′-R7).
  - 목업 규칙: `CONSENT_LINK_DAYS = 7` · `CONSENT_GUIDE_TEXT`(제안 문구 `용용톤 캠퍼스 탐방은 방학 중 대학생 가이드와 캠퍼스와 주변 상점을 함께 둘러보는 서비스예요. 가이드가 신청을 승인하면 오픈채팅으로 연결되고, 탐방 날 캠퍼스와 주변 가게를 함께 걸어요.`) · `submitEnrollment(db, userId, fields: { campusId: string | null; schoolName: string | null }, document: File | null, now): VerificationRow` — 고교생 · 대학생 아니면 403 → PENDING · APPROVED가 있으면 `backendError(409, 'E409_ALREADY_SUBMITTED', 'ALREADY_PROCESSED')` → 파일 없음 `fieldError('document', '학생증 또는 재학증명서 사진을 올려 주세요.')` → `validateProofFile`이 걸리면 `fieldError('document', 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요')`(명세 문장) → 고교생 `schoolName` 공백 뺀 1~50자 아니면 `fieldError('schoolName', '학교 이름은 50자 이하로 입력해 주세요.')` / 대학생 `campusId`가 5개교 id가 아니면 `fieldError('campusId', '5개교 이외 학교 선택 시 제출할 수 없어요.')` → `putMockFile` → 인증 행 upsert(PENDING, 사유 null, `documentUrl` 참조, `submittedAt` now, `reviewed*` null) → 고교생 프로필 학교, 대학생 프로필 `universityId`(행이 없으면 학과 · 소개 null로 만든다). `requestGuardianConsent(db, userId, body: { guardianName?: unknown; guardianEmail?: unknown }, now): GuardianConsentRow` — 고교생 아니면 403 → 동의가 PENDING(기한 전) · AGREED면 `backendError(409, 'E409_CONSENT_EXISTS', 'ALREADY_PROCESSED')` → 이름 1~20자 `fieldError('guardianName', '보호자 이름은 1~20자로 입력해 주세요.')` → 이메일 형식 `fieldError('guardianEmail', '이메일 주소 형식을 확인해 주세요.')` → upsert(토큰 `consent-{userId}-{nextId(db)}`, PENDING, 만료 now + 7일, `agreedAt` null — 예전 토큰은 404가 된다). `findConsent(db, token, now)`(없음 404 `CONSENT_LINK_INVALID` → PENDING이고 기한 지남 410 `CONSENT_LINK_EXPIRED` → 그 밖은 그 행) · `decideConsent(db, token, agree: unknown, now)`(`findConsent` → 불리언 아님 `fieldError('agree', '동의 여부를 골라 주세요.')` → PENDING 아님 `MockApiError(409, 'ALREADY_PROCESSED')` → AGREED(`agreedAt`) | REJECTED). 와이어 `toWireConsentView(db, row)` · `toWireMe`의 확장(고교생, 동의 PENDING · 기한 전이면 `guardianConsentToken = tokenHash`).
  - 핸들러: `POST /verifications/enrollment`(`readForm` → `formFile(form, 'document')`, `form.get('campus_id')` · `form.get('school_name')`) → `ok({ verificationId, status, submittedAt }, 201)` · `POST /guardian-consents` → `ok({ status, expiresAt }, 201)` · `GET /guardian-consents/:consentToken`(토큰 없이) → `ok(view)` · `PATCH /guardian-consents/:consentToken`(토큰 없이) → `ok({ status })`.
  - **`/consent/:token`** — 옛 2B Task 7 화면 절 + 델타: 첫 카드 본문 = `guideText`(`whitespace-pre-wrap`), 둘째 카드 그대로; `동의 대상` 줄 `학생: {studentName}` + 학교가 있으면 ` · {schoolName}`(학년 없음); PENDING이고 `expiresAt`이 있으면 각주 위에 `{M월 D일} {HH:mm}까지 응답할 수 있어요.`(제안 문구); 동의 결과 카드 `동의를 마쳤어요` / `학생이 탐방을 신청할 수 있어요.`(날짜 없음, 제안 문구); 만료는 조회 410 · 결정 410 모두. 그 밖(돌아가기 링크 조건 2B-R8 · 처리 중 잠금 · 409 토스트 + 재조회)은 옛 절 그대로.
- registry: `NOT_MOCKED` − 4(8 · 41).

- [ ] **Step 1: 실패하는 테스트 — 단위** — `validateProofFile` 표(`a.JPG` · `image/png` 통과, `x.heic` · `application/pdf` → `FILE_TYPE`, 정확히 5MB 통과, +1 → `FILE_TOO_LARGE`), `verifySteps` 전 조합 · 라벨 · 톤; `errors.test.ts` 새 두 문구; `fromWireConsentView(toCamel(CONSENT_VIEW.data))` → `{ studentName: '김하늘', schoolName: '용인고등학교', guideText: '용용톤은 방학 중 대학생 가이드와 캠퍼스를 둘러보는 서비스입니다 ...', status: 'PENDING', expiresAt: '2026-11-11T21:00:00+09:00' }`.
- [ ] **Step 2: 실패하는 테스트 — 규칙(`verification.test.ts`)** — 검사 순서(역할 → 409 → 파일 → 형식 · 용량 → 칸), 대학생 제출이 프로필 `universityId`를 맞춘다, 동의 재요청: `rejected@demo.kr`는 되고 예전 토큰 `demo-consent-rejected`가 404, `waiting@demo.kr`는 409; 만료 링크 410 · 처리된 링크(`demo-consent-agreed`) 200; 두 번째 결정 409.
- [ ] **Step 3: 실패하는 테스트 — api · 핸들러** — `newbie@demo.kr` `postEnrollment({ role: 'HIGH_SCHOOL', schoolName: '수원영통고등학교', grade: 1, document: testImage() })` → `fetchMe().verificationStatus 'PENDING'`, 핸들러가 받은 폼 키 `['school_name', 'document']`; `testImage('x.pdf', { type: 'application/pdf' })` → `VALIDATION` · `fieldErrors.document` 명세 문장; 다시 → `ALREADY_PROCESSED`(`backendCode 'E409_ALREADY_SUBMITTED'`); `postGuardianConsent({ guardianName: '최보호', guardianEmail: 'parent@example.com' })` → `fetchMe().guardianStatus 'PENDING'` · `getDemoConsentToken()`이 문자열 → `getConsent(그 토큰)`(요청에 `Authorization` 없음) `studentName '최하늘'` → `patchConsent(그 토큰, 'AGREED')` → `'AGREED'` · `getDemoConsentToken()` null → 다시 → `ALREADY_PROCESSED`(`backendCode 'E409_ALREADY_PROCESSED'`); 대기 중 재요청 → `backendCode 'E409_CONSENT_EXISTS'`; `getConsent(DEMO_CONSENT_TOKENS.expired)` → `CONSENT_LINK_EXPIRED`(`status 410`), `'bad'` → `CONSENT_LINK_INVALID`. 와이어: `ENROLLMENT_OK.data` · `CONSENT_REQUESTED.data` · `CONSENT_VIEW.data` · `CONSENT_DECIDED.data`와 `expectWireShape`, `waiting@demo.kr`의 `/users/me` → `expectWireShape(body.data, ME_HIGH_SCHOOL.data, ['guardian_consent_token'])`.
- [ ] **Step 4: 실패하는 테스트 — `ConsentPage.test.tsx`** — 옛 2B Task 7 Step 1 그대로 + 델타: `demo-consent-valid` 본문에 `CONSENT_GUIDE_TEXT` · `학생: 강하린 · 수원영통고등학교` · `{M월 D일} {HH:mm}까지 응답할 수 있어요.`; 동의 뒤 `동의를 마쳤어요` · `학생이 탐방을 신청할 수 있어요.`; 결정이 `wireFail('E410_EXPIRED')`면 만료 카드.
- [ ] **Step 5: 실패 확인 · Step 6: 구현 · Step 7: 통과 확인** — 전역 검증 명령.
- [ ] **Step 8: 진척 문서 · 커밋** — hs-a02 ✅, API 표 네 행 목업 ✅(enrollment 비고 `jpg · png 5MB`), devlog. 커밋 `feat(U-05 · U-06): 재학 인증 · 보호자 동의 백엔드 와이어와 보호자 동의 페이지`

---

### Task 10: `/verify` 재학 인증 · 보호자 동의 · 시연 건너뛰기 (L)

**Files:**
- Create: `src/pages/student/VerifyPage.tsx`(+`VerifyPage.test.tsx`), `e2e/verify.spec.ts`
- Modify: `src/app/routes.tsx`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 9 `useSubmitEnrollment` · `useRequestGuardianConsent` · `useDecideConsent` · `useDemoConsentToken` · `verifySteps` · 라벨 · 톤 · `PROOF_ACCEPT` · `proofFileError` · `GUARDIAN_NAME_MAX`; `useMe` · `useDemoToolsOn` · `FileField` · `VerificationStatusCard` · `HIGH_SCHOOL_NAME_MAX`.
- Produces: **`VerifyPage` — 옛 2B Task 8 화면 절** + 델타:
  - STEP 1: `학교 이름` 검증 `학교 이름을 입력해 주세요.` · `50자 이내로 적어 주세요.`; `FileField` hint `jpg · png, 5MB 이하`(제안 문구); 제출 = `useSubmitEnrollment({ role: 'HIGH_SCHOOL', schoolName, grade, document })`; IN_REVIEW는 `제출 {M월 D일}` 줄 없이 안내 문장만.
  - STEP 2(2B′-R9): FORM(NONE) · REREQUEST(REJECTED · EXPIRED)의 폼은 빈칸에서 시작(미리 채움 없음), `보호자 성함` 검증 `보호자 성함을 입력해 주세요.` · `20자 이내로 적어 주세요.`; WAITING(PENDING)은 폼 · 다시 보내기 없이 `보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.` + `링크는 보낸 때부터 7일 동안 열 수 있어요.`(제안 문구); DONE은 `보호자가 동의했어요.`(날짜 없음).
  - 시연(2B′-R10): WAITING이고 `useDemoToolsOn()`이고 `useDemoConsentToken(그 조건)`이 문자열이면 링크 `보호자 페이지 열기`(→ `/consent/{token}`, 배지 `시연`) + `Button variant="secondary" size="sm"` `동의 완료로 건너뛰기`(→ `useDecideConsent(token).mutate('AGREED')` → 토스트 `시연용으로 보호자 동의를 마쳤어요.`(제안 문구), 처리 중 잠금 · 연타 1회).
  - 409 `ALREADY_PROCESSED` → 토스트 + `qk.me` 다시 읽기(옛 절 그대로). 셸(뒤로 없음 · `MY` 탭)은 2B-R6 그대로.

- [ ] **Step 1: 실패하는 테스트 — `VerifyPage.test.tsx`** — 옛 2B Task 8 Step 1 그대로 + 델타: `newbie`: 학교 · `1학년` · `testImage()` 제출 → 배지 `심사 중` · 폼 사라짐, 받은 `PATCH /users/me` 본문 `grade: 1`; PDF → `jpg, png 이미지만 올릴 수 있어요.`, 5MB+1 → `5MB 이하 이미지만 올릴 수 있어요.`, 정확히 5MB 통과; `rejected`: 반려 사유 줄, 보호자 폼이 빈칸, 재요청 → `동의 대기`; `waiting`: 폼 · `동의 링크 다시 보내기` 없음. **Review Focus 2:** `waiting` + 시연 도구 켬 → `보호자 페이지 열기` → `/consent/demo-consent-valid`에서 동의 → `학생 화면으로 돌아가기` → 새로고침 없이 STEP 2 `동의 완료`; `rejected` 재요청 뒤 `동의 완료로 건너뛰기` → `동의 완료` · `PATCH /api/guardian-consents/:consentToken` 1번(연타 포함); 시연 도구 끔 → 두 시연 조작 없음; `server.use`로 `/api/users/me`에 확장이 없으면(실서버) 두 조작 없음; `pending@demo.kr` · `student@demo.kr` → 완료 카드. 탭 `MY` 활성, 뒤로 가기 없음.
- [ ] **Step 2: E2E — `e2e/verify.spec.ts`(`./fixtures`의 `test`, `goto` 1번: `/?demo=1&reset=1&as=student`)** — ①(**Review Focus 1**) 패널 `P1 계정` `newbie@demo.kr` → `이 계정으로 전환` → `/verify` → `학년 선택` `1학년` → `학생증 / 재학증명서 업로드`에 `setInputFiles({ name: 'student-id.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) })` → `재학 인증 제출하기` → `심사 중`. ② `waiting@demo.kr` → `보호자 페이지 열기` → `안내 확인 후 동의하기` → `동의를 마쳤어요` → `학생 화면으로 돌아가기` → `동의 완료`. ③ `rejected@demo.kr` → 보호자 성함 `윤보호` · 이메일 `parent@example.com` → `동의 링크 보내기` → `동의 대기` → `동의 완료로 건너뛰기` → `동의 완료`.
- [ ] **Step 3: 실패 확인 · Step 4: 구현 · Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 문서 · 커밋** — `design-v2.md` 2B′ 메모 표에 `/verify` · `/consent/:token` 행(V2 없음, 시연 조작은 시연 도구가 켜졌을 때만). 진척: hs-s02 ✅, API 표 화면 연결, devlog. 커밋 `feat(U-05 · U-06): 재학 인증 · 보호자 동의 화면과 시연 동의 건너뛰기`

---

### Task 11: `/guide/verify` · G05 가이드 프로필 · 첫 화면 규칙 (M)

**Files:**
- Create: `src/pages/guide/{GuideVerifyPage,GuideProfilePage}.tsx`(+`GuideIdentityPages.test.tsx`)
- Modify: `src/features/auth/landing.ts`(+`landing.test.ts`), `src/mocks/db/seed.test.ts`(`guide-pending` 첫 화면), `src/app/routes.tsx`(`/guide/verify` 자리 교체, 새 `/guide/me/profile`), `docs/progress/README.md`
- 숨은 의존: `grep -rn "'/guide/me'" src` 중 첫 화면 단언(`landing.test.ts` 3곳 · `seed.test.ts` 1곳)만 `/guide/me/profile`로. 탭 · 셸 표의 `/guide/me`는 그대로.

**Interfaces:**
- Consumes: Task 9 `useSubmitEnrollment` · `PROOF_ACCEPT` · `proofFileError` · 라벨 · 톤; 2B T4 `useSaveGuideProfile` · `hasGuideProfile` · `GUIDE_MAJOR_MAX` · `GUIDE_INTRO_MAX`; `useUniversities` · `campusLabel` · `getLandingPath` · `FileField` · `VerificationStatusCard`.
- Produces:
  - `getLandingPath`: 대학생 학과 없음 → `/guide/me/profile`(2B-R5). 나머지 그대로.
  - **`/guide/verify`** — 옛 2B Task 10 `/guide/verify` 항목 + 델타: `FileField` hint `jpg · png, 5MB 이하`; 제출 = `useSubmitEnrollment({ role: 'UNIVERSITY', universityId, document })` → 토스트 `재학 인증을 제출했어요.` + `navigate(getLandingPath(새 Me), { replace: true })`; 반려 때 미리 고르는 대학 = `me.guideProfile.universityId`(확장, 없으면 고르지 않음); 상태 카드의 `{대학}` 줄은 그 id로 찾은 `campusLabel`(못 찾으면 줄 없음). 다음 행동 링크는 옛 그대로(`/guide/me/profile` · `/guide/tours` · `/guide/tours/new` — 모두 있는 라우트).
  - **G05 `/guide/me/profile`** — 옛 2B Task 10 G05 항목 + 델타: `소개 한마디` 필수 1~200자 `소개 한마디를 입력해 주세요.` · `200자 이내로 적어 주세요.`; 학교 칸은 `me.guideProfile.universityId`의 `campusLabel`(없으면 placeholder `재학 인증 후 채워져요`); 서버 칸 오류 `major` · `introduction`. 저장 이동 규칙(처음 → `getLandingPath`, 수정 → `/guide/me`)은 옛 그대로.

- [ ] **Step 1: 실패하는 테스트** — `landing.test.ts`: NONE → `/guide/verify`, PENDING + 학과 없음 → `/guide/me/profile`, APPROVED + 학과 → `/guide`. `GuideIdentityPages.test.tsx` — 옛 2B Task 10 Step 1의 `guide-new` · `guide-rejected` · `guide-pending` · G05 부분 그대로 + 델타: `guide-new` 제출 → `/guide/me/profile`; PDF · 5MB+1 파일 오류; G05 소개 비움 → `소개 한마디를 입력해 주세요.`, 201자 → `200자 이내로 적어 주세요.`; 학교 칸 `readOnly`에 `경희대학교 국제캠퍼스`(정다은); 연타 1회; 탭 `MY` 활성.
- [ ] **Step 2: 실패 확인 · Step 3: 구현 · Step 4: 통과 확인** — 전역 검증 명령(가이드 첫 화면 규칙이 바뀌어 E2E 포함).
- [ ] **Step 5: 진척 문서 · 커밋** — guide-a01 ✅ · guide-s01(G05) ✅, devlog. 커밋 `feat(U-04 · U-05): 대학생 재학 인증 · 가이드 프로필 화면과 첫 화면 규칙`

---

### Task 12: 운영자 심사 API · A01 · A02 · A03 (L)

**Files:**
- Create: `src/features/admin/{model,wire,api,queries}.ts`(+`model.test.ts` · `wire.test.ts`), `src/mocks/rules/admin.ts`(+test), `src/mocks/wire/admin.ts`, `src/mocks/handlers/admin.ts`, `src/test/fixtures/backend/admin.ts`(`ADMIN_VERIFICATIONS` · `ADMIN_VERIFICATION` · `ADMIN_DECIDED` · `ADMIN_ALREADY_REVIEWED` — U-08 예시 그대로), `src/pages/admin/{VerificationListPage,VerificationReviewPage,VerificationRejectPage}.tsx`(+`AdminPages.test.tsx`)
- Modify: `src/mocks/registry.ts`(`admin: adminHandlers`), `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/app/routes.tsx`(자리 둘 교체, 새 `/admin/verifications/:id/reject`), `src/mocks/handlers/handlers.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 4 `backendError`; 2B T1 · T2 `deleteMockFile` · `mockFileUrl` · `MOCK_FILE_PREFIX` · `MOCK_DOC_SAMPLE`; `listAll` · `withQuery` · `campusLabel` · `LogoutButton` · `ConfirmDialog` · `formatShortDate`.
- Produces:
  - model: `VerificationSubjectRole = 'HIGH_SCHOOL' | 'UNIVERSITY'` · `AdminVerificationItem { id: number; userName: string; role: VerificationSubjectRole; schoolName: string; submittedAt: string }` · `AdminVerificationDetail extends AdminVerificationItem { documentUrl: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' }` · `REJECT_REASON_MAX = 100` · `SUBJECT_ROLE_LABEL = { HIGH_SCHOOL: '고교생', UNIVERSITY: '대학생' }` · `DocumentView = 'IMAGE' | 'MISSING' | 'DELETED'` · `documentView(d: Pick<AdminVerificationDetail, 'status' | 'documentUrl'>): DocumentView`(PENDING 아님 → DELETED, url 있음 IMAGE, 없음 MISSING).
  - wire: `WireAdminItem { verificationId; userName; role; schoolName; submittedAt }` · `WireAdminDetail extends WireAdminItem { documentUrl: string | null; status }` · `fromWireAdminItem` · `fromWireAdminDetail`.
  - api: `listPendingVerifications(): Promise<AdminVerificationItem[]>`(`listAll('/admin/verifications')` — `status` 없이 서버 기본 PENDING) · `getAdminVerification(id: number): Promise<AdminVerificationDetail>` · `patchAdminVerification(id: number, body: { decision: 'APPROVED' | 'REJECTED'; rejectReason?: string }): Promise<void>`.
  - queries: `qk.adminVerifications = ['adminVerifications']` · `qk.adminVerification(id: number) = ['adminVerifications', id]` · `usePendingVerifications()` · `useAdminVerification(id)` · `useDecideVerification(id): UseMutationResult<void, ApiError, { decision: 'APPROVED' | 'REJECTED'; rejectReason?: string }>`(성공 · 실패 모두 `qk.adminVerifications` 무효화 — 접두사라 상세도).
  - 목업: `listVerifications(db, status: string | null): VerificationRow[]`(없으면 PENDING, `APPROVED` · `REJECTED`도 받는다(명세 "선택"), 그 밖 `fieldError('status', '심사 상태를 다시 골라 주세요.')`, `submittedAt` 오름차순 → id) · `findVerification(db, id)`(404) · `decideVerification(db, adminId, id, body: { decision?: unknown; rejectReason?: unknown }, now): VerificationRow`(404 → PENDING 아님 `backendError(409, 'E409_ALREADY_REVIEWED', 'ALREADY_PROCESSED')` → `decision`이 둘 중 하나가 아니면 `fieldError('decision', '승인 또는 반려를 골라 주세요.')` → 반려인데 사유가 공백 뺀 1~100자가 아니면 `fieldError('rejectReason', '반려 사유는 1~100자로 적어 주세요.')` → 상태 · 사유(승인은 null) · `reviewedAt` · `reviewedBy`, `documentUrl` null + `mock-file:` 참조면 `deleteMockFile`). 와이어 `toWireAdminItem(db, row)`(`schoolName`: 고교생 = 행의 고교 이름, 대학생 = 그 대학 `campusLabel`) · `toWireAdminDetail(db, row)`(`documentUrl`은 PENDING일 때만: `mock-file:`이면 `mockFileUrl(ref) ?? MOCK_DOC_SAMPLE[role]`, 정적 경로는 그대로, null은 null). 핸들러 셋 모두 `requireUser(…, 'ADMIN')`: 목록 `okPage` · 상세 `ok` · 결정 `ok({ verificationId, status, reviewedAt })`.
  - 화면 — 옛 2B Task 12 화면 절 + 델타(2B′-R11): **A01** `SegmentedTabs` · 처리 완료 카드 · 처리 0건 문구 없음, `PageHeading` 아래 소제목 `대기 {n}건`(h2, 제안 문구) + 카드들, 카드 줄 `{formatShortDate(submittedAt)} 제출 · 재학 확인|학교 확인`. **A02** 승인 확인 → 토스트 `{이름} 님을 승인했어요.` + `/admin/verifications`(replace); 처리된 건(주소로)은 칩 `심사 완료` + 결과 칩(`승인` success · `반려` danger) + 사진 자리 `파일 삭제됨` + 버튼 `목록으로`(처리 시각 · 사유 줄 없음); 409 → 토스트 `errorMessage('ALREADY_PROCESSED')` + 목록으로. **A03** 사유 검증 `반려 사유를 입력해 주세요.` · `100자 이내로 적어 주세요.`, 반려 → 토스트 `{이름} 님의 인증을 반려했어요.` + `/admin/verifications`(replace). 사진 `onError` · 사진 없음 · 승인 안 잠금(2B-R9)은 옛 그대로.
- registry: `NOT_MOCKED` − 3(5 · 44).

- [ ] **Step 1: 실패하는 테스트 — 단위 · 규칙** — `fromWireAdminItem(toCamel(ADMIN_VERIFICATIONS.data.items[0]))` → `{ id: 10, userName: '김하늘', role: 'HIGH_SCHOOL', schoolName: '용인고등학교', submittedAt: '2026-11-04T21:00:00+09:00' }`, 상세 → + `documentUrl 'https://.../temp-signed-url'` · `status 'PENDING'`; `documentView` 셋. 규칙: START 대기 순서 한도윤 → 오지호 → 강하린; 승인 뒤 `toWireMe(강하린).verificationStatus 'APPROVED'` · 사진 참조 삭제; 반려 사유 `''` · 101자 → `fieldErrors.rejectReason`; 두 번째 처리 → `ALREADY_PROCESSED`(봉투 `E409_ALREADY_REVIEWED`).
- [ ] **Step 2: 실패하는 테스트 — api · 핸들러** — 운영자 `listPendingVerifications()` 3건 · 한도윤의 `schoolName '단국대학교 죽전캠퍼스'`; `getAdminVerification(강하린)`의 `documentUrl '/mock-docs/student-id-hs.svg'`; `newbie` 업로드(`postEnrollment`) 뒤 상세 `documentUrl`이 `MOCK_DOC_SAMPLE.HIGH_SCHOOL`(jsdom에는 object URL이 없다); 학생 토큰 → `FORBIDDEN`; `?status=X` → `VALIDATION`; `rawFetch` → `ADMIN_VERIFICATIONS.data` · `ADMIN_VERIFICATION.data` · `ADMIN_DECIDED.data`와 `expectWireShape`.
- [ ] **Step 3: 실패하는 테스트 — `AdminPages.test.tsx`**(`as: 'admin'`) — 옛 2B Task 12 Step 1 + 델타: A01 `대기 3건` · 첫 카드 한도윤 `학교 확인` · 탭 없음 · `로그아웃` → `/login`; A02 강하린 승인 → 확인 창 → 토스트 → `/admin/verifications`에 `대기 2건`, 승인 연타 1회, 사진 `onError`에도 `승인 처리하기` 켜짐, 처리된 건 주소 → `심사 완료` · `파일 삭제됨` · `목록으로`; A03 빈 사유 · 101자 오류, 반려 → 목록, 처리된 id로 A03 → A02로 replace, 반려 연타 1회; 승인 뒤 `loginAs('waiting@demo.kr')` → `/verify` STEP 1 배지 `승인`.
- [ ] **Step 4: 실패 확인 · Step 5: 구현 · Step 6: 통과 확인** — 전역 검증 명령.
- [ ] **Step 7: 진척 문서 · 커밋** — owner-s06 · owner-a02 ✅ · A03 행, API 표 세 행 목업 ✅, 팀 요청 6(운영자 심사 시연) 비고 `화면 완료 · 대기 목록만(처리 내역은 9절 34번)`, devlog. 커밋 `feat(U-08): 운영자 인증 심사 백엔드 와이어와 대기 목록 · 상세 · 반려 화면`

---

> **자르는 선.** 여기까지가 11/12까지다. 아래는 시간이 되면 이 순서로 한다(2B′-R1).

### Task 13: 사장님 API — 사업자 인증 · 상점 검색 · 가게 연결/등록 · 가게 수정 · 제휴 (M)

**Files:**
- Modify: `src/shared/lib/http.ts`(+`http.test.ts`), `src/features/stores/{model,wire,api,queries}.ts`(+`model.test.ts` · `wire.test.ts` · `api.test.ts`), `src/test/fixtures/backend/stores.ts`(+`BUSINESS_OK` · `BUSINESS_INVALID` · `STORE_SEARCH` · `STORE_REGISTERED` · `STORE_UNAVAILABLE` · `PARTNERSHIP_SAVED` — U-07 · S-01 · S-03 예시 그대로, 가게 수정은 있는 `MY_STORE_PATCHED`), `src/mocks/rules/stores.ts`(+test), `src/mocks/wire/stores.ts`, `src/mocks/handlers/stores.ts`, `src/mocks/registry.test.ts`, `src/shared/api/queryKeys.ts`, `src/mocks/handlers/handlers.test.ts`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 3 stores 파일; 2C `getMyStore` · `fromWireMyStore` · `toWireMyStore` · `ownerStoreOf` · `recode` · `refetchMe`; 2B T2 `DEMO_BUSINESS`.
- Produces:
  - `http.ts`: `ApiError.fieldReasons?: Record<string, string>` — `errors[]`의 받은 `reason` 원문(칸 이름 규칙 · 첫 항목은 `fieldErrors`와 같다). `recode`는 `fieldReasons`를 그대로 넘긴다.
  - model: `BusinessVerificationInput { businessNumber: string; representativeName: string; openedAt: string }` · `normalizeBusinessNumber(raw: string): string`(숫자만) · `businessNotice(code: string | undefined): { title: string; description: string } | null`(옛 2B Task 20 그대로) · `StoreSearchItem { storeId: number; name: string; address: string; category: string; registered: boolean }` · `STORE_SEARCH_MIN = 2` · `StoreRegistrationInput = { storeId: number } | { name: string; address: string; category: string; latitude: number; longitude: number }` · `StoreEditInput = Partial<{ name: string; address: string; category: string }>` · `diffStoreEdit(before: MyStore, after: { name: string; address: string; category: string }): StoreEditInput`(값이 다른 칸만) · `PartnershipInput { discount: string; startDate: string; endDate: string }` · `PARTNERSHIP_DISCOUNT_MAX = 50` · `STORE_CATEGORIES = ['한식', '분식', '중식', '일식', '양식', '카페', '보드게임카페', '노래방', '공방', '기타'] as const`.
  - wire: `WireStoreSearchItem { storeId; name; address; category; isRegistered: boolean }` · `WireRegisteredStore { storeId; name; address; category }` · `WirePartnershipSaved { discountText; startDate; endDate }` · `fromWireStoreSearchItem(w): StoreSearchItem`.
  - api: `postBusinessVerification(input: BusinessVerificationInput): Promise<void>`(본문 `{ businessNumber: normalizeBusinessNumber(…), representativeName: trim, openedAt }`; `backendCode === 'E422_BUSINESS_INVALID'`면 `fieldReasons.businessNumber === 'CLOSED'` ? `recode(e, 'BIZ_CLOSED', { fieldErrors: { businessNumber: errorMessage('BIZ_CLOSED') } })` : `recode(e, 'BIZ_MISMATCH', { fieldErrors: { businessNumber: errorMessage('BIZ_MISMATCH') } })`) · `searchStores(keyword: string): Promise<StoreSearchItem[]>`(`withQuery('/stores/search', { keyword: trim, page: 1, size: 20 })` 한 쪽) · `postStore(input: StoreRegistrationInput): Promise<MyStore>`(`errorMap { E403_VERIFICATION_REQUIRED: 'BIZ_NOT_VERIFIED' }`, `E409_STORE_UNAVAILABLE`은 2B′-R21 세분, 성공하면 `getMyStore()` — null이면 `ApiError(404, 'STORE_NOT_LINKED')`) · `patchMyStore(patch: StoreEditInput): Promise<MyStore>`(응답을 `fromWireMyStore(…, new Date())`) · `putPartnership(input: PartnershipInput): Promise<MyStore>`(본문 `{ discountText: discount, startDate, endDate }`, `fieldMap { discount_text: 'discount' }`, 뒤에 `getMyStore()`).
  - queries: `qk.storeSearch(keyword: string) = ['storeSearch', keyword]` · `qk.allStoreSearch = ['storeSearch']` · `useVerifyBusiness(): UseMutationResult<Me, ApiError, BusinessVerificationInput>`(→ `refetchMe`) · `useStoreSearch(keyword: string)`(공백 뺀 2자 이상일 때만, `placeholderData: keepPreviousData`) · `useLinkStore(): UseMutationResult<MyStore, ApiError, StoreRegistrationInput>`(성공 `setQueryData(qk.myStore)` + `refetchMe`; `STORE_ALREADY_LINKED` → `qk.allStoreSearch` 무효화; `STORE_LIMIT` · `BIZ_NOT_VERIFIED` → `qk.me` · `qk.myStore` 무효화) · `useUpdateMyStore()` · `useSavePartnership()`(둘 다 성공 `setQueryData(qk.myStore)`, `STORE_NOT_LINKED` → `qk.me` · `qk.myStore` 무효화).
  - 목업 규칙: `verifyBusiness(db, userId, body, now): void` — 번호(숫자만) 10자리 아니면 `fieldError('businessNumber', '사업자등록번호 10자리를 입력해 주세요.')` → 대표자명 빈 값 `fieldError('representativeName', '대표자명을 입력해 주세요.')` → `openedAt` `YYYY-MM-DD` 아니면 `fieldError('openedAt', '개업일자를 입력해 주세요.')` → `DEMO_BUSINESS.closed` 번호면 `fieldError('businessNumber', 'CLOSED', 'BIZ_CLOSED', 422)` → `match`의 번호 · 대표자명 · 개업일과 다르면 `fieldError('businessNumber', 'MISMATCH', 'BIZ_MISMATCH', 422)` → 사업자 행 upsert(`isVerified: true`). `searchStores(db, keyword: string | null): StoreRow[]`(공백 뺀 2자 미만 `fieldError('keyword', '검색어를 2자 이상 입력해 주세요.')`, 공백 · 대소문자 무시 상호 부분 일치, 이름(`ko`) → id 순). `linkStore(db, userId, body, now): StoreRow`(사업자 미인증 `MockApiError(403, 'BIZ_NOT_VERIFIED')` → 이미 가게 있음 `MockApiError(409, 'STORE_LIMIT')` → `storeId`가 있으면 없는 상점 404 · 다른 사장님 가게 `MockApiError(409, 'STORE_ALREADY_LINKED')` · `ownerId` 연결 / 없으면 `name` · `address` · `category` 빈 값 `fieldError(그 칸, '{상호명|가게 주소|업종}을 입력해 주세요.')` · `latitude` · `longitude`가 수가 아니면 `fieldError('latitude', '가게 위치를 골라 주세요.')` → 새 상점(`ownerId`, 행정동 null)). `updateStore(db, userId, body, now): StoreRow`(`ownerStoreOf` → 준 칸이 빈 문자열이면 그 칸 `fieldError` → 고침). `savePartnership(db, userId, body, now): PartnershipRow`(`ownerStoreOf` → `discountText` 공백 뺀 1~50자 아니면 `fieldError('discountText', '50자 이내로 적어 주세요.')` → 날짜 형식 → 종료 < 시작 `fieldError('endDate', '종료 날짜는 시작 날짜와 같거나 뒤여야 해요.')` → 그 가게의 가장 큰 id 제휴 행을 고치거나(id 유지) 새로, `condition` null).
  - 핸들러(전부 사장님): `POST /verifications/business` → `ok({ status: 'APPROVED' })` · `GET /stores/search` → `okPage(toWireStoreSearchItem)` · `POST /users/me/store` → `ok({ storeId, name, address, category }, 201)` · `PATCH /users/me/store` → `ok(toWireMyStore)` · `PUT /users/me/store/partnership` → `ok({ discountText, startDate, endDate })`.
- registry: `NOT_MOCKED` − 5 → `[]`(2B′-R6: 테스트 `NOT_MOCKED는 비었다(2B′ 마감)`, 등록 핸들러 49 = 46 + 3).

- [ ] **Step 1: 실패하는 테스트 — 단위** — `http.test.ts`: `wireFail('E422_BUSINESS_INVALID', { errors: [{ field: 'business_number', reason: 'CLOSED' }] })` → `fieldReasons { businessNumber: 'CLOSED' }` · `fieldErrors.businessNumber`는 코드 문구; `recode` 뒤에도 `fieldReasons`가 남는다. `model.test.ts`: `normalizeBusinessNumber('123-45-67890')` → `'1234567890'`, `businessNotice` 셋, `diffStoreEdit` 그대로 → `{}` · 주소만 → `{ address }`. `wire.test.ts`: `fromWireStoreSearchItem(toCamel(STORE_SEARCH.data.items[0]))` → `{ storeId: 201, name: '용인 분식', address: '경기 용인시 처인구 ...', category: '식당', registered: false }`.
- [ ] **Step 2: 실패하는 테스트 — 규칙 · api** — `owner-new@demo.kr`: `DEMO_BUSINESS.match`(하이픈 포함) → 성공 · `fetchMe().businessVerified true`, 받은 본문 `business_number '1234567890'` · `opened_at '2021-03-02'`; `closed` → `BIZ_CLOSED`, `mismatch` 번호 + `match`의 대표자 · 날짜 → `BIZ_MISMATCH`(둘 다 `backendCode 'E422_BUSINESS_INVALID'`), 9자리 → `fieldErrors.businessNumber`. `owner-nostore`: `searchStores('카페')` → `카페 단풍`(`registered false`) · `카페 모래시계`(`registered true`) 포함 · 이름순, `'카'` → `VALIDATION`; 새로 시작한 `owner-nostore`가 상점 1(owner1 가게) → `STORE_ALREADY_LINKED`; `postStore({ storeId: <카페 단풍> })` → `MyStore.name '카페 단풍'`, 다시 → `STORE_LIMIT`(둘 다 `backendCode 'E409_STORE_UNAVAILABLE'`); `owner-new`(미인증)가 연결 → `BIZ_NOT_VERIFIED`; 직접 등록(좌표 경희대 중심) → 201 · 그 좌표. owner1: `patchMyStore({ address: '새 주소' })` → `address '새 주소'` · 받은 본문 키 `['address']`; `putPartnership({ discount: '음료 500원 할인', startDate: '2027-01-01', endDate: '2027-02-28' })` → `partnership.discount` 그대로 · 제휴 id 유지; 종료 < 시작 → `fieldErrors.endDate`. 와이어: 다섯 픽스처와 `expectWireShape`(가게 수정 ← `MY_STORE_PATCHED.data`).
- [ ] **Step 3: 실패 확인 · Step 4: 구현 · Step 5: 통과 확인** — 전역 검증 명령.
- [ ] **Step 6: 진척 문서 · 커밋** — API 표 다섯 행 목업 ✅(이로써 46 + 3행 모두 ✅), devlog. 커밋 `feat(U-07 · S-01 · S-03): 사업자 인증 · 상점 검색 · 가게 연결 · 수정 · 제휴 백엔드 와이어, 레지스트리 마감`

---

### Task 14: 사장님 화면 — `/owner/verify` · O05 · O06 · 가게 수정 · 쿠폰 가드 (L)

**Files:**
- Create: `src/pages/owner/{BusinessVerifyPage,StoreConnectPage,PartnershipPage,StoreEditPage}.tsx`(+`OwnerStorePages.test.tsx`)
- Modify: `src/pages/owner/{MyStorePage,CouponRedeemPage}.tsx`(+tests), `src/app/routes.tsx`(자리 둘 교체, 새 `/owner/store/partnership` · `/owner/store/edit`, `/owner/me` → `<Navigate to="/owner/store" replace />`), `src/app/shell.test.tsx`(`/owner/me` 단언 → 이동), `docs/reference/design-v2.md`, `docs/progress/README.md`

**Interfaces:**
- Consumes: Task 13 훅 · `businessNotice` · `STORE_CATEGORIES` · `STORE_SEARCH_MIN` · `PARTNERSHIP_DISCOUNT_MAX` · `diffStoreEdit`; `useMyStore` · `useMe` · `useUniversities` · `useDemoToolsOn` · `DEMO_BUSINESS` · `addDaysKey` · `seoulDateKey` · `ConfirmDialog`.
- Produces — **옛 2B Task 21 화면 절** + 델타(2B′-R20 · R21 · R22):
  - `/owner/verify`: 개업일자 칸 값은 `openedAt`; 성공 = `useVerifyBusiness` → 토스트 · `/owner/store/connect`(replace). 나머지 옛 그대로(`시연 사업자 정보 채우기`는 `DEMO_BUSINESS.match`의 `openingDate`를 넣는다).
  - **O05**: 첫 화면은 후보 없이 검색 폼 + 목록 자리 `InfoCard` `가게 이름으로 찾아 주세요` / `2자 이상 입력하고 검색하면 공공데이터(인허가)에 있는 가게가 보여요.`(제안 문구); 1자 제출 → 칸 아래 `가게 이름을 2자 이상 입력해 주세요.` · 요청 없음; 소제목 `검색 결과`(칩 `검색 결과`만); `registered`면 비활성 + 옛 hint; 직접 등록 폼에 **`Select` `가까운 학교`**(첫 선택지 `가게와 가까운 캠퍼스를 골라 주세요`, 캠퍼스마다 `campusLabel`, hint `지도 위치는 이 캠퍼스 근처로 잡혀요.`, 검증 `가까운 학교를 골라 주세요.`) → 좌표 = 그 캠퍼스 `lat`/`lng`; `다음으로` → 옛 확인 창 → `useLinkStore({ storeId })`. 옛 `후보 0건` 상태 삭제, 그 밖 상태 · 오류 대응 옛 그대로.
  - **O06**: `할인 조건` 칸 없음; 서버 칸 오류 `discount` · `startDate` · `endDate`; 기간 기본값 2B-R17. 나머지 옛 그대로.
  - **`/owner/store/edit`**(V2 없음, 제안 문구): `TopBar` `가게 정보 수정`(뒤로 → `/owner/store`) · `PageHeading('가게 정보를 고쳐요.', '학생들이 보는 가게 이름과 주소예요.')` · `TextField` `상호명` · `가게 주소` · `Select` `업종`(초깃값은 지금 가게 값, 그 값이 `STORE_CATEGORIES`에 없으면 맨 앞 선택지로 더한다) · `BottomAction` `변경사항 저장`(바뀐 칸 없으면 비활성 + hint `바뀐 내용이 없어요.`, 연타 1회) → `useUpdateMyStore().mutate(diffStoreEdit(store, values))` → 토스트 `가게 정보를 저장했어요.` + `/owner/store`(replace). 검증 `상호명을 입력해 주세요.` · `가게 주소를 입력해 주세요.`. 가게가 없으면 O06의 가드와 같은 모양.
  - `MyStorePage`: Task 3의 링크 아래 `제휴 혜택 수정 ›`(제휴가 없으면 옛 절의 `제휴 혜택을 설정해 주세요` 카드가 같은 주소) · `가게 정보 수정 ›` → `/owner/store/edit`. `CouponRedeemPage` 가게 없음 가드는 옛 그대로.

- [ ] **Step 1: 실패하는 테스트 — `OwnerStorePages.test.tsx`** — 옛 2B Task 21 Step 1 + 델타: `owner-new` 일치 번호 → `/owner/store/connect`(후보 카드 없음, 안내 카드); `owner-nostore`: `카페` 검색 → `카페 단풍` 선택 → `다음으로` → 확인 창 → O06(`연결 완료`) → `음료 500원 할인` 저장 → `/owner/store`에 `카페 단풍` · 혜택; `카` 1자 → 칸 오류 · 요청 0; `카페 모래시계` 비활성 + hint; 직접 등록(상호 · 주소 · `카페` · `경희대학교 국제캠퍼스`) → 받은 본문 `latitude`/`longitude`가 경희대 중심; 연결 연타 1번; O06 종료 < 시작 문구 · `할인 조건` 칸 없음; owner1 `가게 정보 수정` → 주소만 바꿔 저장 → PATCH 본문 키 `['address']` → O01 갱신, 그대로면 비활성 + `바뀐 내용이 없어요.`; `CouponRedeemPage` `owner-nostore` 가드; `/owner/me` → `/owner/store`.
- [ ] **Step 2: 실패 확인 · Step 3: 구현 · Step 4: 통과 확인** — 전역 검증 명령(골든 패스 사장님 단계 · 쿠폰 화면), 무대 스크린샷 비교.
- [ ] **Step 5: 문서 · 커밋** — `design-v2.md` 2B′ 메모 표에 `/owner/verify` · O05(검색 전 상태 · `가까운 학교`) · `/owner/store/edit` 행. 진척: owner-s01 · owner-a01 ✅ · O05 · O06 · 가게 수정 행, `/owner/me` 행 `→ /owner/store`, devlog. 커밋 `feat(U-07 · S-01 · S-03): 사업자 인증 · 가게 연결 · 제휴 · 가게 수정 화면과 쿠폰 화면 가드`

---

### Task 15: MY · 가입 — `/signup` · H16 · H17 · G12 (L)

**Files:**
- Create: `src/pages/auth/SignupPage.tsx`(+test), `src/pages/student/{MePage,MeEditPage}.tsx`(+`MePages.test.tsx`), `src/pages/guide/GuideMyPage.tsx`(+test), `src/features/auth/profile.ts`(+test)
- Modify: `src/features/applications/model.ts`(+test `completedTourCount`), `src/app/routes.tsx`(`/signup` · `/me` · `/guide/me` 자리 교체, 새 `/me/edit`), `src/app/shell.test.tsx` · `src/demo/demo.test.tsx`(`/me` · `/guide/me` 로그아웃 단언), `src/pages/guide/GuideCourseRedirect.test.tsx`(시작 경로 `/guide/me` → `/explore` — G12가 이제 데이터를 부른다), `docs/progress/README.md`

**Interfaces:**
- Consumes: 2C · 2B T4 `useSignup` · `useUpdateStudentProfile` · `NAME_MAX` · `HIGH_SCHOOL_NAME_MAX` · `INTEREST_MAJOR_MAX` · `PASSWORD_PATTERN` · `getLandingPath`; Task 9 `verifySteps`; `useMyApplications` · `useGuideTours` · `useUniversities` · `LogoutButton` · `ListRow`.
- Produces:
  - `profile.ts`: `splitInterests(text: string | null): string[]` · `verificationBadge(status)` · `guideVerificationBadge(status)`(옛 2B Task 9 · 10 그대로). `completedTourCount(apps: MyApplication[]): number`(옛 그대로).
  - **`/signup`** — 옛 2B Task 6 화면 절 + 델타: 이름 검증 `이름을 입력해 주세요.` · `이름은 20자 이내로 적어 주세요.`; 비밀번호 `비밀번호를 입력해 주세요.` · `PASSWORD_PATTERN`이 아니면 `비밀번호는 영문과 숫자를 섞어 8자 이상으로 정해 주세요.`; 서버 칸 오류(`email` · `password` · `name`)는 칸 아래.
  - **H16 `/me`** — 옛 2B Task 9 H16 항목 + 델타(2B′-R23): `나의 활동` 행 = `지난 탐방` · `내 희망 사항`(`남긴 희망 사항을 보고 고쳐요.` → `/me/wishes`) · `내 정보 수정` · `인증 상태 확인`(`학생증 인증 및 보호자 동의 현황` → `/verify`) · `<LogoutButton variant="row" description="다른 계정으로 UNIRO 사용하기" />`. `알림 및 설정` 행 없음.
  - **H17 `/me/edit`** — 옛 H17 항목 + 델타: 이름 1~20 · 학교 ≤50 · 관심 전공 ≤30(`{n}자 이내로 적어 주세요.`), 저장은 `useUpdateStudentProfile`(학년은 지금 값을 함께 보낸다), 서버 칸 오류 `name` · `highSchoolName` · `interestedMajor`.
  - **G12 `/guide/me`** — 옛 2B Task 10 G12 항목 + 델타: 학교 줄 `{campusLabel} · {학과}`(대학을 모르면 `{학과}`만), `가이드 관리` 행 = `가이드 프로필 수정` · `고교생 희망 사항`(`학생들이 남긴 희망 사항을 보고 탐방을 준비해요.` → `/guide/wishes`) · `내가 개설한 탐방` · `내 정보·인증 상태` · 로그아웃 행. `알림 및 설정` 없음.

- [ ] **Step 1: 실패하는 테스트** — `SignupPage.test.tsx`: 옛 2B Task 6 Step 1 + 델타(이름 21자, 비밀번호 `abcdefgh` → 형식 문구, 중복 `student@demo.kr` → 칸 아래 + `로그인하기`, 역할별 첫 화면 `/verify` · `/guide/verify` · `/owner/verify`, 연타 1번). `MePages.test.tsx`: 옛 2B Task 9 Step 1 중 H16 · H17 + 델타(`내 희망 사항` · `인증 상태 확인` · `로그아웃` 행, `알림 및 설정` 없음, PATCH 본문 `grade`가 기존 값, 학교 51자 → 칸 오류). `GuideMyPage.test.tsx`: 옛 Task 10의 G12 단언 + `고교생 희망 사항` `href '/guide/wishes'`. 2C `WishPages.test.tsx`의 `/me`의 `내 희망 사항` 링크 단언이 그대로 통과.
- [ ] **Step 2: 실패 확인 · Step 3: 구현 · Step 4: 통과 확인** — 전역 검증 명령(시연 패널 · 셸이 `/me`의 로그아웃을 새 행에서 찾는다).
- [ ] **Step 5: 진척 문서 · 커밋** — hs-a01 · hs-a03 ✅ · H17 행 · G12 행 ✅, H18 · G13 행 `빠짐(2B′)`, devlog. 커밋 `feat(U-01 · U-03): 회원가입 · 고교생 MY · 내 정보 수정 · 가이드 MY`

---

### Task 16: 마감 — P1 스모크 · 실서버 스모크 · 문서 (M)

**Files:**
- Create: `e2e/p1-smoke.spec.ts`, `e2e/real-smoke.spec.ts`
- Modify: `docs/progress/README.md`, `docs/progress/devlog.md`, `README.md`, `docs/reference/design-v2.md`, `docs/api/backend-alignment.md`

**Interfaces:**
- Consumes: 모든 화면 태스크의 라우트 · 문구; 패널 `P1 계정` · `이 계정으로 전환`(e2e는 앱 소스를 import하지 않으므로 이메일은 문자열로).
- Produces:
  - `p1-smoke.spec.ts`(`./fixtures`의 `test`, `goto` 1번, 전체 시연 패널): ① **막다른 곳 없음** — 역할마다 P1 계정으로 들어가 P1 화면을 앱 안 링크로 열며 `곧 열려요.`가 없고 `h1`이 있다(고교생 `newbie` → `/verify` · MY → `/me/edit`, 가이드 `guide-new` → `/guide/verify` · `guide@demo.kr` → G04 · 완료 · 취소 · 장소 고르기 · 확정 코스 지도, 사장님 `owner-new` → `/owner/verify` · `owner1` → 리포트 · 가게 수정, 운영자 → A01 → A02 → A03). 자리 화면은 `/explore`뿐. ② **사장님 온보딩** — `owner-new` → `시연 사업자 정보 채우기` → `사업자 정보 확인` → `카페 단풍` 검색 · 연결 → 제휴 저장 → `/owner/store`에 `카페 단풍`. 선 아래 태스크 중 안 된 것의 단계는 이 파일에 넣지 않는다.
  - `real-smoke.spec.ts`: `test.skip(!process.env.E2E_REAL, '실서버 리허설 때만')`. `/?demo=1&mode=real&as=student` → 로그인 → 홈 `h1` · `내 탐방` · `MY`가 열린다(쓰기 없음).
  - 문서: 진척 화면 표 P1 행 최종 상태 · API 표 46 + 3행 확인 · 무대 실측표, `README.md` 시연 계정 표 · 데모 사업자 번호 · 동의 링크 · `P1 계정` · 시연 동의 건너뛰기 · `E2E_REAL` 한 줄, `design-v2.md` 2B′ 메모 표 마감 + 구현 메모에 2B′-R 링크 한 줄, `backend-alignment.md` 9절 앞 문단에 "2B′에서 명세대로 구현하고 판정으로 정한 것"(23 · 25 · 7 · 38 · 36 · 33 · 31 · 32 · 34번과 각 판정 번호) 한 줄씩.

- [ ] **Step 1: 스모크 작성 · 통과** — 실패하면 해당 화면 태스크의 문구 · 로케이터를 고친다.
- [ ] **Step 2: 전체 E2E** — 골든 패스 2변형 · 발표 모드 · 무대 9개 · smoke · demo-tools · review-loop · verify · p1-smoke가 모두 통과, 무대 스크린샷 셋을 2B′ 시작 전과 나란히 본다(바뀐 곳은 2B′-R5 목록뿐).
- [ ] **Step 3: 문서 · 커밋** — 위 문서 + devlog `MVP 2B′ 마감: 백엔드 20개 경로 목업 완료, P1 화면, 리뷰 → AI 요약 → 리포트 고리`. 커밋 `test: P1 스모크 · 실서버 스모크 E2E와 2B′ 마감 문서`

---

## 자체 점검 — 명세 덮기

- **엔드포인트 20개:** reviews 두 개 → T1 · `report` → T3 · `POST /tours` · `cancel` · `complete` → T4 · `nearby` · `places` → T7 · `enrollment` · `guardian-consents` 셋 → T9 · `admin` 셋 → T12 · `business` · `search` · `POST`/`PATCH /users/me/store` · `partnership` → T13. 통째로 빼는 것 없음.
- **기능 명세 행:** U-01 T15 · U-03 T15 · U-04 T11 · U-05 T9 · T10 · T11 · U-06 T9 · T10 · U-07 T13 · T14 · U-08 T12 · T-03 · T-05 · T-06 T4 · T5 · C-02 T7 · T8 · C-04(가이드 지도) T2 · S-01 · S-03 T13 · T14 · S-02 T7 · T8 · S-06(가게 없음 가드) T14 · S-07 T3 · R-01 T1 · T6 · R-02 T1 · T2 · T3 · R-03(목업) T1. U-02 · T-01 · T-02 · T-04 · T-07 · T-08 · A-01~04 · C-01 · C-03 · S-04 · S-05 · D-01은 2C에서 끝남.
- **이름 · 타입 이어짐:** `StoreReviews`(T1 → T2 · T3) · `latestReviewSummary`(T1 → T7) · `backendError`(T4 → T9 · T12) · `GuideTourDetail` · `computeTourActions`(T4 → T5) · `PlaceRef` · `MAX_COURSE_STOPS`(T7 → T8) · `useSubmitEnrollment` · `useDecideConsent` · `useDemoConsentToken`(T9 → T10 · T11) · `ApiError.fieldReasons`(T13 → T13 api) · `diffStoreEdit`(T13 → T14) · `qk.guideTour`는 `['guideTour', id]` 한 곳.

## 사용자에게 물을 것

1. **무대 대본을 골든 패스 뒤로 늘리나요?** 리뷰 → AI 요약 → 사장님 리포트(Task 6 · 3) 또는 가입 → 인증 → 운영자 승인(Task 10 · 12)을 2분 시연에 넣으면 그 화면을 P0로 올리고 `stage-viewport.spec.ts`에 대상(예: 리포트의 AI 카드, 시트의 새 요약)을 더해야 합니다. 안 넣으면 `review-loop` · `verify` E2E로만 지킵니다(2B-R20 대본 게이트).
2. ~~MY 탭(Task 15)을 사장님 흐름(Task 13 · 14)보다 먼저 할까요?~~ → 컨트롤러 판정으로 정함(2B′-R1): 선 아래는 15 → 13 → 14 → 16 순서로 한다.
