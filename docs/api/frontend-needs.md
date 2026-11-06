# 프론트엔드가 기대하는 API (계약 초안)

작성일 2026-11-04 · 갱신 2026-11-06(계약 동결일: P1 27개 초안과 하이파이 V2 반영) · 프론트엔드 → 백엔드 전달용

## 1. 이 문서의 목적

프론트엔드는 백엔드가 준비되기 전에 목업(MSW)으로 화면을 먼저 만들고 있다. 이 문서는 그 목업이 **지금 가정하고 있는 API**를 그대로 적은 것이다. 백엔드가 API 명세를 쓸 때 참고하는 초안이고, **강제가 아니다.** 백엔드가 다르게 정하면 프론트가 맞춘다. 필드 이름이나 모양 차이는 프론트의 `api.ts` 변환 함수 한 곳에서 흡수할 수 있다.

다만 다음 두 가지는 제안한다.

- **11/6(금)에 골든 패스 계약을 동결**한다. 3절 표의 29개 엔드포인트가 대상이다. 이 날짜 이후에 바뀌면 프론트 목업과 화면을 같이 고쳐야 한다. 하이파이 디자인 V2(11/5 시안)가 나왔지만 이 29개의 경로 · 요청 · 응답은 바꾸지 않는다.
- 골든 패스 밖 P1 화면의 엔드포인트 27개는 **3-2절에 초안으로** 두었다. 동결 대상이 아니고, 같은 리뷰에서 보여 드리되 **의견은 11/8(일)까지**(늦어도 구현 시작 전) 받는다.
- 골든 패스 API는 11/9까지 배포, 배포 주소는 11/12까지 고정한다(팀 일정 기준).

업무 규칙(신청 자격, 정원, 취소 가능 시점 등)의 최종 기준은 백엔드 API다. 목업의 규칙은 기능 명세를 따른 잠정안이므로, 다르게 구현하면 알려 주기만 하면 된다.

배경 문서

- 프론트엔드 설계: `docs/superpowers/specs/2026-11-03-frontend-design.md` (5.5 데이터 · API 연동 계층)
- 결정 기록: [`0002` 목업 먼저 만들기](../decisions/0002-mock-first-with-msw.md) · [`0005` Vercel `/api` 프록시](../decisions/0005-vercel-api-proxy.md) · [`0007` 시연 데이터는 당일 날짜 기준](../decisions/0007-demo-data-seeded-with-today.md) · [`0008` C-01은 제휴 상점 1곳 이상 포함](../decisions/0008-c01-includes-partner-store.md)
- 상태값 근거: `docs/reference/erd.md` (상태값 요약) · 기능 명세 `docs/reference/feature-spec.md`
- 화면 근거(하이파이 V2): [`design-v2.md`](../reference/design-v2.md) · [`0010` V2 채택](../decisions/0010-adopt-design-v2.md)

## 2. 공통 규약 (제안)

| 항목 | 제안 |
|---|---|
| base URL | `/api` (Vercel 프록시로 백엔드에 전달) |
| 본문 | JSON, 필드 이름은 camelCase. 백엔드가 snake_case 등으로 정하면 프론트 `api.ts`에서 변환 |
| 인증 | 로그인이 돌려준 `token`을 `Authorization: Bearer <token>` 헤더로 보낸다. 쿠키 세션을 택하면 프론트 HTTP 클라이언트 한 곳만 바꾼다 |
| ID | 모두 number |
| 날짜 · 시각 | 시각은 `+09:00` 오프셋이 붙은 ISO 8601 (`2026-11-15T14:00:00+09:00`). 날짜만은 `YYYY-MM-DD`, 시각만은 `HH:mm`. 화면 표시는 Asia/Seoul 고정 |
| 목록 응답 | 배열 그대로. 페이지네이션 없음 (MVP 데이터 규모) |
| 로그아웃 | `204 No Content` |
| 에러 응답 | HTTP 상태 + 본문 `{ "code": string, "message": string, "fieldErrors"?: { [field]: string }, "details"?: object }` |
| 상태 코드 (3-2절에서 추가) | 400 입력 값 · 401 토큰 없음 · 403 요청자 자격과 선행 조건 · 404 대상 없음 · 409 대상의 현재 상태와 충돌(이미 처리됨 · 상태 전이 불가 · 중복 · 상한) · 410 만료된 링크 · 413 본문 용량. 프론트는 `code`로만 가르므로 상태 코드는 권장값이다 |
| 성공 코드 (3-2절에서 추가) | 201은 새 리소스(또는 그것을 담은 응답)를 돌려줄 때만 쓰고, 집계를 돌려주는 생성은 200이다. 프론트는 2xx를 모두 같게 처리한다 |
| 공개 엔드포인트 (3-2절에서 추가) | 3-2절의 "(토큰 없이)"는 `Authorization` 헤더 없이 부른다. 토큰이 없다고 401을 주면 안 된다 |

**에러 코드.** `code`는 문자열 상수이고, 프론트가 이 값으로 한국어 안내 문구를 고른다. `message`는 개발자용 설명이어도 된다. 전체 목록과 문구는 [`src/shared/lib/errors.ts`](../../src/shared/lib/errors.ts)의 표가 기준이다. 프론트가 쓰는 코드가 이미 정리돼 있으니 백엔드가 같은 이름을 쓰면 연동이 가장 쉽다. 다른 이름을 쓰면 매핑 표만 바꾸면 된다.

- `fieldErrors`는 입력 검증 실패(`VALIDATION`, `EMAIL_DUPLICATE` 등)에서 필드 이름별 메시지를 준다. 키는 **요청 필드 이름**(camelCase)이다.
- `details`는 코드별 부가 값이다. 예를 들어 `COUPON_ALREADY_USED`는 `details.usedAt`(사용 시각, ISO 8601)을 준다.
- 409는 "이미 처리됨" 계열로 취급해 프론트가 목록을 다시 불러온다.

## 3. 골든 패스 엔드포인트 (29개)

시연 골든 패스(추천 → 신청 → 승인 → 코스 → 쿠폰 사용)에 필요한 엔드포인트다. 응답 타입 이름은 4절의 정의를 가리킨다. 성공은 별도 표기가 없으면 200이다. `:id` 같은 자리 표시는 경로 변수다.

| 메서드 · 경로 | 요청 | 응답 | 에러 | 쓰는 화면 |
|---|---|---|---|---|
| POST /api/auth/login | `{email,password}` | `LoginResponse` | INVALID_CREDENTIALS 401 | 로그인 `/login` |
| POST /api/auth/logout | — | 204 | — | 내 정보 · MY 탭 |
| GET /api/me | — | `Me` | UNAUTHORIZED 401 | 모든 화면(가드 · 첫 화면 결정), 재학 인증 · 내 정보 |
| GET /api/universities | — | `University[]` | — | 홈 학교 선택, 탐방 개설 |
| GET /api/universities/:id/insight | — | `Insight` | NOT_FOUND 404 | 추천 목록, 코스 초안(방학 상권 인사이트 카드) |
| POST /api/recommendations | `RecommendationQuery` | `RecommendationResult` | VALIDATION 400 | 홈 `/`, 추천 목록 `/recommendations`(추천 0건이면 넓힌 대체 목록도 이 응답의 `items` · `fallback`으로 온다) |
| GET /api/tours?status=&universityId= | — | `TourSummary[]` | — | 탐색 `/explore`(P2, 가이드 · 사장님 `탐색` 탭) |
| GET /api/tours/:id | — | `TourDetail` | NOT_FOUND 404 | 탐방 상세 `/tours/:tourId` |
| POST /api/tours/:id/applications | `{motivation}` | `MyApplication` (201) | NOT_VERIFIED · GUARDIAN_NOT_AGREED 403 / TOUR_NOT_RECRUITING · TOUR_CLOSED · DUPLICATE_APPLICATION · REAPPLY_AFTER_REJECT 409 / VALIDATION 400 | 신청서 `/tours/:tourId/apply` |
| GET /api/me/applications | — | `MyApplication[]` | — | 내 탐방 목록 `/my-tours` |
| GET /api/me/applications/:id | — | `MyApplication` | NOT_FOUND 404 | 신청 완료, 내 탐방 상세 `/my-tours/:applicationId` |
| POST /api/me/applications/:id/cancel | — | `MyApplication` | CANCEL_AFTER_TOUR_DATE · ALREADY_PROCESSED 409 | 내 탐방 상세 |
| GET /api/guide/tours | — | `GuideTourSummary[]` | FORBIDDEN 403 | 내가 개설한 탐방 `/guide/tours` |
| GET /api/guide/tours/:id/applicants | — | `ApplicantsBoard` | FORBIDDEN 403 | 신청자 관리 |
| POST /api/guide/applications/:id/approve | — | `ApplicantsBoard` | CAPACITY_EXCEEDED · ALREADY_PROCESSED 409 | 신청자 관리 |
| POST /api/guide/applications/:id/reject | — | `ApplicantsBoard` | ALREADY_PROCESSED 409 | 신청자 관리 |
| GET /api/guide/tours/:id/course | — | `Course` | NOT_FOUND 404(코스 없음) | 코스 초안 · 편집 · 확정, 확정 코스 지도 |
| POST /api/guide/tours/:id/course/draft | — | `Course` | NO_APPROVED_APPLICANTS · COURSE_NOT_DRAFT 409 | AI 코스 초안 |
| PUT /api/guide/tours/:id/course/order | `{stopIds:number[]}` | `Course` | COURSE_NOT_DRAFT 409 / VALIDATION 400 | 코스 편집 |
| PATCH /api/guide/tours/:id/course/stops/:stopId | `{description}` | `Course` | COURSE_NOT_DRAFT 409 | 코스 편집 |
| DELETE /api/guide/tours/:id/course/stops/:stopId | — | `Course` | COURSE_NOT_DRAFT 409 | 코스 편집 |
| POST /api/guide/tours/:id/course/confirm | — | `Course` | COURSE_EMPTY · COURSE_NOT_DRAFT 409 | 코스 편집 → 코스 확정 · 쿠폰 발급 결과 |
| GET /api/tours/:id/course | — | `Course` | FORBIDDEN 403 / COURSE_NOT_READY 404 | 탐방 코스 지도 `/my-tours/:applicationId/course` |
| GET /api/me/coupons?applicationId= | — | `Coupon[]` | — | 쿠폰 목록 `/my-tours/:applicationId/coupons` |
| GET /api/me/coupons/:id | — | `Coupon` | NOT_FOUND 404 | 쿠폰 상세 `/coupons/:couponId` |
| GET /api/owner/coupons/:code | — | `CouponLookup` | COUPON_NOT_FOUND 404 / COUPON_OTHER_STORE 403 | 쿠폰 사용 처리 `/owner/coupons/redeem` |
| POST /api/owner/coupons/:code/redeem | — | `RedeemResult` | COUPON_ALREADY_USED(`details.usedAt`) · COUPON_EXPIRED · COUPON_NOT_YET 409 / COUPON_OTHER_STORE 403 / COUPON_NOT_FOUND 404 | 쿠폰 사용 처리 |
| GET /api/health | — | `{ok:true, mode}` | — | 시연 패널(연결 확인), 배포 확인 |
| POST /api/demo/reset | `{checkpoint?}` + 헤더 `X-Demo-Key`(세션 토큰 없음) | `{ok:true}` | FORBIDDEN 403(키 없음 · 틀림) / VALIDATION 400(모르는 `checkpoint`) | 시연 패널(시연 데이터 초기화), 원클릭 시연 링크 `reset=1` |

