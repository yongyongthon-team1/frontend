# 프론트엔드가 기대하는 API (계약 초안)

작성일 2026-11-04 · 프론트엔드 → 백엔드 전달용

## 1. 이 문서의 목적

프론트엔드는 백엔드가 준비되기 전에 목업(MSW)으로 화면을 먼저 만들고 있다. 이 문서는 그 목업이 **지금 가정하고 있는 API**를 그대로 적은 것이다. 백엔드가 API 명세를 쓸 때 참고하는 초안이고, **강제가 아니다.** 백엔드가 다르게 정하면 프론트가 맞춘다. 필드 이름이나 모양 차이는 프론트의 `api.ts` 변환 함수 한 곳에서 흡수할 수 있다.

다만 다음 두 가지는 제안한다.

- **11/6(금)에 골든 패스 계약을 동결**한다. 3절 표의 29개 엔드포인트가 대상이다. 이 날짜 이후에 바뀌면 프론트 목업과 화면을 같이 고쳐야 한다.
- 골든 패스 API는 11/9까지 배포, 배포 주소는 11/12까지 고정한다(팀 일정 기준).

업무 규칙(신청 자격, 정원, 취소 가능 시점 등)의 최종 기준은 백엔드 API다. 목업의 규칙은 기능 명세를 따른 잠정안이므로, 다르게 구현하면 알려 주기만 하면 된다.

배경 문서

- 프론트엔드 설계: `docs/superpowers/specs/2026-11-03-frontend-design.md` (5.5 데이터 · API 연동 계층)
- 결정 기록: [`0002` 목업 먼저 만들기](../decisions/0002-mock-first-with-msw.md) · [`0005` Vercel `/api` 프록시](../decisions/0005-vercel-api-proxy.md) · [`0007` 시연 데이터는 당일 날짜 기준](../decisions/0007-demo-data-seeded-with-today.md) · [`0008` C-01은 제휴 상점 1곳 이상 포함](../decisions/0008-c01-includes-partner-store.md)
- 상태값 근거: `docs/reference/erd.md` (상태값 요약)

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

**에러 코드.** `code`는 문자열 상수이고, 프론트가 이 값으로 한국어 안내 문구를 고른다. `message`는 개발자용 설명이어도 된다. 전체 목록과 문구는 [`src/shared/lib/errors.ts`](../../src/shared/lib/errors.ts)의 표가 기준이다. 프론트가 쓰는 코드가 이미 정리돼 있으니 백엔드가 같은 이름을 쓰면 연동이 가장 쉽다. 다른 이름을 쓰면 매핑 표만 바꾸면 된다.

- `fieldErrors`는 입력 검증 실패(`VALIDATION`, `EMAIL_DUPLICATE` 등)에서 필드 이름별 메시지를 준다.
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
| POST /api/recommendations | `RecommendationQuery` | `RecommendationResult` | VALIDATION 400 | 홈 `/`, 추천 목록 `/recommendations` |
| GET /api/tours?status=&universityId= | — | `TourSummary[]` | — | 추천 0건 대체 목록, 탐색 `/explore` |
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
| POST /api/demo/reset | `{checkpoint?}` + 헤더 `X-Demo-Key` | `{ok:true}` | FORBIDDEN 403 | 시연 패널(시연 데이터 초기화) |

참고

- 코스 응답(`Course`)을 돌려주는 변경 API는 모두 **변경 후의 전체 `Course`**를 준다. 신청 승인 · 거절은 **변경 후의 전체 `ApplicantsBoard`**를 준다. 프론트가 응답으로 화면을 바로 갱신한다.
- `GET /api/guide/tours/:id/course`는 코스가 아직 없으면 `NOT_FOUND 404`를 준다. 프론트는 이를 "코스 없음" 상태로 그린다.
- `GET /api/tours/:id/course`는 코스가 `CONFIRMED`이고 요청자가 승인된 신청자(또는 해당 가이드)일 때만 준다. 코스가 없거나 `DRAFT`면 `COURSE_NOT_READY 404`, 승인되지 않은 사람이면 `FORBIDDEN 403`.
- `POST /api/demo/reset`은 시연 데이터를 시드 상태로 되돌린다. `checkpoint`(선택)를 주면 "신청 완료 · 승인 완료 · 코스 확정 · 쿠폰 발급" 같은 중간 단계에서 시작한다. 6절에서 방식을 묻는다.

