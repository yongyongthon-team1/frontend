# 진척 대시보드

프론트엔드 진척 기준의 현황판이다. 작업 단위가 끝날 때마다 해당 행만 갱신한다(설계 7장). 개발 일지는 [`devlog.md`](devlog.md), 결정 배경은 [`../decisions/`](../decisions/)에 있다.

상태 표기: `⬜` 미착수 · `🟨` 진행 중 · `✅` 완료 · `➖` 해당 없음 · `자리` placeholder 라우트(화면 자리만 있고 내용 없음)

마지막 갱신: 2026-11-07

## 체크포인트

팀 공식 일정은 [노션 `# 일정`](https://app.notion.com/p/408e0c1995d680e8be5cce86f42d362d)이 정본이다. 아래 표는 그 일정에 맞춘 프론트 기준이다.

| 날짜 | 체크포인트 | 완료 기준 | 상태 |
|---|---|---|---|
| 11/4 | 빈 앱 배포 | Vercel 고정 도메인에서 SPA 새로고침 · 목업(MSW) · `/api` 프록시 동작 확인 | 🟨 배포 대기 · `/api` 프록시 · 카카오 도메인 미확인(백엔드 주소 · 키 대기) |
| 11/6 | 시연 대본 확정 (팀) | 2분 대본을 스톱워치로 잼. P0를 대본 화면 기준으로 재조정 | ⬜ |
| **11/8** | **MVP** | 배포 링크에서 **목업 모드 골든 패스**(설계 6.1)가 끝까지 동작. P1 화면은 막다른 곳 없는 최소판으로 모두 존재 | 🟨 목업 골든 패스 ✅ V2 적용(배포 빌드 E2E: 골든 패스 · 무대 해상도 3종 · 발표 모드 배지 통과, 배포 링크에서는 배포 후 확인) · P1 최소판 ⬜(MVP 2단계) |
| 11/10 | 실서버 골든 패스 1회 완주 | 배포 링크 + 실서버로 골든 패스 완주. 통과해야 P2 착수 | ⬜ |
| 11/12 | 기능 동결 | 하이파이 반영 · 디자인 QA 완료, 이후 버그 수정만 | ⬜ |
| 11/15 15:30 | 제출 | 동결 절차(설계 5.12) 후 태그한 커밋 · 배포 링크 제출 | ⬜ |

메모(하이파이 V2, MVP 2A): 디자인 시스템 — V2 토큰 · 글꼴(Noto Sans KR) · 브랜드 · 3D 일러스트 에셋 ✅(Task 1). 컴포넌트 · 골든 패스 화면(고교생 · 가이드 · 사장님) · 시연 도구 · E2E V2 ✅(Task 2~12). P1 화면 V2는 MVP 2B.

## 화면 진척

우선순위는 설계 5.3 기준이다. P0 = 시연 골든 패스, P1 = 나머지 MVP(막다른 곳 없는 최소판), P2 = 11/10 체크포인트 통과 후, OUT = 만들지 않음. 단계는 UI → 목업 → 실API → 하이파이 → QA 순서다. 와이어프레임 코드와 이름은 [`wireframes.md`](../reference/wireframes.md) 목록 그대로다.

| 코드 | 화면 | 라우트 | 우선 | UI | 목업 | 실API | 하이파이 | QA |
|---|---|---|---|---|---|---|---|---|
| `hs-s01` | 로그인 | `/login` | P0 | ✅ | ✅ | ⬜ | ⬜ | ⬜ |
| `hs-s02` | 재학 인증 · 보호자 동의 | `/verify` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `hs-s03` | 홈 · AI 탐방 추천 · V2(H01) | `/` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s04` | AI 추천 탐방 목록 · V2(H02) | `/recommendations` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s05` | 탐방 상세 · 신청 · V2(H03) | `/tours/:tourId` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s06` | 신청 완료 · 승인 대기 · V2(H08) | `/tours/:tourId/apply/done` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s07` | 내 탐방 · 승인 완료 · V2(H10 신청 내역 상세) | `/my-tours/:applicationId` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s08` | 탐방 코스 · V2(H04 단계 막대 · 시간표, 지도는 아래 `지도로 보기` 펼침 · H14 코스 준비 중) | `/my-tours/:applicationId/course` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s09` | 상점 쿠폰 · 사용 · V2(H05 내 쿠폰 · 코드 3자리씩, H15 사용 완료는 같은 주소의 USED 모습) | `/my-tours/:applicationId/coupons` · `/coupons/:couponId` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-s10` | 방문 리뷰 작성 | `/reviews/new` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `hs-a01` | 회원가입 · 역할 선택 | `/signup` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `hs-a02` | 보호자 동의 페이지 | `/consent/:token` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `hs-a03` | 내 정보 · 인증 상태 | `/me` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `hs-a04` | 탐방 신청서 · V2(H07) | `/tours/:tourId/apply` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-a05` | 내 탐방 상태별 목록 · V2(H06 예정된 탐방) | `/my-tours` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `H09` | 지난 탐방 (V2) | `/my-tours?tab=past` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `H11` | 신청 취소 확인 (V2, 확인 창 대체) | `/my-tours/:applicationId/cancel` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `hs-a06` | 탐방 추천·신청 예외 상태 · V2(H13 추천 0건 · 탐방 상세의 마감 · 중복 신청 카드) | `/recommendations` · `/tours/:tourId` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `G01` | 가이드 홈 (V2, 신청자 없음 G11 포함) | `/guide` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| — | 코스 편집 탭 (다가오는 탐방의 코스로 이동) | `/guide/course` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `guide-s01` | 가이드 프로필 | `/guide/me` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `guide-s02` | 탐방 개설 | `/guide/tours/new` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `guide-s03` | 신청자 관리 · V2(G02 신청자 승인) | `/guide/tours/:tourId/applicants` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `guide-s04` | AI 추천 코스 생성 · V2(생성 중 로딩 뒤 G03 코스 완성 `edit`로 replace) | `/guide/tours/:tourId/course/draft` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `guide-s05` | 코스 편집 · 상점 교체 · V2(G03 코스 완성: AI 초안 + 편집 한 화면, 카드 `≡` → 지점 시트) | `/guide/tours/:tourId/course/edit` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `guide-s06` | 코스 확정 · 쿠폰 발급 · V2(G08 확정 전 점검 → 같은 화면의 완료 상태, 옛 `/confirmed`는 이리로) | `/guide/tours/:tourId/course/confirm` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `guide-s07` | 탐방 종료 · 완료 | `/guide/tours/:tourId/complete` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `guide-a01` | 대학생 재학 인증 | `/guide/verify` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `guide-a02` | 내가 개설한 탐방 · V2(G06, `?tab=past`) | `/guide/tours` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `guide-a03` | 주변 상점 교체 | `/guide/tours/:tourId/course/stops/pick` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `guide-a04` | 탐방 취소 확인 | `/guide/tours/:tourId/cancel` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `owner-s01` | 사업자 인증 | `/owner/verify` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `owner-s02` | 내 가게 · 제휴 할인 · V2(O01 가게 홈 · O01-E 미연결, 오른쪽 위 `로그아웃`. 제휴 설정 O06은 2B) | `/owner/store` | P1 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `owner-s03` | 쿠폰 사용 처리 · V2(O02 입력 · 조회, O07 사용 완료) | `/owner/coupons/redeem` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| `owner-s04` | 방문 · 리뷰 리포트 | `/owner/report` | P2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `owner-s05` | 빈 시간 달력 | — | OUT | ➖ | ➖ | ➖ | ➖ | ➖ |
| `owner-s06` | 운영자 인증 심사 | `/admin/verifications` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `owner-a01` | 가게 후보 선택·직접 등록 | `/owner/store/connect` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `owner-a02` | 학생증 상세 심사·반려 | `/admin/verifications/:id` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| `owner-a03` | 쿠폰·리포트 예외 상태 · V2(O08 쿠폰 오류 · 만료) | `/owner/coupons/redeem` | P0 | ✅ | ✅ | ⬜ | ✅ | ⬜ |
| — | 모집 중 탐방 둘러보기 (가이드 · 사장님 `탐색` 탭, 읽기 전용) | `/explore` | P2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| — | 사장님 내 정보 · 로그아웃 | `/owner/me` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| — | 확정 코스 지도 보기 (고교생 지도 화면 재사용, `hs-s08`) | `/guide/tours/:tourId/course` | P1 | 자리 | ⬜ | ⬜ | ⬜ | ⬜ |
| — | 404 · 에러 화면 | `*` | P1 | ✅ | ➖ | ➖ | ⬜ | ⬜ |

- `hs-a06`, `owner-a03`은 별도 라우트가 없는 상태 화면이다. 위 표의 라우트는 그 상태가 얹히는 화면이다.
- 코드가 `—`인 행은 와이어프레임이 없는 라우트다. 화면은 와이어 없이 설계 문서(5.3)를 기준으로 만든다.
- `hs-s08`은 목업 · 도식 지도로 확인했다. 카카오맵(실제 지도)은 JavaScript 키(팀 요청 16)가 오면 고정 도메인에서 확인한다.
- `hs-s08` 상점 시트의 `최근 리뷰`(펼치기, 설계 5.6 · R-02)는 계약에만 먼저 넣었다(`CourseStop.review.recent` 최신순 최대 3개, 판정 34). 프론트 타입 · 목업 · 화면은 MVP 2단계에서 만든다.
- `owner-s03`의 O07에는 V2에 없는 `이번 탐방으로 온 학생 {n}명`을 시연의 상권 효과 장면용으로 남겼다(판정 2A-R13). `owner-s02`에서 제휴가 없으면 `제휴 혜택을 설정해 주세요` 문구만 보이고(링크는 2B의 `/owner/store/partnership`이 생기면), 가게 연결은 `/owner/store/connect`(자리)로 간다.
- `owner-a03`은 쿠폰 오류 3종(이미 사용 · 만료/다른 가게 · 없는 코드)과 "아직 사용할 수 없는 쿠폰"까지다. 리포트 빈 상태는 `owner-s04`(P2)와 함께 만든다.
- `guide-s05`는 순서 · 한줄평 · 삭제까지다(V2 G03의 지점 시트). 지점 추가 · 상점 교체는 2단계(`guide-a03`)에서 만든다. 백엔드는 지점 단위 편집이 없어 전체 스팟 PUT(빌더)이다(`buildSpots`, 2C-R13). 백엔드가 지점 1곳 이상을 요구해 마지막 지점의 빼기는 사유 `지점은 1곳 이상 있어야 해요.`와 함께 잠긴다(2C-R12 ②).

## API 연동

도메인별로 시연 대본 순서대로 하나씩 연동하고, 할 때마다 해당 행을 갱신한다. 행은 [`../api/frontend-needs.md`](../api/frontend-needs.md)의 골든 패스 엔드포인트 29개와 P1 엔드포인트 27개(3-2절 초안, `#번호`는 그 절의 번호, 동결 대상 아님)다. P1 `GET /api/owner/store`(#26)는 내 가게 화면 때문에 2A에서 목업을 먼저 만들었고(2C Task 5에서 백엔드 경로 `GET /api/users/me/store`로 바뀜), 나머지 P1 행은 MVP 2B의 API 태스크가 목업을 만들 때 ✅로 바꾼다. 도메인 열은 `VITE_MOCK_DOMAINS`의 이름(`MockDomain`)이다.

| 도메인 | 메서드 · 경로 | 쓰는 화면 | 계약 합의 | 목업 | 실서버 | 배포 확인 |
|---|---|---|---|---|---|---|
| auth | `POST /api/auth/login` (U-02, 백엔드 와이어 · 이어서 `GET /users/me`로 합성) | hs-s01 로그인 · 빠른 로그인 · 원클릭 링크 · 401 재로그인 | ⬜ | ✅ | ⬜ | ⬜ |
| auth | `POST /api/auth/logout` (U-02) | hs-a03 · guide-s01 · `/owner/me` (로그아웃) | ⬜ | ✅ | ⬜ | ⬜ |
| auth | `GET /api/users/me` (U-03, 사장님은 `GET /users/me/store`로 가게 id 합성) | 전 화면 가드 · 첫 화면, hs-s02, hs-a03 | ⬜ | ✅ | ⬜ | ⬜ |
| auth | #1 `POST /api/auth/signup` (U-01, 토큰 없음 → 이어서 로그인) | hs-a01 회원가입 (P1 · 동결 대상 아님) | ⬜ | ✅ | ⬜ | ⬜ |
| auth | #2 `PATCH /api/users/me` (U-03) | hs-a03 내 정보 수정 `/me/edit` (P1 · 동결 대상 아님) | ⬜ | ✅ | ⬜ | ⬜ |
| auth | #3 `PUT /api/users/me/guide-profile` (U-04) | guide-s01 가이드 프로필 `/guide/me/profile` (P1 · 동결 대상 아님) | ⬜ | ✅ | ⬜ | ⬜ |
| campuses | `GET /api/campuses` (D-01, 백엔드 와이어) | hs-s03, guide-s02 | ⬜ | ✅ | ⬜ | ⬜ |
| campuses | `GET /api/campuses/:campusId/insight` (확장 · 목업 전용, 봉투) | hs-s04, guide-s04 | ⬜ | ✅ | ⬜ | ⬜ |
| tours | `POST /api/recommendations` | hs-s03, hs-s04, hs-a06 | ⬜ | ✅ | ⬜ | ⬜ |
| tours | `GET /api/tours` (T-01 보완, 쿼리 `status · campus_id · major · date_from · date_to · page · size`, 백엔드 와이어) | hs-s03 홈 모집 중 목록, `/explore`(P2). 추천 0건 대체 목록(hs-a06)은 `POST /api/recommendations`가 준다 | ⬜ | ✅ | ⬜ | ⬜ |
| tours | `GET /api/tours/:tourId` (T-02, 백엔드 와이어) | hs-s05, hs-a04, hs-s06, hs-a06 | ⬜ | ✅ | ⬜ | ⬜ |
| tours | #14 `POST /api/guide/tours` | guide-s02 탐방 개설 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| tours | #15 `GET /api/guide/tours/:id` | guide-s07 탐방 종료 · guide-a04 탐방 취소 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| tours | #16 `POST /api/guide/tours/:id/complete` | guide-s07 탐방 종료 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| tours | #17 `POST /api/guide/tours/:id/cancel` | guide-a04 탐방 취소 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| applications | `GET /api/users/me/tours` (T-04, 백엔드 와이어 · 역할마다 모양이 다르다. 고교생 행은 `GET /tours/{tourId}`로 탐방 요약을, 확장 `coupon_count`가 없으면 `GET /users/me/coupons?tour_id`로 쿠폰 수를 합성하고, 신청 단건(상세 · 신청 · 취소 뒤)도 이 행에서 찾는다 — 단건 경로는 없다. 가이드 행은 확정이 아니면 `GET /tours/{tourId}/course`로 초안 여부) | hs-a05, hs-s06, hs-s07, G01, guide-a02 | ⬜ | ✅ | ⬜ | ⬜ |
| applications | `POST /api/tours/:tourId/applications` (A-01, 본문 `{ wish }` 100자. `E403_VERIFICATION_REQUIRED`는 `GET /users/me`, `E409_TOUR_FULL`은 `GET /tours/{tourId}`를 다시 읽어 세분) | hs-a04 | ⬜ | ✅ | ⬜ | ⬜ |
| applications | `POST /api/applications/:applicationId/cancel` (A-03, `E409_INVALID_APPLICATION_STATUS`는 신청을 다시 읽어 탐방 날짜 · 이미 처리로 세분) | hs-s07 | ⬜ | ✅ | ⬜ | ⬜ |
| applications | `GET /api/tours/:tourId/applications` (A-04, 신청자 보드 = 이 목록 + `GET /tours/{tourId}` + 코스 상태 합성, `인증` 칩은 늘 켬) | guide-s03, guide-s06 | ⬜ | ✅ | ⬜ | ⬜ |
| applications | `PATCH /api/applications/:applicationId/decision` (A-02, 승인 · 거절 `{ decision }` 뒤 신청자 보드를 다시 읽는다. `E409_TOUR_FULL`은 정원 초과) | guide-s03 | ⬜ | ✅ | ⬜ | ⬜ |
| courses | `GET /api/tours/:tourId/course` (C-04, 백엔드 와이어 · 학생과 가이드가 같이 쓴다. 가이드는 404 → 코스 없음, 학생은 확정 전 `E409_COURSE_NOT_READY`) | hs-s08, guide-s04 · s05 · s06, `/guide/tours/:tourId/course` | ⬜ | ✅ | ⬜ | ⬜ |
| courses | `POST /api/tours/:tourId/course` (C-01 AI 초안, 실패 `E502_AI_FAILED`) | guide-s04 · s05(다시 만들기) | ⬜ | ✅ | ⬜ | ⬜ |
| courses | `PUT /api/tours/:tourId/course/spots` (C-02 전체 스팟 교체 — 순서 · 한줄평 · 빼기를 `buildSpots`로 만든다) | guide-s05 | ⬜ | ✅ | ⬜ | ⬜ |
| courses | `POST /api/tours/:tourId/course/confirm` (C-03 · S-04, 제휴 0곳이면 `E422_PARTNER_REQUIRED`) | guide-s05 → guide-s06 | ⬜ | ✅ | ⬜ | ⬜ |
| courses | #18 `GET /api/guide/tours/:id/course/store-candidates` | guide-a03 주변 상점 선택 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| courses | #19 `POST /api/guide/tours/:id/course/stops` | guide-a03 (지점 추가) (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| courses | #20 `POST /api/guide/tours/:id/course/stops/:stopId/replace` | guide-a03 (지점 교체) (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| coupons | `GET /api/users/me/coupons` (S-05, 백엔드 와이어 · 쪽 없는 목록, `tour_id` · `store_id`로 거른다. 쿠폰 상태는 어댑터가 `computeCouponState`로 계산하고, 탐방 요약은 `GET /tours/{tourId}`, 신청 id는 `GET /users/me/tours` 행(같은 탐방의 승인된 신청)으로 합성한다. 신청 id를 주면 그 신청의 `tourId`로 좁혀 부른다. 확장 `store.category`) | hs-s09 (목록), 코스 지도의 상점 시트 | ⬜ | ✅ | ⬜ | ⬜ |
| coupons | 내 쿠폰 상세 — 단건 경로가 없어 `GET /api/users/me/coupons` 목록에서 찾는다(없으면 `NOT_FOUND`). 5초 폴링은 그대로 | hs-s09 (상세) | ⬜ | ✅ | ⬜ | ⬜ |
| coupons | `GET /api/coupons/:couponCode` (S-06 쿠폰 확인, 백엔드 와이어 · 가게 이름은 `GET /users/me/store`로 합성, `E404` → `COUPON_NOT_FOUND`, 확장 `used_at` · `tour_title` · `student_name`) | owner-s03, owner-a03 | ⬜ | ✅ | ⬜ | ⬜ |
| coupons | `POST /api/coupons/:couponCode/redeem` (S-06 사용 처리, 뒤에 코드를 다시 확인해 카드를 만든다. `E409_ALREADY_USED`(확장 `data.used_at`) · `E410_EXPIRED` · `E409_DAILY_LIMIT`(클라이언트만 — 목업에는 하루 한 장 규칙이 없다, 2C-R11). 확장 `tour_visitor_count` · `total_visitor_count`가 없으면 O07의 `이번 탐방으로 온 학생 {n}명`을 숨긴다) | owner-s03, owner-a03 | ⬜ | ✅ | ⬜ | ⬜ |
| stores | `GET /api/users/me/store` (S-01 보완, 백엔드 와이어) | owner-s02 (O01 · O01-E), 쿠폰 사용 처리 | ⬜ | ✅ | ⬜ | ⬜ |
| stores | #22 `POST /api/me/business-verification` | owner-s01 사업자 인증 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| stores | #23 `GET /api/owner/store-candidates` | owner-a01 가게 후보 선택 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| stores | #24 `POST /api/owner/store/link` | owner-a01 가게 연결 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| stores | #25 `POST /api/owner/store` | owner-a01 직접 등록 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| stores | #27 `PUT /api/owner/store/partnership` | owner-s02 제휴 설정 `/owner/store/partnership` (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| verification | #4 `GET /api/me/verification` | hs-s02 · guide-a01 인증 현황 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| verification | #5 `POST /api/me/student-verification` | hs-s02 · guide-a01 (사진 업로드) (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| verification | #6 `POST /api/me/guardian-consent` | hs-s02 (보호자 동의 요청) (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| verification | #7 `GET /api/guardian-consents/:token` | hs-a02 보호자 동의 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| verification | #8 `POST /api/guardian-consents/:token/agree` | hs-a02 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| verification | #9 `POST /api/guardian-consents/:token/reject` | hs-a02 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| admin | #10 `GET /api/admin/student-verifications` | owner-s06 인증 심사 목록 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| admin | #11 `GET /api/admin/student-verifications/:id` | owner-a02 심사 상세 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| admin | #12 `POST /api/admin/student-verifications/:id/approve` | owner-a02 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| admin | #13 `POST /api/admin/student-verifications/:id/reject` | owner-a02 (반려 사유) (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| reviews | #21 `POST /api/reviews` | hs-s10 방문 리뷰 작성 (P1 · 동결 대상 아님) | ⬜ | ⬜ | ⬜ | ⬜ |
| demo | `GET /api/health` | 시연 패널 (확장 · 목업 전용, 봉투) | ⬜ | ✅ | ⬜ | ⬜ |
| demo | `POST /api/demo/reset` | 시연 패널 (확장 · 목업 전용, 봉투) | ⬜ | ✅ | ⬜ | ⬜ |

- P1 행의 `#번호`는 계약 3-2절 번호다. 목업 사진(재학 인증 업로드)은 메모리에만 있어 새로고침하거나 시연 초기화를 하면 사라진다(운영자 화면은 그때 정적 견본 사진을 보인다, 2B-R9).

## 팀 요청 · 블로커

1~18은 설계 9장 18건을 그대로 옮겼고, 19~23은 MVP 2B에서 더했다. 팀 전달은 사용자가 하고, 여기서는 전달 여부와 응답을 추적한다. 기한은 설계에 날짜가 있으면 그 날짜이고 없으면 11/8(MVP)이다.

| # | 대상 | 요청 | 기한 | 상태 |
|---|---|---|---|---|
| 1 | 기획 · 백엔드 | 사장님 방문 · 리뷰 리포트(S-07): 명세엔 있고 플로우(F-O2)에선 삭제. 처리: P2, 백엔드가 API를 주면 만든다 | 11/8 | ⬜ |
| 2 | 기획 · 백엔드 | 회원가입 이름 필드(ERD NOT NULL ↔ 명세 입력에 없음). 처리: 이름 필드 추가 | 11/8 | ⬜ |
| 3 | 기획 · 백엔드 | 탐방 제목 · 학과가 ERD에 없음(같은 가이드의 탐방이 같은 제목이 됨, 가이드 학년도 없음). 처리: "대학교 + 가이드 학과" + 날짜를 항상 함께 표시, T-03에 탐방 제목(주제) 필드를 추가할지 질문, 가이드 학년은 필드가 생기면 표시 | 11/8 | ⬜ |
| 4 | 백엔드 | `tour_wishes`(희망 탐방) 대응 화면 없음. 처리: 만들지 않음, T-01 요청 기록용으로 추정 | 11/8 | ⬜ |
| 5 | 기획 · 백엔드 | 보호자 동의 수단. 처리: 이메일 링크(ERD 기준), 목업은 "보호자 페이지 열기" 시연 링크 | 11/8 | ⬜ |
| 6 | 기획 | 운영자 심사를 시연할지. 처리: 화면은 P1로 만들되 골든 패스는 미리 승인된 계정으로 | 11/6 | ⬜ |
| 7 | 기획 · 디자인 | 추천 0건 + 학교 미선택 시 대체 목록 기준(와이어 "팀 협의 필요"). 처리: 전체 모집 중 탐방을 날짜 · 남은 자리 순으로 + "조건을 넓혀서 보여 드려요" | 11/8 | ⬜ |
| 8 | 기획 · 백엔드 | 리뷰 중복 기준: 명세 "상점당 1건" ↔ ERD "탐방 × 상점(쿠폰)당 1건". 처리: ERD 기준, 문구는 "이 탐방에서 방문한 상점마다 한 번" | 11/8 | ⬜ |
| 9 | 기획 · 백엔드 | 거절된 탐방에 재신청 허용 여부. 처리: 불가("거절됨" 표시), 취소 이력은 재신청 허용 | 11/8 | ⬜ |
| 10 | 디자인 · 기획 | 와이어프레임의 옛 추천 기준 문구(guide-s04 · s05 · a03). 처리: 설계 5.6대로 실제 기준 문구로 교체, 디자인 · 기획에 공유 | 11/8 | 🟨 공유 준비됨(guide-s04 교체 완료 · 사용자 전달 대기) |
| 11 | 기획 | 화면에 올릴 가공 데이터 지표 1~2개(데이터 활용 점수). 처리: 프론트가 자리 · 목업 값을 먼저 만들고, 지표 · 출처는 데이터 담당이 정함 | 11/8 | ⬜ |
| 12 | 백엔드 | 실서버 진위확인 API 키 · 데모 사업자번호(U-07). 처리: 목업은 데모 번호 3종, 실서버는 백엔드 확인 | 11/8 | ⬜ |
| 13 | 백엔드 | 배포 주소(11/12까지 고정) · 인증 방식 · 응답 필드 표기 · OpenAPI 제공 · 시연 계정 시드 · 당일 날짜 시드 스크립트 · 비밀 키 보호 시연 리셋 수단 · LLM 캐시 · 타임아웃 대체 응답 · 골든 패스 API 11/9까지 배포. 처리: `frontend-needs.md`로 요청, 골든 패스 계약 11/6 동결 제안. 프론트가 고정해 쓰는 시연 전제(계정 이메일 · 같은 비밀번호 · 가게 1~4 ↔ owner1~4 · 체크포인트 값 · 세션 토큰 없는 리셋)는 계약 6절 11 · 13번 | 11/6 (계약 동결) · 11/9 (API 배포) · 11/12 (주소 고정) | 🟨 |
| 14 | 디자인 | 토큰 11/5 선전달, 골든 패스 화면 우선, 11/6 이후 구조 변경 없음, 변수 · 컴포넌트가 있는 디자인 파일, 무대 400px 제약(설계 5.7). 처리: 사용자가 디자이너에게 전달 | 11/5 (토큰) | ⬜ |
| 15 | 운영진 | 무대 노트북 OS · 브라우저 · 해상도 · 프로젝터, 사전 접속 · 탭 미리 열기 가능 여부, 네트워크(와이파이 · 유선 · 핫스팟), 라이브 시연 대신 영상 허용 여부, 배포본 데이터 초기화 · 모드 전환이 코드 수정이 아님. 처리: 사용자/팀이 문의 | 11/8 | ⬜ |
| 16 | 사용자 | 카카오맵 JavaScript 키 · Vercel 프로젝트(팀 계정 · 고정 도메인) 준비. 처리: 사용자/팀 준비물. 키가 없어도 코스 지도는 도식 지도로 동작한다(Task 16) | 11/4 | ⬜ |
| 17 | 사용자 | 비상용 2분 골든 패스 녹화본(11/14). 처리: 팀 | 11/14 | ⬜ |
| 18 | 기획 · 백엔드 | C-01 "관련 후보 중 제휴 상점 최소 1곳 포함"(설계 4장 결정)을 기획 문서(S-03 · C-01 · 변경 정리)와 백엔드 구현에 반영. 처리: 사용자가 팀에 전달, 목업은 이 규칙으로 구현 | 11/8 | ⬜ |
| 19 | 백엔드 | P1 엔드포인트 27개(계약 3-2절) 모양에 대한 의견. 동결 대상은 아니고 차이는 프론트 `api.ts`에서 흡수한다(계약 6절 17번). 처리: 목업은 지금 이 모양으로 만든다 | 11/8 | ⬜ |
| 20 | 백엔드 | 업로드: 서버 · 프록시 본문 한도를 10MB보다 넉넉하게(Spring 기본 1MB), multipart 필드 이름(`document` · `highSchoolName` · `grade` · `universityId`), 넘으면 413(본문 없어도 됨, 프론트는 `FILE_TOO_LARGE`로 취급)(계약 6절 18번). 처리: 배포에서 9~10MB 파일로 직접 잰다 | 11/8 | ⬜ |
| 21 | 백엔드 | 심사 사진 URL: 짧게 유효한 서명 URL, 안 되면 Bearer로 받는 이미지 바이트 엔드포인트(계약 6절 19번). 처리: 목업은 정적 견본 `/mock-docs/…`로 그린다 | 11/8 | ⬜ |
| 22 | 백엔드 | 보호자 동의 메일 발송 여부 · 링크 주소 · 유효 기간, 시연용 `demoConsentToken`은 `X-Demo-Key`가 있을 때만(계약 6절 21번). 처리: 목업은 `보호자 페이지 열기` 시연 링크 | 11/8 | ⬜ |
| 23 | 사용자 · 팀 | 11/6 시연 대본 게이트: 대본에 리뷰 · 상점 교체 · 운영자 심사 · 가입 장면이 들어가면 그 화면을 P0로 올리고 무대 단언을 더한다(2B-R20). 처리: 사용자가 대본 확정 뒤 알려 준다 | 11/6 | ⬜ |

## 열린 질문

- 리뷰 단계 무대 측정: 방문 리뷰 작성(`/reviews/new`) · 등록 뒤 코스 시트의 AI 요약 갱신이 11/6 대본(팀 요청 23)에 들어가면, 판정 뷰포트 3종에서 별점 · 등록 버튼 · 갱신된 요약이 탭바 위에 보이는지 재서 위 실측표에 행을 더한다.
- 무대 노트북의 실제 페이지 영역(해상도 · 배율 · 브라우저 UI)이 E2E가 가정한 판정 뷰포트(1366×620 · 1280×600 · 1280×590 @1.5배)보다 작은가? 작으면 골든 패스 화면의 무대 예산(설계 5.7, 본문 약 400px)을 다시 잡는다. V2 적용 뒤 본문 높이 여유는 아래 표다. 팀 요청 15의 운영진 답으로 확인한다.

  무대 실측표(2026-11-06, MVP 2A Task 12, 배포 빌드 E2E `stage-viewport`의 `stage-measure` 기록). 기준점은 프레임 위 + 56 = 뷰포트 y 72px(설계 헤더의 452 · 432 · 422와 같은 기준)이다. 코스 · 쿠폰 화면은 상단 바(56px) 하단이고, ① 추천(H02)은 상단 바 없이 자기 뒤로 가기 줄(`pt-2` + `h-12` = 56px)이 같은 선을 만든다. 사용 = 그 선에서 가장 아래 핵심 요소 하단까지, 가용 = 그 선에서 하단 탭 위까지, 여유 = 가용 − 사용(px).

  | 화면 | 1366×620 사용 / 여유 | 1280×600 사용 / 여유 | 1280×590 @1.5 사용 / 여유 |
  |---|---|---|---|
  | ① 추천(키워드 칩 · 첫 추천 이유) | 235 / 217 | 235 / 197 | 235 / 187 |
  | ② 코스 완성(지점 카드 3개) | 414 / 37.5 | 414 / 17.5 | 414 / 7.5 |
  | ③ 쿠폰 상세(쿠폰 코드) | 378 / 74 | 378 / 54 | 378 / 44 |
  | 가용 높이 | 452 | 432 | 422 |

  가장 빠듯한 곳은 ②의 1280×590 @1.5(7.5px)다. 무대 화면이 이보다 작으면 ②부터 다시 줄인다.