참고

- 코스 응답(`Course`)을 돌려주는 변경 API는 모두 **변경 후의 전체 `Course`**를 준다. 신청 승인 · 거절은 **변경 후의 전체 `ApplicantsBoard`**를 준다. 프론트가 응답으로 화면을 바로 갱신한다.
- `GET /api/guide/tours/:id/course`는 코스가 아직 없으면 `NOT_FOUND 404`를 준다. 프론트는 이를 "코스 없음" 상태로 그린다.
- `GET /api/tours/:id/course`는 코스가 `CONFIRMED`이고 요청자가 승인된 신청자(또는 해당 가이드)일 때만 준다. 코스가 없거나 `DRAFT`면 `COURSE_NOT_READY 404`, 승인되지 않은 사람이면 `FORBIDDEN 403`.
- `POST /api/demo/reset`은 시연 데이터를 시드 상태로 되돌린다. `checkpoint`(선택)를 주면 "신청 완료 · 승인 완료 · 코스 확정 · 쿠폰 발급" 같은 중간 단계에서 시작한다. 프론트가 기대하는 약속(키 · 체크포인트 값 · 세션)은 6절 11번, 시연 계정 · 가게 짝은 13번이다. 리셋 범위를 3-2절 P1 데이터(리뷰 · 인증 · 가게 · 개설한 탐방)까지 넓혀 달라는 요청은 6절 31번이다.

## 3-2. P1 엔드포인트(초안 — 동결 대상 아님, 11/8까지 의견)

골든 패스 밖의 P1 화면(가입 · 인증 · 탐방 개설 · 주변 상점 · 리뷰 · 사장님 · 운영자)이 쓰는 엔드포인트 27개다. **11/6 동결 대상이 아니다.** 같은 리뷰에서 모양을 함께 보되, 의견은 **11/8(일)까지, 늦어도 백엔드 구현을 시작하기 전에** 주시면 된다. 프론트는 지금 이 모양으로 목업을 만들고 있고, 다르게 정해지면 `api.ts` 변환 한 곳에서 맞춘다. 표기와 읽는 법은 3절과 같다. 성공은 별도 표기가 없으면 200이고, "(토큰 없이)"는 `Authorization` 헤더 없이 부르는 공개 엔드포인트라는 뜻이다. 로그인이 필요한 엔드포인트는 모두 토큰이 없으면 `UNAUTHORIZED 401`, 역할이 맞지 않으면 `FORBIDDEN 403`이므로 표에는 그 밖의 오류만 적었다.

**하이파이 디자인 V2를 보고 정한 것**(V2 화면: [`design-v2.md`](../reference/design-v2.md))