## 4. 타입 정의

아래 타입은 프론트 `src/features/*/model.ts`의 실제 정의와 같다. `string`으로 적힌 날짜 · 시각은 2절 형식을 따른다.

**서버가 계산해서 주길 기대하는 값.** 프론트는 자기 시계로 유효 여부를 판단하지 않고 이 값을 그대로 그린다.

| 필드 | 설명 |
|---|---|
| `TourSummary.remainingSeats` | 남은 자리 (정원 − 승인 수) |
| `TourDetail.myApplication` | 요청자의 이 탐방 신청(없으면 `null`). 신청 버튼 상태 결정에 쓴다 |
| `TourDetail.openChatUrl`, `MyApplication.openChatUrl` | **승인된 신청자에게만** 내려준다. 그 밖에는 `null` |
| `MyApplication.cancellable` | 지금 직접 취소할 수 있는지 (탐방 날짜 전, 대기 · 승인 상태) |
| `MyApplication.couponCount` | 이 신청으로 발급된 쿠폰 수 |
| `Coupon.state` | `BEFORE_DAY`(탐방 당일 전) · `USABLE` · `EXPIRED` · `USED`. 발급 상태(`status`)와 시각을 합쳐 서버가 판정 |
| `Coupon.reviewWritten` | 이 쿠폰의 상점에 리뷰를 이미 썼는지 |
| `CourseStop.review` · `CourseStop.partnership` | 지점별 리뷰 요약(평균 · 개수 · AI 요약)과 제휴 할인. 해당 없으면 `null` |
| `Course.issuedCouponCount` | 코스 확정 때 발급된 쿠폰 수 |
| `TourSummary.title` | 탐방 제목. ERD에 없어서 "대학교 + 가이드 학과 + 탐방"으로 만드는 안을 쓰고 있다(6절 질문) |

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

## 5. 골든 패스 밖에서 P1 화면이 필요로 하는 것

MVP에는 막다른 곳 없는 최소판으로 들어가는 화면들이다. 위 29개와 달리 **요청 · 응답 모양을 아직 정하지 않았다.** 필요한 동작 목록이고, 백엔드 명세가 나오면 그 모양에 맞춘다.

- 회원가입: 이메일 · 비밀번호 · **이름** · 역할을 받아 계정을 만든다. 이름은 ERD `users.name`이 NOT NULL인데 기능 명세 입력에 없어서 필드를 추가했다.
- 재학 인증 업로드: 학생증 사진과 학교 정보를 multipart로 올린다. 형식 jpg · png · heic, 10MB 이하(`FILE_TYPE`, `FILE_TOO_LARGE`).
- 보호자 동의 요청: 고교생이 보호자 이름 · 이메일을 보내면 동의 링크 메일을 발송하고 `guardianStatus`를 `PENDING`으로 한다.
- 보호자 동의 재요청: 거부 · 만료 · 대기 상태에서 토큰과 만료 시각을 새로 발급해 다시 보낸다.
- 보호자 동의 페이지: 로그인 없이 토큰으로 열어 동의 또는 거부한다. 상태는 유효 · 만료(`CONSENT_LINK_EXPIRED`) · 이미 처리됨 · 잘못된 링크(`CONSENT_LINK_INVALID`).
- 내 정보 수정: 고교생 프로필(학교 · 학년 · 관심 학과)을 고친다.
- 가이드 프로필: 대학교 · 학과 · 소개를 저장한다. 미작성이면 탐방 개설이 막힌다(`GUIDE_PROFILE_REQUIRED`).
- 탐방 개설: 날짜 · 시간 · 정원 · 소개로 탐방을 만든다. 방학 기간 밖 날짜는 거절(`OUTSIDE_VACATION`)하고, 재학 인증 승인과 가이드 프로필이 필요하다.
- 탐방 완료: 가이드가 탐방을 `COMPLETED`로 바꾼다. 탐방 날짜 이후에만 가능하다.
- 탐방 취소: 가이드가 탐방을 취소하면 모든 신청이 `CANCELED`, 발급된 쿠폰이 `EXPIRED`가 된다. 완료된 탐방은 취소 불가(`TOUR_ALREADY_COMPLETED`).
- 주변 상점 조회(S-02): 코스 편집에서 상점을 추가 · 교체할 때 쓰는 후보 목록. 정렬은 **하고 싶은 것과 관련된 업종 우선, 그다음 거리순**.
- 사업자 인증: 사업자번호 등을 보내 진위확인 결과와 후보 상점을 받는다. 불일치 · 휴폐업은 `BIZ_MISMATCH`, `BIZ_CLOSED`.
- 가게 연결: 후보 상점을 내 가게로 연결한다. 이미 다른 사장님이 연결한 가게는 거절(`STORE_ALREADY_LINKED`), 계정당 1개(`STORE_LIMIT`).
- 가게 직접 등록: 후보에 없는 가게를 주소 등으로 직접 등록한다(주소 → 좌표 변환은 6절 질문).
- 제휴 설정: 할인 내용과 제휴 기간을 저장한다. 시작일이 종료일보다 늦으면 `PARTNERSHIP_PERIOD_INVALID`.
- 리뷰 작성: 쿠폰을 사용한 상점에 별점과 글을 남긴다. 쿠폰을 쓰지 않았으면 `REVIEW_NOT_ALLOWED`, 같은 탐방 × 상점에 이미 썼으면 `REVIEW_DUPLICATE`. 저장 시 AI 요약(R-03)을 갱신한다.
- 운영자 심사: 인증 요청 목록(대기 · 처리 내역), 상세(학생증 이미지), 승인, 반려(사유 포함). 이미 처리된 건은 `ALREADY_PROCESSED`, 심사가 끝나면 이미지를 삭제한다.

