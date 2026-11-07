# 백엔드 API 명세 대조와 적용 제안

작성 2026-11-07 · 대상: 백엔드 명세 스냅샷 [`backend-spec.md`](./backend-spec.md)(공통규칙 + 46개) ↔ 프론트 계약 [`frontend-needs.md`](./frontend-needs.md)(골든 패스 29 + P1 27) · 현행 코드(2A 완료, 2B Task 4까지)

**읽는 법**

- 프론트 근거는 `파일:줄`이다(경로 앞 `src/`는 생략할 때가 있다). 백엔드 근거는 `backend-spec.md`의 절 제목, 곧 메서드 · 경로 · `[기능ID]`다. 공통 규칙은 `BE 공통규칙 › 소제목`으로 적는다.
- 프론트 계약 번호: 골든 패스는 `G1`~`G29`(`frontend-needs.md` 3절 표 순서이고 `src/mocks/registry.test.ts:6-34`의 `CONTRACT` 순서와 같다), P1은 `#1`~`#27`(3-2절).
- 3절의 판정은 **공통 계층**(경로 접두사, 봉투 벗기기, snake_case ↔ camelCase, 오류 코드 변환)을 적용했다고 보고 내린다. 그래서 "모양 다름"은 공통 계층으로는 안 풀리는 필드 차이가 있다는 뜻이다.
- 백엔드 명세가 말하지 않는 것은 "명세에 없음"이라고 적었다. 추측으로 채우지 않았다.

---

## 1. 요약

- 46개 백엔드 엔드포인트와 56개 프론트 엔드포인트를 짝지으면 63행이 나온다. 공통 계층만 씌워 그대로 쓸 수 있는 것은 로그아웃 1개뿐이다. 41개는 필드 모양이 다르고, 7개는 동작 단위부터 다르며(추천, 코스 지점 편집 5종, 상점 후보), 7개는 백엔드에 없고, 7개는 프론트에 없다.
- 공통 규약이 모두 다르다. 접두사가 없고, 봉투가 `{code,message,data,errors,timestamp}`이며, 필드는 snake_case, 오류는 `E409_TOUR_FULL` 식, 검증 오류는 `errors[]`, 목록은 페이지 봉투다.
- 시연에 가장 아픈 공백은 다섯 가지다. AI 추천이 없다(희망 사항을 저장만 한다). 시연 초기화가 없다. 코스 지점에 id · 제휴 문구 · 리뷰 수가 없다. 쿠폰 화면에 쓰는 표시 값이 빠졌다. "같은 날 같은 가게 쿠폰 한 장" 규칙이 시연을 막을 수 있다.
- 권장은 **(c) 혼합**이다. 도메인 타입과 화면은 그대로 둔다. `features/*/api.ts`가 백엔드 경로를 부르고 어댑터가 백엔드 DTO를 프론트 타입으로 바꾼다. 목업도 백엔드 와이어를 흉내 내되, 백엔드에 없는 값은 **선택 확장 필드**로 계속 준다. 어댑터는 그 값이 없으면 대체 경로를 탄다.
- 도메인 하나씩 바꾸고, 바꿀 때마다 골든 패스 · 무대 E2E를 다시 통과시킨다. 목업 시연은 어느 단계에서도 지금과 똑같이 돌아야 한다.
- 2B는 Task 5부터 이 전환 뒤로 미룬다. P1 엔드포인트는 처음부터 백엔드 모양으로 만든다. Task 4(가입 · 프로필)는 경로 2개와 검증 길이를 다시 맞춘다.

---

## 1-1. 기능 명세(11/7 갱신본) 기준으로 다시 본 것

기능 명세(`docs/reference/feature-spec.md`, 노션 11/7)는 기획 · 프론트 · 백엔드가 함께 기준으로 삼는 문서다. 11/3 사본 이후 바뀐 것은 C-01 한 가지다. **AI 코스 초안에 제휴 상점을 1곳 이상 넣는다**(순위 기준은 아니고 구성 규칙). 관련 후보에 제휴가 없을 때의 대체 기준은 추후 결정이다. 이 규칙은 이미 반영돼 있다. 백엔드 확정의 `E422_PARTNER_REQUIRED`, 프론트 G08 점검(`제휴 상점 1곳 이상` · 0곳이면 확정 비활성), 목업 초안(`mocks/ai/course.ts:16-17, 116-121`)이 모두 이 규칙을 따른다.

이 기준으로 3~5절의 공백을 다시 나누면 성격이 셋이다.

**(가) 백엔드 API 명세가 기능 명세와 다르다 → 명세 불일치로 팀에 올린다(프론트가 맞출 일이 아님)**

| 기능 | 기능 명세 | 백엔드 API 명세 | 영향 |
|---|---|---|---|
| **T-01 진로 문장 AI 추천** | (11/7 노션 반영 전 옛 내용) LLM이 문장에서 키워드 추출 → 정렬 → 탐방별 추천 이유 한 줄 | `POST /tour-wishes`는 AI 없이 저장만, `campus_id` · `major` 필수, 맞는 탐방은 `GET /tours` 필터 | **팀 합의(카톡, 11/4)로 백엔드 쪽이 맞다.** 합의: 학교 · 학과는 칸을 나눠 받고, 희망 사항은 한두 문장, AI 매칭 없이 고교생이 입력한 텍스트를 그대로 보여 준다. 고교생 "내 희망 사항" 화면과 대학생 "학교 · 학과별 고교생 희망 사항" 화면을 더한다. 11/7 기능 명세에 T-01 수정 · T-07 · T-08 추가로 반영했다 — 프론트(H01 · H02, AI 추천 이유)가 바뀌어야 한다 |
| U-07 사업자 인증 | 일치 · 계속사업자면 확인됨, **인허가 상점과 대조해 후보 상점 반환** | 응답에 후보 상점 없음(검색 `GET /stores/search`로 찾음) | O05 첫 화면 후보 카드 → 검색만으로 축소 가능(P1, 시연 밖) |
| A-04 신청자 목록 | 이름 · 학년 · 하고 싶은 것 · 상태 · **인증 배지** | 항목에 인증 여부 없음 | G02 `인증` 칩(2A 실행 판정 R8) 표시 불가 → 요청 또는 칩 숨김 |

**(나) 기능 명세에 없는 것 → 프론트 · 시연 도구 쪽 확장이다(백엔드에 요구하기보다 목업 확장 · 프론트 흉내가 기본)**

- 시연 초기화 · 체크포인트 · 오늘 날짜 시드 · 헬스(G28 · G29). 기능 명세에 없으므로 **무대 시연은 목업을 기본**으로 두는 근거가 된다. 실서버 시연은 백엔드가 초기화를 따로 줄 때만 가능하다.
- 방학 상권 인사이트 카드(G5). D-02 · D-03이 삭제됐으므로 프론트 상수(`예시` 배지)로 둔다.
- 탐방 제목(T-03 입력에 없음, V2 G04가 더함)과 제휴 할인 조건(S-03 입력에 없음, V2 O06이 더함). 백엔드에는 "있으면 좋음"으로 낮춰 묻고, 없으면 파생 제목 · 저장 안 함으로 처리한다.
- 지점 단위 코스 편집 엔드포인트. C-02(추가 · 삭제 · 순서 · 상점 교체 · 한줄평)는 백엔드 `PUT /course/spots` 전체 교체로 충족된다. 프론트가 빌더로 흉내 낸다.

**(다) 기능 명세로 답이 나온 9절 질문 → 묻지 않는다**

- 10번: 제휴 0곳 확정 → C-01 구성 규칙상 초안에는 늘 제휴가 있다. 가이드가 편집으로 모두 뺐을 때만 `E422_PARTNER_REQUIRED`다(G08이 미리 막는다).
- 24번: 신청 취소는 "탐방 날짜 전까지"(A-03)이므로 당일에는 안 된다.
- 26번: 확정 뒤 승인한 신청자에게도 쿠폰을 발급한다(A-02). 신청 취소 · 탐방 취소 때 쿠폰은 만료한다(A-03 · T-05). "거절된 신청도 CANCELED"인지만 남는다.
- 41번 일부: 리뷰는 그 상점 쿠폰을 사용한 사람만, 상점당 1건이다(R-01). 최소 길이 · 요약 반영 시점만 남는다.
- 2번: 기능 명세는 학교 · 날짜를 선택으로 본다. 그래서 이 질문은 (가) T-01 불일치의 일부로 묶는다.

**결론.** 적용 방식 권장 (c)는 그대로다. T-01은 불일치가 아니라 **팀 합의(11/4 카톡)를 백엔드가 먼저 반영한 것**이고, 기능 명세 T-01 본문과 프론트의 홈 · 추천 화면이 아직 옛 방식(AI 추천 + 이유)이다. 프론트는 홈을 학교 · 학과 · 희망 사항 입력 → 저장 → 조건에 맞는 탐방 목록(입력한 희망 원문 표시)으로 바꾸고, 고교생 "내 희망 사항"과 대학생 "고교생 희망 사항" 화면을 더해야 한다. 시연에서 AI는 C-01 코스 초안(과 R-03 리뷰 요약)이 맡는다. 같은 합의에서 보호자 동의는 시연 때 생략하거나 '동의 완료' 기본값으로 둔다(프론트 반영 약속).

---

## 2. 공통 차이