1. **사업자 인증은 자동 그대로다**(기능 명세 U-07, #22). V2 운영자 심사 목록의 `사업자 심사` 카드는 채택하지 않는다. 운영자 심사(#10~#13)는 **학생증 인증만** 다룬다.
2. **가게 이름 검색을 둔다**(V2 O05 `가게 이름 검색`). #23은 `q`가 없으면 사업자 정보로 대조한 후보를, 있으면 상호 검색 결과를 준다(이름 포함, 이름순, 최대 20개).
3. **제휴에 `condition`(할인 조건)을 더한다**(V2 O06 `혜택 이름` + `할인 조건`, 예 `탐방 당일 · 1회 사용 가능`). 제휴 기간(`startDate` · `endDate`)은 기능 명세 S-03과 ERD 기간 칼럼, `PARTNERSHIP_PERIOD_INVALID` 때문에 그대로 두고, 프론트가 V2의 두 칸 아래에 기본값을 채워 넣은 기간 칸을 둔다. ERD에 `condition` 칼럼이 필요한지는 6절 32번이다.
4. **내 정보 수정에 이름이 들어간다**(V2 H17 `이름 · 학교 · 이메일 · 관심 전공`). #2 요청에 `name`(ERD `users.name`)이 있다. 이메일은 읽기 전용이라 요청에 없다.
5. **탐방 개설에 제목을 받는다**(V2 G04와 모든 목록의 `디자인 전공자의 하루` 같은 제목). #14 요청에 `title`이 있고, `TourSummary.title`은 입력값을 그대로 돌려준다(6절 2번). 응답 모양은 바뀌지 않는다.
6. **코스 상점 후보에 `matchedRequest`를 더한다**(V2 G07 `학생 요청: 쉬면서 전공 이야기 나누기`). 승인된 신청자들의 `하고 싶은 것` 문구 중 후보의 `relatedIntent`가 나온 문구다. `도보 약 6분`은 프론트가 `distanceM`으로 계산한다(4절).
7. **알림 설정은 API가 없다**(V2 H18 · G13 토글). 값은 기기에만 저장한다(5절, 6절 33번).

| 메서드 · 경로 | 요청 | 응답 | 에러 | 쓰는 화면 |
|---|---|---|---|---|
| #1 POST /api/auth/signup (토큰 없이) | `SignupInput` | `LoginResponse` (201) | VALIDATION 400(`fieldErrors.email` · `password` · `name` · `role`) / EMAIL_DUPLICATE 409(`fieldErrors.email`) | 회원가입 `/signup` |
| #2 PUT /api/me/student-profile | `StudentProfileInput` | `Me` | VALIDATION 400(`fieldErrors.name` 등) | 내 정보 수정 `/me/edit` |
| #3 PUT /api/me/guide-profile | `GuideProfileInput` | `Me` | VALIDATION 400(`fieldErrors.major` · `introduction`) | 가이드 프로필 `/guide/me/profile` |
| #4 GET /api/me/verification | — | `VerificationOverview` | — | 재학 인증 · 보호자 동의 `/verify` |
| #5 POST /api/me/student-verification (multipart) | 폼 필드 `document`(파일) + 고교생 `highSchoolName` · `grade` / 대학생 `universityId` | `VerificationOverview` | VALIDATION 400(`fieldErrors.document` · `highSchoolName` · `grade` · `universityId`, 5개교 밖 포함) · FILE_TYPE 400 / FILE_TOO_LARGE 413 / ALREADY_PROCESSED 409(심사 중 · 승인) | `/verify` 1단계, 대학생 재학 인증 `/guide/verify` |
| #6 POST /api/me/guardian-consent | `GuardianConsentInput` | `VerificationOverview` | VALIDATION 400 / ALREADY_PROCESSED 409(이미 동의) | `/verify` 2단계(요청 · 재요청) |
| #7 GET /api/guardian-consents/:token (토큰 없이) | — | `ConsentRequest` (처리된 링크도 200 + status) | CONSENT_LINK_INVALID 404 / CONSENT_LINK_EXPIRED 410 | 보호자 동의 `/consent/:token` |
| #8 POST /api/guardian-consents/:token/agree (토큰 없이) | — | `ConsentRequest` | CONSENT_LINK_INVALID 404 / CONSENT_LINK_EXPIRED 410 / ALREADY_PROCESSED 409 | `/consent/:token` |
| #9 POST /api/guardian-consents/:token/reject (토큰 없이) | — | `ConsentRequest` | #8과 같음 | `/consent/:token` |
| #10 GET /api/admin/student-verifications?status=PENDING\|PROCESSED | — (생략하면 PENDING) | `VerificationRequestSummary[]` | VALIDATION 400(모르는 status) | 인증 심사 목록 `/admin/verifications`(처리 내역 `?filter=processed`) |
| #11 GET /api/admin/student-verifications/:id | — | `VerificationRequestDetail` | NOT_FOUND 404 | 인증 상세 `/admin/verifications/:id` |
| #12 POST /api/admin/student-verifications/:id/approve | — | `VerificationRequestDetail` | NOT_FOUND 404 / ALREADY_PROCESSED 409 | 인증 상세 |
| #13 POST /api/admin/student-verifications/:id/reject | `{reason}` | `VerificationRequestDetail` | VALIDATION 400(`fieldErrors.reason`) / NOT_FOUND 404 / ALREADY_PROCESSED 409 | 인증 반려 사유 입력 |
| #14 POST /api/guide/tours | `CreateTourInput` | `GuideTourDetail` (201) | NOT_VERIFIED · GUIDE_PROFILE_REQUIRED 403 / VALIDATION 400(`fieldErrors.title` 등) · OUTSIDE_VACATION 400(`fieldErrors.startsAt`) | 탐방 개설 `/guide/tours/new` |
| #15 GET /api/guide/tours/:id | — | `GuideTourDetail` | FORBIDDEN 403(남의 탐방) / NOT_FOUND 404 | 탐방 완료 · 취소 화면 |
| #16 POST /api/guide/tours/:id/complete | — | `GuideTourDetail` | COMPLETE_BEFORE_TOUR_DATE · TOUR_ALREADY_COMPLETED · ALREADY_PROCESSED(취소된 탐방) 409 / FORBIDDEN 403 / NOT_FOUND 404 | 탐방 종료 · 완료 `/guide/tours/:tourId/complete` |
| #17 POST /api/guide/tours/:id/cancel | — | `GuideTourDetail` | TOUR_ALREADY_COMPLETED · ALREADY_PROCESSED(이미 취소) 409 / FORBIDDEN 403 / NOT_FOUND 404 | 탐방 취소 확인 `/guide/tours/:tourId/cancel` |
| #18 GET /api/guide/tours/:id/course/store-candidates | — | `CourseStoreCandidate[]` (서버 정렬) | FORBIDDEN 403 / NOT_FOUND 404 | 코스 상점 교체 · 추가 `/guide/tours/:tourId/course/stops/pick` |
| #19 POST /api/guide/tours/:id/course/stops | `{storeId}` | `Course` | VALIDATION 400(storeId 형식 · 반경 밖) / NOT_FOUND 404(탐방 · 코스 · 상점) / COURSE_NOT_DRAFT · COURSE_STOP_DUPLICATE · COURSE_STOP_LIMIT 409 | 코스 상점 선택(추가) → 코스 편집 |
| #20 POST /api/guide/tours/:id/course/stops/:stopId/replace | `{storeId}` | `Course` | VALIDATION 400(캠퍼스 지점 · storeId 형식 · 반경 밖) / NOT_FOUND 404(지점 · 상점) / COURSE_NOT_DRAFT · COURSE_STOP_DUPLICATE 409 | 코스 상점 선택(교체) → 코스 편집 |
| #21 POST /api/reviews | `CreateReviewInput` | `MyReview` (201) | VALIDATION 400(`fieldErrors.rating` · `content`) / REVIEW_NOT_ALLOWED 403(쿠폰 미사용) / NOT_FOUND 404(없거나 남의 쿠폰) / REVIEW_DUPLICATE 409 | 방문 리뷰 작성 `/reviews/new?couponId=` |
| #22 POST /api/me/business-verification | `BusinessVerificationInput` | `BusinessVerificationResult` | VALIDATION 400 · BIZ_MISMATCH 400 · BIZ_CLOSED 400 | 사업자 인증 `/owner/verify` |
| #23 GET /api/owner/store-candidates?q= | — | `OwnerStoreCandidate[]` | BIZ_NOT_VERIFIED 403 / VALIDATION 400(q 50자 초과) | 가게 찾기 · 연결 `/owner/store/connect` |
| #24 POST /api/owner/store/link | `{storeId}` | `MyStore` | BIZ_NOT_VERIFIED 403 / NOT_FOUND 404 / STORE_LIMIT · STORE_ALREADY_LINKED 409 | `/owner/store/connect` |
| #25 POST /api/owner/store | `StoreRegistrationInput` | `MyStore` (201) | VALIDATION · ADDRESS_NOT_FOUND 400 / BIZ_NOT_VERIFIED 403 / STORE_LIMIT 409 | `/owner/store/connect`(내 가게 직접 등록) |
| #26 GET /api/owner/store | — | `MyStore` | STORE_NOT_LINKED 404 | 내 가게 `/owner/store`, 사장님 내 정보 `/owner/me` |
| #27 PUT /api/owner/store/partnership | `PartnershipInput` | `MyStore` | VALIDATION · PARTNERSHIP_PERIOD_INVALID 400(`fieldErrors.endDate`) / STORE_NOT_LINKED 404 | 제휴 할인 설정 `/owner/store/partnership` |

참고

- **#1**: `role`은 `HIGH_SCHOOL` · `UNIVERSITY` · `OWNER` 중 하나다. 운영자는 시드 계정이다. 이름은 ERD `users.name`이 NOT NULL이라 받는다. 가입하면 역할별 빈 프로필 행을 만들어 주면 좋다(제안). 백엔드가 토큰을 주지 않으면 프론트가 로그인을 이어서 부른다(6절 20번).
- **#2 · #3**: PUT은 모든 키를 보낸다. 값은 null이어도 되고, #2의 `name`과 #3의 `major`만 필수다. #3은 학교를 받지 않는다(학교는 재학 인증 U-05 값). 둘 다 인증 상태와 상관없이 저장된다. #2의 이메일은 읽기 전용이라 받지 않는다.
- **#4**: 대학생도 부를 수 있지만 대학생 화면은 `Me`로 충분하다. 사장님 · 운영자는 403이다. 보호자 이름 · 이메일 · 만료 시각과 제출 시각은 `Me`에 없어서 이 집계로 받는다(6절 20번).
- **#5**: 고교생 · 대학생이 같은 엔드포인트를 쓰고, 서버가 역할로 필드를 고른다. `document`는 파일이고 필수다. 고교생은 `highSchoolName`(100자 이하)과 `grade`(`1`~`3`)를, 대학생은 `universityId`(숫자 문자열, `GET /api/universities`의 5개교 중 하나)를 보낸다. 형식은 jpg · png · heic · heif, 10MB(10×1024×1024) 이하이고 MIME **또는 확장자**로 판정해 주세요(HEIC는 MIME이 비어 올 수 있다). 미제출 · 반려 상태에서만 받는다. 성공하면 `PENDING`이 되고 반려 사유를 비우며 제출 시각을 새로 쓴다. 대학생이 내면 `Me.guideProfile.universityId`가 그 대학으로 맞춰진다. 프론트 업로드 제한 시간은 60초다(제안).
- **#6**: 대기 · 거부 · 만료 상태에서 다시 보내면 토큰과 `expiresAt`을 새로 만들고 예전 링크는 무효(404)가 된다. 행은 사용자당 하나다(ERD `guardian_consents`).
- **#7~#9**: 처리된 링크는 만료 시각이 지났어도 200과 그 상태를 준다. 만료보다 "이미 처리됨"이 먼저다. 그래서 처리한 뒤에도 토큰을 남겨야 한다(ERD `token_hash`는 NULL 허용).
- **#10**: `PROCESSED`는 `APPROVED` + `REJECTED`다. 대기는 제출이 오래된 순, 처리 내역은 처리가 최근인 순이다. `:id`는 ERD상 `users.id`이지만 프론트는 불투명한 number로만 쓴다(2절). **학생증 인증만** 있고 사업자 심사 건은 없다(위 결정 1).
- **#12 · #13**: 처리하면 사진 파일을 지우고 `documentUrl`은 null이 된다(U-08). 반려 사유는 필수다.
- **#14**: 학교는 보내지 않는다. 서버가 가이드의 인증 대학(`Me.guideProfile.universityId`)을 쓴다. 검사 순서는 인증 → 프로필(학과) → 형식 → 방학이다. 시각은 `+09:00` ISO(2절), 시작 · 종료는 같은 날이다. `title`은 탐방 이름이고 2~30자를 제안한다(6절 2번 · 25번).
- **#16**: 오늘(서울 날짜)이 탐방 날짜와 같거나 뒤면 완료할 수 있다(제안: 시연 탐방이 오늘이라 당일에 완료 → 리뷰를 보일 수 있다). 신청과 쿠폰은 그대로 둔다.
- **#17**: 승인 대기 · 승인 신청은 `CANCELED`로, 그 신청의 `ISSUED` 쿠폰은 `EXPIRED`로 바꾸고(`USED`는 그대로) 탐방을 `CANCELED`로 바꾼다(T-05). 거절된 신청은 그대로 둔다(제안).
- **#18**: 대학 중심 반경 안의 상점을 준다. 정렬은 관련 업종 → 거리 → 상호 · id 순이다. `relatedIntent` · `matchedRequest`는 **승인된 신청자들이 실제로 적은 `하고 싶은 것`만** 본다(C-01과 같은 기준). 제휴는 탐방 날짜에 유효한 제휴이고 쿠폰 발급과 같은 기준이다. 후보 목록은 길어서 `review`에 `recent`를 넣지 않는다.
- **#19 · #20**: #19는 지점을 맨 끝에 넣고, 서버가 모든 지점의 `visitTime`을 슬롯대로 다시 매긴다(6절 7번). 지점은 최대 5곳이다(제안). #20은 지점 id · 순서 · 방문 시간을 그대로 두고 상점과 제휴만 바꾸며 `description` · `recommendationReason`은 null로 비운다. 두 경우 모두 같은 상점이 겹치면 409다. 쿠폰이 신청 × 상점마다 1장이기 때문이다(ERD `coupons`). 기존 지점 수정 PATCH(3절)는 건드리지 않으려고 교체를 따로 뒀다.
- **#21**: 서버 검사 순서는 형식 → 내 쿠폰 → `USED` → 중복이다. 저장한 뒤 그 상점의 요약(R-03)을 갱신한다. 프론트는 30초까지 기다린다(6절 8번 · 29번).
- **#22**: 사업자번호는 숫자 10자리만 보낸다. 일치하고 계속사업자면 확인됨으로 바꾸고 후보를 준다(U-07). 실패해도 이미 받은 인증은 그대로다. 사업자 인증은 운영자 심사 없이 이 호출 하나로 끝난다(위 결정 1).
- **#23**: `q`가 없으면 사업자 정보로 대조한 후보를, 있으면 상호 검색 결과를 준다(이름 포함, 이름순, 최대 20개 — 제안). V2 `가게 이름 검색` 칸이 `q`다.
- **#27**: 가게당 "지금 쓰는 제휴" 1건을 고친다. id는 그대로 둔다. 발급된 쿠폰이 `partnership_id`로 이 행을 가리키기 때문이다(ERD `store_partnerships`). V2는 `혜택 이름`(= `discount`)과 `할인 조건`(= `condition`) 두 칸이고, 기간은 프론트가 기본값을 채워 보낸다.

**에러 코드 (P1에서 새로 쓰는 것)**

새 코드는 프론트 [`src/shared/lib/errors.ts`](../../src/shared/lib/errors.ts) 표에 먼저 넣는다. 메시지는 프론트가 고르는 한국어 문구(제안)이고, 다른 이름을 쓰면 매핑 표만 바꾼다. 상태 코드는 권장값이고 프론트는 `code`로만 가른다.

| 코드 | HTTP | 메시지(제안 문구) | 엔드포인트 |
|---|---|---|---|
| `COMPLETE_BEFORE_TOUR_DATE` | 409 | 탐방 날짜 이후에 완료할 수 있어요. | #16 (T-06 "날짜 전"). 학생의 `CANCEL_AFTER_TOUR_DATE`와 짝 |
| `COURSE_STOP_DUPLICATE` | 409 | 이미 코스에 있는 장소예요. | #19 · #20 |
| `COURSE_STOP_LIMIT` | 409 | 지점은 최대 5곳까지 넣을 수 있어요. | #19 |
| `BIZ_NOT_VERIFIED` | 403 | 사업자 인증을 마친 뒤에 가게를 연결할 수 있어요. | #23 · #24 · #25 (S-01 "사업자 인증 전"). `NOT_VERIFIED`는 학생용 문구라 쓰지 않는다 |
| `STORE_NOT_LINKED` | 404 | 연결된 가게가 없어요. 가게를 먼저 연결해 주세요. | #26 · #27 |
| `ADDRESS_NOT_FOUND` | 400 | 주소를 찾을 수 없어요. 도로명 주소로 다시 입력해 주세요. | #25 (서버가 주소를 좌표로 바꿀 때만, 6절 6번) |
| (선택) `MAIL_SEND_FAILED` | 502 | 메일을 보내지 못했어요. 이메일 주소를 확인하고 다시 보내 주세요. | #6 (메일 실패를 구분할 때만) |

- 문구만 바꾸는 기존 코드: `BIZ_CLOSED`를 `휴업 또는 폐업한 사업자예요. 계속사업자 정보로 다시 입력해 주세요.`로 고친다(지금 문구에는 다음 행동이 없다).
- 다시 쓰는 기존 코드: `VALIDATION` 400(#1 · #2 · #3 · #5 · #6 · #10 · #13 · #14 · #19 · #20 · #21 · #22 · #23 · #25 · #27), `EMAIL_DUPLICATE` 409(#1), `ALREADY_PROCESSED` 409(#5 · #6 · #8 · #9 · #12 · #13 · #16 · #17), `FILE_TYPE` 400(#5), `FILE_TOO_LARGE` **413**(#5), `CONSENT_LINK_INVALID` 404 · `CONSENT_LINK_EXPIRED` **410**(#7 · #8 · #9), `NOT_VERIFIED` · `GUIDE_PROFILE_REQUIRED` 403 · `OUTSIDE_VACATION` 400(#14), `TOUR_ALREADY_COMPLETED` 409(#16 · #17), `COURSE_NOT_DRAFT` 409(#19 · #20), `REVIEW_NOT_ALLOWED` 403 · `REVIEW_DUPLICATE` 409(#21), `BIZ_MISMATCH` · `BIZ_CLOSED` 400(#22, 409는 "이미 처리됨" 계열이라 쓰지 않는다), `STORE_ALREADY_LINKED` · `STORE_LIMIT` 409(#24 · #25), `PARTNERSHIP_PERIOD_INVALID` 400(#27).
- 410과 413은 이 계약에서 처음 쓰는 상태다. 프록시가 본문 없는 413을 주면 프론트가 `FILE_TOO_LARGE`로 취급한다.
- 끝난 탐방을 승인할 때 `TOUR_NOT_RECRUITING`을 줄지는 동결된 승인 API(3절)를 건드리므로 6절 26번에서 묻는다.

## 4. 타입 정의

아래 타입은 프론트 `src/features/*/model.ts`의 실제 정의와 같다. 단 `CourseStop.review.recent`(최근 리뷰)는 계약에 먼저 넣은 필드라 프론트 타입 · 목업 · 화면(상점 시트의 `최근 리뷰` 펼치기, 설계 5.6 · R-02)은 MVP 2단계에서 맞춘다. 3-2절 엔드포인트가 쓰는 새 타입은 이 절 끝의 "P1 추가 타입"에 있고, 동결 타입의 뜻을 더 분명히 적은 곳은 "의미 고정"에 모았다. 그때까지 프론트는 이 필드를 읽지 않으므로 먼저 내려 줘도 된다. `string`으로 적힌 날짜 · 시각은 2절 형식을 따른다.

**서버가 계산해서 주길 기대하는 값.** 프론트는 자기 시계로 유효 여부를 판단하지 않고 이 값을 그대로 그린다.

| 필드 | 설명 |
|---|---|
| `TourSummary.remainingSeats` | 남은 자리 (정원 − 승인 수) |
| `TourDetail.myApplication` | 요청자의 이 탐방 신청(없으면 `null`). 신청 버튼 상태 결정에 쓴다 |
| `TourDetail.openChatUrl`, `MyApplication.openChatUrl` | **승인된 신청자에게만** 내려준다. 그 밖에는 `null` |
| `MyApplication.cancellable` | 지금 직접 취소할 수 있는지 (탐방 날짜 전, 대기 · 승인 상태) |
| `MyApplication.couponCount` | 이 신청으로 발급된 쿠폰 수 |
| `Coupon.state` | `BEFORE_DAY`(탐방 당일 전) · `USABLE` · `EXPIRED` · `USED`. 발급 상태(`status`)와 시각을 합쳐 서버가 판정 |
| `Coupon.reviewWritten` | 이 쿠폰(= 이 탐방 × 이 상점)으로 쓴 리뷰가 있는지. 다른 탐방에서 같은 상점을 리뷰했어도 이 값은 `false`다 |
| `CourseStop.review` · `CourseStop.partnership` | 지점별 리뷰 요약(평균 · 개수 · AI 요약 · 최근 리뷰 최신순 최대 3개, 같은 시각이면 id 내림차순, 학생 · 가이드 모든 `Course` 응답에 포함)과 제휴 할인. 해당 없으면 `null`(캠퍼스 지점의 `review`). 리뷰가 0건인 상점은 `{ average: null, count: 0, summary: null, recent: [] }` |
| `Course.issuedCouponCount` | 코스 확정 때 발급된 쿠폰 수 |
| `TourSummary.title` | 탐방 제목. 가이드가 개설 때 입력한 값(`CreateTourInput.title`)을 그대로 준다. 제목이 없는 기존 탐방만 "대학교 + 가이드 학과 + 탐방"으로 만든 값이다(6절 2번) |

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
  partnership: { discount: string } | null;
  review: { average: number | null; count: number; summary: string | null;
    recent: { rating: number; content: string; createdAt: string }[] } | null;  // recent: 최신순 최대 3개(판정 C27, 프론트 반영은 MVP 2단계)
  dataSource: string | null }
// review.recent[]: rating 1~5(ERD reviews.rating), content = 한줄평(reviews.content), createdAt = 작성 시각(+09:00 ISO 8601)
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

### P1 추가 타입 (3-2절 엔드포인트용 — 동결 대상 아님)

프론트는 이 타입으로 목업을 만들고 있다. 위 동결 타입은 구조를 바꾸지 않는다. 요청 본문 타입은 `*Input`이고, 후보 항목은 가리키는 리소스를 `storeId`로 쓴다(`CourseStop.storeId` · `Coupon.storeId`와 같은 규칙).

```ts
// auth/model.ts — 추가
type SignupRole = Exclude<Role, 'ADMIN'>;
interface SignupInput { email: string; password: string; name: string; role: SignupRole }
interface StudentProfileInput {            // PUT: 네 키를 모두 보낸다. 이메일은 읽기 전용이라 없다
  name: string;                            // users.name — 내 정보 수정의 이름 칸
  highSchoolName: string | null; grade: number | null; interestedMajor: string | null }
interface GuideProfileInput { major: string; introduction: string | null }   // 학교는 받지 않는다(재학 인증 대학)

// verification/model.ts — 새 모듈
interface StudentVerificationView {        // ERD student_verifications. 미제출이면 overview.student = null
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  highSchoolName: string | null;           // 고교생
  universityId: number | null;             // 대학생
  rejectionReason: string | null;          // REJECTED일 때만 그린다
  submittedAt: string; reviewedAt: string | null }
interface GuardianConsentView {            // ERD guardian_consents
  status: 'PENDING' | 'AGREED' | 'REJECTED' | 'EXPIRED';   // EXPIRED = PENDING + expiresAt 지남(서버 계산)
  guardianName: string; guardianEmail: string;
  expiresAt: string | null; agreedAt: string | null;
  demoConsentToken: string | null }        // 시연 · 개발 환경 전용(6절 21번). 운영 공개 요청에는 반드시 null
interface VerificationOverview {
  student: StudentVerificationView | null; // null = 미제출
  guardian: GuardianConsentView | null }   // 고교생만. null = 미요청(대학생은 늘 null)
// POST /api/me/student-verification 폼 필드(multipart/form-data, 값은 문자열):
//   document: 파일(jpg · png · heic · heif, 10MB 이하, MIME 또는 확장자로 판정)
//   고교생: highSchoolName, grade('1' | '2' | '3') / 대학생: universityId
interface GuardianConsentInput { guardianName: string; guardianEmail: string }
interface ConsentRequest {                 // 보호자 동의 페이지(로그인 없음)
  status: 'PENDING' | 'AGREED' | 'REJECTED';   // 만료 · 무효는 오류 코드(410 · 404)로 온다
  studentName: string; studentGrade: number | null;
  expiresAt: string | null;
  decidedAt: string | null }               // AGREED = agreed_at, REJECTED = 거부 처리 시각(ERD에 칸이 없어 updated_at)
type VerificationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
interface VerificationRequestSummary {     // 학생증 인증 요청(사업자 심사는 없다)
  id: number;                              // 심사 요청 ID(ERD상 users.id). 프론트는 불투명 number로만 쓴다
  role: 'HIGH_SCHOOL' | 'UNIVERSITY';
  userName: string; email: string;
  schoolName: string;                      // 고교생 high_school_name, 대학생 "{대학교} {캠퍼스}"(서버가 만든 표시값)
  status: VerificationRequestStatus;
  submittedAt: string; reviewedAt: string | null;
  rejectionReason: string | null }
interface VerificationRequestDetail extends VerificationRequestSummary {
  documentUrl: string | null }             // PENDING일 때만. <img src>로 바로 열리는 URL. 처리 뒤 null = 파일 삭제됨

// tours/model.ts — 추가
interface CreateTourInput {
  title: string;                           // 탐방 이름(2~30자 제안). TourSummary.title로 그대로 돌아온다
  startsAt: string; endsAt: string;        // +09:00 ISO, 같은 날 · 종료가 더 늦음
  capacity: number; introduction: string;
  openChatUrl: string | null }             // 학교는 보내지 않는다
interface GuideTourDetail extends GuideTourSummary {
  cancellable: boolean; completable: boolean; courseStopCount: number }

// reviews/model.ts — 새 모듈(코스 · 후보 타입이 가져다 쓴다)
interface StoreReviewSummary { average: number | null; count: number; summary: string | null }
interface RecentReview { rating: number; content: string; createdAt: string }   // 위 CourseStop.review.recent[]와 같다
interface StoreReview extends StoreReviewSummary { recent: RecentReview[] }     // 0건 = { average: null, count: 0, summary: null, recent: [] }
interface CreateReviewInput { couponId: number; rating: number; content: string }
interface MyReview { id: number; couponId: number; tourId: number; storeId: number;
  rating: number; content: string; createdAt: string }
// 위 CourseStop.review는 StoreReview와 같은 모양이다(구조 변경 없음)

// courses/model.ts — 추가
interface CourseStoreCandidate {
  storeId: number; name: string; category: string; address: string; lat: number; lng: number;
  distanceM: number;                       // 대학 중심에서, 미터 정수
  relatedIntent: string | null;            // 승인자들이 적은 하고 싶은 것과 맞는 생활 의도(식사 · 카페 · 놀거리 등). 없으면 null
  matchedRequest: string | null;           // relatedIntent가 나온 '하고 싶은 것' 문구(30자 이내). 관련이 없으면 null
  partnership: { discount: string } | null;    // 탐방 날짜에 유효한 제휴(= 쿠폰 대상)
  review: StoreReviewSummary;              // recent는 없다
  dataSource: string | null }

// stores/model.ts — 새 모듈
interface BusinessVerificationInput {
  businessNumber: string;                  // 숫자 10자리
  representativeName: string;
  openingDate: string }                    // YYYY-MM-DD
interface OwnerStoreCandidate { storeId: number; name: string; address: string; category: string;
  linkable: boolean }                      // 다른 사장님이 연결하지 않은 가게
interface BusinessVerificationResult { verifiedAt: string; candidates: OwnerStoreCandidate[] }
type PartnershipState = 'ACTIVE' | 'SCHEDULED' | 'ENDED';   // 서버가 오늘(서울)과 기간으로 계산. ERD 칼럼이 아니다
interface Partnership { id: number; discount: string;
  condition: string | null;                // 할인 조건(예: 탐방 당일 · 1회 사용 가능). ERD 칼럼은 6절 32번
  startDate: string; endDate: string; state: PartnershipState }
interface MyStore { id: number; name: string; address: string; category: string;
  partnership: Partnership | null }        // 가게당 "지금 쓰는 제휴" 1건
interface StoreRegistrationInput { name: string; address: string; category: string;
  lat?: number; lng?: number }             // 서버가 주소를 좌표로 바꾸면 생략(6절 6번)
interface PartnershipInput { discount: string; condition: string | null; startDate: string; endDate: string }
```

**서버가 계산해서 주길 기대하는 값 — P1 추가분**

| 필드 | 설명 |
|---|---|
| `GuardianConsentView.status`의 `EXPIRED` | 동의 대기이면서 `expires_at`이 지난 경우. `Me.guardianStatus`와 같은 기준이다 |
| `GuardianConsentView.demoConsentToken` | 시연 · 개발 환경에서만 채운다. 운영 공개 요청은 null(6절 21번) |
| `GuideTourDetail.cancellable` · `completable` · `courseStopCount` | 취소 가능 = 모집 중 · 마감. 완료 가능 = 취소 가능이면서 오늘(서울)이 탐방 날짜와 같거나 뒤. 코스 지점 수(코스가 없으면 0) |
| `CourseStoreCandidate.distanceM` · `relatedIntent` · `partnership` | 대학 중심 거리(m, 정수), 승인자 의도와 맞는 생활 의도(없으면 null), 탐방 날짜에 유효한 제휴 |
| `CourseStoreCandidate.matchedRequest` | 승인된 신청자들의 `하고 싶은 것` 문구 중 `relatedIntent`가 나온 것(30자 이내). 관련이 없으면 null. 화면에 `학생 요청: …`으로 그린다 |
| `OwnerStoreCandidate.linkable` | 다른 사장님이 연결하지 않은 가게인지 |
| `Partnership.state` | 오늘(서울)과 기간으로 계산한 `ACTIVE` · `SCHEDULED` · `ENDED` |
| `VerificationRequestSummary.schoolName` | 고교명 또는 "{대학교} {캠퍼스}" |
| `VerificationRequestDetail.documentUrl` | 대기 중에만 주고, `<img src>`로 바로 열려야 한다 |
| `ConsentRequest.studentName` · `studentGrade` | 보호자 화면의 "학생: {이름} · 고등학교 {학년}학년"에 쓴다 |

**프론트가 계산하는 값.** 코스 상점 후보의 `도보 약 6분`(V2 G07)은 프론트가 `distanceM`을 80 m/분으로 나눠(분 단위 올림) 그린다. 서버는 `distanceM`만 주면 된다.

**의미 고정 (구조는 그대로, 뜻만 적는다)**

- `Me.guideProfile`: `UNIVERSITY`이고 프로필 행이 있으면 객체다(`major`가 null일 수 있다). 행이 없으면 null.
- `Me.guideProfile.universityId`: 가장 최근 재학 인증 제출의 대학이다. 서버가 `POST /api/me/student-verification`(대학생) 때 맞춘다. null = 제출 전. 프로필 저장(#3)은 학교를 받지 않는다.
- `Me.rejectionReason`: `verificationStatus === 'REJECTED'`일 때만 의미가 있다. 그 밖에는 프론트가 그리지 않는다.
- `Coupon.reviewWritten`: 이 쿠폰(= 이 탐방 × 이 상점)으로 쓴 리뷰가 있는지다. 리뷰는 쿠폰 기준으로 만든다(ERD `reviews.coupon_id`, 중복 기준은 탐방 × 상점).
- `CourseStop.review.recent`: 최신순 최대 3개, 작성 시각이 같으면 id 내림차순이다. 학생 · 가이드의 모든 `Course` 응답에 같이 들어간다.
- `TourSummary.title`: 가이드가 개설 때 입력한 제목(`CreateTourInput.title`)이다. 제목이 없는 탐방(기존 데이터)만 "대학교 + 가이드 학과 + 탐방"으로 만든 값이다(6절 2번).

**ERD 대응** (필드 이름 · 상태값의 근거)

| 타입.필드 | ERD | 비고 |
|---|---|---|
| `StudentVerificationView` · `VerificationRequest*`의 `status` · `highSchoolName` · `universityId` · `rejectionReason` · `submittedAt` · `reviewedAt` | `student_verifications` | 상태값은 ERD 그대로. 레코드 없음 = 미제출 |
| `VerificationRequestDetail.documentUrl` | `student_verifications.document_url` | 심사가 끝나면 null |
| `GuardianConsentView.guardianName` · `guardianEmail` · `expiresAt` · `agreedAt` | `guardian_consents` | `EXPIRED`는 계산값 |
| `StudentProfileInput.name` | `users.name` | 나머지 키는 `student_profiles` |
| `GuideProfileInput.*` | `guide_profiles.major` · `introduction` | `university_id`는 인증 제출에서 맞춘다 |
| `CreateTourInput.*` | `tours.starts_at` · `ends_at` · `capacity` · `introduction` · `open_chat_url` | `title`은 ERD에 없다(6절 2번). `university_id`는 서버가 채운다 |
| `CreateReviewInput` · `MyReview` | `reviews` | `content` = 한줄평 |
| `StoreReviewSummary.summary` | `store_review_summaries.summary` | |
| `Partnership.discount` · `startDate` · `endDate` | `store_partnerships.discount_description` · `start_date` · `end_date` | 이름 `discount`는 `CourseStop.partnership.discount`와 맞춘다. `condition`은 ERD에 없다(6절 32번) |
| `MyStore` · 후보의 `name` · `address` · `category` | `stores` | 계정당 1개 |
| `BusinessVerificationResult.verifiedAt` | `business_verifications.verified_at` | 사업자번호 칸은 ERD에 없다(6절 30번) |

## 5. 골든 패스 밖에서 P1 화면이 필요로 하는 것

MVP에는 막다른 곳 없는 최소판으로 들어가는 화면들이다. 위 29개와 달리 동결 대상이 아니고, 요청 · 응답 모양은 **3-2절 표의 초안**(줄마다 `→ #번호`)이다. 아래는 화면이 필요로 하는 동작 목록이고, 백엔드 명세가 나오면 그 모양에 맞춘다. 화면 문구와 배치는 하이파이 V2를 따른다([`design-v2.md`](../reference/design-v2.md)).

- 회원가입 → #1: 이메일 · 비밀번호 · **이름** · 역할을 받아 계정을 만든다. 이름은 ERD `users.name`이 NOT NULL인데 기능 명세 입력에 없어서 필드를 추가했다.
- 재학 인증 업로드 → #5 (진행 상태 조회 #4): 학생증 사진과 학교 정보를 multipart로 올린다. 형식 jpg · png · heic · heif, 10MB 이하(`FILE_TYPE`, `FILE_TOO_LARGE`).
- 보호자 동의 요청 → #6: 고교생이 보호자 이름 · 이메일을 보내면 동의 링크 메일을 발송하고 `guardianStatus`를 `PENDING`으로 한다.
- 보호자 동의 재요청 → #6: 거부 · 만료 · 대기 상태에서 토큰과 만료 시각을 새로 발급해 다시 보낸다.
- 보호자 동의 페이지 → #7 · #8 · #9: 로그인 없이 토큰으로 열어 동의 또는 거부한다. 상태는 유효 · 만료(`CONSENT_LINK_EXPIRED`) · 이미 처리됨 · 잘못된 링크(`CONSENT_LINK_INVALID`).
- 내 정보 수정 → #2: 고교생 프로필(**이름** · 학교 · 학년 · 관심 전공)을 고친다. 이메일은 보여 주기만 한다(V2 H17).
- 가이드 프로필 → #3: 전공 · 소개를 저장한다(학교는 재학 인증 대학). 미작성이면 탐방 개설이 막힌다(`GUIDE_PROFILE_REQUIRED`).
- 탐방 개설 → #14 (개설한 탐방 조회 #15): **탐방 이름** · 날짜 · 시간 · 정원 · 소개로 탐방을 만든다. 방학 기간 밖 날짜는 거절(`OUTSIDE_VACATION`)하고, 재학 인증 승인과 가이드 프로필이 필요하다.
- 탐방 완료 → #16: 가이드가 탐방을 `COMPLETED`로 바꾼다. 탐방 날짜 이후에만 가능하다.
- 탐방 취소 → #17: 가이드가 탐방을 취소하면 모든 신청이 `CANCELED`, 발급된 쿠폰이 `EXPIRED`가 된다. 완료된 탐방은 취소 불가(`TOUR_ALREADY_COMPLETED`).
- 주변 상점 조회(S-02) → #18 (추가 #19, 교체 #20): 코스 편집에서 상점을 추가 · 교체할 때 쓰는 후보 목록. 정렬은 **하고 싶은 것과 관련된 업종 우선, 그다음 거리순**이고, 후보마다 관련된 학생 요청(`matchedRequest`)을 함께 보여 준다.
- 사업자 인증 → #22: 사업자번호 등을 보내 진위확인 결과와 후보 상점을 받는다. 운영자 심사 없이 자동으로 끝난다. 불일치 · 휴폐업은 `BIZ_MISMATCH`, `BIZ_CLOSED`.
- 가게 연결 → #23 · #24 (내 가게 조회 #26): 가게 이름으로 검색하거나 사업자 정보로 대조한 후보 상점을 내 가게로 연결한다. 이미 다른 사장님이 연결한 가게는 거절(`STORE_ALREADY_LINKED`), 계정당 1개(`STORE_LIMIT`).
- 가게 직접 등록 → #25: 후보에 없는 가게를 상호 · 주소 · 업종으로 직접 등록한다(주소 → 좌표 변환은 6절 질문).
- 제휴 설정 → #27: **혜택 이름**(할인 내용) · **할인 조건**과 제휴 기간을 저장한다. 시작일이 종료일보다 늦으면 `PARTNERSHIP_PERIOD_INVALID`.
- 리뷰 작성 → #21: 쿠폰을 사용한 상점에 별점과 글을 남긴다. 쿠폰을 쓰지 않았으면 `REVIEW_NOT_ALLOWED`, 같은 탐방 × 상점에 이미 썼으면 `REVIEW_DUPLICATE`. 저장 시 AI 요약(R-03)을 갱신한다.
- 운영자 심사 → #10 · #11 · #12 · #13: **학생증 인증** 요청 목록(대기 · 처리 내역), 상세(학생증 이미지), 승인, 반려(사유 포함). 이미 처리된 건은 `ALREADY_PROCESSED`, 심사가 끝나면 이미지를 삭제한다. 사업자 심사는 없다.
- 알림 설정(V2 H18 · G13의 토글): **API 없음.** 값은 기기에만 저장하고 서버로 보내지 않는다. 서버 저장이 필요한지는 6절 33번이다.

## 6. 백엔드에 묻고 싶은 것

팀 요청 13번(프론트 진척 문서의 "팀 요청 · 블로커")과 C-01 규칙 반영 요청(18번)이 여기에 해당한다.

**응답 모양**

1. **표시용 집계 값을 응답에 포함해 주실 수 있나요?** 포함해 주시면 프론트가 가장 단순하다. 4절의 "서버가 계산해서 주길 기대하는 값" 표가 그 목록이다. 대표적으로 탐방 제목(입력값이 없으면 대학교 + 가이드 학과), 남은 자리, 내 신청 상태, 가이드 인증 배지(`guideVerified`), 지점별 리뷰 요약 · 별점 · 제휴 여부, 쿠폰별 리뷰 작성 여부다. 따로 못 주는 값이 있으면 알려 주세요.
2. **탐방 제목을 저장하고 돌려줄 수 있나요?** V2 탐방 개설(G04)과 모든 목록이 `디자인 전공자의 하루` 같은 가이드가 직접 정한 제목을 쓴다. T-03에 제목 필드(ERD `tours.title`, 2~30자 제안)를 더해 요청(`CreateTourInput.title`)으로 받고, `TourSummary.title`로 입력값을 그대로 돌려주세요. 응답 모양은 이미 있는 필드라 바뀌지 않고 값의 의미만 바뀐다. 제목이 없는 탐방(시드 · 기존 데이터)은 이전처럼 "대학교 + 가이드 학과 + 탐방"으로 만든 값을 주면 되고, 프론트는 날짜를 항상 함께 보여 준다.
3. **응답 필드 표기**는 camelCase를 제안하는데 다르게 정하신다면 알려 주세요. OpenAPI(Swagger) 문서를 제공해 주시면 프론트가 `openapi-typescript`로 타입을 만들어 맞춘다.
4. **인증 방식**은 Bearer 토큰을 가정했다. 쿠키 세션이면 알려 주세요.

**동작**

5. **사진 업로드 방식**: 학생증은 multipart로 올리는 안을 가정했다. presigned URL 방식이면 흐름이 달라진다.
6. **직접 등록한 가게의 주소 → 좌표 변환은 누가 하나요?** 서버가 하면 요청에 주소만 보낸다. 프론트가 하면 카카오 지오코더로 좌표를 구해서 같이 보낸다.
7. **코스 순서를 바꾸거나 지점을 추가 · 삭제할 때 방문 시간 재계산은 누가 하나요?** 프론트 목업은 "방문 시간은 위치 슬롯에 고정"(탐방 시작 시각 기준 0 · 70 · 120 · 170 · 220분, 그다음부터 50분씩)이고 서버가 재계산해서 `CourseStop.visitTime`을 준다고 가정했다.
8. **LLM(추천 · 코스 초안 · 리뷰 요약) 결과 캐시와 타임아웃 대체 응답**이 있나요? 프론트는 AI 엔드포인트를 30초까지 기다리고 실패하면 "다시 시도"를 보여 준다. 시연 중 느려질 때 미리 만든 대체 응답을 줄 수 있으면 좋다.
9. **코스 확정 때 쿠폰은 누구에게 발급되나요?** 목업은 승인된 신청자 × 코스 안 제휴 상점, 유효기간은 탐방 당일이다. 제휴 상점이 0곳이면 0장(`issuedCouponCount: 0`). 확정 뒤에 승인된 신청자에게도 발급한다.

**C-01 규칙**

10. **코스 초안(C-01)은 관련 후보 중 제휴 상점을 최소 1곳 포함**해 주세요([결정 0008](../decisions/0008-c01-includes-partner-store.md)). 기획 문서에서 S-03(제휴 우선)과 C-01 변경 정리(제휴 제외)가 충돌했고, 제휴 상점이 코스에 없으면 쿠폰이 발급되지 않아 시연이 끊긴다.

**시연 운영**

11. **시연 리셋 수단**: `POST /api/demo/reset`을 비밀 키 헤더(`X-Demo-Key`)로 보호하는 안이다. 공개 배포이므로 키 없이 호출되면 안 된다. 다른 수단(스크립트, 관리 도구)이면 알려 주세요. `checkpoint` 값으로 중간 단계 시드에서 시작할 수 있으면 좋다. 프론트(시연 패널 · 원클릭 링크 `reset=1`)는 지금 이렇게 부르고, 목업은 키 검사(403)만 빼고 같은 약속을 구현한다.
    - 요청: 본문 `{ "checkpoint"?: "START" | "APPLIED" | "APPROVED" | "CONFIRMED" }`(없으면 `START`), 헤더 `X-Demo-Key: <키>`. 키는 원클릭 시연 링크의 `key=`로 받아 브라우저에 둔다.
    - **세션 토큰 없이** 부른다(`Authorization` 헤더 없음). 리셋은 로그인과 상관없이 키만으로 동작해야 한다 — 지난 리허설의 만료된 토큰이 남아 있어도 리셋이 되게.
    - 응답: 성공 `200 { "ok": true }`. 키가 없거나 틀리면 `403 FORBIDDEN`, 모르는 `checkpoint`는 `400 VALIDATION`(데이터는 그대로).
    - 리셋할 때마다 12번처럼 **그날(Asia/Seoul) 기준 상대 날짜**로 다시 시드한다(시연 탐방 = 오늘).
    - 프론트는 리셋이 성공하면 세션 토큰을 버리고 시연 계정으로 다시 로그인한다. 그래서 리셋이 기존 세션을 모두 무효로 만들어도 된다.
    - `checkpoint`는 시연 골든 패스(설계 6.1)를 그 단계까지 진행한 데이터다. `START`: 기본 시드 — 시연 학생 `student@demo.kr`은 어느 탐방에도 신청 · 쿠폰이 없다. `APPLIED`: + 그 학생이 시연 탐방(가이드 `guide@demo.kr`)에 신청했다(승인 대기). `APPROVED`: + 가이드가 그 신청을 승인했다. `CONFIRMED`: + 가이드가 코스 초안을 만들어 확정했다(승인자마다 코스 안 제휴 상점 쿠폰이 발급돼 오늘 사용 가능). 목업 시드의 시연 탐방에는 미리 승인된 학생 2명과 승인 대기 1명이 더 있다(승인 화면 · 정원 표시용).
12. **당일 날짜 시드**: 시연 탐방은 "오늘", 시작 시각은 발표 시간대 이후, 제휴 기간은 오늘을 포함하는 시드를 만드는 스크립트가 필요하다([결정 0007](../decisions/0007-demo-data-seeded-with-today.md)). 리셋 때마다 오늘 기준으로 다시 만들어 주세요.
13. **시연 계정 시드**: 역할별 계정(고교생 · 가이드 · 사장님 · 운영자)과, 제휴 상점마다 사장님 계정이 필요하다. 시연 캠퍼스 주변의 식사 · 카페 상점은 모두 제휴 상점으로 두면 골든 패스가 항상 이어진다. 프론트는 아래 값을 고정해 쓴다(`src/shared/config/demoAccounts.ts` — 빠른 로그인 · 원클릭 링크 `as=` · 시연 패널). 다르게 시드하면 알려 주세요. 그 파일 하나만 바꾼다.
    - 계정 이메일: 고교생 `student@demo.kr`(재학 인증 `APPROVED` · 보호자 동의 `AGREED` — 바로 신청할 수 있다), 인증 전 고교생 `newbie@demo.kr`(재학 인증 미제출), 가이드 `guide@demo.kr`(재학 인증 `APPROVED` · 가이드 프로필 작성, 시연 탐방의 가이드), 사장님 `owner1@demo.kr` ~ `owner4@demo.kr`(사업자 인증 완료, 각자 가게 1개 연결), 운영자 `admin@demo.kr`.
    - 비밀번호: 시연 계정은 **모두 같은 비밀번호 하나**를 쓴다. 프론트는 빌드 환경변수 `VITE_DEMO_PASSWORD`로 받는다(번들에 들어가 공개되므로 시연 전용 계정에만 쓴다). 목업의 비밀번호는 `demo1234`다.
    - 가게 ↔ 사장님: 상점 id `1` = `owner1`, `2` = `owner2`, `3` = `owner3`, `4` = `owner4`(목업: 서천 밥상 · 카페 모래시계 · 영통 분식집 · 보드게임 카페 다이스). 시연 도구의 `쿠폰 가게 사장님으로 전환`(발표 모드에서는 `사장님` 버튼)이 학생 쿠폰의 `storeId`로 사장님 계정을 고르므로 이 짝이 맞아야 하고, 프론트는 이 네 가게만 시연 가게로 본다. 사장님의 `GET /api/me`는 연결한 가게의 `storeId`를 준다(사용 처리 화면이 "내 가게 쿠폰"인지 고를 때 쓴다).
14. **일정**: 골든 패스 계약 동결 11/6, API 배포 11/9, 배포 주소 고정 11/12가 가능한지 확인 부탁드린다.

**정해 둔 규칙 · 임시 문구**

15. **재신청 규칙**: 취소 후 재신청은 허용하고, 거절된 탐방에는 재신청할 수 없다(`REAPPLY_AFTER_REJECT` 409). 설계 9장 #9에서 확정했고 ERD `active_user_id`(대기 · 승인 신청에만 채움)와 같은 기준이다. 프론트의 신청 버튼과 "거절됨" 표시가 이 규칙을 따르니, 다르게 구현하면 알려 주세요.
16. **목업 AI 문구는 임시다**: 목업이 만드는 추천 이유 · 코스 지점 이유 · fallback 문구(추천 0건일 때의 대체 목록 제목과 이유)는 화면을 먼저 만들려고 정한 예시다. 실서버에서는 LLM 출력이 이 문구를 대체하므로 문구를 여기에 맞출 필요는 없다.

**P1 엔드포인트 · 업로드 · 전송** (3-2절 · 5절 이어서)

17. **P1 엔드포인트 27개(3-2절) 모양**에 대한 의견을 11/8까지, 늦어도 구현을 시작하기 전에 주세요. 동결 대상은 아니고, 프론트는 `api.ts`에서 차이를 흡수한다(1절).
18. **업로드**(5번 질문의 구체안): multipart 필드 이름은 `document` · `highSchoolName` · `grade` · `universityId`다. 10MB 이하 jpg · png · heic · heif이고, 확장자로도 판정해 달라(HEIC는 MIME이 비어 `application/octet-stream`으로 올 수 있다). 서버와 프록시의 본문 한도를 10MB보다 넉넉하게 올려 줄 수 있나(예: Spring 기본 파일 한도 1MB)? 넘으면 413이면 되고 본문은 없어도 된다. Vercel `/api` 프록시는 아직 설정 전이라 배포에서 9~10MB 파일로 직접 잰다.
19. **심사 사진 URL**: `<img>`는 Bearer 헤더를 보낼 수 없다. `documentUrl`을 짧게 유효한 서명 URL로 줄 수 있나? 안 되면 `GET /api/admin/student-verifications/:id/document`(Bearer, 이미지 바이트)를 받아 프론트가 object URL로 그린다.
20. **`GET /api/me/verification` 집계**를 줄 수 있나? 보호자 이름 · 이메일 · 만료 시각 · 제출 시각은 `Me`에 없다. 못 주면 `Me`로 상태만 그리고 미리 채움과 만료 시각 표시를 뺀다. 그리고 **가입 응답에 토큰**(`LoginResponse`)을 주나? 안 주면 프론트가 로그인을 한 번 더 부른다.

**동작 — 인증 · 프로필**

21. **보호자 동의 메일**: 실제로 보내나? 링크 주소는 `{프론트 주소}/consent/{token}`, 유효 기간은 목업 기준 7일이다. 재요청하면 이전 토큰은 무효가 된다. 처리한 뒤에도 토큰으로 "이미 처리됨"을 답할 수 있나(ERD `token_hash` NULL 허용)? **`demoConsentToken`**은 시연 때 메일 없이 보호자 페이지로 가는 링크를 만드는 값이다. 운영의 일반 요청에는 반드시 null이어야 하고, **요청에 `X-Demo-Key` 헤더(11번 질문의 리셋 키)가 있을 때만** 채워 줄 수 있나? 프론트는 키를 가진 시연 브라우저에서만 `GET /api/me/verification` · `POST /api/me/guardian-consent`에 이 헤더를 붙이는 안이다.
22. **재학 인증 제출**: 미제출 · 반려 상태에서만 받나(그 밖은 409)? 대학생이 제출하면 `guide_profiles.university_id`를 인증 대학으로 맞추나(U-04)? 고교생은 학년을 같이 받아 프로필에 저장하나(U-05 입력과 ERD에 학년이 없다)? 재제출 때 `rejection_reason`을 비우나? 5개교 밖은 `VALIDATION`(`fieldErrors.universityId`)이면 되나?
23. **가입 · 프로필 규칙**: 비밀번호 최소 길이(목업 8자), 이메일 중복을 대소문자 무시로 볼지, 가입 때 역할별 빈 프로필 행을 만들지, 가이드 프로필을 인증 승인 전에도 저장할 수 있는지, 소개가 선택인지(ERD). 내 정보 수정(#2)의 `name`은 `users.name`을 고치는 것으로 이해했는데 맞나?
24. **심사**: 요청 ID가 `users.id`인가(ERD)? 반려 사유는 필수인가, 길이 상한은(목업 200자)? 처리 내역은 처리가 최근인 순인가? 사업자 인증은 운영자 심사 없이 자동(U-07)이라 목록에 사업자 건은 없다.

**동작 — 탐방 · 코스 · 리뷰**

25. **탐방 개설**: 개설 때 **제목(`title`)**을 받는다(2번 질문). 오픈채팅 링크(T-03 입력, 5절에는 없음)는 선택 입력으로 둔다. 학교는 요청에 넣지 않고 인증 대학을 쓴다. 정원 · 소개 길이(목업 1~10명 · 10~500자)와 "내일 이후만"(목업)은 어떻게 하나?
26. **탐방 완료 · 취소**: 완료는 탐방 날짜(서울) 당일부터인가, 종료 시각 뒤부터인가(목업은 당일부터)? 완료 때 남은 승인 대기 신청은 어떻게 하나? 취소 때 거절된 신청은 그대로인가(목업은 그대로)? **끝난 탐방의 승인을 막나?** 막는다면 3절의 승인 API 에러에 `TOUR_NOT_RECRUITING` 409를 더하자는 제안인데, 동결된 표라서 이 질문으로만 두고 답을 받은 뒤에 반영한다.
27. **주변 상점(S-02)**: 반경과 개수 상한(목업은 1km 안 전부)은? "관련 업종"은 승인자들이 실제로 적은 의도만 보고, 없으면 거리순인가? 정렬은 관련 → 거리 → 이름, 제휴는 탐방 날짜에 유효한 제휴로 보나? `relatedIntent`와 **`matchedRequest`**(승인자 문구 중 관련 문구, 30자 이내)를 서버가 만들어 줄 수 있나? 문구 줄이기와 매칭을 LLM이 하면 알려 달라. AI 표식을 붙여야 한다.
28. **지점 추가 · 교체**(7번 질문 확장): 추가는 맨 끝에 넣고 서버가 방문 시간을 다시 계산하나? 지점 상한(목업 5)은? 같은 상점 중복은 금지하나(쿠폰이 신청 × 상점마다 1장, ERD)? 교체 때 한줄평 · AI 추천 이유를 비우나? 슬롯이 탐방 종료 시각을 넘어도 되나?
29. **리뷰**: R-03 요약을 저장 요청 안에서 갱신하나? 프론트는 30초까지 기다린다. LLM이 실패해도 리뷰는 저장하고 이전 요약을 남기나? 쿠폰을 쓴 즉시, 탐방 완료 전에도 쓸 수 있나(목업은 그렇다)? 한줄평 길이(목업 5~100자)는?

**동작 — 사장님**

30. **사업자 인증 · 가게**: 진위확인 API는 상호 · 주소를 돌려주지 않는 것으로 안다. 그렇다면 `q` 없는 후보 상점은 무엇과 대조하나? 사업자번호를 저장하지 않는다면(ERD `business_verifications`) `q`가 없을 때는 빈 배열이어도 된다. `q`가 있을 때의 상호 검색(이름 포함, 이름순, 최대 20개)은 인허가 데이터 상점과 직접 등록 상점을 모두 대상으로 하나? 직접 등록의 업종 목록은 인허가 업태와 맞추나? 좌표 변환(6번 질문)을 서버가 하면 `ADDRESS_NOT_FOUND`를 쓴다. 제휴는 가게당 "지금 쓰는 1건"을 PUT으로 고치고 id를 유지해도 되나(쿠폰이 `partnership_id`로 가리킨다)? `Partnership.state`는 서버가 계산해 주나?

**시연 운영**

31. **리셋 범위**(11 · 12번 확장): 리허설에서 쓴 리뷰와 바뀐 요약, 프로필 · 인증 · 심사 대기열, 가게 연결 · 제휴, 개설한 탐방까지 시드로 되돌려 달라. 그래야 시연의 "전" 상태가 늘 같다. 프론트 목업은 시드 계정을 8개 더 두고(인증 심사 중 · 반려, 보호자 동의 만료 등 상태별) 체크포인트(`START` ~ `CONFIRMED`)에는 영향을 주지 않는다. 이 계정을 실서버에도 시드할지는 선택이다(13번 표 밖).

**ERD · 알림 설정**

32. **제휴 할인 조건 칼럼**: V2 제휴 설정은 `혜택 이름`(= `discount_description`)과 `할인 조건`(예: `탐방 당일 · 1회 사용 가능`) 두 칸이다. `store_partnerships`에 `condition`(문자열, null 허용, 50자 제안) 칼럼을 더할 수 있나? 안 되면 프론트는 `condition`을 화면에서만 쓰고 저장하지 않는다. 기간 칼럼은 그대로 두고 프론트가 기본값을 채워 보낸다(S-03).
33. **알림 설정**: V2에 알림 토글(신청 승인 · 탐방 일정 · 새 신청 · 승인 대기)이 있는데 기능 명세와 ERD에 알림이 없어서 지금은 기기에만 저장한다. 나중에 알림 발송과 선호 저장(`notification_preferences` 같은)을 둘 계획이 있나? 있으면 `GET · PUT /api/me/notification-settings` 정도를 3-2절에 더하자.

**16번 보강**: 목업의 R-03 요약 템플릿 문구도 임시다. 실서버 LLM 출력이 대신한다.