## 6. 백엔드에 묻고 싶은 것

팀 요청 13번(프론트 진척 문서의 "팀 요청 · 블로커")과 C-01 규칙 반영 요청(18번)이 여기에 해당한다.

**응답 모양**

1. **표시용 집계 값을 응답에 포함해 주실 수 있나요?** 포함해 주시면 프론트가 가장 단순하다. 4절의 "서버가 계산해서 주길 기대하는 값" 표가 그 목록이다. 대표적으로 탐방 제목(대학교 + 가이드 학과), 남은 자리, 내 신청 상태, 가이드 인증 배지(`guideVerified`), 지점별 리뷰 요약 · 별점 · 제휴 여부, 쿠폰별 리뷰 작성 여부다. 따로 못 주는 값이 있으면 알려 주세요.
2. **탐방 제목 · 주제 필드를 둘 수 있나요?** ERD에는 탐방 제목이 없어서 같은 가이드의 탐방이 모두 같은 제목이 된다. T-03에 주제 필드를 추가하면 좋겠다. 없으면 "대학교 + 가이드 학과 + 탐방"으로 표시하고 날짜를 항상 함께 보여 준다.
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

11. **시연 리셋 수단**: `POST /api/demo/reset`을 비밀 키 헤더(`X-Demo-Key`)로 보호하는 안이다. 공개 배포이므로 키 없이 호출되면 안 된다. 다른 수단(스크립트, 관리 도구)이면 알려 주세요. `checkpoint` 값으로 중간 단계 시드에서 시작할 수 있으면 좋다.
12. **당일 날짜 시드**: 시연 탐방은 "오늘", 시작 시각은 발표 시간대 이후, 제휴 기간은 오늘을 포함하는 시드를 만드는 스크립트가 필요하다([결정 0007](../decisions/0007-demo-data-seeded-with-today.md)). 리셋 때마다 오늘 기준으로 다시 만들어 주세요.
13. **시연 계정 시드**: 역할별 계정(고교생 · 가이드 · 사장님 · 운영자)과, 제휴 상점마다 사장님 계정이 필요하다. 시연 캠퍼스 주변의 식사 · 카페 상점은 모두 제휴 상점으로 두면 골든 패스가 항상 이어진다.
14. **일정**: 골든 패스 계약 동결 11/6, API 배포 11/9, 배포 주소 고정 11/12가 가능한지 확인 부탁드린다.