| 항목 | 프론트 지금 (파일:줄) | 백엔드 (근거) | 바꿀 것 |
|---|---|---|---|
| 경로 접두사 · base URL | 모든 경로 앞에 `config.baseUrl`(기본 `/api`)을 붙인다 `shared/lib/http.ts:48`, `:93`, `shared/config/env.ts:58`. MSW도 같은 접두사를 쓴다 `mocks/handlers/util.ts:12`. 개발 프록시는 `/api`를 떼지 않고 넘긴다 `vite.config.ts:31-35`. 배포 프록시는 아직 없다 `vercel.json:1`(SPA rewrite만) | 접두사 없는 경로(`/auth/login`, `/users/me` …). 호스트 · 포트 · 컨텍스트 경로는 명세에 없음 | 프론트 base `/api`와 MSW 접두사는 그대로 둔다. 프록시가 `/api`를 뗀다(Vite `rewrite`, `vercel.json`에 `/api/(.*)` → `{백엔드}/$1`을 SPA 규칙보다 앞에). 경로 문자열은 백엔드 그대로 쓴다 |
| 인증 헤더 · 토큰 | `Authorization: Bearer <token>` `http.ts:95-96`. 로그인 응답 `token` `features/auth/model.ts:35-38`. 로그인 요청은 토큰 없이 `features/auth/api.ts:15` | 같은 Bearer(BE 공통규칙 › 헤더). 로그인 응답은 `data.access_token` [U-02]. 만료 시간과 갱신은 명세에 없음 | 헤더는 그대로. 어댑터가 `access_token`을 `token`으로 옮긴다. 401 처리(`http.ts:113`)도 그대로 |
| 토큰 없이 부르는 API | 추천 · 탐방 목록 · 상세는 로그인 없이 된다 `mocks/handlers/tours.ts:11-12`. 신청 버튼에 `LOGIN` 상태가 있다 `features/tours/model.ts:103-111` | 토큰 없이 되는 것은 가입 · 로그인 · 보호자 안내 · 동의 · 캠퍼스뿐이다(BE 공통규칙 › 헤더). `GET /tours` · `GET /tours/{tourId}` · 희망 사항은 토큰이 필요하다 | 비로그인 둘러보기를 지키려면 백엔드에 공개를 요청한다(9절). 안 되면 홈 · 추천 · 상세를 로그인 뒤로 옮긴다. 시연은 로그인한 채로 하므로 영향이 없다 |
| 응답 봉투 | 본문이 곧 DTO다 `http.ts:116-119` | 모든 응답이 `{code,message,data,errors,timestamp}`(BE 공통규칙 › 응답 형식) | `send()`가 2xx면 `data`를 돌려준다. 전환 기간에는 본문에 `timestamp`와 `data` 키가 있을 때만 벗긴다(아직 안 바꾼 목업 도메인과 함께 돌게) |
| 성공 · 오류 코드 체계 | 상태 코드로 가르지 않는다. 오류 본문의 `code`가 곧 `ErrorCode`다 `http.ts:68-79`, `shared/lib/errors.ts:2-50`. 화면은 `error.code`로 가른다(예 `features/coupons/model.ts:90-104`) | 성공 `S200`·`S201`, 실패 `E{상태}` 또는 `E{상태}_{사유}`(BE 공통규칙 › 응답 형식). 한 코드가 여러 뜻으로 쓰인다(`E409_ALREADY_REVIEWED`는 심사와 리뷰 둘 다). 공통 실패 표에 없는 409 · 410 · 422 · 502를 쓴다(BE 읽기 메모) | `ApiError.code`는 계속 `ErrorCode`로 두고 `backendCode` 칸을 더한다. 기본 표에 호출별 덮어쓰기를 얹는다(`request(path, { errorMap })`). 새 `ErrorCode`는 `COURSE_PARTNER_REQUIRED` · `COUPON_DAILY_LIMIT` · `AI_FAILED`. 대응표는 4-37 |
| 검증 오류 모양 | `fieldErrors: { camel필드: 문구 }` `http.ts:74-76`. 목업도 같다 `mocks/handlers/util.ts:62-69` | `errors: [{ field, reason }]`. `field`는 snake 요청 필드다. `reason`은 문구일 때도([U-05] 재학 인증), 기계값일 때도([U-07] `MISMATCH`) 있다 | 클라이언트가 배열을 객체로 바꾸고 `field`를 camel로 바꾼다. 호출별 이름 표로 폼 칸 이름에 맞춘다(`date`→`startsAt`, `school_name`→`highSchoolName`, `intro`→`introduction`, `discount_text`→`discount`). `reason`이 대문자 기계값이면 문구로 쓰지 않고 코드로 바꾼다 |
| 필드 이름 | camelCase. ID는 `id` `features/auth/model.ts:20-33` | snake_case(BE 공통규칙 › 응답 형식). ID는 `tour_id` · `application_id`처럼 리소스 이름을 붙인다. 좌표 이름이 섞여 있다(가게 등록만 `latitude`/`longitude`, 나머지는 `lat`/`lng`, BE 읽기 메모) | 클라이언트가 JSON 키를 바꾼다(요청은 snake, 응답은 camel. FormData와 쿼리 문자열은 손으로). 뜻이 같은데 이름이 다른 것(`wish`↔`motivation` 등)은 어댑터가 옮긴다 |
| 목록 · 페이지네이션 | 배열 그대로, 페이지 없음 `frontend-needs.md:33`. 예 `features/tours/api.ts:27` | `data`가 `{items,page,size,total}`이고 size는 최대 50이다. 작은 목록은 `items`만 준다(BE 공통규칙 › 응답 형식). 신청자 · 주변 상점 · 내 쿠폰 · 캠퍼스 · 장소는 `items`만 준다 | 목록 도우미 `listAll(path)`를 둔다. `size=50`으로 부르고 `total`이 크면 다음 쪽을 이어 부른다. `items`만 오면 그대로 쓴다 |
| 날짜 · 시각 형식 | 시각은 `+09:00` ISO 하나(`startsAt`/`endsAt`) `features/tours/model.ts:17-18` | 날짜 `yyyy-MM-dd`, 시간 `HH:mm`, 일시 ISO 8601(+09:00)(BE 공통규칙 › 응답 형식). 탐방은 `date` + `start_time` + `end_time`으로 나뉜다 [T-01 보완] [T-03] | 어댑터가 `${date}T${start_time}:00+09:00`로 합친다. 탐방 개설은 나눠 보낸다. 쿠폰 `valid_until`은 그대로 `expiresAt`이 된다 |
| multipart | `upload()`는 60초이고 Content-Type을 비운다 `http.ts:154-161`. 본문 없는 413은 `FILE_TOO_LARGE` `http.ts:82-84`. 계약은 jpg · png · heic · heif 10MB(`frontend-needs.md` 3-2 #5) | 재학 인증만 multipart다. jpg · png 5MB, 필드 `campus_id` · `school_name` · `document` [U-05]. 413은 명세에 없음(형식 · 용량 오류는 `E400` + `errors[document]`) | 업로드 함수는 그대로 쓴다. 폼 필드 이름과 형식 · 용량 상수(2B T5의 `PROOF_*`)를 백엔드 값으로 바꾸거나, 백엔드에 heic와 10MB를 요청한다 |
| 로그아웃 · 세션 | 로그아웃은 204를 기대하고, 실패해도 토큰을 비운다 `features/auth/queries.ts:95-108`. 목업 204 `mocks/handlers/auth.ts:54`. 시연 계정은 401에서 자동으로 다시 로그인한다 `demo/quickLogin.ts:79-93` | 200 + `data: null`, "현재 토큰을 폐기" [U-02]. 토큰 만료는 명세에 없음 | 그대로 돈다(빈 본문과 JSON 둘 다 받는다 `http.ts:117-119`). 만료가 짧아도 시연 계정은 자동 재로그인이 덮는다 |
| 서버 계산 값 | 계약 4절 표의 값을 서버가 준다고 가정했다 `frontend-needs.md:176-189`. 컴포넌트는 시계로 유효 여부를 판단하지 않는다(2B 계획 Global Constraints) | 남은 자리(`remaining`) · 내 신청(`my_application`) · 오픈채팅 공개 · 리뷰 작성 여부(`reviewed`)는 준다. 취소 가능 · 쿠폰 수 · 쿠폰 `state` · 탐방 제목 · 지점 제휴 문구 · 코스 조회의 발급 수는 주지 않는다 | 없는 값은 어댑터가 만든다. `computeCouponState`(`features/coupons/model.ts:47`)와 `computePartnershipState`(`features/stores/model.ts:31`)는 이미 "어댑터 전용"으로 둔 함수다. 어댑터 안의 시계는 허용하고 컴포넌트는 그대로 둔다 |
| 상태 값 | role · 인증 · 동의 · 탐방 · 신청 · 코스 · 쿠폰 · 지점 유형 `features/auth/model.ts:1-5`, `features/tours/model.ts:5`, `features/courses/model.ts:3-4`, `features/coupons/model.ts:4` | 같은 값이다(BE 공통규칙 › 값 정의). 고교생이 아니면 `guardian_consent_status`가 null이다 [U-03] | null을 `'NONE'`으로 바꾸는 것뿐이다 |
| 시연 지원 | 초기화 · 체크포인트 · 헬스 `mocks/handlers/demo.ts:16-40`, `demo/resetDemo.ts:14-30`, `demo/DemoPanel.tsx:406-417` | 명세에 없음 | 5절 |
| AI 제한 시간 · 실패 | AI 요청은 30초 `http.ts:4`. 추천과 초안에 쓴다 `features/tours/api.ts:15`, `features/courses/api.ts:26` | 초안만 AI 실패 `E502_AI_FAILED` [C-01]. 서버 제한 시간은 명세에 없음 | `E502_AI_FAILED` → `AI_FAILED`(다시 시도 안내) |

---

## 3. 엔드포인트 대응표

판정 기준(공통 계층을 씌운 뒤): **동일** = 경로 · 요청 · 응답이 같다. **경로만 다름** = 경로나 메서드만 다르다. **모양 다름** = 필드 이름 · 타입 · 구성이 다르다(4절). **의미가 다름** = 한 번의 호출이 하는 일의 단위나 규칙이 달라 1:1로 옮길 수 없다. **백엔드에 없음** · **프론트에 없음** = 짝이 없다. "(미구현, 2B Tn)"은 계약에는 있지만 아직 함수가 없고 그 태스크가 만들 예정이라는 뜻이다.

| # | 백엔드 메서드 · 경로 [기능ID] | 프론트 계약 · 메서드 · 경로 | 프론트 함수 (파일) | 판정 | 핵심 차이 |
|---|---|---|---|---|---|
| 1 | POST /auth/login [U-02] | G1 POST /api/auth/login | `login` `features/auth/api.ts:14` | 모양 다름 | 응답 `{access_token, user{id,name,role,verification_status}}`. 토큰 이름이 다르고 `Me` 전체가 없어 `GET /users/me`를 더 부른다 |
| 2 | POST /auth/logout [U-02] | G2 POST /api/auth/logout | `logout` `features/auth/api.ts:18` | 동일 | 204 대신 200 + `data:null`(봉투만 벗기면 같다) |
| 3 | GET /users/me [U-03] | G3 GET /api/me | `fetchMe` `features/auth/api.ts:22` | 모양 다름 | 평평한 구조, `guide_profile{major,intro}`. `businessVerified` · `storeId` · `guideProfile.universityId` 없음 |
| 4 | POST /auth/signup [U-01] | #1 POST /api/auth/signup | `postSignup` `features/auth/api.ts:30` | 모양 다름 | 토큰 없이 사용자만 준다(기존 `login()` 이어 부르기가 흡수). 중복은 `E409`(errors 없음), 이름 20자, 비밀번호 영문+숫자 |
| 5 | PATCH /users/me [U-03] | #2 PUT /api/me/student-profile | `putStudentProfile` `features/auth/api.ts:41` | 모양 다름 | PUT→PATCH(부분 수정), `school_name` · `interest_major`, 길이 20/50/30, 응답은 사용자(예시는 일부 칸) |
| 6 | PUT /users/me/guide-profile [U-04] | #3 PUT /api/me/guide-profile | `putGuideProfile` `features/auth/api.ts:46` | 모양 다름 | 경로, `introduction`→`intro` 필수 200자, 응답 `{major,intro}`(Me 아님) |
| 7 | (없음) | #4 GET /api/me/verification | (미구현, 2B T5) | 백엔드에 없음 | 상태는 `GET /users/me`에 있다. 보호자 이름 · 이메일 · 만료 · 제출 시각 · `demoConsentToken`은 없다 |
| 8 | POST /verifications/enrollment [U-05] | #5 POST /api/me/student-verification | (미구현, 2B T5) | 모양 다름 | `universityId`→`campus_id`, `highSchoolName`→`school_name`, 학년 없음, jpg · png 5MB(우리는 heic 포함 10MB), 응답 3칸 |
| 9 | POST /guardian-consents [U-06] | #6 POST /api/me/guardian-consent | (미구현, 2B T5) | 모양 다름 | snake 필드, 응답 `{status,expires_at}`, 대기 중 재요청은 409(우리는 허용) |
| 10 | GET /guardian-consents/{consentToken} [U-06] | #7 GET /api/guardian-consents/:token | (미구현, 2B T5) | 모양 다름 | `studentGrade` · `decidedAt` 없음, `school_name` · `guide_text` 추가, 처리된 링크의 응답은 명세에 없음 |
| 11 | PATCH /guardian-consents/{consentToken} [U-06] | #8 POST /api/guardian-consents/:token/agree | (미구현, 2B T5) | 모양 다름 | 한 엔드포인트에 `{agree:true}`, 응답 `{status}` |
| 12 | PATCH /guardian-consents/{consentToken} [U-06] | #9 POST /api/guardian-consents/:token/reject | (미구현, 2B T5) | 모양 다름 | `{agree:false}`, 응답 `{status}` |
| 13 | POST /verifications/business [U-07] | #22 POST /api/me/business-verification | (미구현, 2B T20) | 모양 다름 | `opened_at`, 응답은 `{status}`뿐(후보 · 인증 시각 없음), 실패는 422 + `errors[].reason` `MISMATCH`/`CLOSED` |
| 14 | GET /admin/verifications [U-08 보완] | #10 GET /api/admin/student-verifications | (미구현, 2B T11) | 모양 다름 | 페이지 봉투, 처리 내역 필터는 명세에 없음, email · status · 처리 시각 · 반려 사유 없음 |
| 15 | GET /admin/verifications/{verificationId} [U-08 보완] | #11 GET /api/admin/student-verifications/:id | (미구현, 2B T11) | 모양 다름 | `document_url` · `status`만 더한다. email · 처리 시각 · 반려 사유 없음 |
| 16 | PATCH /admin/verifications/{verificationId} [U-08] | #12 POST /api/admin/student-verifications/:id/approve | (미구현, 2B T11) | 모양 다름 | `{decision:"APPROVED"}`, 응답 `{verification_id,status,reviewed_at}` |
| 17 | PATCH /admin/verifications/{verificationId} [U-08] | #13 POST /api/admin/student-verifications/:id/reject | (미구현, 2B T11) | 모양 다름 | `{decision:"REJECTED", reject_reason}` 100자(우리 200), 응답은 위와 같다 |
| 18 | GET /campuses [D-01] | G4 GET /api/universities | `listUniversities` `features/campuses/api.ts:4` | 모양 다름 | `campus_id`, `vacation_periods`(label 없음). `shortName` · `administrativeDong` 없음 |
| 19 | (없음) | G5 GET /api/universities/:id/insight | `getInsight` `features/campuses/api.ts:8` | 백엔드에 없음 | 방학 상권 인사이트 데이터가 없다 |
| 20 | GET /campuses/{campusId}/places [C-02 보완] | (없음) | — | 프론트에 없음 | 캠퍼스 건물 목록(코스에 캠퍼스 지점을 넣을 때 쓴다) |
| 21 | POST /tour-wishes (+ GET /tours) | G6 POST /api/recommendations | `recommend` `features/tours/api.ts:11` | 의미가 다름 | 희망을 저장만 한다(AI 없음). 학교 · 학과가 필수다. 추천 이유 · 헤드라인 · 키워드 · 대체 목록이 없다 |
| 22 | GET /users/me/tour-wishes [T-01 보완] | (없음) | — | 프론트에 없음 | 내 희망 사항 목록 |
| 23 | PATCH /users/me/tour-wishes/{wishId} [T-01 보완] | (없음) | — | 프론트에 없음 | 희망 사항 수정 |
| 24 | GET /tour-wishes [T-01 보완] | (없음) | — | 프론트에 없음 | 대학생이 보는 학교 · 학과별 희망 사항 |
| 25 | GET /tours [T-01 보완] | G7 GET /api/tours | `listTours` `features/tours/api.ts:19` | 모양 다름 | 페이지 봉투, `universityId`→`campus_id`. 항목에 제목 · 학교 id · 종료 시각 · 승인 수 없음. 기본 RECRUITING, 토큰 필요 |
| 26 | GET /tours/{tourId} [T-02] | G8 GET /api/tours/:id | `getTour` `features/tours/api.ts:30` | 모양 다름 | `date`+`start_time`/`end_time`, `intro`, `guide{…}` 중첩. 제목 · 학교 id 없음, 토큰 필요 |
| 27 | POST /tours [T-03] | #14 POST /api/guide/tours | (미구현, 2B T13) | 모양 다름 | 제목 없음, 날짜 · 시각 분리, 연락 링크 필수, 정원 1~10, 응답 `{tour_id,status}` |
| 28 | (없음) | #15 GET /api/guide/tours/:id | (미구현, 2B T13) | 백엔드에 없음 | `cancellable` · `completable` · `courseStopCount`가 없다 |
| 29 | POST /tours/{tourId}/complete [T-06] | #16 POST /api/guide/tours/:id/complete | (미구현, 2B T13) | 모양 다름 | 경로에 `guide` 없음, 응답 `{tour_id,status}`, 오류는 `E409_INVALID_TOUR_STATUS` 하나 |
| 30 | POST /tours/{tourId}/cancel [T-05] | #17 POST /api/guide/tours/:id/cancel | (미구현, 2B T13) | 모양 다름 | 위와 같다. 취소 때 쿠폰을 어떻게 하는지는 명세에 없음 |
| 31 | GET /users/me/tours [T-04] (고교생) | G10 GET /api/me/applications | `getMyApplications` `features/applications/api.ts:13` | 모양 다름 | 탐방 축 항목 7칸. 하고 싶은 것 · 신청 시각 · 시작 시각 · 가이드 · 쿠폰 수 · 취소 가능 없음 |
| 32 | GET /users/me/tours [T-04] (대학생) | G13 GET /api/guide/tours | `getGuideTours` `features/applications/api.ts:25` | 모양 다름 | 학교 · 학과 · 시작 시각 · 제목 없음. 코스 상태가 bool(`course_confirmed`)이라 초안이 있는지 모른다 |
| 33 | (없음) | G11 GET /api/me/applications/:id | `getMyApplication` `features/applications/api.ts:17` | 백엔드에 없음 | 신청 단건 조회가 없다 |
| 34 | POST /tours/{tourId}/applications [A-01] | G9 POST /api/tours/:id/applications | `postApplication` `features/applications/api.ts:6` | 모양 다름 | `motivation`→`wish` 100자, 응답 4칸, 403 · 409 코드 하나가 두 사유를 합친다 |
| 35 | POST /applications/{applicationId}/cancel [A-03] | G12 POST /api/me/applications/:id/cancel | `postCancelApplication` `features/applications/api.ts:21` | 모양 다름 | 경로, 응답 `{application_id,status}`, 탐방 당일 취소 규칙은 명세에 없음 |
| 36 | GET /tours/{tourId}/applications [A-04] | G14 GET /api/guide/tours/:id/applicants | `getApplicantsBoard` `features/applications/api.ts:29` | 모양 다름 | 신청자 배열만 준다(보드의 탐방 · 집계 · 코스 없음). `verified` 없음 |
| 37 | PATCH /applications/{applicationId}/decision [A-02] | G15 POST /api/guide/applications/:id/approve | `postApprove` `features/applications/api.ts:34` | 모양 다름 | `{decision:"APPROVED"}`, 응답 `{application_id,status,tour_status}`(보드 아님) |
| 38 | PATCH /applications/{applicationId}/decision [A-02] | G16 POST /api/guide/applications/:id/reject | `postReject` `features/applications/api.ts:38` | 모양 다름 | `{decision:"REJECTED"}`, 응답은 위와 같다 |
| 39 | GET /tours/{tourId}/course [C-04] | G17 GET /api/guide/tours/:id/course | `getGuideCourse` `features/courses/api.ts:13` | 모양 다름 | 학생과 같은 경로. 가이드가 코스 없는 탐방을 부를 때의 응답은 명세에 없음. 스팟 모양은 4-24 |
| 40 | GET /tours/{tourId}/course [C-04] | G23 GET /api/tours/:id/course | `getCourse` `features/courses/api.ts:8` | 모양 다름 | 준비 중은 409 `E409_COURSE_NOT_READY`(우리 404). 스팟에 id · 제휴 문구 · 리뷰 평균 · 개수 없음 |
| 41 | POST /tours/{tourId}/course [C-01] | G18 POST /api/guide/tours/:id/course/draft | `postCourseDraft` `features/courses/api.ts:23` | 모양 다름 | 경로, 201, 초안은 STORE 지점만, AI 실패 502 |
| 42 | PUT /tours/{tourId}/course/spots [C-02] | G19 PUT /api/guide/tours/:id/course/order | `putStopOrder` `features/courses/api.ts:30` | 의미가 다름 | 지점 id 배열 대신 전체 스팟 배열(시각 · 한줄평 포함)로 통째 바꾼다 |
| 43 | PUT /tours/{tourId}/course/spots [C-02] | G20 PATCH /api/guide/tours/:id/course/stops/:stopId | `patchStop` `features/courses/api.ts:37` | 의미가 다름 | 한줄평 하나를 고쳐도 전체 배열을 보낸다 |
| 44 | PUT /tours/{tourId}/course/spots [C-02] | G21 DELETE /api/guide/tours/:id/course/stops/:stopId | `deleteCourseStop` `features/courses/api.ts:44` | 의미가 다름 | 그 지점을 뺀 배열을 보낸다. 마지막 1곳은 뺄 수 없다(1개 이상) |
| 45 | PUT /tours/{tourId}/course/spots [C-02] | #19 POST /api/guide/tours/:id/course/stops | (미구현, 2B T16) | 의미가 다름 | 끝에 붙인 배열을 보낸다. 상한 · 중복 검사는 명세에 없음 |
| 46 | PUT /tours/{tourId}/course/spots [C-02] | #20 POST /api/guide/tours/:id/course/stops/:stopId/replace | (미구현, 2B T16) | 의미가 다름 | 그 자리의 `store_id`만 바꾼 배열을 보낸다(새 지점의 `reason`은 null) |
| 47 | POST /tours/{tourId}/course/confirm [C-03, S-04] | G22 POST /api/guide/tours/:id/course/confirm | `postConfirmCourse` `features/courses/api.ts:48` | 모양 다름 | 응답 `{tour_id,status,coupon_count}`(Course 아님). 제휴 상점이 0곳이면 422 |
| 48 | GET /stores/nearby [S-02] | #18 GET /api/guide/tours/:id/course/store-candidates | (미구현, 2B T16) | 의미가 다름 | 탐방이 아니라 캠퍼스 기준이다. 거리 · 관련 의도 · 학생 요청 · 제휴 문구 · 리뷰 수가 없고, 정렬은 명세에 없음 |
| 49 | GET /users/me/coupons [S-05] | G24 GET /api/me/coupons?applicationId= | `getMyCoupons` `features/coupons/api.ts:7` | 모양 다름 | 거르기가 `tour_id` · `store_id`. `state` · 업종 · 신청 id · 탐방 제목 · 시작 시각 없음 |
| 50 | (없음) | G25 GET /api/me/coupons/:id | `getMyCoupon` `features/coupons/api.ts:13` | 백엔드에 없음 | 쿠폰 단건 조회가 없다 |
| 51 | GET /coupons/{couponCode} [S-06] | G26 GET /api/owner/coupons/:code | `getCouponLookup` `features/coupons/api.ts:17` | 모양 다름 | 가게 이름 · 탐방 제목 · 학생 이름 · 사용 시각 · `state` 없음. 날짜는 `tour_date`뿐 |
| 52 | POST /coupons/{couponCode}/redeem [S-06] | G27 POST /api/owner/coupons/:code/redeem | `postRedeem` `features/coupons/api.ts:21` | 모양 다름 | 응답 `{coupon_id,status,used_at}`, 방문 수 없음, 하루 한 장 규칙(`E409_DAILY_LIMIT`) 추가 |
| 53 | GET /stores/search [S-01] | #23 GET /api/owner/store-candidates?q= | (미구현, 2B T20) | 모양 다름 | `keyword` 필수 2자 이상(검색어 없는 사업자 대조 후보가 없다), `is_registered`(= `!linkable`), 페이지 봉투 |
| 54 | POST /users/me/store [S-01] | #24 POST /api/owner/store/link | (미구현, 2B T20) | 모양 다름 | `{store_id}`, 응답에 제휴 없음, 409가 하나(`E409_STORE_UNAVAILABLE`) |
| 55 | POST /users/me/store [S-01] | #25 POST /api/owner/store | (미구현, 2B T20) | 모양 다름 | `latitude` · `longitude` 필수(우리는 선택), 주소 오류 코드 없음 |
| 56 | GET /users/me/store [S-01 보완] | #26 GET /api/owner/store | `getMyStore` `features/stores/api.ts:5` | 모양 다름 | 제휴에 id · condition · state 없음, 가게 없음은 `E404`(우리 `STORE_NOT_LINKED`) |
| 57 | PATCH /users/me/store [S-01] | (없음) | — | 프론트에 없음 | 가게 정보 수정 |
| 58 | PUT /users/me/store/partnership [S-03] | #27 PUT /api/owner/store/partnership | (미구현, 2B T20) | 모양 다름 | `discount_text`, condition 없음, 응답은 제휴만 |
| 59 | GET /users/me/store/report [S-07] | (없음) | — | 프론트에 없음 | 방문 · 리뷰 리포트(필드 미확정). 프론트는 `/owner/report` 자리 화면 |
| 60 | POST /stores/{storeId}/reviews [R-01] | #21 POST /api/reviews | (미구현, 2B T18) | 모양 다름 | 상점 id가 경로에 들어간다, 응답에 쿠폰 · 탐방 id 없음, 요약 갱신은 응답과 별개 |
| 61 | GET /stores/{storeId}/reviews [R-02] | (없음) | — | 프론트에 없음 | 요약 · 평균 · 목록(작성자 가림). 우리는 코스 지점 안에 `review`를 끼워 받는다 |
| 62 | (없음) | G28 GET /api/health | `request('/health')` `demo/DemoPanel.tsx:410` | 백엔드에 없음 | 연결 확인 수단이 없다 |
| 63 | (없음) | G29 POST /api/demo/reset | `resetDemoData` `demo/resetDemo.ts:14` | 백엔드에 없음 | 시연 초기화 · 체크포인트 · 오늘 날짜 시드가 없다 |

**판정 집계(63행):** 동일 1 · 경로만 다름 0 · 모양 다름 41 · 의미가 다름 7 · 백엔드에 없음 7 · 프론트에 없음 7. 백엔드 46개는 모두 한 번 이상 나오고, 프론트 56개(G1~G29, #1~#27)는 정확히 한 번씩 나온다.

---

## 4. 필드 차이

"모양 다름"과 "의미가 다름" 48행을 엔드포인트별로 묶었다. 표의 왼쪽은 프론트 타입(`features/*/model.ts`), 가운데는 백엔드 `data`의 필드다(공통 계층 뒤에는 camel로 바뀌지만 여기서는 명세 그대로 snake로 적는다). "어댑터"는 7절의 권장안에서 `features/*/api.ts`가 할 일이다.

### 4-1. 로그인 (3절 1행) — `LoginResponse` `features/auth/model.ts:35-38`

| 프론트 | 백엔드 [U-02] | 차이 · 어댑터 |
|---|---|---|
| `token` | `access_token` | 이름만 다르다 |
| `me: Me` | `user: { id, name, role, verification_status }` | 4칸뿐이다. 어댑터가 로그인 직후 `GET /users/me`(사장님이면 `GET /users/me/store`도)를 불러 `Me`를 채운다. `quickLogin`(`demo/quickLogin.ts:52`)과 `useLogin`이 `{token, me}`를 그대로 받게 된다 |

오류: `E401_INVALID_CREDENTIALS` → `INVALID_CREDENTIALS`. 요청 `{email,password}`는 같다.

### 4-2. 내 정보 (3행) — `Me` `features/auth/model.ts:20-33`

| 프론트 | 백엔드 `GET /users/me` [U-03] | 차이 · 어댑터 |
|---|---|---|
| `id` `email` `name` `role` | 같은 이름 | 없음 |
| `verificationStatus` | `verification_status` | 이름. 사장님은 사업자 인증이 맞으면 `APPROVED`(BE 공통규칙 › 값 정의) |
| `rejectionReason` | `reject_reason` | 이름 |
| `guardianStatus`(늘 값, `NONE` 포함) | `guardian_consent_status`(고교생이 아니면 null) | null을 `'NONE'`으로 |
| `studentProfile { highSchoolName, grade, interestedMajor }` 또는 null | 평평한 `school_name`, `grade`, `interest_major` | 중첩 대 평평. 고교생일 때만 객체로 묶는다. 대학생의 `school_name`은 인증 학교 이름이라 뜻이 다르다 |
| `guideProfile { universityId, major, introduction }` 또는 null | `guide_profile { major, intro }` 또는 null | `universityId`가 없다(대학생은 `school_name` 문자열뿐). `introduction`→`intro` |
| `businessVerified` | 없음 | `role==='OWNER' && verification_status==='APPROVED'`로 만든다. `features/auth/landing.ts:22`가 쓴다 |
| `storeId` | 없음 | 사장님이면 `GET /users/me/store`의 `store_id`(404면 null). `landing.ts:23`, `pages/owner/CouponRedeemPage.tsx:59`가 쓴다 |

### 4-3. 가입 (4행) — `SignupInput` `features/auth/model.ts:45-50`

| 프론트 | 백엔드 [U-01] | 차이 · 어댑터 |
|---|---|---|
| 요청 `email` `password` `name` `role` | 같은 이름 | 검증이 다르다. 비밀번호는 "영문+숫자 8자 이상"(우리 8자 이상 `model.ts:66`), 이름은 20자(우리 100 `model.ts:69`). 운영자 역할 불가는 같다 |
| 응답 `LoginResponse`(토큰 + Me, 201) | `{ id, email, name, role, created_at }`(201, 토큰 없음, "자동 로그인은 되지 않으며") | `postSignup`이 이미 토큰이 없으면 `login()`을 잇는다 `features/auth/api.ts:36-37`. 그대로 쓴다 |
| 중복 `EMAIL_DUPLICATE` 409 + `fieldErrors.email` | `E409`(사유 없음, `errors` 없음) | 이 호출에서는 `E409`를 `EMAIL_DUPLICATE`로 바꾸고 `fieldErrors.email`을 만들어 넣는다 |

### 4-4. 내 정보 수정 (5행) — `StudentProfileInput` `features/auth/model.ts:53-58`

| 프론트 | 백엔드 `PATCH /users/me` [U-03] | 차이 · 어댑터 |
|---|---|---|
| PUT, 네 키 모두 | PATCH, "보낸 필드만 수정" | 네 키를 다 보내도 된다. null로 비우기가 되는지는 명세에 없음 |
| `name` | `name` 20자 | 우리 100자 |
| `highSchoolName` | `school_name` 50자, 고교생만 | 이름, 우리 100자 |
| `grade` | `grade` 1~3 | 같다 |
| `interestedMajor` | `interest_major` 30자 | 이름, 우리 100자 |
| 응답 `Me` | "GET /users/me 응답과 같은 형태"(예시는 5칸) | 응답을 믿지 말고 `GET /users/me`를 다시 부른다 |

### 4-5. 가이드 프로필 (6행) — `GuideProfileInput` `features/auth/model.ts:61-64`

| 프론트 | 백엔드 `PUT /users/me/guide-profile` [U-04] | 차이 · 어댑터 |
|---|---|---|
| 경로 `/me/guide-profile` | `/users/me/guide-profile` | 경로 |
| `major` 1~30자 | `major` 필수 30자 | 같다 |
| `introduction` 선택, 300자(`model.ts:71`) | `intro` **필수**, 200자 | 이름 · 필수 여부 · 길이 |
| 응답 `Me` | `{ major, intro }` | `GET /users/me`를 다시 부른다 |
| 학교 연결: 대학생이 인증을 **제출**할 때(계약 3-2 #5) | 인증이 **승인**되면 연결 [U-04] | 시점이 다르다 |

### 4-6. 재학 인증 제출 (8행) — 계약 4절 `StudentVerificationSubmit`(2B T5 예정)

| 프론트 | 백엔드 `POST /verifications/enrollment` [U-05] | 차이 · 어댑터 |
|---|---|---|
| `document` jpg · png · heic · heif, 10MB, MIME 또는 확장자 | `document` jpg · png, 5MB | 형식 · 용량 상한이 다르다 |
| 고교생 `highSchoolName`(100자) | `school_name` 50자 | 이름 · 길이 |
| 고교생 `grade` | 없음 | 학년은 `PATCH /users/me`로 따로 보낸다 |
| 대학생 `universityId` | `campus_id`(5개교 밖은 거절) | 이름 |
| 응답 `VerificationOverview` | `{ verification_id, status, submitted_at }`(201) | 어댑터가 `GET /users/me`로 상태를 다시 읽는다 |
| `FILE_TYPE` 400 · `FILE_TOO_LARGE` 413 | `E400` + `errors[{field:"document", reason}]` 하나 | 둘을 가를 수 없다. `reason` 문구를 칸 아래에 그대로 보인다 |
| `ALREADY_PROCESSED` 409 | `E409_ALREADY_SUBMITTED` | 코드 대응 |

### 4-7. 보호자 동의 요청 (9행) — `GuardianConsentInput`(T5 예정)

| 프론트 | 백엔드 `POST /guardian-consents` [U-06] | 차이 · 어댑터 |
|---|---|---|
| `guardianName` · `guardianEmail` | `guardian_name`(20자) · `guardian_email` | 이름(공통 변환) |
| 응답 `VerificationOverview`(보호자 이름 · 이메일 · 만료 · `demoConsentToken`) | `{ status, expires_at }` | 이름 · 이메일은 보낸 값으로, 만료는 응답으로 채운다. `demoConsentToken`은 없다 |
| 대기 · 거부 · 만료 상태에서 다시 보낼 수 있다(계약 3-2 #6 참고) | 진행 중이거나 동의 완료면 `E409_CONSENT_EXISTS`. 거부 · 만료일 때만 다시 요청 | **규칙 차이**: 대기 중 재발송이 막힌다 |

### 4-8. 보호자 안내 조회 (10행) — `ConsentRequest`(계약 4절)

| 프론트 | 백엔드 `GET /guardian-consents/{consentToken}` [U-06] | 차이 · 어댑터 |
|---|---|---|
| `status` `PENDING`·`AGREED`·`REJECTED` | `status` | 같다. 처리된 링크를 열 때 200을 주는지는 명세에 없음(예시는 410만 있다) |
| `studentName` | `student_name` | 이름 |
| `studentGrade` | 없음 | 보호자 화면의 "고등학교 N학년"을 뺀다 |
| `expiresAt` | `expires_at` | 이름 |
| `decidedAt` | 없음 | 뺀다 |
| (없음) | `school_name`, `guide_text` | 프론트가 보여 줄 수 있는 새 값 |
| `CONSENT_LINK_INVALID` 404 · `CONSENT_LINK_EXPIRED` 410 | 404는 공통 `E404`, 410은 `E410_EXPIRED` | 이 호출에서는 `E404`→`CONSENT_LINK_INVALID`, `E410_EXPIRED`→`CONSENT_LINK_EXPIRED` |

### 4-9. 보호자 동의 · 거부 (11 · 12행)

| 프론트 | 백엔드 `PATCH /guardian-consents/{consentToken}` [U-06] | 차이 · 어댑터 |
|---|---|---|
| `POST …/agree`, `POST …/reject`, 본문 없음 | 한 경로에 `{ agree: true }` 또는 `{ agree: false }` | 메서드 · 경로 · 본문 |
| 응답 `ConsentRequest` | `{ status }` | 안내를 다시 조회하거나 이전 응답에 `status`만 덮는다 |
| `ALREADY_PROCESSED` 409 · `CONSENT_LINK_EXPIRED` 410 | `E409_ALREADY_PROCESSED` · `E410_EXPIRED` | 코드 대응 |

### 4-10. 사업자 인증 (13행) — `BusinessVerificationInput` · `BusinessVerificationResult`(계약 4절)

| 프론트 | 백엔드 `POST /verifications/business` [U-07] | 차이 · 어댑터 |
|---|---|---|
| `businessNumber`(숫자 10자리) | `business_number` 숫자 10자리, 하이픈 제외 | 이름. 시연 번호 `DEMO_BUSINESS`는 하이픈이 있어 빼서 보낸다 |
| `representativeName` | `representative_name` | 이름 |
| `openingDate` `YYYY-MM-DD` | `opened_at` | 이름 |
| 응답 `{ verifiedAt, candidates }` | `{ status: "APPROVED" }` | 후보 상점과 인증 시각이 없다. 가게 찾기는 검색(53행)만 남는다 |
| `BIZ_MISMATCH` · `BIZ_CLOSED` 400 | `E422_BUSINESS_INVALID` + `errors[{field:"business_number", reason:"MISMATCH"/"CLOSED"}]` | `reason`으로 가른다 |

### 4-11. 운영자 심사 (14~17행) — `VerificationRequestSummary` · `VerificationRequestDetail`(계약 4절)

| 프론트 | 백엔드 [U-08 보완] [U-08] | 차이 · 어댑터 |
|---|---|---|
| `?status=PENDING` 또는 `PROCESSED` | `?status=`(기본 PENDING) + `page`, `size` | `PROCESSED`(승인 + 반려)를 받는지 명세에 없음. 값 목록도 명세에 없음 |
| 정렬: 대기는 제출 오래된 순, 처리는 처리 최근 순 | "오래된 제출부터" | 처리 내역 정렬은 명세에 없음 |
| `id` | `verification_id` | 이름 |
| `role` · `userName` · `schoolName` · `submittedAt` | `role` · `user_name` · `school_name` · `submitted_at` | 이름 |
| `email` | 없음 | 뺀다 |
| `status` | 목록에 없음, 상세에 있음 | 목록은 요청한 필터로 채운다 |
| `reviewedAt` · `rejectionReason` | 없음(PATCH 응답에 `reviewed_at`만) | 처리 내역 화면이 그릴 값이 없다 |
| `documentUrl`(상세) | `document_url`(짧게 유효한 임시 주소) | 같은 뜻. 계약 6절 19번의 답이다 |
| 승인 `POST …/approve` · 반려 `POST …/reject {reason}` | `PATCH …/{verificationId}` `{ decision, reject_reason }`(반려 때 필수 100자) | 메서드 · 본문. 반려 사유 상한 100(우리 200) |
| 응답 `VerificationRequestDetail` | `{ verification_id, status, reviewed_at }` | 상세를 다시 부른다 |
| `ALREADY_PROCESSED` 409 | `E409_ALREADY_REVIEWED` | 코드 대응(리뷰와 같은 코드라 경로로 가른다) |

### 4-12. 캠퍼스 (18행) — `University` · `Vacation` `features/campuses/model.ts:1-17`

| 프론트 | 백엔드 `GET /campuses` [D-01] | 차이 · 어댑터 |
|---|---|---|
| `id` | `campus_id` | 이름 |
| `name` | `name`("단국대학교") | 같다 |
| `shortName` | 없음 | `shortUniversityName()`(`features/tours/model.ts:59`)으로 만든다 |
| `campusName` | `campus_name`("주전캠퍼스") | 다른 응답의 `campus_name`("단국대학교 죽전캠퍼스")과 뜻 · 철자가 다르다(BE 읽기 메모) |
| `address` · `lat` · `lng` | 같은 이름 | 없음 |
| `administrativeDong` | 없음 | null(화면에서 쓰는 곳 없음) |
| `vacations[{ startDate, endDate, label }]` | `vacation_periods[{ start_date, end_date }]` | 이름. `label`이 없어 null |
| 배열 | `data.items` | 목록 도우미 |

### 4-13. 추천 (21행, 의미가 다름) — `RecommendationQuery` · `RecommendationResult` `features/tours/model.ts:32-49`

| 프론트 | 백엔드 `POST /tour-wishes` + `GET /tours` | 차이 |
|---|---|---|
| 요청 `q`(문장 하나, 홈은 이것만 받는다 `pages/student/HomePage.tsx:27`) · `major?` · `universityId?` · `date?` | `wish` 100자 필수 · `campus_id` **필수** · `major` **필수** · `date` 선택 | 홈이 학교 · 학과를 묻지 않는다(2A-R1). 필수 두 칸을 채울 수 없다 |
| 응답 `headline` · `keywords` · `items[{ tour, reason }]` · `fallback` | `{ wish_id, campus_id, major, wish, date, created_at }` | 추천이 없다. "이 API는 AI를 쓰지 않으며, 맞는 탐방은 탐방 목록 조회에서 학교 · 학과 · 날짜로 찾습니다" [POST /tour-wishes] |
| 추천 이유 `reason`(`pages/student/RecommendationsPage.tsx:151`) | 없음 | 무대에서 첫 추천 이유가 보여야 한다(판정 2A-R3) |
| `headline`(`:89`) · `fallback`(`:77`) · `keywords`(`features/tours/filterChips.ts:20`) | 없음 | 대체 목록과 헤드라인 문구를 만들 수 없다 |
| 서버가 LLM으로 순위를 매긴다 | `GET /tours?campus_id&major(부분 일치)&date_from&date_to`로 거른다 | 순위 기준이 날짜뿐이다 |

명세 안의 모순: 내 희망 사항 조회의 제목은 "추천 내역"이고 본문은 "추천 결과는 저장하지 않아 등록 응답에서만 내려줍니다"이다. 수정 페이지도 "이미 받은 추천 결과는 그대로"라고 쓴다. 그런데 등록 응답에는 추천 필드가 없다(BE 읽기 메모). 이 모순은 T-01 팀 합의로 풀렸다(결정 0011, 9절 위쪽 문단).

### 4-14. 탐방 목록 (25행) — `TourSummary` `features/tours/model.ts:7-23`

| 프론트 | 백엔드 `GET /tours` 항목 [T-01 보완] | 차이 · 어댑터 |
|---|---|---|
| `id` | `tour_id` | 이름 |
| `title` | 없음(개설 입력에도 없다) | `tourTitle()`(`features/tours/model.ts:70-79`)로 만든다. 학교와 캠퍼스가 나뉘어 있어야 한다 |
| `universityId` | 없음 | `campus_name`을 `GET /campuses`의 `name + ' ' + campus_name`과 맞춰 찾는다. D-01 예시와 철자가 달라 깨질 수 있다. `campus_id`를 요청한다 |
| `universityName` · `universityShortName` · `campusName` | `campus_name`(학교와 캠퍼스를 합친 문자열) | 위 조인으로 나눈다 |
| `major` | `major` | 같다 |
| `guideName` · `guideVerified` | `guide.name` · `guide.verified` | 중첩 |
| `startsAt` | `date` + `start_time` | 합친다 |
| `endsAt`(null 허용) | 목록에 없음(상세에 `end_time`) | 목록에서는 null |
| `capacity` | `capacity` | 같다 |
| `approvedCount` | 없음 | `capacity - remaining`. `remaining`의 정의는 명세에 없음 |
| `remainingSeats` | `remaining` | 이름 |
| `status` | `status` | 같은 값 |
| 쿼리 `status` · `universityId`, 없으면 전체(`mocks/handlers/tours.ts:31-37`) | `status`(기본 RECRUITING) · `campus_id` · `major` · `date_from` · `date_to` · `page` · `size` | 기본값이 다르다. 전체가 필요하면 상태별로 나눠 부른다 |

### 4-15. 탐방 상세 (26행) — `TourDetail` `features/tours/model.ts:25-30`

`TourSummary` 부분은 4-14와 같다. 다른 점은 `end_time`이 있다는 것이다.

| 프론트 | 백엔드 `GET /tours/{tourId}` [T-02] | 차이 · 어댑터 |
|---|---|---|
| `introduction` | `intro` | 이름 |
| `guideIntroduction` | `guide.intro` | 중첩 |
| (없음) | `guide.major` | 탐방 `major`와 같은 값 |
| `openChatUrl` | `open_chat_url` | 백엔드는 승인 신청자와 개설 가이드에게 준다. 우리 목업은 승인 신청자에게만 준다 `mocks/rules/views.ts:132` |
| `myApplication { id, status }` 또는 null | `my_application { application_id, status }` | 이름. 우리는 취소한 신청을 빼고 최신 것을 준다 `views.ts:125-127`. 백엔드가 취소한 신청도 주는지는 명세에 없음 |

### 4-16. 탐방 개설 (27행) — `CreateTourInput` · `GuideTourDetail`(계약 4절)

| 프론트 | 백엔드 `POST /tours` [T-03] | 차이 · 어댑터 |
|---|---|---|
| `title` 2~30자 | 없음 | V2 G04의 탐방 이름 칸을 보낼 곳이 없다 |
| `startsAt` · `endsAt`(+09:00 ISO, 같은 날) | `date` · `start_time` · `end_time`(시작 이후) | 나눠 보낸다 |
| `capacity` 1~8(2B-R10) | `capacity` 1~10 | 상한이 다르다 |
| `introduction` 10~500자 | `intro` 300자 | 이름 · 길이 |
| `openChatUrl` 선택 | `open_chat_url` **필수** | 필수 여부 |
| 응답 `GuideTourDetail`(201) | `{ tour_id, status }`(201) | 상세를 합성해 다시 읽는다(4-17 아래) |
| `OUTSIDE_VACATION` 400 + `fieldErrors.startsAt` | `E400` + `errors[{field:"date"}]` | `date`를 `startsAt`으로 옮긴다 |
| `GUIDE_PROFILE_REQUIRED` 403 | `E409_GUIDE_PROFILE_REQUIRED`(409) | 코드 대응 |
| `NOT_VERIFIED` 403 | `E403_VERIFICATION_REQUIRED` | 코드 대응 |
| "내일 이후"(목업) | 명세에 없음 | — |

### 4-17. 탐방 완료 · 취소 (29 · 30행) — `GuideTourDetail`

| 프론트 | 백엔드 [T-06] [T-05] | 차이 · 어댑터 |
|---|---|---|
| 경로 `/guide/tours/:id/complete` · `/cancel` | `/tours/{tourId}/complete` · `/cancel` | 경로 |
| 응답 `GuideTourDetail` | `{ tour_id, status }` | 합성해 다시 읽는다(28행) |
| 완료 오류 `COMPLETE_BEFORE_TOUR_DATE` · `TOUR_ALREADY_COMPLETED` · `ALREADY_PROCESSED` | `E409_INVALID_TOUR_STATUS` 하나("탐방 날짜 이후에만…" 문구) | 한 코드에 세 사유가 들어 있다. 어댑터가 탐방 상태를 보고 고른다 |
| 완료 기준: 탐방 당일부터(계약 3-2 #16) | "탐방 날짜가 지나기 전에는 완료할 수 없습니다" | 당일이 되는지 모호하다 |
| 취소 때 대기 · 승인 → CANCELED, ISSUED 쿠폰 → EXPIRED, 거절은 그대로(#17) | "신청자 전원의 신청 상태가 CANCELED" | 쿠폰 처리는 명세에 없음. 거절된 신청까지 CANCELED가 되는지 모호하다 |
| `GuideTourDetail.cancellable` · `completable` · `courseStopCount` | 없음 | 어댑터가 상태와 날짜로 계산하고 지점 수는 코스에서 센다 |

### 4-18. 내 신청 목록 (31행) — `MyApplication` `features/applications/model.ts:7-17`

| 프론트 | 백엔드 `GET /users/me/tours`(고교생) [T-04] | 차이 · 어댑터 |
|---|---|---|
| `id` | `application_id` | 이름 |
| `status` | `application_status` | 이름 |
| `motivation` | 없음 | 신청 때 쓴 `wish`가 오지 않는다 |
| `createdAt` | 없음 | 정렬 기준이 없다 |
| `tour: TourSummary` | `tour_id` · `campus_name` · `date` · `tour_status`뿐 | 시작 시각 · 학과 · 가이드 · 정원이 없다. 탐방마다 `GET /tours/{id}`를 부른다 |
| `courseStatus` | `course_confirmed`(bool) | true → `'CONFIRMED'`, false → null(학생 화면은 초안을 "준비 중"으로 같이 본다 `features/courses/model.ts:85-87`) |
| `openChatUrl` | 없음 | `GET /tours/{id}`의 `open_chat_url` |
| `couponCount` | 없음 | `GET /users/me/coupons`를 한 번 불러 `tour_id`로 센다(`pages/student/MyToursPage.tsx:116`, `:128`이 쓴다) |
| `cancellable` | 없음 | 어댑터가 계산한다(대기 · 승인, 오늘 < 탐방 날짜) |
| (없음) | `status` 쿼리(탐방 상태로 거르기), 페이지 봉투 | — |

거절 · 취소된 신청이 목록에 들어오는지, 한 탐방에 취소 후 재신청한 두 건이 다 오는지는 명세에 없음.

### 4-19. 가이드 탐방 목록 (32행) — `GuideTourSummary` `features/applications/model.ts:35-38`

| 프론트 | 백엔드 `GET /users/me/tours`(대학생) [T-04] | 차이 · 어댑터 |
|---|---|---|
| `TourSummary` 전체 | `tour_id` · `date` · `tour_status` · `capacity` | 학교 · 학과 · 시작 시각 · 가이드 · 남은 자리가 없다. `GET /tours/{id}`를 부르거나 내 정보(학교)와 가이드 프로필(학과)로 채운다 |
| `counts.total` | 없음 | `approved_count + pending_count`(우리 정의는 거절 포함, 취소 제외 `views.ts:190-201`) |
| `counts.pending` · `counts.approved` | `pending_count` · `approved_count` | 이름 |
| `courseStatus`(null · DRAFT · CONFIRMED) | `course_confirmed`(bool) | **초안 여부를 모른다.** `coursePathFor`(`features/applications/model.ts:63-72`)가 초안이면 편집으로, 없으면 생성으로 보낸다. 어댑터가 `GET /tours/{id}/course`를 불러야 한다 |

### 4-20. 탐방 신청 (34행) — 요청 `{motivation}`, 응답 `MyApplication`

| 프론트 | 백엔드 `POST /tours/{tourId}/applications` [A-01] | 차이 · 어댑터 |
|---|---|---|
| `motivation` 최대 300자(`pages/student/ApplyPage.tsx:24`) | `wish` 100자 | 이름 · 길이 |
| 응답 `MyApplication`(201) | `{ application_id, tour_id, status, created_at }`(201) | 신청 단건을 합성해 다시 읽는다(33행 흉내) |
| `NOT_VERIFIED` · `GUARDIAN_NOT_AGREED` 403 | `E403_VERIFICATION_REQUIRED` 하나("인증 · 보호자 동의 전") | 어댑터가 캐시된 `Me`로 가른다 |
| `TOUR_NOT_RECRUITING` · `TOUR_CLOSED` 409 | `E409_TOUR_FULL` 하나("정원 마감 · 모집 종료") | 어댑터가 탐방 상태로 가른다 |
| `DUPLICATE_APPLICATION` 409 | `E409_ALREADY_APPLIED` | 코드 대응 |
| `REAPPLY_AFTER_REJECT` 409 | 명세에 없음("취소 후 재신청은 가능"만 있다) | — |

### 4-21. 신청 취소 (35행)

| 프론트 | 백엔드 `POST /applications/{applicationId}/cancel` [A-03] | 차이 · 어댑터 |
|---|---|---|
| 경로 `/me/applications/:id/cancel` | `/applications/{applicationId}/cancel` | 경로 |
| 응답 `MyApplication` | `{ application_id, status }` | 다시 읽는다 |
| `CANCEL_AFTER_TOUR_DATE` · `ALREADY_PROCESSED` 409 | `E409_INVALID_APPLICATION_STATUS` 하나 | 어댑터가 상태로 가른다 |
| 탐방 당일부터 취소 불가(`mocks/rules/applications.ts:158-160`) | "이미 취소 · 거절된 신청이나 완료된 탐방의 신청은 취소할 수 없습니다" | 당일 취소 규칙은 명세에 없음 |
| 취소하면 쿠폰 EXPIRED, 승인이었으면 CLOSED → RECRUITING | CLOSED → RECRUITING은 같다 | 쿠폰 처리는 명세에 없음 |

### 4-22. 신청자 관리 보드 (36행) — `ApplicantsBoard` · `Applicant` `features/applications/model.ts:19-33`

| 프론트 | 백엔드 `GET /tours/{tourId}/applications` [A-04] | 차이 · 어댑터 |
|---|---|---|
| `tour: TourSummary` | 없음 | `GET /tours/{id}` |
| `counts { pending, approved, remaining }` | 없음 | 항목을 세고 `remaining`은 탐방에서 |
| `course { status }` 또는 null | 없음 | `GET /tours/{id}/course`(없을 때의 응답은 명세에 없음) |
| `applicants[].id` | `application_id` | 이름 |
| `userName` | `name` | 이름 |
| `grade` | `grade` | 같다 |
| `motivation` | `wish` | 이름 |
| `status` | `status` | 같다 |
| `verified` | 없음 | 신청하려면 인증이 APPROVED여야 하므로(A-01) 늘 true로 둔다(`pages/guide/ApplicantsPage.tsx:182`) |
| (없음) | `created_at` | 정렬은 "신청 시각이 빠른 순", 우리는 신청 id 순 `views.ts:153-157` |
| 취소한 신청은 뺀다(`views.ts:173`) | 들어오는지 명세에 없음, `status` 쿼리로 거를 수 있다 | 어댑터가 CANCELED를 거른다 |

### 4-23. 승인 · 거절 (37 · 38행)

| 프론트 | 백엔드 `PATCH /applications/{applicationId}/decision` [A-02] | 차이 · 어댑터 |
|---|---|---|
| `POST /guide/applications/:id/approve` · `/reject`, 본문 없음 | `PATCH` + `{ decision: "APPROVED" 또는 "REJECTED" }` | 메서드 · 경로 · 본문 |
| 응답 바뀐 `ApplicantsBoard` 전체(`frontend-needs.md:84`) | `{ application_id, status, tour_status }` | 보드를 다시 읽는다(위 합성) |
| `CAPACITY_EXCEEDED` 409 | `E409_TOUR_FULL` | 이 호출에서는 `CAPACITY_EXCEEDED`로 |
| `ALREADY_PROCESSED` 409 | `E409_ALREADY_PROCESSED` | 같다 |
| 정원이 차면 CLOSED(`mocks/rules/applications.ts:122-125`) | 정원이 차면 CLOSED | 같다 |
| 확정 뒤 승인하면 쿠폰을 더 발급한다(`applications.ts:126-128`) | 명세에 없음 | — |

### 4-24. 코스 조회 (39 · 40행) — `Course` · `CourseStop` · `CourseTourInfo` `features/courses/model.ts:6-42`

`Course`:

| 프론트 | 백엔드 `GET /tours/{tourId}/course` [C-04] | 차이 · 어댑터 |
|---|---|---|
| `tourId` · `status` | `tour_id` · `status` | 이름 |
| `tour: CourseTourInfo { id, title, universityId, universityShortName, campusName, startsAt, endsAt }` | 없음 | `GET /tours/{id}`로 채운다(`universityId`는 4-14의 조인) |
| `stops` | `spots` | 이름 · 모양(아래) |
| `interests` | 없음 | 화면에서 쓰지 않는다. 빈 배열 |
| `criteria` | 없음 | 편집 화면 기준 카드가 쓴다(`pages/guide/CourseEditPage.tsx:250`). 프론트 상수로 |
| `confirmedAt` | 없음 | 쓰는 곳 없음. null |
| `issuedCouponCount` | 없음(확정 응답에만 `coupon_count`) | G08 완료 상태가 쓴다(`pages/guide/CourseConfirmPage.tsx:179`, `:204`, `:218`). 요청하거나 승인 수 × 제휴 지점 수로 계산한다 |

`CourseStop`:

| 프론트 | 백엔드 스팟 | 차이 · 어댑터 |
|---|---|---|
| `id` | 없음 | 지점 id가 없다. `order`로 식별한다(React 키와 편집 대상) |
| `order` | `order` | 같다 |
| `visitTime` `HH:mm` | `start_time` | 이름 |
| `type` | `stop_type` | 이름 |
| `name` | `name` | 같다 |
| `category`(캠퍼스는 `'캠퍼스'` `views.ts:233`) | `category`(캠퍼스는 null) | null을 `'캠퍼스'`로 |
| `lat` · `lng` | `lat` · `lng` | 같다 |
| (없음) | `address`, `campus_building_id` | 새 값 |
| `description` | `comment`(가이드 한줄평) | 이름 |
| `recommendationReason` | `reason`(AI 추천 이유) | 이름 |
| `storeId` | `store_id` | 이름 |
| `partnership { discount }` 또는 null | `is_partner`(bool) | **할인 문구가 없다.** 시트의 `제휴 혜택 · {discount}`와 `partnerStopCount`(`features/courses/model.ts:80-82`)가 쓴다. bool은 `{ discount: '' }`로 옮길 수 있지만 문구는 요청해야 한다. 탐방 날짜 기준 제휴인지도 명세에 없음 |
| `review { average, count, summary }`(계약은 `recent` 포함) 또는 null | `review_summary`(문자열) | 평균 · 개수가 없다. 상점마다 `GET /stores/{id}/reviews`로 채우거나 요청한다 |
| `dataSource` | 없음 | 시트 출처 줄(`features/courses/components/StoreSheet.tsx:64`). STORE면 프론트 상수 `'공공데이터(인허가) 기반'` |

상태 · 권한: 학생이 준비 중인 코스를 열면 `E409_COURSE_NOT_READY`(409, 우리 404 `COURSE_NOT_READY`). 승인되지 않은 사람이 열 때의 응답은 명세에 없음(공통 `E403`로 본다). 가이드가 코스 없는 탐방을 열 때의 응답도 명세에 없음. 우리는 404를 "코스 없음"(null)으로 읽는다 `features/courses/api.ts:13-20`.

### 4-25. AI 코스 초안 (41행)

| 프론트 | 백엔드 `POST /tours/{tourId}/course` [C-01] | 차이 · 어댑터 |
|---|---|---|
| 경로 `/guide/tours/:id/course/draft` | `/tours/{tourId}/course` | 경로 |
| 응답 `Course`(200) | 코스(201), 스팟 모양은 4-24 | 같은 어댑터 |
| 초안에 캠퍼스 지점이 들어간다(`mocks/ai/course.ts:130`) | "AI 초안은 상점 지점(STORE)으로" | 실서버 초안에는 캠퍼스 지점이 없다 |
| 다시 만들기 = 같은 호출(`mocks/rules/courses.ts:55-93`) | "이미 초안이 있으면 새로 만든 초안으로 바꾸고" | 같다(공백 아님) |
| 제휴 1곳 이상 포함(결정 0008) | "제휴 상점을 1곳 이상 포함" | 같다(계약 6절 10번의 답) |
| `NO_APPROVED_APPLICANTS` · `COURSE_NOT_DRAFT` 409 | `E409_NO_APPROVED_APPLICANT` · `E409_COURSE_CONFIRMED` | 코드 대응 |
| (없음) | `E502_AI_FAILED` | `AI_FAILED` 새 코드 |

### 4-26. 코스 편집 (42~46행, 의미가 다름) — `putStopOrder` · `patchStop` · `deleteCourseStop` + #19 · #20

백엔드 `PUT /tours/{tourId}/course/spots` [C-02]는 `{ spots: [{ stop_type, store_id 또는 campus_building_id, start_time, comment? }] }` 배열 전체가 새 코스다. 배열 순서가 곧 `order`다. 같은 상점을 유지한 지점은 `reason`이 남고, 새 지점의 `reason`은 null이다. `spots`는 1개 이상이고, 확정된 코스는 `E409_COURSE_CONFIRMED`다.

| 프론트 동작 | 지금 | 백엔드로 흉내 | 차이 |
|---|---|---|---|
| 순서 바꾸기 G19 | `{ stopIds }` `features/courses/api.ts:30-35` | 지금 코스를 새 순서로 늘어놓은 배열 | `start_time`을 프론트가 계산해 보낸다. 슬롯 규칙은 `slotTimes()`(`features/courses/model.ts:50-60`). 계약 6절 7번은 서버가 다시 계산한다고 가정했다 |
| 한줄평 G20 | `{ description }` `:37-42` | 그 지점의 `comment`만 바꾼 배열 | 100자 상한(우리 목업은 상한 없음 `mocks/rules/courses.ts:113-129`) |
| 빼기 G21 | `DELETE` `:44-46` | 그 지점을 뺀 배열 | 마지막 1곳은 뺄 수 없다(우리는 빼고 확정에서 `COURSE_EMPTY` `mocks/rules/courses.ts:131-140`, `:153`) |
| 추가 #19 | `{ storeId }`, 서버가 끝에 넣고 시간을 다시 매긴다 | 끝에 `{ stop_type:"STORE", store_id }`를 붙인 배열 | 5곳 상한 · 같은 상점 중복은 프론트가 미리 막는다(명세에 없음) |
| 교체 #20 | `{ storeId }`, 자리 · 시간 유지, 한줄평 · 이유 비움 | 그 자리의 `store_id`만 바꾼 배열 | 새 지점이라 `reason`이 null이 되는 것은 같다 |
| 캠퍼스 지점 | 편집 UI 없음 | `campus_building_id`(`GET /campuses/{campusId}/places`) | 백엔드는 캠퍼스 지점 추가를 이 API로만 한다 |

모든 경우에 응답은 바뀐 코스이고(4-24 모양) 탐방 정보는 다시 붙인다. 두 화면에서 동시에 고치면 나중 요청이 앞 요청을 덮는다(전체 교체라서).

### 4-27. 코스 확정 (47행)

| 프론트 | 백엔드 `POST /tours/{tourId}/course/confirm` [C-03, S-04] | 차이 · 어댑터 |
|---|---|---|
| 응답 확정된 `Course` | `{ tour_id, status, coupon_count }` | 코스를 다시 읽고 `coupon_count`를 `issuedCouponCount`로 넣는다 |
| 제휴 0곳이면 쿠폰 0장으로 확정된다(`frontend-needs.md:430`, 완료 화면 분기 `CourseConfirmPage.tsx:218`) | `E422_PARTNER_REQUIRED` | **규칙 차이.** 새 코드 `COURSE_PARTNER_REQUIRED`. G08에서 `partnerStopCount === 0`이면 확정 버튼을 잠근다 |
| `COURSE_EMPTY` 409 | 없음(빈 코스는 PUT에서 이미 막힌다) | — |
| `COURSE_NOT_DRAFT` 409 | `E409_COURSE_CONFIRMED` | 코드 대응 |
| 쿠폰: 승인자 × 탐방 날짜에 유효한 제휴 지점, 당일 유효 | 승인자 × 제휴 지점, 6자리, 탐방 당일만 | 같다(계약 6절 9번의 답) |

### 4-28. 코스 상점 후보 (48행, 의미가 다름) — `CourseStoreCandidate`(계약 4절)

| 프론트 | 백엔드 `GET /stores/nearby` [S-02] | 차이 · 어댑터 |
|---|---|---|
| 경로가 탐방 기준 `/guide/tours/:id/course/store-candidates` | `?campus_id`(필수) `&category` | 탐방의 `campus_id`가 탐방 응답에 없다(4-14) |
| `storeId` · `name` · `category` · `address` · `lat` · `lng` | `store_id` · 같은 이름 | 이름 |
| `distanceM` | 없음 | 프론트가 캠퍼스 좌표(`GET /campuses`)와 상점 좌표로 계산할 수 있다 |
| `relatedIntent` · `matchedRequest` | 없음 | 학생 요청 줄(2B-R13)을 그릴 값이 없다. null로 둔다(화면은 null이면 줄을 뺀다) |
| `partnership { discount }` 또는 null | `is_partner` | 문구가 없다. 탐방 날짜 기준인지 명세에 없음 |
| `review { average, count, summary }` | `review_summary` | 평균 · 개수가 없다 |
| `dataSource` | 없음 | 프론트 상수 |
| 서버 정렬: 관련 업종 → 거리 → 이름(2B-R13) | "반경은 서버가 정합니다". 정렬은 명세에 없음 | 프론트가 거리순으로 정렬한다 |
| 배열 | `data.items` | 목록 도우미 |

### 4-29. 내 쿠폰 (49행) — `Coupon` `features/coupons/model.ts:8-24`

| 프론트 | 백엔드 `GET /users/me/coupons` [S-05] | 차이 · 어댑터 |
|---|---|---|
| 쿼리 `applicationId` | `tour_id` · `store_id` | 신청 id를 탐방 id로 바꿔 부른다(내 신청 목록에서) |
| `id` | `coupon_id` | 이름 |
| `code` · `status` | 같은 이름 | 같다 |
| `state` | 없음 | `computeCouponState`(`features/coupons/model.ts:47-55`)로. 쿠폰은 탐방 당일에만 유효하므로 [S-06] 탐방 날짜 = `valid_until`의 날짜 |
| `discount` | `discount_text` | 이름 |
| `storeId` · `storeName` | `store.store_id` · `store.name` | 중첩 |
| `storeCategory` | 없음 | 쿠폰 목록 머리 줄(`pages/student/CouponListPage.tsx:46`). 빼거나 요청 |
| `applicationId` | 없음 | 내 신청 목록에서 `tour_id`로 찾는다 |
| `tourId` | `tour_id` | 이름 |
| `tourTitle` · `tourStartsAt` | 없음 | `GET /tours/{id}` |
| `expiresAt` | `valid_until` | 이름 |
| `usedAt` | `used_at` | 이름 |
| `reviewWritten`(이 쿠폰 = 이 탐방 × 이 상점) | `reviewed`("리뷰를 이미 썼으면") | 쿠폰 단위인지 상점 단위인지 명세에 없음 |
| 배열(id 오름차순) | `data.items`, 정렬은 명세에 없음 | 어댑터가 정렬한다 |

### 4-30. 쿠폰 코드 확인 (51행) — `CouponLookup` `features/coupons/model.ts:26-35`

| 프론트 | 백엔드 `GET /coupons/{couponCode}` [S-06] | 차이 · 어댑터 |
|---|---|---|
| `code` | `code` | 같다 |
| `state` | 없음(`status` · `valid_until` · `tour_date`가 있다) | 어댑터가 계산한다 |
| `discount` | `discount_text` | 이름 |
| `storeName` | 없음 | 내 가게(`GET /users/me/store`) 이름 |
| `tourTitle` | 없음 | 확인 화면이 그린다(`pages/owner/CouponRedeemPage.tsx:182`). 요청하거나 뺀다 |
| `tourStartsAt` | `tour_date`(날짜만) | 화면은 날짜만 그린다. `${tour_date}T00:00:00+09:00` |
| `studentName` | 없음 | 화면에서 쓰지 않는다 |
| `usedAt` | 없음 | "이미 사용된 쿠폰 · 사용 시각" 카드(`features/coupons/model.ts:119-124`)가 쓴다. 요청 |
| (없음) | `coupon_id` · `status` · `valid_until` | — |
| `COUPON_NOT_FOUND` 404 · `COUPON_OTHER_STORE` 403 | `E404` · `E403_OTHER_STORE` | 이 호출에서 `E404`→`COUPON_NOT_FOUND` |

### 4-31. 쿠폰 사용 처리 (52행) — `RedeemResult` `features/coupons/model.ts:37-41`

| 프론트 | 백엔드 `POST /coupons/{couponCode}/redeem` [S-06] | 차이 · 어댑터 |
|---|---|---|
| `coupon: CouponLookup` | `{ coupon_id, status, used_at }` | 코드로 다시 확인해 채우고 `usedAt`은 응답 값 |
| `tourVisitorCount` | 없음 | "이번 탐방으로 온 학생 N명"(`CouponRedeemPage.tsx:228`). 요청하거나 줄을 뺀다 |
| `totalVisitorCount` | 없음 | 쓰는 곳 없음 |
| `COUPON_ALREADY_USED` 409 + `details.usedAt` | `E409_ALREADY_USED`(사용 시각 없음) | 시각 없이 "재사용 불가"만 보인다 |
| `COUPON_EXPIRED` 409 | `E410_EXPIRED`(410) | 이 호출에서 `COUPON_EXPIRED` |
| `COUPON_NOT_YET` 409(탐방 당일 전) | 명세에 없음("탐방 당일에만 쓸 수 있고"만 있다) | — |
| (없음) | `E409_DAILY_LIMIT`("같은 날 이 가게에서 이미 쿠폰이 사용 처리됐으면") | 새 코드 `COUPON_DAILY_LIMIT`. 손님별인지 가게 전체인지 모호하다(9절 4번) |

### 4-32. 가게 검색 (53행) — `OwnerStoreCandidate`(계약 4절)

| 프론트 | 백엔드 `GET /stores/search` [S-01] | 차이 · 어댑터 |
|---|---|---|
| `q` 선택. 없으면 사업자 정보로 대조한 후보(결정 2) | `keyword` **필수** 2자 이상 | 검색어 없는 후보 목록이 없다 |
| `q` 50자 상한 | 명세에 없음 | — |
| `storeId` · `name` · `address` · `category` | `store_id` · 같은 이름 | 이름 |
| `linkable` | `is_registered` | 반대 뜻(`linkable = !is_registered`) |
| 이름순 최대 20개 | 페이지 봉투, 정렬은 명세에 없음 | — |
| `BIZ_NOT_VERIFIED` 403 | 명세에 없음(검색은 인증 조건이 없다) | — |

### 4-33. 가게 연결 · 직접 등록 (54 · 55행) — `MyStore` · `StoreRegistrationInput`

| 프론트 | 백엔드 `POST /users/me/store` [S-01] | 차이 · 어댑터 |
|---|---|---|
| 연결 `POST /owner/store/link {storeId}`, 등록 `POST /owner/store {...}` | 한 경로. `store_id`가 있으면 연결, 없으면 직접 입력 | 경로 둘이 하나로 |
| 등록 `name` · `address` · `category` | 같은 이름 | 같다 |
| 등록 `lat?` · `lng?`(서버가 지오코딩하면 생략) | `latitude` · `longitude` **필수** | 이름 · 필수. 프론트가 카카오 지오코더로 좌표를 구한다(계약 6절 6번의 답) |
| 응답 `MyStore`(제휴 포함) | `{ store_id, name, address, category }` | 내 가게를 다시 읽는다 |
| `STORE_ALREADY_LINKED` · `STORE_LIMIT` 409 | `E409_STORE_UNAVAILABLE` 하나 | 둘을 가를 수 없다. 한 문구로 합친다 |
| `BIZ_NOT_VERIFIED` 403 | `E403_VERIFICATION_REQUIRED`(BE 공통규칙 › 권한 요약) | 이 호출에서 `BIZ_NOT_VERIFIED` |
| `ADDRESS_NOT_FOUND` 400 | 없음 | 지오코더 실패를 프론트가 같은 코드로 보인다 |

### 4-34. 내 가게 (56행) — `MyStore` · `Partnership` `features/stores/model.ts:6-25`

| 프론트 | 백엔드 `GET /users/me/store` [S-01 보완] | 차이 · 어댑터 |
|---|---|---|
| `id` | `store_id` | 이름 |
| `name` · `address` · `category` | 같은 이름 | 같다 |
| `partnership.id` | 없음 | 쓰는 곳 없음. 0 |
| `partnership.discount` | `partnership.discount_text` | 이름 |
| `partnership.condition` | 없음 | null |
| `partnership.startDate` · `endDate` | `start_date` · `end_date` | 이름 |
| `partnership.state` | 없음 | `computePartnershipState`(`features/stores/model.ts:31-39`)로 |
| 가게 없음 `STORE_NOT_LINKED` 404 → null(`features/stores/api.ts:9`가 코드를 본다) | `E404` | 이 호출에서 `E404`→`STORE_NOT_LINKED` |

### 4-35. 제휴 설정 (58행) — `PartnershipInput`

| 프론트 | 백엔드 `PUT /users/me/store/partnership` [S-03] | 차이 · 어댑터 |
|---|---|---|
| `discount` | `discount_text` 50자 | 이름 |
| `condition` | 없음 | 저장할 곳이 없다(계약 6절 32번) |
| `startDate` · `endDate` | `start_date` · `end_date`(시작 이후) | 이름 |
| 응답 `MyStore` | `{ discount_text, start_date, end_date }` | 내 가게를 다시 읽는다 |
| `PARTNERSHIP_PERIOD_INVALID` 400 + `fieldErrors.endDate` | 오류 예시 없음(공통 `E400` + `errors`로 본다) | `end_date`를 `endDate`로 |
| 제휴 id 유지(쿠폰이 가리킨다) | 명세에 없음("없으면 만들고 있으면 덮어씁니다") | — |

### 4-36. 리뷰 작성 (60행) — `CreateReviewInput` · `MyReview`(계약 4절)

| 프론트 | 백엔드 `POST /stores/{storeId}/reviews` [R-01] | 차이 · 어댑터 |
|---|---|---|
| 경로 `/reviews` | 경로에 상점 id | 쿠폰의 `storeId`를 경로에 넣는다 |
| `couponId` · `rating` · `content` | `coupon_id` · `rating` 1~5 · `content` 100자 | 이름. 최소 길이(우리 5자)는 명세에 없음 |
| 응답 `{ id, couponId, tourId, storeId, rating, content, createdAt }` | `{ review_id, store_id, rating, content, created_at }` | 쿠폰 · 탐방 id는 요청 값으로 채운다 |
| 요약(R-03)을 저장 요청 안에서 갱신, 30초 대기 | "저장 후 서버가 … 요약을 갱신합니다(응답과 별개)" | 착지 화면에서 새 요약이 바로 안 보일 수 있다(2B-R14) |
| `REVIEW_NOT_ALLOWED` 403 · `REVIEW_DUPLICATE` 409 · `NOT_FOUND` 404 | `E403_COUPON_NOT_USED` · `E409_ALREADY_REVIEWED` · 공통 `E404` | 코드 대응 |

### 4-37. 오류 코드 대응표

"이 호출에서"라고 적은 것은 같은 백엔드 코드가 호출마다 다른 `ErrorCode`가 되므로 `errorMap`으로 덮어써야 한다는 뜻이다.

| 백엔드 코드 | 기본 `ErrorCode` | 호출별 덮어쓰기 |
|---|---|---|
| `E400` | `VALIDATION`(+ `errors` → `fieldErrors`) | 사업자 인증의 422와 혼동하지 않는다 |
| `E401` | `UNAUTHORIZED` | — |
| `E401_INVALID_CREDENTIALS` | `INVALID_CREDENTIALS` | — |
| `E403` | `FORBIDDEN` | — |
| `E403_VERIFICATION_REQUIRED` | `NOT_VERIFIED` | 신청: `Me.guardianStatus`가 AGREED가 아니면 `GUARDIAN_NOT_AGREED`. 가게 연결: `BIZ_NOT_VERIFIED` |
| `E403_OTHER_STORE` | `COUPON_OTHER_STORE` | — |
| `E403_COUPON_NOT_USED` | `REVIEW_NOT_ALLOWED` | — |
| `E404` | `NOT_FOUND` | 쿠폰 확인 · 사용: `COUPON_NOT_FOUND`. 내 가게: `STORE_NOT_LINKED`. 보호자 링크: `CONSENT_LINK_INVALID` |
| `E409` | `ALREADY_PROCESSED` | 가입: `EMAIL_DUPLICATE` + `fieldErrors.email` |
| `E409_TOUR_FULL` | `TOUR_CLOSED` | 신청: 탐방이 RECRUITING이 아니면 `TOUR_NOT_RECRUITING`. 승인: `CAPACITY_EXCEEDED` |
| `E409_ALREADY_APPLIED` | `DUPLICATE_APPLICATION` | — |
| `E409_ALREADY_PROCESSED` | `ALREADY_PROCESSED` | — |
| `E409_INVALID_APPLICATION_STATUS` | `ALREADY_PROCESSED` | 대기 · 승인 신청이면 `CANCEL_AFTER_TOUR_DATE` |
| `E409_INVALID_TOUR_STATUS` | `ALREADY_PROCESSED` | 완료: 탐방이 COMPLETED면 `TOUR_ALREADY_COMPLETED`, 모집 중 · 마감이면 `COMPLETE_BEFORE_TOUR_DATE`. 취소: COMPLETED면 `TOUR_ALREADY_COMPLETED` |
| `E409_GUIDE_PROFILE_REQUIRED` | `GUIDE_PROFILE_REQUIRED` | — |
| `E409_NO_APPROVED_APPLICANT` | `NO_APPROVED_APPLICANTS` | — |
| `E409_COURSE_CONFIRMED` | `COURSE_NOT_DRAFT` | — |
| `E409_COURSE_NOT_READY` | `COURSE_NOT_READY` | — |
| `E409_ALREADY_USED` | `COUPON_ALREADY_USED` | — |
| `E409_DAILY_LIMIT` | `COUPON_DAILY_LIMIT`(새) | — |
| `E409_ALREADY_SUBMITTED` | `ALREADY_PROCESSED` | — |
| `E409_CONSENT_EXISTS` | `ALREADY_PROCESSED` | — |
| `E409_ALREADY_REVIEWED` | `ALREADY_PROCESSED` | 리뷰 작성: `REVIEW_DUPLICATE` |
| `E409_STORE_UNAVAILABLE` | `STORE_ALREADY_LINKED` | — |
| `E410_EXPIRED` | `COUPON_EXPIRED` | 보호자 링크: `CONSENT_LINK_EXPIRED` |
| `E422_BUSINESS_INVALID` | `BIZ_MISMATCH` | `errors[0].reason === 'CLOSED'`면 `BIZ_CLOSED` |
| `E422_PARTNER_REQUIRED` | `COURSE_PARTNER_REQUIRED`(새) | — |
| `E502_AI_FAILED` | `AI_FAILED`(새) | — |
| `E500` · 모르는 코드 | `UNKNOWN` | — |

백엔드에 짝이 없는 프론트 코드: `REAPPLY_AFTER_REJECT` · `COUPON_NOT_YET` · `COURSE_STOP_DUPLICATE` · `COURSE_STOP_LIMIT`(프론트가 미리 막는다) · `COURSE_EMPTY` · `FILE_TYPE` · `FILE_TOO_LARGE`(413만 남는다) · `OUTSIDE_VACATION` · `ADDRESS_NOT_FOUND`(지오코더 실패에 쓴다) · `PARTNERSHIP_PERIOD_INVALID` · `STORE_LIMIT`.

---

## 5. 백엔드에 없는데 프론트가 필요한 것

"흉내"는 프론트(어댑터)가 다른 호출을 묶거나 계산해서 같은 결과를 만드는 것이다.

| 필요한 것 | 영향 | 선택지 | 권장 |
|---|---|---|---|
| **AI 추천 + 추천 이유**(G6, 21행) | 시연 첫 장면(홈 → 추천 목록). 추천 이유 `RecommendationsPage.tsx:151`, 헤드라인 `:89`, 대체 목록 `:77`, 학교 칩 `filterChips.ts:20`, `:27` | 요청: `POST /tour-wishes` 응답에 `recommendations{headline, keywords, fallback, items[{tour_id, reason}]}`. 흉내: 희망을 저장하고 `GET /tours`로 거른 뒤 이유 없이 보인다(대체 목록은 학과 → 학교 순으로 조건을 풀어 다시 부른다). 빼기: AI 배지와 이유 줄 숨김 | 요청하고, 오지 않으면 흉내로 대체한다. 목업은 확장 필드로 지금 추천을 그대로 준다. 이유를 프론트가 지어내 "AI"로 보이지는 않는다 |
| 추천 입력 필수값(campus_id · major) | 홈은 문장 하나만 받는다 `HomePage.tsx:27` | 요청: 둘을 선택으로. 흉내: 홈에 학교 · 학과 칸을 다시 넣는다 | 요청. 안 되면 시연 계정 프로필(관심 학과)과 학교 칩을 기본값으로 채운다 |
| **시연 초기화 · 체크포인트 · 오늘 날짜 시드**(G29) | 원클릭 링크 `reset=1`, 패널 초기화 `demo/resetDemo.ts:14-30`, `CONFIRMED`부터 시작 | 요청(계약 6절 11 · 12번 그대로). 흉내 불가(서버 데이터) | 요청. 안 되면 실서버 시연은 하지 않고 목업으로 시연한다 |
| 시연 계정 시드(이메일 · 공통 비밀번호 · 가게 1~4 ↔ 사장님) | 빠른 로그인 · 사장님 전환 `shared/config/demoAccounts.ts:3-40` | 요청(계약 6절 13번) | 요청 |
| 헬스(G28) | 시연 패널 연결 표시 `DemoPanel.tsx:406-417` | 요청. 흉내: 토큰 없이 되는 `GET /campuses`로 대신 | 흉내 |
| 방학 상권 인사이트(G5) | 추천 · 코스 편집 카드 `CourseEditPage.tsx:252`. 지금도 자리 값이다 `mocks/handlers/campuses.ts:11-13` | 요청. 흉내: 프론트 상수 | 프론트 상수(`예시` 배지 유지) |
| 신청 단건(G11) | 신청 완료 · 내 탐방 상세 | 흉내: `GET /users/me/tours`에서 찾고 `GET /tours/{id}`로 합성 | 흉내 |
| 쿠폰 단건(G25) | 쿠폰 상세 | 흉내: 목록에서 `coupon_id`로 찾는다 | 흉내 |
| 지점 단위 코스 편집(G19~G21, #19 · #20) | 코스 편집 · 상점 선택 | 흉내: 전체 스팟 배열 빌더(4-26) | 흉내(백엔드 설계가 그렇다) |
| AI 코스 다시 만들기 | — | 백엔드 `POST /tours/{tourId}/course`가 초안을 바꿔 만든다 [C-01] | 공백 아님 |
| 코스 지점 id · 제휴 문구 · 리뷰 평균/개수 · 출처 | 코스 지도 시트, 제휴 칩, 확정 점검 | 요청(`spot_id`, `discount_text`, `review_average`, `review_count`). 흉내: id는 `order`, 리뷰는 상점마다 `GET /stores/{id}/reviews`, 출처는 상수. 제휴 문구는 흉내 불가 | 요청 + 부분 흉내 |
| 코스 조회의 발급 쿠폰 수 | G08 완료 상태 `CourseConfirmPage.tsx:179-218` | 요청. 흉내: 승인 수 × 제휴 지점 수 | 요청 + 흉내 |
| 탐방 제목 · `campus_id` | 모든 목록의 제목, 학교 칩, 인사이트, 주변 상점의 `campus_id` | 요청. 흉내: 파생 제목, 캠퍼스 이름 조인 | 요청 + 흉내 |
| 내 탐방 · 가이드 탐방 표시 값(시작 시각, 하고 싶은 것, 쿠폰 수, 취소 가능, 초안 여부) | 내 탐방 목록 · 가이드 홈 · 코스 경로 `coursePathFor` | 요청(`course_status` 등). 흉내: 탐방마다 `GET /tours/{id}`, 코스마다 `GET /tours/{id}/course` | 흉내(시연 규모라 몇 번 더 불러도 된다) + 요청 |
| 쿠폰 화면 표시 값(`state`, 업종, 탐방 제목, 사용 시각, 방문 수) | 쿠폰 목록 · 상세 · 사장님 확인 · 사용 처리 | 요청. 흉내: `state`는 계산, 가게 이름은 내 가게, 탐방은 `GET /tours/{id}`. 방문 수는 흉내 불가 | 흉내 + 사용 시각 · 방문 수 요청 |
| 서버 계산 플래그(취소 가능, 가이드 완료 · 취소 가능, 제휴 state) | 버튼 활성, 칩 | 흉내: 어댑터 계산 | 흉내 |
| 상점 후보 #18의 거리 · 관련 의도 · 학생 요청 · 제휴 문구 | G07 카드 | 요청. 흉내: 거리는 좌표로 계산, 나머지는 null | 흉내 + 요청 |
| 가게 후보(검색어 없음)와 사업자 대조(#22 · #23) | O05 첫 화면 | 흉내 불가. 빼기: 검색만 | 검색만 |
| 인증 진행 집계 #4 + `demoConsentToken` | `/verify` 미리 채움 · 만료 시각, 같은 탭 보호자 동의 시연(2B-R8) | 요청. 흉내: `GET /users/me`의 상태만 | 상태만 + 시연 토큰은 개발 환경 한정으로 요청 |
| 가이드 탐방 상세 #15 | 완료 · 취소 화면 | 흉내: `GET /tours/{id}` + `GET /users/me/tours` + 코스 | 흉내 |
| 운영자 처리 내역 · 이메일 · 처리 시각 · 반려 사유 | A01 `처리 완료` 탭 | 요청. 빼기: 탭 숨김 | 요청, 안 되면 탭 숨김 |
| 탐방 개설 제목 | V2 G04 | 요청. 빼기: 칸 숨김(파생 제목) | 요청 |
| 제휴 할인 조건(`condition`) | O06 두 번째 칸 | 요청. 화면에서만 받고 저장하지 않기 | 요청, 안 되면 저장하지 않는다 |
| 비로그인 둘러보기 | 홈 · 추천 · 상세 | 요청. 로그인 가드로 옮기기 | 요청. 시연 영향 없음 |
| 오류 사유 세분 | 안내 문구 | 요청. 흉내: 4-37 호출별 대응 | 흉내 + 요청 |
| AI 초안의 캠퍼스 지점 | 코스에 캠퍼스 지점이 사라진다 | 요청. 흉내: 장소 API로 가이드가 넣기(UI 없음) | 요청(낮음) |
| 코스 `criteria` · `interests` · `confirmedAt` | 편집 기준 카드 `CourseEditPage.tsx:250` | 흉내: 프론트 상수 | 상수 |

---

## 6. 프론트에 없는데 백엔드가 주는 것

| 백엔드 | 내용 | 쓸 곳 · 우리가 만든 것을 대신할 수 있나 |
|---|---|---|
| `GET /stores/{storeId}/reviews` [R-02] | 요약 · 평균 · 개수 · 리뷰 목록(작성자 가림), 페이지 | **대신할 수 있다.** 2B T22는 `CourseStop.review.recent`를 코스 응답에 끼워 넣으려 했다. 상점 시트를 열 때 이 API를 지연 조회하면 된다. 평균 · 개수 공백(4-24)도 같이 메운다 |
| `GET /campuses` [D-01] | 5개교 기준 정보 · 방학 기간 | `/universities`를 대신한다(18행) |
| `GET /campuses/{campusId}/places` [C-02 보완] | 캠퍼스 건물 · 장소와 좌표 | 코스에 캠퍼스 지점을 넣는 UI가 없다. G07에 "캠퍼스 장소" 탭을 더하면 실서버 초안(STORE만)의 빈자리를 채운다(P1 밖) |
| `GET /users/me/tour-wishes` · `PATCH /users/me/tour-wishes/{wishId}` [T-01 보완] | 내 희망 사항 목록 · 수정 | 기기에 저장하는 마지막 검색(`features/tours/lastQuery.ts`)을 대신할 수 있다. 화면은 없다(P2) |
| `GET /tour-wishes` [T-01 보완] | 대학생이 보는 고교생 희망 사항(학교 · 학과별 원문) | 가이드 홈이나 탐방 개설(G04)에 "고교생이 원하는 것" 카드를 둘 수 있다. 수요 기반 개설이라 심사 설명에 좋다. 지금 화면은 없다 |
| `PATCH /users/me/store` [S-01] | 가게 정보 수정 | 내 가게 화면에 수정 동선이 없다(P2) |
| `GET /users/me/store/report` [S-07] | 기간 안 방문 수 · 리뷰 수 · 평균 별점 | `/owner/report` 자리 화면(2B-R19)을 대신할 수 있다. 필드는 아직 미확정이다 |
| 탐방 상세 `guide.major`, 보호자 안내 `school_name` · `guide_text` | 표시 값 | 보호자 동의 화면에 서비스 안내 문구를 서버 값으로 쓸 수 있다 |
| 신청자 `created_at`, 결정 응답 `tour_status` | — | 정렬 · 마감 표시를 서버 값으로 맞출 수 있다 |
| `E502_AI_FAILED` | AI 실패를 따로 알린다 | 초안 실패 안내를 일반 오류와 나눌 수 있다 |
| 주변 상점 `category` 거르기 | 업종 필터 | G07 검색칸의 업종 필터를 서버에 맡길 수 있다 |

---

## 7. 적용 방식 제안

### 7-1. 세 가지 안

| | (a) 어댑터 + 목업이 백엔드를 **정확히** 흉내 | (b) 프론트 타입을 백엔드 모양으로 | (c) 혼합 — 권장 |
|---|---|---|---|
| 도메인 타입 · 화면 | 그대로 | 거의 전부 고친다(2A 화면 · 컴포넌트 · 테스트) | 그대로 |
| `features/*/api.ts` | 백엔드 경로 + 어댑터 | 백엔드 DTO를 그대로 돌려준다 | 백엔드 경로 + 어댑터(확장 필드가 있으면 쓰고, 없으면 대체) |
| 목업(MSW) | 백엔드 와이어만 낸다 | 같다 | 백엔드 와이어 + **선택 확장 필드 · 확장 엔드포인트**(추천 결과, 지점 id · 제휴 문구, 쿠폰 사용 시각 · 방문 수, `/demo/reset`, `/health` …) |
| 백엔드에 없는 기능 | 목업에서도 사라진다. 추천 이유 · 방문 수 등 시연 장면이 줄어든다 | 같다 | 목업 시연은 지금 그대로. 실서버에서만 대체 경로를 탄다 |
| 비용 | L(공통 + 7개 도메인 + 테스트) | XL(L + 화면 전체) | L + 확장 필드(작다) |
| 위험 | 시연 품질 저하. 목업 시연이 지금과 달라진다 | 동결된 골든 패스 회귀가 크다. 일정을 넘긴다 | 대체 경로는 실서버에서만 돈다. 명세 예시 픽스처로 계약 테스트를 해서 덮는다 |
| 명세가 또 바뀌면 | 어댑터 · 목업만 | 화면까지 | 어댑터 · 목업만 |

참고로 (a′) "목업은 지금 계약 그대로 두고 실서버 모드에서만 어댑터"는 비용이 가장 작다(M~L). 대신 어댑터가 백엔드가 뜨기 전까지 브라우저에서 한 번도 돌지 않는다. 와이어 형식도 두 벌이 된다. 일정이 무너질 때 쓰는 비상안으로만 남긴다.

### 7-2. 권장안 (c)의 구조

```
페이지 → features/*/queries.ts (변경 없음)
       → features/*/api.ts      백엔드 경로 · 요청 본문 · 여러 호출 합성 · 코스 PUT 빌더
       → features/*/wire.ts     Wire* 타입(명세 필드의 camel판, 확장 필드는 선택) + fromWire* 순수 함수
       → shared/lib/http.ts     봉투 벗기기 · 키 변환(요청 snake, 응답 camel) · 오류 변환(errorMap) · listAll
목업:  rules/* (그대로, 내부 ErrorCode를 던진다)
       → rules/views.ts        toWire* (백엔드 모양 + 확장 필드)
       → handlers/*            백엔드 경로, ok(data) · fail() 봉투, ErrorCode → E코드 역표
```

- **키 변환은 클라이언트 한 곳에서** 한다(일반 객체 · 배열만, FormData · 쿼리 문자열은 손으로). 그러면 `Wire*` 타입을 camel로 적을 수 있고, 어댑터는 이름이 실제로 다른 것(`wish`→`motivation` 등)만 옮긴다.
- **오류**: `ApiError.code`는 계속 `ErrorCode`다. 오류 표시를 맡은 화면 · 훅(`couponNotice` 등)은 고치지 않는다. `backendCode`를 더하고 4-37 표를 기본값으로 쓰며, 모호한 코드만 호출에서 덮어쓴다.
- **목업 규칙은 건드리지 않는다.** 규칙은 지금처럼 `MockApiError(…, 'TOUR_CLOSED')`를 던진다. 핸들러 경계의 역표가 `E409_TOUR_FULL`로 바꾼다. 클라이언트가 다시 `TOUR_CLOSED`로 돌려놓으므로 `ApiError.code`를 보는 테스트는 대부분 그대로 통과한다.
- **확장 필드 규칙**: 목업이 내는 확장 필드는 9절에서 백엔드에 요청하는 필드와 같은 이름(snake)이다. 목업이 곧 "요청안"이 된다. 어댑터는 `wire.x ?? 대체값` 꼴로만 쓴다. 모드(`mock`/`real`)를 보고 분기하지 않는다.
- **전환 기간**: `http.ts`는 봉투가 있을 때만 벗기고(`timestamp` · `data` 키), 오류 본문도 옛 모양(`fieldErrors`)과 새 모양(`errors[]`)을 다 받는다. 마지막 도메인을 바꾼 뒤 옛 분기를 지운다.

### 7-3. 동결된 골든 패스와 시연을 지키는 법

1. **도메인 하나 = 커밋 하나.** 바꿀 때마다 전역 검증 명령(`npm run test:run && npm run typecheck && npm run lint && npm run build && npm run e2e`)을 돌린다. 골든 패스 2변형 · 발표 모드 · 무대 9개가 매번 통과해야 커밋한다. 화면과 도메인 타입이 그대로라 실패하면 어댑터나 목업 와이어의 잘못이다.
2. **목업 시연은 지금과 똑같다.** 확장 필드 덕분에 목업은 추천 이유 · 지점 제휴 문구 · 방문 수를 계속 준다. 무대 스크린샷(`test-results/stage-*.png`)을 바꾸기 전과 비교한다.
3. **시연은 목업으로 할 수 있어야 한다.** 배포 기본값은 `VITE_API_MODE=mock`으로 둔다. 실서버 시연은 `?demo=1&mode=real`로 리허설에서 확인된 뒤에만 쓴다. 실서버에 `/demo/reset`이 없으면 패널은 초기화 버튼을 잠그고 사유를 보인다(실서버 초기화 없음).
4. **전환 전에 태그**를 하나 둔다(예 `demo-safe-2a`). 문제가 생기면 그 커밋으로 목업 빌드를 다시 배포할 수 있다(푸시는 매번 확인, 11/15 15:30 이후 푸시 금지).
5. **마감선**: 11/12까지 백엔드가 골든 패스 엔드포인트를 배포하지 못하면 실서버 연동은 멈추고 목업 시연을 다듬는다. 어댑터는 남겨 둔다.

### 7-4. `VITE_MOCK_DOMAINS` · 부분 목업

- 목업과 실서버가 같은 와이어를 쓰므로 HTTP 수준에서는 섞어도 된다. 워커는 고르지 않은 요청을 그대로 네트워크로 보낸다(`mocks/browser.ts:16`).
- 그러나 **데이터는 섞이지 않는다.** 목업 토큰은 실서버에서 무효이고 탐방 · 신청 id도 다르다. 그래서 의미 있는 조합은 두 가지뿐이다. ① `all`(전부 목업) ② 실서버 + **확장 엔드포인트만 목업**(`/health`, 인사이트). 실서버와 함께 `/demo/reset`을 목업하면 목업 DB만 지워지므로 쓰면 안 된다.
- 도메인 → 경로 묶음은 백엔드 경로로 다시 짠다. 예를 들어 `/users/me/*`가 auth · applications · coupons · stores에 흩어진다. 제안: auth(`/auth/*`, `GET`·`PATCH /users/me`, `/users/me/guide-profile`) · verification(`/verifications/enrollment`, `/guardian-consents*`) · admin(`/admin/*`) · campuses(`/campuses*`) · tours(`GET /tours`, `GET /tours/{id}`, `/tour-wishes`, `/users/me/tour-wishes*`) · applications(`POST /tours`, `/tours/{id}/cancel`·`complete`·`applications`, `/applications/*`, `/users/me/tours`) · courses(`/tours/{id}/course*`) · coupons(`/users/me/coupons`, `/coupons/*`) · stores(`/stores/search`, `/stores/nearby`, `/users/me/store*`, `/verifications/business`) · reviews(`/stores/{id}/reviews`) · demo(`/demo/reset`, `/health`, 인사이트).
- `quickLogin`의 비밀번호 선택(`demo/quickLogin.ts:31-38`)은 "auth가 목업인가"를 보므로 그대로 맞다.

### 7-5. `mode=real`은 어디에 사는가

- 지금처럼 **부트스트랩에만** 있다. 우선순위는 URL `?mode=` > 시연 패널 저장값 > `VITE_API_MODE`(`shared/config/env.ts:56-72`, `demo/demoParams.ts:46`, `:63`)이고, `main.tsx:30-43`이 목업 워커를 켤지만 정한다.
- `features/**`는 모드를 모른다. 어댑터는 응답에 확장 필드가 **있는지**만 본다. 이렇게 하면 실서버가 확장 필드를 나중에 추가해도 코드를 바꿀 필요가 없다.
- 예외는 시연 계층뿐이다. 패널은 `useBootStatus().apiMode`로 "실서버" 표시를 하고(`DemoPanel.tsx:201-206`), 초기화 · 헬스가 404면 그 사실을 보인다.

### 7-6. 테스트 전략

1. **어댑터 계약 테스트(새로)**: `src/test/fixtures/backend/*.json`에 `backend-spec.md`의 응답 예시를 **그대로** 옮긴다(성공 · 오류 예시 모두). `fromWire*`에 넣어 기대하는 도메인 객체와 비교한다. 같은 엔드포인트에 대해 "명세 그대로"(대체 경로)와 "확장 포함"(목업 경로) 두 픽스처를 둔다. 오류 예시마다 4-37 대응을 단언한다.
2. **와이어 일치 테스트**: 목업 핸들러가 내는 본문을 `Wire*` 스키마(zod)로 검사한다. 확장 필드는 선택이고 그 밖의 키가 끼면 실패한다. 목업이 백엔드 명세에서 멀어지는 것을 막는다.
3. **레지스트리 테스트**: `CONTRACT`(29) · `P1_CONTRACT`(`mocks/registry.test.ts:5-43`)를 `BACKEND_CONTRACT`(명세 46개 메서드 · 경로) + `EXTENSIONS`(`/demo/reset`, `/health`, 인사이트)로 바꾼다. 등록 핸들러가 이 합집합과 같다고 단언한다.
4. **핸들러 테스트**: `mocks/handlers/handlers.test.ts`(약 60곳)는 `request<도메인타입>(옛 경로)`로 부른다. 이것을 `features/*/api` 함수 호출로 바꾼다. 그러면 목업 + 어댑터를 끝까지 같이 시험하게 된다.
5. **화면 테스트**: `server.use` 덮어쓰기 49곳(17파일)이 옛 경로 · 옛 모양을 쓴다. `wireOk(data)` · `wireFail(code)` 도우미로 바꾼다.
6. **E2E**: 골든 패스 · 무대 · 발표 모드는 바꾸지 않는다(UI 수준). 백엔드가 뜨면 `e2e/real-smoke.spec.ts`(환경 변수로 켬)로 로그인 → 탐방 상세 → 내 정보만 실서버에 대 본다.

### 7-7. 작업 나누기 (S ≈ 2시간 이하, M ≈ 반나절, L ≈ 하루)

| 순서 | 작업 | 크기 | 내용 |
|---|---|---|---|
| 0 | 백엔드에 질문 · 요청 보내기 | S(사람) | 9절 1~18번을 먼저 |
| 1 | 공통 계층 | M | `http.ts` 봉투 · 키 변환 · `errorMap` · `listAll` · 전환기 두 모양 수용, `ApiError.backendCode`, 새 `ErrorCode` 3개, 테스트 |
| 2 | 프록시 | S | `vite.config.ts` `rewrite`로 `/api` 떼기, 백엔드 주소가 오면 `vercel.json`에 `/api/(.*)` rewrite |
| 3 | 목업 공통 | M | `ok()` · `fail()`, ErrorCode → E코드 역표, `BACKEND_CONTRACT` · `EXTENSIONS` 레지스트리, 와이어 스키마 틀, `wireOk` 도우미 |
| 4 | campuses | S | D-01 어댑터, 인사이트는 확장(또는 상수) |
| 5 | auth | M | 로그인 합성(`/users/me`, 사장님 가게), `Me` 어댑터, 가입 · `PATCH /users/me` · 가이드 프로필, **T4 재작업 포함**(8절) |
| 6 | tours | L | 목록 · 상세 어댑터(제목 · 캠퍼스 조인), 추천 = `POST /tour-wishes` + 확장 `recommendations` + `GET /tours` 대체 |
| 7 | applications | L | 신청 · 취소 · 결정, `/users/me/tours` 두 모양, 신청 단건 · 신청자 보드 · 가이드 탐방 합성 |
| 8 | courses | L | 코스 어댑터, 스팟 PUT 빌더(순서 · 한줄평 · 빼기), 확정 + 422, 초안 502 |
| 9 | coupons | M | 내 쿠폰 · 단건 흉내 · 확인 · 사용 처리, `state` 계산, 하루 한 장 코드 |
| 10 | stores | S | 내 가게 어댑터, `E404` → `STORE_NOT_LINKED` |
| 11 | demo | S | `/demo/reset` · `/health` 확장, 실서버에서 없을 때의 패널 처리 |
| 12 | 테스트 정리 | M | 핸들러 테스트를 api 함수 경유로, `server.use` 49곳, 명세 예시 픽스처(4~11과 함께 나눠서 해도 된다) |
| 13 | 문서 | S | `frontend-needs.md` 머리에 "백엔드 명세로 대체, 이 문서 참고", 진척표 API 연동표를 백엔드 경로로 |

합계는 대략 S 6개 + M 4개 + L 3개, 에이전트 시간으로 4~5일이다. 11/15까지 2B 19개 태스크를 모두 함께 할 수는 없다. 그래서 순서는 1 → 2 → 3 → 골든 패스 도메인(4~11) → 2B 재개(백엔드 와이어 위에서, 8절대로 줄여서)로 제안한다.

---

## 8. 2B 계획에 미치는 영향

판정: **영향 없음** · **경로 · 모양 변경**(어댑터와 목업 와이어만 바뀐다) · **공백으로 막히거나 바뀜**(백엔드에 없는 것 때문에 화면 범위가 바뀐다).

| 태스크 | 판정 | 내용 |
|---|---|---|
| T5 인증 API #4~#9 · `features/verification` | 공백으로 바뀜 | #4가 없어 `VerificationOverview`를 `GET /users/me` 상태로만 만든다. 보호자 이름 · 이메일 미리 채움, 만료 · 제출 시각, `demoConsentToken`이 빠진다. #5는 `campus_id` · `school_name`, 학년 없음, jpg · png 5MB. #8 · #9는 `PATCH {agree}`. 대기 중 재요청 불가 |
| T6 `/signup` | 경로 · 모양 변경 | 화면은 그대로. 이름 20자 · 비밀번호 영문+숫자 검증을 맞춘다 |
| T7 `/consent/:token` | 경로 · 모양 변경 | 학년 · 처리 시각 줄을 빼고 `school_name` · `guide_text`를 쓴다. 처리된 링크를 열 때의 응답은 9절에서 확인한다 |
| T8 `/verify` | 공백으로 막힘 | 2B-R8 같은 탭 보호자 동의 시연은 `demoConsentToken`이 없으면 실서버에서 안 된다(목업은 된다). 학년은 `PATCH /users/me`로 따로 저장한다 |
| T9 고교생 MY · 내 정보 수정 · 설정 | 경로 · 모양 변경 | `PATCH /users/me`, 길이 20 · 50 · 30. 알림 설정은 기기 저장 그대로 |
| T10 가이드 재학 인증 · 프로필 · MY | 경로 · 모양 변경 | `campus_id`, 소개 필수 200자. `guideProfile.universityId`가 없다(인증 학교 표시는 `school_name`) |
| T11 운영자 심사 API #10~#13 | 공백으로 바뀜 | `PATCH {decision}`, 페이지 봉투. 처리 내역 필터 · 이메일 · 처리 시각 · 반려 사유가 없다 |
| T12 운영자 심사 화면 | 공백으로 바뀜 | `처리 완료` 탭은 백엔드 답에 달렸다. 안 되면 대기 목록 · 상세 · 반려만 만든다 |
| T13 탐방 생애 API #14~#17 | 공백으로 바뀜 | 제목 없음, 연락 링크 필수, 정원 1~10, 소개 300자. #15를 합성하고 `cancellable` · `completable`을 계산한다. 완료 · 취소 경로 변경, 오류 코드가 하나로 합쳐진다 |
| T14 탐방 개설 · 완료 · 취소 화면 | 공백으로 바뀜 | G04 탐방 이름 칸은 백엔드 답에 달렸다. 연락 링크를 필수로, 정원 상한을 다시 정한다. 완료 당일 규칙은 확인이 필요하다 |
| T15 가이드 확정 코스 보기 | 경로 · 모양 변경 | 코스 어댑터를 따라간다. 시트의 `제휴 혜택 · {discount}`는 제휴 문구 공백에 달렸다 |
| T16 주변 상점 API #18~#20 · `StoreReviewSummary` | 공백으로 바뀜 | #18 → `GET /stores/nearby` + 프론트 거리 계산, `relatedIntent` · `matchedRequest`는 null. #19 · #20은 스팟 PUT 빌더. 5곳 상한 · 중복은 프론트가 막는다 |
| T17 코스 상점 선택(G07) | 공백으로 바뀜 | `학생 요청:` 줄이 실서버에서는 비어 있다. 정렬은 프론트 거리순. 진입점 · 교체 시트는 그대로 |
| T18 리뷰 API #21 | 경로 · 모양 변경 | `POST /stores/{storeId}/reviews`, 내용 100자, 코드 대응 |
| T19 방문 리뷰 작성 화면 | 경로 · 모양 변경 | 요약 갱신이 응답과 별개라 착지 화면(2B-R14)에서 새 요약이 늦게 보일 수 있다. 착지 뒤 한 번 다시 부르기를 더한다 |
| T20 사장님 API #22~#25 · #27 | 공백으로 바뀜 | #22에 후보가 없다. #23은 검색어 필수. #24 · #25는 한 경로이고 직접 등록에 좌표가 필수(카카오 지오코더). #27에 `condition`이 없다 |
| T21 사업자 인증 · 가게 연결 · 제휴 화면 | 공백으로 바뀜 | O05는 검색만 남는다(첫 화면 후보 목록 없음). O06 `할인 조건`은 저장되지 않는다(백엔드 답 전까지) |
| T22 R-02 최근 리뷰 | 경로 · 모양 변경(설계가 바뀜) | `CourseStop.review.recent`를 끼워 넣지 말고 시트를 열 때 `GET /stores/{storeId}/reviews`로 지연 조회한다. 평균 · 개수도 여기서 얻는다 |
| T23 마감 스모크 | 영향 작음 | 목업 기준이라 그대로 돈다. 시나리오 ③(같은 탭 보호자 동의)은 목업 전용이라고 적는다 |

**T4에서 다시 할 것**(커밋 `0efe30e`):

1. `putStudentProfile`(`features/auth/api.ts:41-43`) → `PATCH /users/me`, 본문 `{ name, school_name, grade, interest_major }`. 응답 대신 `GET /users/me`를 다시 읽는다(`useUpdateStudentProfile`이 `setQueryData(qk.me)` 하던 것을 `refetchMe`로).
2. `putGuideProfile`(`:46-48`) → `PUT /users/me/guide-profile`, 본문 `{ major, intro }`. `GuideProfileInput.introduction`을 필수 문자열로 바꾸고, 응답 뒤 `GET /users/me`.
3. `postSignup`(`:30-38`): 경로는 접두사만 다르다. 토큰 없는 응답에서 `login()`으로 잇는 분기가 이제 실제로 쓰이므로 테스트를 더한다(리뷰 Minor 2). `E409` → `EMAIL_DUPLICATE` + `fieldErrors.email`.
4. 상수(`features/auth/model.ts:66-71`): `PROFILE_TEXT_MAX = 100` 하나를 이름 20 · 학교 50 · 관심 학과 30으로 나눈다. `GUIDE_INTRO_MAX` 300 → 200. 비밀번호는 영문+숫자 규칙을 더한다.
5. 목업 `mocks/rules/auth.ts`의 `signUp` · `updateStudentProfile` · `saveGuideProfile` 검사를 같은 상수로 바꾼다. 핸들러 `mocks/handlers/auth.ts:29-95`는 백엔드 경로와 와이어로. `P1_CONTRACT`의 세 줄(`mocks/registry.test.ts:40-42`)은 `BACKEND_CONTRACT`로 옮긴다.
6. 그대로 두는 것: `tourCreateBlock` · `hasGuideProfile`(`features/auth/guide.ts`). 판정은 `Me`만 보고, 백엔드의 `E409_GUIDE_PROFILE_REQUIRED`는 4-37 대응만 하면 된다. `activeDemoToken` 정리도 그대로다.

---

## 9. 2C 뒤 남은 질문 (시연 영향 순)

2C(백엔드 와이어 전환)가 끝난 뒤에도 백엔드에 물어야 하는 것이다. 시연에 가장 중요한 것부터 적었다. 한 줄에 하나씩이고, 줄 끝 괄호는 2C 이전 9절의 번호다.

**2C까지 답이 나온 것**(다시 묻지 않는다)

- 옛 1 · 2번(`POST /tour-wishes`의 AI 추천, `campus_id` · `major` 선택): T-01 팀 합의로 풀렸다. AI 없이 저장만 하고, 홈이 학교 · 학과 · 희망 사항을 칸으로 받는다(결정 0011).
- 옛 10번(제휴 0곳 확정), 옛 24번(신청 취소는 탐방 날짜 전까지), 옛 26번의 앞부분(확정 뒤 승인한 신청자 쿠폰 발급, 취소 때 쿠폰 만료), 옛 41번의 앞부분(리뷰는 그 상점 쿠폰을 사용한 사람만, 상점당 1건): 기능 명세로 답이 났다(1-1절 다).
- 옛 19번(토큰 없는 `GET /tours`): 2C의 모든 화면이 로그인 뒤에 있어서 묻지 않는다.
- 옛 17번(로그인 응답 `user`의 전체 모양): 로그인 뒤 `GET /users/me`로 합성하면 충분하다.
- 목업 메모(옛 10번 관련, 2C Task 8): 목업 AI 초안은 시연을 지키려고 첫 지점이 캠퍼스 건물(CAMPUS)이다. 명세 C-01은 "AI 초안은 상점 지점(STORE)으로 만든다"라서 명세와 다르다. 와이어 일치 테스트(`expectWireShape`)는 배열의 첫 원소끼리만 견주고 null 칸은 건너뛰므로 이 차이를 잡지 않는다.

**남은 질문**

1. 시연 초기화 `POST /demo/reset`(헤더 `X-Demo-Key`, `checkpoint` START · APPLIED · APPROVED · CONFIRMED, 오늘 날짜로 다시 시드)과 `GET /health`를 둘 수 있나요? (옛 3번)
2. 시연 계정을 프론트 계약 6절 13번 그대로 시드해 주실 수 있나요(이메일, 공통 비밀번호, 가게 1~4 ↔ `owner1`~`owner4`)? (옛 4번)
3. 백엔드 주소와 경로 접두사(컨텍스트 경로)는 무엇이고, 배포 주소는 언제 고정되나요? 프론트 계약은 11/9 배포 · 11/12 고정을 가정했습니다. (옛 30번)
4. `E409_DAILY_LIMIT`의 "같은 날 같은 가게 한 장"은 손님(고교생)별인가요, 가게 전체인가요? 가게 전체면 시연에서 두 번째 학생의 쿠폰이 막힙니다. (옛 5번)
5. 코스 스팟에 지점 id(`spot_id`), 제휴 할인 문구(`discount_text`), 리뷰 평균 · 개수(`review_average` · `review_count`)를 넣어 주실 수 있나요? 지금은 `is_partner`와 `review_summary`뿐입니다. (옛 6번)
6. 가이드가 코스가 아직 없는 탐방의 `GET /tours/{tourId}/course`를 부르면 어떤 코드가 오나요? (옛 8번)
7. `PUT /tours/{tourId}/course/spots`의 `start_time`은 프론트가 계산해서 보내면 되나요(시작 + 0 · 70 · 120 · 170 · 220분)? 지점 수 상한과 같은 상점 중복 규칙이 있나요? (옛 9번)
8. `GET /tours/{tourId}/course` 응답에 발급 쿠폰 수(`coupon_count`)와 확정 시각을 넣어 주실 수 있나요? 지금은 확정 응답에만 있습니다. (옛 7번)
9. `GET /coupons/{couponCode}`에 `used_at`, 탐방 제목(`tour_title`, 또는 `tour_id`)을 넣고, `E409_ALREADY_USED`에도 `used_at`을 줄 수 있나요? (옛 11번)
10. 탐방 당일 전에 쿠폰을 사용 처리하면 어떤 코드인가요? 그리고 사용 처리 응답에 이번 탐방 방문 수(`tour_visitor_count` · `total_visitor_count`)를 줄 수 있나요? (옛 12번)
11. 탐방 목록 · 상세 · 내 탐방 응답에 `campus_id`와 탐방 제목(`title`)을 넣고, 탐방 개설에 `title`(2~30자)을 받을 수 있나요? (옛 13번)
12. 캠퍼스 이름이 응답마다 다릅니다(`campus_name` "단국대학교 죽전캠퍼스" 대 D-01 `name` "단국대학교" + `campus_name` "주전캠퍼스"). 어느 쪽이 맞나요? (옛 45번)
13. 희망 사항 응답 필드가 셋이 다릅니다(등록 `campus_id`·`date`, 수정 `campus_name`·`date`·`updated_at`, 목록 `campus_name`, `date` 없음). 맞추실 건가요? (옛 44번)
14. 탐방 찾기에서 희망 날짜가 있으면 `GET /tours`를 `date_from=그 날짜`(그날 이후 전체, 날짜 빠른 순)로 불러도 되나요? 명세는 "이 날짜의 탐방을 우선"이라고만 적었고, 기능 명세 T-01은 "날짜 조건에 맞는 모집 중 탐방"입니다(2C-R17). (새 질문)
15. `GET /tour-wishes`를 인증이 끝나지 않은 대학생(재학 인증 미승인)이 부르면 어떤 코드가 오나요? 명세는 "인증이 끝난 대학생만 호출할 수 있습니다"라고만 적었습니다. (새 질문)
16. `GET /users/me/tours`(대학생)의 `course_confirmed` 대신 `course_status`(null · DRAFT · CONFIRMED)를 주시고 `campus_name` · `major` · `start_time`도 넣어 주실 수 있나요? 초안 유무로 화면이 갈립니다. (옛 15번)
17. `GET /users/me/tours`(고교생) 항목에 `start_time` · `end_time` · `major` · 가이드 · `wish` · `open_chat_url` · 쿠폰 수 · 취소 가능 여부를 넣어 주실 수 있나요? 없으면 탐방마다 상세를 다시 부릅니다. (옛 14번)
18. `GET /users/me`에 대학생 인증 학교 `campus_id`와 사장님 `store_id`를 넣어 주실 수 있나요? (옛 18번)
19. 신청 단건 조회(`GET /applications/{applicationId}`)를 둘 수 있나요? (옛 16번)
20. 신청의 `E403_VERIFICATION_REQUIRED`를 재학 인증 미승인과 보호자 미동의로 나눠 주실 수 있나요? (옛 20번)
21. 신청의 `E409_TOUR_FULL`을 정원 마감과 모집 종료로 나눠 주실 수 있나요? (옛 21번)
22. 탐방 완료의 `E409_INVALID_TOUR_STATUS`를 "날짜 전" · "이미 완료" · "취소됨"으로 나눠 주실 수 있나요? (옛 22번)
23. 탐방 완료는 탐방 당일에 되나요, 다음 날부터인가요("날짜가 지나기 전에는")? (옛 23번)
24. 거절된 탐방에 다시 신청할 수 있나요(명세는 취소 후 재신청만 적었습니다)? (옛 25번)
25. 탐방 취소 때 거절된 신청도 CANCELED가 되나요? (옛 26번의 뒷부분)
26. 탐방 상세 `my_application`과 신청자 목록에 취소한 신청이 들어오나요? `remaining`은 정원 − 승인 수인가요? (옛 27번)
27. `errors[].reason`은 화면에 그대로 보일 문구인가요, 기계 코드인가요? 재학 인증은 문구이고 사업자 인증은 `MISMATCH`입니다. (옛 28번)
28. 목록 size 상한이 50인데, 내 탐방 · 내 쿠폰 · 가이드 신청자처럼 전부 필요한 목록은 페이지 없이 주실 수 있나요? (옛 29번)
29. 토큰 만료 시간과 갱신 방식은 무엇인가요? (옛 31번)
30. 보호자 동의 대기 중에 메일을 다시 보낼 수 없나요? 메일은 실제로 보내나요? 개발 · 시연 환경에서만 동의 토큰을 응답에 줄 수 있나요(`X-Demo-Key`가 있을 때)? (옛 32번)
31. 이미 처리된 보호자 링크로 `GET /guardian-consents/{consentToken}`을 부르면 200과 그 상태가 오나요? (옛 33번)
32. 내 정보(또는 별도 API)에서 보호자 이름 · 이메일 · 링크 만료 시각과 재학 인증 제출 시각을 줄 수 있나요? (옛 34번)
33. 재학 인증에 heic · heif와 10MB를 받아 주실 수 있나요? 고교생 학년은 `PATCH /users/me`로 따로 보내면 되나요? 대학생 학교는 제출 때가 아니라 승인 때 프로필에 연결되나요? (옛 35번)
34. 운영자 인증 목록 `status`에 APPROVED · REJECTED(처리 내역)를 받나요? 정렬은 무엇인가요? 항목에 `status` · `reviewed_at` · `reject_reason` · email을 넣어 주실 수 있나요? (옛 36번)
35. 사업자 인증 뒤 가게 찾기는 상호 검색(2자 이상)뿐인가요? `business_number`는 하이픈을 빼서 보내면 되나요? (옛 37번)
36. 가게 직접 등록 좌표는 프론트가 지오코딩해 보내면 되나요? `latitude`/`longitude`가 다른 API의 `lat`/`lng`와 이름이 다른 것은 의도인가요? (옛 38번)
37. 제휴에 할인 조건(`condition`, 50자, null 허용) 칸을 더할 수 있나요? (옛 39번)
38. 주변 상점의 반경 · 개수 · 정렬은 무엇이고, `is_partner`는 탐방 날짜에 유효한 제휴 기준인가요? 거리(`distance_m`)와 신청자 요청 관련도를 줄 수 있나요? (옛 40번)
39. 리뷰 내용의 최소 길이는 얼마인가요? AI 요약은 리뷰 저장 후 얼마 만에 반영되나요? 쿠폰의 `reviewed`는 쿠폰 단위인가요, 상점 단위인가요? (옛 41번)
40. 운영자 시드 계정 이메일은 무엇인가요(프론트 시연은 `admin@demo.kr`)? (옛 42번)
41. `PATCH /users/me` · `PATCH /users/me/store` 응답은 GET과 같은 전체 모양인가요? 예시는 일부 칸만 있습니다. (옛 43번)
42. 공통 실패 표에 없는 409 · 410 · 422 · 502와 사유 없는 `E409`가 개별 페이지에 있습니다. 전체 코드 목록을 확정해 주실 수 있나요? (옛 46번)
43. 경로 매개변수 표기(`{tourId}` 대 `{tour_id}`, `consent_token`)와 T-05 페이지에 붙은 T-06 내용은 정리만 하면 되는 것이죠? (옛 47번)
44. S-07 리포트 필드는 언제 정해지나요(프론트는 P2)? (옛 48번)
45. 방학 상권 인사이트(대학 주변 상권 지표) 데이터를 API로 줄 계획이 있나요? (옛 49번)

**명세로 답이 나온 프론트 계약 6절 질문**(다시 묻지 않는다)

- 3번 필드 표기 → snake_case(BE 공통규칙). 4번 인증 → Bearer. 5번 업로드 → multipart(재학 인증만).
- 6번 좌표 → 프론트가 `latitude`/`longitude`를 보낸다(가게 등록 필수). 7번 방문 시간 → 코스 수정 요청에 `start_time`이 들어가므로 보내는 쪽이 정한다(9절 7번에서 확인).
- 9번 쿠폰 발급 → 확정 때 승인자 × 제휴 지점, 탐방 당일 유효. 10번 C-01 제휴 포함 → 포함한다.
- 19번 심사 사진 → 짧게 유효한 임시 주소. 20번 가입 토큰 → 주지 않는다(로그인을 따로 부른다).
- 2번 탐방 제목 · 11번 시연 초기화 · 32번 제휴 조건 → 반영되지 않았다(9절 1 · 11 · 37번으로 다시 묻는다).
