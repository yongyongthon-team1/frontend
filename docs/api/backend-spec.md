# 백엔드 API 명세 스냅샷

- 출처: https://app.notion.com/p/40fe0c1995d68012946bde4f831cbd4e (Notion 데이터베이스 "API 명세서", 워크스페이스 "용용톤-1팀")
- 캡처일: 2026-11-07
- 노션 원본이 기준이다. 이 파일은 프론트 대조용 스냅샷이다.

> 표기 규칙: 각 엔드포인트 절의 "개발 / API연동 / 담당"은 노션 행 속성값이다. JSON 코드 블록은 노션 코드 블록을 옮긴 것이며 들여쓰기는 2칸 기준으로 맞췄다(노션 텍스트 추출 시 들여쓰기가 사라져 다시 맞춤). 표는 마크다운 표로 옮겼다.

---

## 공통규칙

- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음
- (method, endpoint 속성: 비어 있음)

### 공통 규칙

모든 API 상세에 적용되는 규칙이다. 각 API에는 이 규칙에 없는 내용만 적었다.

#### 헤더

로그인 후 호출하는 모든 API는 Authorization: Bearer {access_token}을 보낸다. 토큰 없이 호출할 수 있는 API는 회원가입, 로그인, 보호자 동의 안내 조회·동의, 캠퍼스 기준 데이터 조회다.

본문이 있는 요청은 Content-Type: application/json이다. 파일을 올리는 재학 인증만 multipart/form-data다.

역할은 토큰으로 판별하므로 요청에 역할을 따로 넣지 않는다.

#### 응답 형식

```json
{
  "code": "S200",
  "message": "성공",
  "data": {},
  "errors": null,
  "timestamp": "2026-11-04T21:00:00+09:00"
}
```

모든 응답은 code, message, data, errors, timestamp를 가진다. 각 API의 예시는 줄이기 위해 code, message, data만 적고, errors는 유효성 실패일 때만 적었다.

성공 코드는 S200, S201이다. 실패 코드는 E{HTTP 상태}이고, 화면이 분기해야 하는 업무 오류는 E{HTTP 상태}_{사유}다(예: E409_TOUR_FULL).

목록 응답의 data는 { "items": [], "page": 1, "size": 20, "total": 0 } 형태다. 요청은 page(1부터, 기본 1), size(기본 20, 최대 50)를 쓴다. 목록이 작은 API는 items만 내려준다.

날짜는 yyyy-MM-dd, 시간은 HH:mm, 일시는 ISO 8601(+09:00)이다. 필드명은 snake_case다.

#### 공통 실패

각 API에서 반복하지 않는다.

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | E400 | 요청 값이 유효하지 않음. errors에 { "field", "reason" } 배열 |
| 401 | E401 | 토큰이 없거나 만료됨 |
| 403 | E403 | 역할이 맞지 않거나 남의 자원에 접근함 |
| 404 | E404 | 없는 자원 |
| 500 | E500 | 서버 오류 |

#### 값 정의

| 이름 | 값 |
| --- | --- |
| role | HIGH_SCHOOL, UNIVERSITY, OWNER, ADMIN |
| verification_status | NONE, PENDING, APPROVED, REJECTED (사장님은 사업자 인증이 맞으면 바로 APPROVED) |
| guardian_consent_status | NONE, PENDING, AGREED, REJECTED, EXPIRED (고교생만) |
| tour.status | RECRUITING, CLOSED, COMPLETED, CANCELED |
| application.status | PENDING, APPROVED, REJECTED, CANCELED |
| course.status | DRAFT, CONFIRMED |
| coupon.status | ISSUED, USED, EXPIRED |
| stop_type | CAMPUS, STORE (코스 지점 유형) |

상점 업종(category)은 정해진 enum이 아니라 상점에 저장된 문자열(예: 식당, 카페)을 그대로 쓴다.

#### 권한 요약

신청, 탐방 개설, 가게 연결은 verification_status가 APPROVED일 때만 된다. 아니면 403 E403_VERIFICATION_REQUIRED다.

가이드 전용 API(탐방 취소·완료, 신청 승인, 코스 생성·수정·확정, 신청자 목록)는 그 탐방을 개설한 대학생만 호출할 수 있다.

---

## 엔드포인트

### POST /auth/signup — 회원가입 [U-01]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

신규 회원 정보를 받아 계정을 생성합니다.
이메일은 중복될 수 없으며, 비밀번호는 해싱하여 저장합니다.
운영자 계정은 가입으로 만들 수 없고 시드 데이터로 넣습니다.
회원가입 성공 시 자동 로그인은 되지 않으며, 별도로 로그인 API를 호출해야 합니다.

#### Request

header
```
Content-Type: application/json
```

body
```json
{
  "email": "hs01@example.com",
  "password": "myPassword123!",
  "name": "김하늘",
  "role": "HIGH_SCHOOL"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| email | 필수 | 이메일 형식 |
| password | 필수 | 영문+숫자 8자 이상 |
| name | 필수 | 20자 이내 |
| role | 필수 | HIGH_SCHOOL / UNIVERSITY / OWNER |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{
  "code": "S201",
  "message": "회원가입 성공",
  "data": {
    "id": 1,
    "email": "hs01@example.com",
    "name": "김하늘",
    "role": "HIGH_SCHOOL",
    "created_at": "2026-11-04T21:00:00+09:00"
  }
}
```

body(이메일 중복) — HTTP Status : 409 Conflict
```json
{ "code": "E409", "message": "이미 가입된 이메일입니다", "data": null }
```

### POST /auth/login — 로그인 [U-02]

- 그룹: U. 사용자 · 인증 (기능 속성: 비어 있음)
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

이메일과 비밀번호가 맞으면 토큰을 발급합니다.
응답의 role과 verification_status로 로그인 후 이동할 화면을 정합니다(인증 전이면 역할 인증, 인증 후면 역할별 첫 화면).

#### Request

header
```
Content-Type: application/json
```

body
```json
{
  "email": "hs01@example.com",
  "password": "myPassword123!"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| email | 필수 | (비어 있음) |
| password | 필수 | (비어 있음) |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "로그인 성공",
  "data": {
    "access_token": "eyJhbGciOi...",
    "user": { "id": 1, "name": "김하늘", "role": "HIGH_SCHOOL", "verification_status": "NONE" }
  }
}
```

body(로그인 실패) — HTTP Status : 401 Unauthorized
```json
{ "code": "E401_INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호가 올바르지 않습니다", "data": null }
```

### POST /auth/logout — 로그아웃 [U-02]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

현재 토큰을 폐기합니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "로그아웃 성공", "data": null }
```

### GET /users/me — 내 정보 조회 [U-03]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

로그인한 사용자의 정보를 돌려줍니다. 역할에 해당하지 않는 필드는 null입니다.
고교생은 인증 상태와 보호자 동의 상태를, 대학생은 가이드 프로필을 함께 받습니다.
인증이 반려되면 reject_reason에 사유가 담깁니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공 - 고교생) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "id": 1,
    "email": "hs01@example.com",
    "name": "김하늘",
    "role": "HIGH_SCHOOL",
    "verification_status": "APPROVED",
    "reject_reason": null,
    "school_name": "용인고등학교",
    "grade": 2,
    "interest_major": "컴퓨터공학",
    "guardian_consent_status": "AGREED",
    "guide_profile": null
  }
}
```

body(성공 - 대학생) — HTTP Status : 200 OK

고교생 전용 필드(grade, interest_major, guardian_consent_status)는 null
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "id": 2,
    "email": "univ01@example.com",
    "name": "이준호",
    "role": "UNIVERSITY",
    "verification_status": "APPROVED",
    "reject_reason": null,
    "school_name": "단국대학교 죽전캠퍼스",
    "grade": null,
    "interest_major": null,
    "guardian_consent_status": null,
    "guide_profile": { "major": "컴퓨터공학과", "intro": "신입생 때부터 동아리 활동을 했어요" }
  }
}
```

### PATCH /users/me — 내 정보 수정 [U-03]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

보낸 필드만 수정합니다. 이메일과 역할은 바꿀 수 없습니다.
학교·학년·관심 학과는 고교생만 수정할 수 있습니다. 대학생의 학교는 재학 인증으로 정해지므로 수정할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "name": "김하늘",
  "school_name": "용인고등학교",
  "grade": 2,
  "interest_major": "컴퓨터공학"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| name | 선택 | 20자 이내 |
| school_name | 선택 | 고교생만, 50자 이내 |
| grade | 선택 | 고교생만, 1~3 |
| interest_major | 선택 | 고교생만, 30자 이내 |

#### Response

body(성공) — HTTP Status : 200 OK

data는 GET /users/me 응답과 같은 형태
```json
{ "code": "S200", "message": "수정 성공", "data": { "id": 1, "name": "김하늘", "school_name": "용인고등학교", "grade": 2, "interest_major": "컴퓨터공학" } }
```

### PUT /users/me/guide-profile — 가이드 프로필 등록 · 수정 [U-04]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

대학생 가이드의 학과와 소개를 저장합니다. 없으면 만들고 있으면 덮어씁니다.
탐방 개설 시 이 학과가 탐방의 학과가 됩니다.
학교는 프로필에 직접 쓰지 않고, 재학 인증이 승인되면 인증된 학교가 프로필에 연결됩니다. 인증 전에도 저장할 수 있습니다.
인증 배지는 verification_status가 APPROVED일 때 화면에서 표시합니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "major": "컴퓨터공학과",
  "intro": "신입생 때부터 동아리 활동을 했어요"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| major | 필수 | 30자 이내 |
| intro | 필수 | 200자 이내 |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "저장 성공", "data": { "major": "컴퓨터공학과", "intro": "신입생 때부터 동아리 활동을 했어요" } }
```

### POST /verifications/enrollment — 재학 인증 제출 [U-05]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생·대학생이 학생증 또는 재학증명서 사진을 올려 인증을 요청합니다. 상태는 PENDING이 됩니다.
대학생은 campus_id를, 고교생은 school_name을 보냅니다.
반려된 뒤에는 다시 제출할 수 있습니다. 심사 중이거나 이미 승인되었으면 제출할 수 없습니다. 대학생의 학교는 용용톤에 참여하는 5개 학교 중에서만 고를 수 있고, 5개 밖의 campus_id는 거절합니다.
사진은 심사가 끝나면 삭제합니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

body
```json
{
  "campus_id": 1,
  "school_name": "용인고등학교",
  "document": "(파일)"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| campus_id | 대학생 필수 | 캠퍼스 기준 데이터 조회의 campus_id |
| school_name | 고교생 필수 | 50자 이내 |
| document | 필수 | jpg, png / 5MB 이하 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{
  "code": "S201",
  "message": "인증 요청 완료",
  "data": { "verification_id": 10, "status": "PENDING", "submitted_at": "2026-11-04T21:00:00+09:00" }
}
```

body(형식·용량 오류) — HTTP Status : 400 Bad Request
```json
{
  "code": "E400",
  "message": "요청 값이 유효하지 않습니다",
  "data": null,
  "errors": [{ "field": "document", "reason": "jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요" }]
}
```

body(이미 심사 중이거나 승인됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_SUBMITTED", "message": "이미 심사 중이거나 승인된 인증입니다", "data": null }
```

### POST /guardian-consents — 보호자 동의 요청 [U-06]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 보호자 정보를 입력하면 보호자에게 동의 링크를 이메일로 보냅니다. 상태는 PENDING이 됩니다.
링크는 7일 뒤 만료됩니다. 동의는 최초 한 번만 받습니다.
진행 중이거나 이미 동의했으면 다시 요청할 수 없고, 보호자가 거부했거나 링크가 만료됐을 때만 다시 요청할 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "guardian_name": "김철수",
  "guardian_email": "parent@example.com"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| guardian_name | 필수 | 20자 이내 |
| guardian_email | 필수 | 이메일 형식 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{
  "code": "S201",
  "message": "동의 요청 완료",
  "data": { "status": "PENDING", "expires_at": "2026-11-11T21:00:00+09:00" }
}
```

body(진행 중이거나 동의 완료) — HTTP Status : 409 Conflict
```json
{ "code": "E409_CONSENT_EXISTS", "message": "이미 요청했거나 동의가 완료되었습니다", "data": null }
```

### GET /guardian-consents/{consentToken} — 보호자 동의 안내 조회 [U-06]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

보호자가 메일의 링크로 들어와 서비스와 탐방 방식 안내를 봅니다. 로그인 없이 호출합니다.
링크의 consent_token이 곧 인증 수단입니다.

#### Request

header
```
없음
```

path
```
consent_token: 메일 링크에 담긴 토큰
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "student_name": "김하늘",
    "school_name": "용인고등학교",
    "guide_text": "용용톤은 방학 중 대학생 가이드와 캠퍼스를 둘러보는 서비스입니다 ...",
    "status": "PENDING",
    "expires_at": "2026-11-11T21:00:00+09:00"
  }
}
```

body(만료된 링크) — HTTP Status : 410 Gone
```json
{ "code": "E410_EXPIRED", "message": "만료된 링크입니다. 학생에게 다시 요청해 달라고 알려주세요", "data": null }
```

### PATCH /guardian-consents/{consentToken} — 보호자 동의 · 거부 [U-06]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

보호자가 동의 또는 거부를 보냅니다. 로그인 없이 호출합니다.
한 번 처리한 요청은 바꿀 수 없습니다. 거부하면 고교생이 다시 요청해야 합니다.

#### Request

header
```
Content-Type: application/json
```

body
```json
{
  "agree": true
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| agree | 필수 | true = 동의, false = 거부 |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "처리 완료", "data": { "status": "AGREED" } }
```

body(이미 처리됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_PROCESSED", "message": "이미 처리된 요청입니다", "data": null }
```

body(만료된 링크) — HTTP Status : 410 Gone
```json
{ "code": "E410_EXPIRED", "message": "만료된 링크입니다", "data": null }
```

### POST /verifications/business — 사업자 인증 [U-07]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

사업자등록번호·대표자명·개업일자로 진위를 확인합니다. 일치하고 영업 중이면 바로 APPROVED가 됩니다(운영자 심사 없음).
사업자 정보는 저장하지 않고 인증 결과만 남깁니다. 진위확인과 영업 상태 확인은 공공데이터포털의 국세청 사업자등록정보 진위확인 및 상태조회 API로 하며, 서비스키가 필요합니다.
인증 후 가게 연결은 상점 검색으로 상점을 찾아 진행합니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "business_number": "1234567890",
  "representative_name": "박사장",
  "opened_at": "2020-03-02"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| business_number | 필수 | 숫자 10자리, 하이픈 제외 |
| representative_name | 필수 | (비어 있음) |
| opened_at | 필수 | 개업일자 |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "사업자 인증 완료",
  "data": { "status": "APPROVED" }
}
```

body(불일치 · 휴폐업)

reason: MISMATCH(정보 불일치) / CLOSED(휴폐업)

HTTP Status : 422 Unprocessable Entity
```json
{
  "code": "E422_BUSINESS_INVALID",
  "message": "사업자 정보를 확인할 수 없습니다",
  "data": null,
  "errors": [{ "field": "business_number", "reason": "MISMATCH" }]
}
```

### GET /admin/verifications — 인증 심사 목록 조회 [U-08 보완]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

운영자가 재학 인증 심사 대기 목록을 봅니다. 오래된 제출부터 정렬합니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
status: PENDING
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| status | 선택 | 기본 PENDING |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "verification_id": 10, "user_name": "김하늘", "role": "HIGH_SCHOOL", "school_name": "용인고등학교", "submitted_at": "2026-11-04T21:00:00+09:00" }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

### GET /admin/verifications/{verificationId} — 인증 심사 상세 조회 [U-08 보완]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

심사할 요청 하나의 상세와 제출 사진을 봅니다. 사진은 유효 시간이 짧은 임시 주소로 내려줍니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "verification_id": 10,
    "user_name": "김하늘",
    "role": "HIGH_SCHOOL",
    "school_name": "용인고등학교",
    "document_url": "https://.../temp-signed-url",
    "status": "PENDING",
    "submitted_at": "2026-11-04T21:00:00+09:00"
  }
}
```

### PATCH /admin/verifications/{verificationId} — 인증 심사 승인 · 반려 [U-08]

- 그룹: U. 사용자 · 인증
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

운영자가 승인 또는 반려합니다. 사용자의 verification_status가 바뀔고 제출 사진 파일은 삭제됩니다.
반려하면 사유가 사용자의 reject_reason에 담겨 내 정보에서 보입니다.
이미 심사한 요청은 다시 처리할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "decision": "REJECTED",
  "reject_reason": "학교명이 보이지 않습니다"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| decision | 필수 | APPROVED / REJECTED |
| reject_reason | 반려 시 필수 | 100자 이내 |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "심사 완료", "data": { "verification_id": 10, "status": "REJECTED", "reviewed_at": "2026-11-04T21:30:00+09:00" } }
```

body(이미 심사됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_REVIEWED", "message": "이미 심사가 끝난 요청입니다", "data": null }
```

### GET /tours — 탐방 목록 조회 [T-01 보완]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

탐방을 조건으로 찾아 봅니다. 기본은 모집 중인 탐방이며, 날짜가 빠른 순입니다.
인증 심사 중에도 둘러볼 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
campus_id: 1
major: 컴퓨터공학
date_from, date_to
status: RECRUITING
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| campus_id | 선택 | (비어 있음) |
| major | 선택 | 부분 일치 |
| date_from, date_to | 선택 | yyyy-MM-dd |
| status | 선택 | 기본 RECRUITING |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      {
        "tour_id": 31,
        "campus_name": "단국대학교 죽전캠퍼스",
        "major": "컴퓨터공학과",
        "date": "2027-01-15",
        "start_time": "13:00",
        "capacity": 5,
        "remaining": 3,
        "status": "RECRUITING",
        "guide": { "name": "이준호", "verified": true }
      }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

### POST /tour-wishes — 탐방 희망 사항 등록

- 그룹: T. 탐방 (제목에 기능 ID 없음)
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 학교·학과·희망 사항을 입력하면 저장합니다. 이 API는 AI를 쓰지 않으며, 맞는 탐방은 탐방 목록 조회에서 학교·학과·날짜로 찾습니다.
입력은 저장되어 본인은 내 희망 사항 조회에서, 대학생은 학교·학과별 희망 사항 조회에서 입력한 원문 그대로 볼 수 있습니다. 한 사람이 여러 개 등록할 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "campus_id": 1,
  "major": "컴퓨터공학",
  "wish": "게임 동아리 구경하고 싶고 맛집도 가보고 싶어요",
  "date": "2027-01-15"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| campus_id | 필수 | 캠퍼스 기준 데이터 조회의 campus_id |
| major | 필수 | 30자 이내 |
| wish | 필수 | 100자 이내, 한두 문장 |
| date | 선택 | 희망 날짜. 이 날짜의 탐방을 우선 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{
  "code": "S201",
  "message": "등록 성공",
  "data": {
    "wish_id": 5,
    "campus_id": 1,
    "major": "컴퓨터공학",
    "wish": "게임 동아리 구경하고 싶고 맛집도 가보고 싶어요",
    "date": "2027-01-15",
    "created_at": "2026-11-06T10:14:00+09:00"
  }
}
```

### GET /users/me/tour-wishes — 내 희망 사항 · 추천 내역 조회 [T-01 보완]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 자신이 입력한 희망 사항을 최신순으로 봅니다. 추천 결과는 저장하지 않아 등록 응답에서만 내려줍니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      {
        "wish_id": 5,
        "campus_name": "단국대학교 죽전캠퍼스",
        "major": "컴퓨터공학",
        "wish": "게임 동아리 구경하고 싶고 맛집도 가보고 싶어요",
        "created_at": "2026-11-04T21:00:00+09:00"
      }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

### PATCH /users/me/tour-wishes/{wishId} — 탐방 희망 사항 수정 [T-01 보완]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 본인이 등록한 희망 사항을 고칩니다. 보낸 필드만 수정합니다.
수정해도 이미 받은 추천 결과는 그대로이며, 새 추천이 필요하면 희망 사항을 새로 등록합니다.
본인이 등록한 것만 수정할 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "campus_id": 1,
  "major": "컴퓨터공학",
  "wish": "동아리 구경하고 학식도 먹어보고 싶어요",
  "date": "2027-01-16"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| campus_id | 선택 | (비어 있음) |
| major | 선택 | 30자 이내 |
| wish | 선택 | 100자 이내, 한두 문장 |
| date | 선택 | 희망 날짜 |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "수정 성공",
  "data": {
    "wish_id": 5,
    "campus_name": "단국대학교 죽전캠퍼스",
    "major": "컴퓨터공학",
    "wish": "동아리 구경하고 학식도 먹어보고 싶어요",
    "date": "2027-01-16",
    "updated_at": "2026-11-05T19:30:00+09:00"
  }
}
```

### GET /tour-wishes — 학교 · 학과별 고교생 희망 사항 조회 [T-01 보완]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

대학생이 탐방을 구성할 때 참고하도록, 고교생이 입력한 희망 사항을 입력한 그대로 보여줍니다.
고교생의 이름 등 개인정보는 내려주지 않습니다.
campus_id를 생략하면 내 인증 학교로 조회합니다. 인증이 끝난 대학생만 호출할 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
campus_id: 1
major: 컴퓨터공학
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| campus_id | 선택 | 기본 내 학교 |
| major | 선택 | 부분 일치 |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "wish_id": 5, "campus_name": "단국대학교 죽전캠퍼스", "major": "컴퓨터공학", "wish": "게임 동아리 구경하고 싶고 맛집도 가보고 싶어요", "created_at": "2026-11-04T21:00:00+09:00" }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

### GET /tours/{tourId} — 탐방 상세 조회 [T-02]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

탐방 정보, 가이드 프로필, 인증 배지, 내 신청 상태를 돌려줍니다.
open_chat_url은 승인된 신청자와 개설한 가이드에게만 내려주고, 나머지는 null입니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "tour_id": 31,
    "campus_name": "단국대학교 죽전캠퍼스",
    "major": "컴퓨터공학과",
    "date": "2027-01-15",
    "start_time": "13:00",
    "end_time": "16:00",
    "capacity": 5,
    "remaining": 3,
    "status": "RECRUITING",
    "intro": "캠퍼스와 근처 맛집을 함께 둘러봐요",
    "open_chat_url": null,
    "guide": { "name": "이준호", "major": "컴퓨터공학과", "intro": "신입생 때부터 동아리 활동을 했어요", "verified": true },
    "my_application": { "application_id": 77, "status": "PENDING" }
  }
}
```

### POST /tours — 탐방 개설 [T-03]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

인증이 끝난 대학생 가이드가 탐방을 만듭니다. 상태는 RECRUITING이 됩니다.
학교와 학과는 인증된 학교와 가이드 프로필의 학과가 자동으로 들어갑니다. 가이드 프로필이 없으면 만들 수 없습니다.
날짜는 인증된 학교의 방학 기간 안이어야 합니다(기간은 캠퍼스 기준 데이터 조회로 확인).

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "date": "2027-01-15",
  "start_time": "13:00",
  "end_time": "16:00",
  "capacity": 5,
  "intro": "캠퍼스와 근처 맛집을 함께 둘러봐요",
  "open_chat_url": "https://open.kakao.com/o/xxxx"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| date | 필수 | 방학 기간 안 |
| start_time | 필수 | (비어 있음) |
| end_time | 필수 | start_time 이후 |
| capacity | 필수 | 1~10 |
| intro | 필수 | 300자 이내 |
| open_chat_url | 필수 | 승인된 신청자에게만 공개 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{ "code": "S201", "message": "탐방 개설 성공", "data": { "tour_id": 31, "status": "RECRUITING" } }
```

body(방학 기간 밖 날짜) — HTTP Status : 400 Bad Request
```json
{
  "code": "E400",
  "message": "요청 값이 유효하지 않습니다",
  "data": null,
  "errors": [{ "field": "date", "reason": "방학 기간 안의 날짜만 선택할 수 있어요" }]
}
```

body(가이드 프로필 없음) — HTTP Status : 409 Conflict
```json
{ "code": "E409_GUIDE_PROFILE_REQUIRED", "message": "가이드 프로필을 먼저 등록해 주세요", "data": null }
```

### GET /users/me/tours — 내 탐방 목록 조회 [T-04]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생은 내가 신청한 탐방을, 대학생은 내가 개설한 탐방을 봅니다. 응답 형태가 역할마다 다릅니다.
코스가 확정된 탐방은 course_confirmed가 true입니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
status: RECRUITING
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| status | 선택 | 탐방 상태로 거르기 |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공 - 고교생) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      {
        "tour_id": 31, "campus_name": "단국대학교 죽전캠퍼스", "date": "2027-01-15", "tour_status": "RECRUITING",
        "application_id": 77, "application_status": "APPROVED", "course_confirmed": true
      }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

body(성공 - 대학생) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "tour_id": 31, "date": "2027-01-15", "tour_status": "RECRUITING", "capacity": 5, "approved_count": 2, "pending_count": 3, "course_confirmed": false }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

### POST /tours/{tourId}/cancel — 탐방 취소 [T-05]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

가이드가 탐방을 취소합니다. 신청자 전원의 신청 상태가 CANCELED로 바뀝니다.
이미 완료되었거나 취소된 탐방은 취소할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "탐방 취소 완료", "data": { "tour_id": 31, "status": "CANCELED" } }
```

body(취소할 수 없는 상태) — HTTP Status : 409 Conflict
```json
{ "code": "E409_INVALID_TOUR_STATUS", "message": "이미 완료되었거나 취소된 탐방입니다", "data": null }
```

(이 페이지 하단에 아래 블록이 더 있다. 탐방 완료 처리 페이지 [T-06]와 같은 내용이며, 경로 매개변수 표기만 {tour_id}다.)

탐방 완료 처리
POST /tours/{tour_id}/complete

기능
탐방이 끝난 뒤 가이드가 완료로 바꿉니다. 승인된 신청자에게 리뷰를 요청하는 알림이 갑니다.
탐방 날짜가 지나기 전에는 완료할 수 없습니다. 취소된 탐방도 완료할 수 없습니다.

Request
header
```
Authorization: Bearer {access_token}
```

body: 없음

Response
body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "탐방 완료 처리", "data": { "tour_id": 31, "status": "COMPLETED" } }
```

body(완료할 수 없는 상태) — HTTP Status : 409 Conflict
```json
{ "code": "E409_INVALID_TOUR_STATUS", "message": "탐방 날짜 이후에만 완료 처리할 수 있어요", "data": null }
```

### POST /tours/{tourId}/complete — 탐방 완료 처리 [T-06]

- 그룹: T. 탐방
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

탐방이 끝난 뒤 가이드가 완료로 바꿉니다. 승인된 신청자에게 리뷰를 요청하는 알림이 갑니다.
탐방 날짜가 지나기 전에는 완료할 수 없습니다. 취소된 탐방도 완료할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "탐방 완료 처리", "data": { "tour_id": 31, "status": "COMPLETED" } }
```

body(완료할 수 없는 상태) — HTTP Status : 409 Conflict
```json
{ "code": "E409_INVALID_TOUR_STATUS", "message": "탐방 날짜 이후에만 완료 처리할 수 있어요", "data": null }
```

### POST /tours/{tourId}/applications — 탐방 신청 [A-01]

- 그룹: A. 신청
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 탐방에 신청합니다. 상태는 PENDING이 됩니다.
재학 인증이 APPROVED이고 보호자 동의가 AGREED일 때만 신청할 수 있습니다.
입력한 wish는 코스 초안을 만들 때 기준으로 쓰입니다.
한 탐방에 한 번만 신청할 수 있습니다(취소 후 재신청은 가능).

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "wish": "게임 동아리 구경하고 싶고 맛집도 가보고 싶어요"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| wish | 필수 | 100자 이내 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{ "code": "S201", "message": "신청 완료", "data": { "application_id": 77, "tour_id": 31, "status": "PENDING", "created_at": "2026-11-04T21:00:00+09:00" } }
```

body(인증 · 보호자 동의 전) — HTTP Status : 403 Forbidden
```json
{ "code": "E403_VERIFICATION_REQUIRED", "message": "인증 후 신청할 수 있어요", "data": null }
```

body(정원 마감 · 모집 종료) — HTTP Status : 409 Conflict
```json
{ "code": "E409_TOUR_FULL", "message": "신청할 수 없는 탐방입니다", "data": null }
```

body(이미 신청) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_APPLIED", "message": "이미 신청한 탐방입니다", "data": null }
```

### PATCH /applications/{applicationId}/decision — 신청 승인 · 거절 [A-02]

- 그룹: A. 신청
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

가이드가 신청 하나를 승인하거나 거절합니다. 승인된 신청자는 탐방 상세에서 오픈채팅 링크를 볼 수 있습니다.
승인 수가 정원에 닿으면 탐방 상태가 CLOSED로 자동으로 바뀝니다. 정원이 찬 뒤의 승인은 거부합니다.
PENDING 상태인 신청만 처리할 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "decision": "APPROVED"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| decision | 필수 | APPROVED / REJECTED |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "처리 완료", "data": { "application_id": 77, "status": "APPROVED", "tour_status": "CLOSED" } }
```

body(정원 초과) — HTTP Status : 409 Conflict
```json
{ "code": "E409_TOUR_FULL", "message": "정원이 모두 찼습니다", "data": null }
```

body(이미 처리됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_PROCESSED", "message": "이미 처리된 신청입니다", "data": null }
```

### POST /applications/{applicationId}/cancel — 신청 취소 [A-03]

- 그룹: A. 신청
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 본인의 신청을 취소합니다. 상태는 CANCELED가 됩니다.
승인 상태였고 정원 때문에 CLOSED였던 탐방은 다시 RECRUITING으로 돌아갑니다.
이미 취소·거절된 신청이나 완료된 탐방의 신청은 취소할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "신청 취소 완료", "data": { "application_id": 77, "status": "CANCELED" } }
```

body(취소할 수 없는 상태) — HTTP Status : 409 Conflict
```json
{ "code": "E409_INVALID_APPLICATION_STATUS", "message": "취소할 수 없는 신청입니다", "data": null }
```

### GET /tours/{tourId}/applications — 신청자 목록 조회 [A-04]

- 그룹: A. 신청
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

가이드가 자기 탐방의 신청자와 그들이 쓴 하고 싶은 것을 봅니다. 신청 시각이 빠른 순입니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
status: PENDING
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| status | 선택 | 신청 상태로 거르기 |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "application_id": 77, "name": "김하늘", "grade": 2, "wish": "게임 동아리 구경하고 싶고 맛집도 가보고 싶어요", "status": "PENDING", "created_at": "2026-11-04T21:00:00+09:00" }
    ]
  }
}
```

### POST /tours/{tourId}/course — AI 코스 초안 생성 [C-01]

- 그룹: C. 코스
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

승인된 신청자들이 쓴 하고 싶은 것만을 기준으로, 캠퍼스 주변 상점 중 관련 있는 곳을 골라 AI가 2~3시간짜리 코스 초안을 만듭니다(점심 · 카페 · 놀거리, 지점별 추천 이유 포함).
코스 구성 규칙으로 제휴 상점을 1곳 이상 포함합니다. AI 초안은 상점 지점(STORE)으로 만들고, 캠퍼스 건물 지점은 코스 수정에서 추가합니다.
탐방당 코스는 하나입니다(코스는 탐방 ID로 식별). 이미 초안이 있으면 새로 만든 초안으로 바꾸고, 확정된 코스는 다시 만들 수 없습니다.
승인된 신청자가 없으면 만들 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공)

스팟 형식은 이후 코스 API에서 모두 같습니다. reason은 AI 추천 이유, comment는 가이드 한줄평입니다. stop_type이 STORE면 상점 필드를, CAMPUS면 캠퍼스 건물 필드를 채우고 나머지는 null입니다.

HTTP Status : 201 Created
```json
{
  "code": "S201",
  "message": "코스 초안 생성 완료",
  "data": {
    "tour_id": 31,
    "status": "DRAFT",
    "spots": [
      {
        "order": 1, "stop_type": "STORE", "store_id": 201, "campus_building_id": null,
        "name": "용인 분식", "category": "식당", "address": "경기 용인시 처인구 ...",
        "lat": 37.3219, "lng": 127.1268, "start_time": "13:00",
        "reason": "신청자들이 맛집을 가고 싶다고 적었어요", "comment": null,
        "is_partner": true, "review_summary": null
      }
    ]
  }
}
```

body(승인된 신청자 없음) — HTTP Status : 409 Conflict
```json
{ "code": "E409_NO_APPROVED_APPLICANT", "message": "승인된 신청자가 있어야 코스를 만들 수 있어요", "data": null }
```

body(이미 확정됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_COURSE_CONFIRMED", "message": "이미 확정된 코스입니다", "data": null }
```

body(AI 호출 실패) — HTTP Status : 502 Bad Gateway
```json
{ "code": "E502_AI_FAILED", "message": "코스를 만들지 못했어요. 잠시 후 다시 시도해 주세요", "data": null }
```

### PUT /tours/{tourId}/course/spots — 코스 수정 [C-02]

- 그룹: C. 코스
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

가이드가 지점의 순서·상점·캠퍼스 건물·시간·한줄평을 한 번에 바꿉니다. 보낸 배열 전체가 새 코스가 되며, 배열 순서가 곧 order입니다.
상점은 주변 상점 조회에서, 캠퍼스 건물은 캠퍼스 장소 조회에서 고른 값만 쓸 수 있습니다.
같은 상점을 유지한 지점은 기존 reason(AI 추천 이유)이 유지되고, 새로 넣은 지점의 reason은 null입니다.
확정된 코스는 수정할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "spots": [
    { "stop_type": "STORE", "store_id": 201, "start_time": "13:00", "comment": "학생들이 즐겨 가는 분식집이에요" },
    { "stop_type": "CAMPUS", "campus_building_id": 3, "start_time": "14:30", "comment": "시험 기간엔 24시간 열려요" }
  ]
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| spots | 필수 | 1개 이상 |
| spots[].stop_type | 필수 | STORE / CAMPUS |
| spots[].store_id | STORE일 때 필수 | (비어 있음) |
| spots[].campus_building_id | CAMPUS일 때 필수 | (비어 있음) |
| spots[].start_time | 필수 | (비어 있음) |
| spots[].comment | 선택 | 100자 이내, 한줄평 |

#### Response

body(성공)

스팟의 형식은 코스 초안 생성 응답과 같습니다.

HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "수정 완료",
  "data": {
    "tour_id": 31,
    "status": "DRAFT",
    "spots": [
      {
        "order": 1, "stop_type": "STORE", "store_id": 201, "campus_building_id": null,
        "name": "용인 분식", "category": "식당", "address": "경기 용인시 처인구 ...",
        "lat": 37.3219, "lng": 127.1268, "start_time": "13:00",
        "reason": "신청자들이 맛집을 가고 싶다고 적었어요", "comment": "학생들이 즐겨 가는 분식집이에요",
        "is_partner": true, "review_summary": null
      },
      {
        "order": 2, "stop_type": "CAMPUS", "store_id": null, "campus_building_id": 3,
        "name": "중앙도서관", "category": null, "address": null,
        "lat": 37.3226, "lng": 127.1261, "start_time": "14:30",
        "reason": null, "comment": "시험 기간엔 24시간 열려요",
        "is_partner": false, "review_summary": null
      }
    ]
  }
}
```

body(이미 확정됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_COURSE_CONFIRMED", "message": "이미 확정된 코스입니다", "data": null }
```

### POST /tours/{tourId}/course/confirm — 코스 확정 (쿠폰 발급 포함) [C-03, S-04]

- 그룹: C. 코스
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

가이드가 코스를 확정합니다. 승인된 신청자에게 코스가 공개되고, 코스 안의 제휴 상점 지점마다 승인된 신청자 각자에게 6자리 쿠폰이 자동 발급됩니다.
제휴 상점이 1곳도 없으면 확정할 수 없습니다.
한 번 확정하면 되돌릴 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "코스 확정 완료", "data": { "tour_id": 31, "status": "CONFIRMED", "coupon_count": 6 } }
```

body(제휴 상점 없음) — HTTP Status : 422 Unprocessable Entity
```json
{ "code": "E422_PARTNER_REQUIRED", "message": "제휴 상점을 1곳 이상 포함해 주세요", "data": null }
```

body(이미 확정됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_COURSE_CONFIRMED", "message": "이미 확정된 코스입니다", "data": null }
```

### GET /tours/{tourId}/course — 코스 조회 (지도) [C-04]

- 그룹: C. 코스
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

코스를 지도 핀 정보로 돌려줍니다. 가이드는 초안도 볼 수 있고, 승인된 신청자는 확정된 코스만 볼 수 있습니다.
코스가 아직 없거나 확정 전이면 신청자에게는 준비 중 오류를 돌려줍니다.
상점 지점의 review_summary에는 그 상점의 AI 리뷰 요약이 들어갑니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공)

스팟의 형식은 코스 초안 생성 응답과 같습니다.

HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "tour_id": 31,
    "status": "CONFIRMED",
    "spots": [
      {
        "order": 1, "stop_type": "STORE", "store_id": 201, "campus_building_id": null,
        "name": "용인 분식", "category": "식당", "address": "경기 용인시 처인구 ...",
        "lat": 37.3219, "lng": 127.1268, "start_time": "13:00",
        "reason": "신청자들이 맛집을 가고 싶다고 적었어요", "comment": "학생들이 즐겨 가는 분식집이에요",
        "is_partner": true, "review_summary": "양이 많고 가격이 착하다는 평이 많아요"
      },
      {
        "order": 2, "stop_type": "CAMPUS", "store_id": null, "campus_building_id": 3,
        "name": "중앙도서관", "category": null, "address": null,
        "lat": 37.3226, "lng": 127.1261, "start_time": "14:30",
        "reason": null, "comment": "시험 기간엔 24시간 열려요",
        "is_partner": false, "review_summary": null
      }
    ]
  }
}
```

body(코스 준비 중) — HTTP Status : 409 Conflict
```json
{ "code": "E409_COURSE_NOT_READY", "message": "가이드가 코스를 준비 중이에요", "data": null }
```

### GET /stores/search — 상점 검색 [S-01]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

상호로 상점을 찾습니다. 사장님이 내 가게를 연결할 때 씁니다.
이미 다른 사장님이 연결한 상점은 is_registered가 true입니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
keyword: 분식
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| keyword | 필수 | 2자 이상 |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "store_id": 201, "name": "용인 분식", "address": "경기 용인시 처인구 ...", "category": "식당", "is_registered": false }
    ],
    "page": 1, "size": 20, "total": 1
  }
}
```

### POST /users/me/store — 가게 등록 (사장님 계정 연결) [S-01]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

사업자 인증이 끝난 사장님이 가게를 자기 계정에 연결합니다. 사장님 한 명당 가게 하나입니다.
상점 검색에서 고르면 store_id만 보냅니다. 목록에 없으면 store_id 없이 직접 입력합니다.
다른 사장님이 이미 연결한 상점은 연결할 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "store_id": 201,
  "name": "용인 분식",
  "address": "경기 용인시 처인구 ...",
  "category": "식당",
  "latitude": 37.3219,
  "longitude": 127.1268
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| store_id | 택일 | 검색에서 고른 경우 |
| name | 택일 | 직접 입력 시 필수(store_id가 없을 때) |
| address | 택일 | 직접 입력 시 필수 |
| category | 택일 | 직접 입력 시 필수. 식당, 카페 등 |
| latitude | 택일 | 직접 입력 시 필수 |
| longitude | 택일 | 직접 입력 시 필수 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{
  "code": "S201",
  "message": "가게 등록 성공",
  "data": { "store_id": 201, "name": "용인 분식", "address": "경기 용인시 처인구 ...", "category": "식당" }
}
```

body(이미 가게가 있거나 다른 사장님이 연결함) — HTTP Status : 409 Conflict
```json
{ "code": "E409_STORE_UNAVAILABLE", "message": "연결할 수 없는 상점입니다", "data": null }
```

### GET /users/me/store — 내 가게 조회 [S-01 보완]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

사장님이 연결한 가게와 제휴 할인 설정을 봅니다. 연결한 가게가 없으면 404입니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "store_id": 201,
    "name": "용인 분식",
    "address": "경기 용인시 처인구 ...",
    "category": "식당",
    "partnership": { "discount_text": "음료 1,000원 할인", "start_date": "2027-01-01", "end_date": "2027-02-28" }
  }
}
```

### PATCH /users/me/store — 가게 수정 [S-01]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

보낸 필드만 수정합니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "name": "용인 분식",
  "address": "경기 용인시 처인구 ...",
  "category": "식당"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| name | 선택 | (비어 있음) |
| address | 선택 | (비어 있음) |
| category | 선택 | (비어 있음) |

#### Response

body(성공) — HTTP Status : 200 OK

data는 내 가게 조회 응답과 같은 형태
```json
{ "code": "S200", "message": "수정 성공", "data": { "store_id": 201, "name": "용인 분식", "address": "경기 용인시 처인구 ...", "category": "식당", "partnership": null } }
```

### GET /stores/nearby — 주변 상점 조회 [S-02]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

캠퍼스 주변 상점을 지도용 좌표와 함께 돌려줍니다. 가이드가 코스에서 상점을 바꿀 때 씁니다.
반경은 서버가 정합니다. 제휴 상점은 is_partner로 구분합니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
campus_id: 1
category: 카페
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| campus_id | 필수 | (비어 있음) |
| category | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "store_id": 202, "name": "캠퍼스 카페", "category": "카페", "address": "경기 용인시 처인구 ...", "lat": 37.3225, "lng": 127.1271, "is_partner": false, "review_summary": null }
    ]
  }
}
```

### PUT /users/me/store/partnership — 제휴 할인 설정 [S-03]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

사장님이 제휴 할인 내용과 기간을 저장합니다. 없으면 만들고 있으면 덮어씁니다.
설정하면 제휴 상점으로 표시되고, 코스를 만들 때 제휴 상점으로 포함될 수 있습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "discount_text": "음료 1,000원 할인",
  "start_date": "2027-01-01",
  "end_date": "2027-02-28"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| discount_text | 필수 | 50자 이내 |
| start_date | 필수 | (비어 있음) |
| end_date | 필수 | start_date 이후 |

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "저장 성공", "data": { "discount_text": "음료 1,000원 할인", "start_date": "2027-01-01", "end_date": "2027-02-28" } }
```

### GET /users/me/coupons — 내 쿠폰 조회 [S-05]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

고교생이 발급받은 쿠폰을 6자리 코드와 함께 봅니다. 유효기간이 지난 쿠폰은 EXPIRED로 내려갑니다.
코스 지도에서 제휴 상점 핀을 눌렀을 때는 tour_id와 store_id로 좁혀 부릅니다.
쿠폰이 USED이면 그 상점에 리뷰를 쓸 수 있습니다. 리뷰를 이미 썼으면 reviewed가 true입니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
tour_id: 31
store_id: 201
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| tour_id | 선택 | (비어 있음) |
| store_id | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      {
        "coupon_id": 501,
        "code": "483920",
        "tour_id": 31,
        "store": { "store_id": 201, "name": "용인 분식" },
        "discount_text": "음료 1,000원 할인",
        "status": "ISSUED",
        "valid_until": "2027-01-15T23:59:59+09:00",
        "used_at": null,
        "reviewed": false
      }
    ]
  }
}
```

### GET /coupons/{couponCode} — 쿠폰 코드 확인 [S-06]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

사장님이 학생이 보여준 6자리 코드를 입력해 쿠폰 정보와 상태를 확인합니다.
내 가게의 쿠폰이면 상태가 USED·EXPIRED여도 정보를 돌려주니, 화면이 상태를 보여줍니다. 사용 처리 가능 여부는 status가 ISSUED인지로 판단합니다. 쿠폰은 탐방 당일에만 유효하고, 같은 날 같은 가게에서는 한 장만 사용 처리됩니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "coupon_id": 501,
    "code": "483920",
    "discount_text": "음료 1,000원 할인",
    "tour_date": "2027-01-15",
    "status": "ISSUED",
    "valid_until": "2027-01-15T23:59:59+09:00"
  }
}
```

body(다른 가게 쿠폰) — HTTP Status : 403 Forbidden
```json
{ "code": "E403_OTHER_STORE", "message": "다른 가게의 쿠폰입니다", "data": null }
```

### POST /coupons/{couponCode}/redeem — 쿠폰 사용 처리 [S-06]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음

#### 기능

사장님이 쿠폰을 사용 처리합니다. 상태는 USED가 되고 사용 시각이 기록됩니다.
이 기록이 방문 인증이 되어 고교생이 그 상점에 리뷰를 쓸 수 있게 됩니다.
내 가게의 쿠폰이고, ISSUED 상태이며 유효기간 안일 때만 처리됩니다. 쿠폰은 탐방 당일에만 쓸 수 있고, 같은 날 이 가게에서 이미 쿠폰이 사용 처리됐으면 다른 쿠폰은 사용할 수 없습니다(손님이 여러 개를 보여줘도 하나만 처리).

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{ "code": "S200", "message": "사용 처리 완료", "data": { "coupon_id": 501, "status": "USED", "used_at": "2027-01-15T13:40:00+09:00" } }
```

body(다른 가게 쿠폰) — HTTP Status : 403 Forbidden
```json
{ "code": "E403_OTHER_STORE", "message": "다른 가게의 쿠폰입니다", "data": null }
```

body(이미 사용됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_USED", "message": "이미 사용된 쿠폰입니다", "data": null }
```

body(만료됨) — HTTP Status : 410 Gone
```json
{ "code": "E410_EXPIRED", "message": "만료된 쿠폰입니다", "data": null }
```

body(오늘 이미 다른 쿠폰 사용됨) — HTTP Status : 409 Conflict
```json
{ "code": "E409_DAILY_LIMIT", "message": "오늘 이미 다른 쿠폰이 사용되었습니다", "data": null }
```

### GET /users/me/store/report — 방문 · 리뷰 리포트 조회 [S-07]

- 그룹: S. 상점 · 쿠폰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음
- (사용자가 전달한 엔드포인트 목록에는 없고 노션 표에만 있는 행)

#### 기능

사장님이 기간 안에 쿠폰이 사용된 횟수와 리뷰 수·평균 별점을 봅니다.
기능 명세 S-07의 세부 항목이 정해지면 필드를 맞춥니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
from: 2027-01-01
to: 2027-01-31
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| from | 선택 | 기본 최근 30일 |
| to | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": { "from": "2027-01-01", "to": "2027-01-31", "visit_count": 18, "review_count": 11, "average_rating": 4.5 }
}
```

### POST /stores/{storeId}/reviews — 리뷰 작성 [R-01]

- 그룹: R. 리뷰 (노션 행 제목은 "리뷰 작성 [R-01]기능")
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음
- (사용자가 전달한 엔드포인트 목록에는 없고 노션 표에만 있는 행)

#### 기능

고교생이 쿠폰을 사용한 상점에 별점과 한줄평을 남깁니다. 쿠폰 한 장당 리뷰 한 개입니다. 같은 탐방에서는 같은 상점에 한 번만 쓸 수 있고, 다른 탐방이면 같은 상점에 다시 쓸 수 있습니다.
저장 후 서버가 그 상점의 AI 리뷰 요약을 갱신합니다(응답과 별개).
쿠폰이 본인 것이 아니거나, 그 상점의 쿠폰이 아니거나, USED가 아니면 쓸 수 없습니다.

#### Request

header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

body
```json
{
  "coupon_id": 501,
  "rating": 5,
  "content": "양도 많고 맛있었어요"
}
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| coupon_id | 필수 | 사용 처리된 내 쿠폰 |
| rating | 필수 | 1~5 |
| content | 필수 | 100자 이내 |

#### Response

body(성공) — HTTP Status : 201 Created
```json
{ "code": "S201", "message": "리뷰 작성 성공", "data": { "review_id": 90, "store_id": 201, "rating": 5, "content": "양도 많고 맛있었어요", "created_at": "2027-01-15T15:00:00+09:00" } }
```

body(쿠폰 미사용) — HTTP Status : 403 Forbidden
```json
{ "code": "E403_COUPON_NOT_USED", "message": "쿠폰을 사용한 상점에만 리뷰를 쓸 수 있어요", "data": null }
```

body(이미 작성함) — HTTP Status : 409 Conflict
```json
{ "code": "E409_ALREADY_REVIEWED", "message": "이미 리뷰를 작성했습니다", "data": null }
```

### GET /stores/{storeId}/reviews — 상점 리뷰 · 요약 조회 [R-02]

- 그룹: R. 리뷰
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음
- (사용자가 전달한 엔드포인트 목록에는 없고 노션 표에만 있는 행)

#### 기능

상점의 AI 리뷰 요약, 평균 별점, 리뷰 목록을 최신순으로 돌려줍니다.
리뷰가 적어 요약이 아직 없으면 summary는 null입니다.
작성자는 이름 가운데를 가려서(김*늘) 내려줍니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

query
```
page, size
```

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| page, size | 선택 | (비어 있음) |

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "summary": "양이 많고 가격이 착하다는 평이 많아요",
    "average_rating": 4.5,
    "review_count": 11,
    "items": [
      { "review_id": 90, "rating": 5, "content": "양도 많고 맛있었어요", "author": "김*늘", "created_at": "2027-01-15T15:00:00+09:00" }
    ],
    "page": 1, "size": 20, "total": 11
  }
}
```

### GET /campuses — 캠퍼스 기준 데이터 조회 [D-01]

- 그룹: D. 상권 데이터
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음
- (사용자가 전달한 엔드포인트 목록에는 없고 노션 표에만 있는 행)

#### 기능

서비스가 다루는 5개 캠퍼스의 기준 정보를 돌려줍니다. 로그인 없이 호출합니다.
재학 인증의 학교 선택, 탐방 조건 검색, 희망 사항, 주변 상점 조회의 campus_id에 씁니다.
vacation_periods는 탐방을 개설할 수 있는 방학 기간입니다.

#### Request

header
```
없음
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      {
        "campus_id": 1,
        "name": "단국대학교",
        "campus_name": "주전캠퍼스",
        "address": "경기 용인시 수지구 주전로 152",
        "lat": 37.3219,
        "lng": 127.1268,
        "vacation_periods": [
          { "start_date": "2027-01-01", "end_date": "2027-02-28" },
          { "start_date": "2027-06-21", "end_date": "2027-08-31" }
        ]
      }
    ]
  }
}
```

### GET /campuses/{campusId}/places — 캠퍼스 장소 조회 [C-02 보완]

- 그룹: D. 상권 데이터 (노션 표에서 D-01 바로 다음 행)
- 개발: 시작 전 / API연동: 시작 전 / 담당: 비어 있음
- (사용자가 전달한 엔드포인트 목록에는 없고 노션 표에만 있는 행)

#### 기능

캠퍼스의 건물·장소(도서관, 학생회관 등)를 지도 좌표와 함께 돌려줍니다.
가이드가 코스에 캠퍼스 건물 지점을 넣을 때 씁니다. 코스 수정의 campus_building_id에 이 목록의 값을 사용합니다.

#### Request

header
```
Authorization: Bearer {access_token}
```

body: 없음

#### Response

body(성공) — HTTP Status : 200 OK
```json
{
  "code": "S200",
  "message": "조회 성공",
  "data": {
    "items": [
      { "campus_building_id": 3, "name": "중앙도서관", "description": "24시간 열람실이 있어요", "lat": 37.3226, "lng": 127.1261 }
    ]
  }
}
```

---

## 읽기 메모

관찰만 적는다. 권고는 없다.

### 읽지 못했거나 불완전할 수 있는 부분
- 노션 표는 가상 스크롤이라 스크롤하며 행 47개(공통규칙 1 + 엔드포인트 46)를 모두 수집했다. 요청서에는 43개라고 했으나 표에는 46개가 있고, 요청서 목록에 없는 5개(S-07 리포트, R-01, R-02, D-01, C-02 보완 장소 조회)를 표 순서대로 끝에 실었다. 요청서 목록의 41개는 모두 표에 있었다.
- 텍스트 추출이 일부 긴 페이지(A-02, S-06 사용 처리, T-05)의 끝부분을 놓쳐 스크롤 후 다시 읽어 보충했다. 응답 body 개수가 3개 이상인 페이지와 2개인 페이지 대부분은 `body(` 제목 개수와 마지막 문장을 다시 대조했다. 응답이 1개뿐인 페이지(예: 로그아웃, 내 정보 수정, 가이드 프로필, 목록·조회류 대부분)는 재대조하지 않았다.
- 노션 텍스트 추출은 코드 블록의 들여쓰기를 지운다. 여러 줄 JSON은 2칸 들여쓰기로 다시 맞췄고, 한 줄짜리 코드는 그대로다. 노션 원본 들여쓰기와 다를 수 있다.
- 표 셀이 비어 있으면 "(비어 있음)"으로 적었다. 추출 텍스트에서 빈 셀은 줄이 없어져 표 구조로 추정한 것이다(예: 로그인의 email/password 설명, page,size 설명 칸).
- 모든 행의 개발·API연동은 "시작 전", 담당은 "비어 있음"이었다. 기능 속성(그룹)은 그룹의 첫 행에만 값이 있고 나머지 행은 "비어 있음"으로 보였다(이 파일에서는 그룹 이름을 같이 적었다).

### 빈 페이지 / TBD
- 빈 페이지는 없었다. 모든 엔드포인트 페이지에 본문이 있었다.
- S-07(방문·리뷰 리포트) 기능란에 "기능 명세 S-07의 세부 항목이 정해지면 필드를 맞춥니다."라는 문장이 있다(필드 미확정 표시).

### 페이지 간 불일치·특이점
- 경로 매개변수 표기: 표의 endpoint는 `{consentToken}`, `{tourId}`인데 보호자 동의 안내 조회 본문 path에는 `consent_token`, 탐방 취소 페이지 하단에 붙은 완료 처리 블록에는 `/tours/{tour_id}/complete`로 적혀 있다.
- 탐방 취소 [T-05] 페이지 하단에 탐방 완료 처리 [T-06] 내용이 한 번 더 붙어 있다(제목 줄·헤더 구조가 다른 평문 블록).
- 좌표 필드명: 가게 등록(POST /users/me/store)은 `latitude`/`longitude`, 코스 스팟·주변 상점·캠퍼스 기준 데이터·캠퍼스 장소는 `lat`/`lng`.
- 캠퍼스 이름: GET /users/me 대학생 예시와 탐방 목록·희망 사항 예시는 "단국대학교 죽전캠퍼스"(`school_name`, `campus_name`)인데, 캠퍼스 기준 데이터(D-01) 예시는 `name` "단국대학교", `campus_name` "주전캠퍼스", 주소 "수지구 주전로 152"다. D-01은 `name`과 `campus_name`을 나누지만 다른 응답의 `campus_name`에는 학교명이 합쳐 들어 있다.
- 내 정보 수정(PATCH /users/me)은 "data는 GET /users/me 응답과 같은 형태"라고 쓰고 예시는 id, name, school_name, grade, interest_major만 있다. 내 가게 수정도 "내 가게 조회 응답과 같은 형태"라고 쓰고 예시는 `partnership: null`을 포함한다.
- 희망 사항: 등록 페이지는 "이 API는 AI를 쓰지 않으며"라고 하고 응답에 추천 필드가 없다. 반면 내 희망 사항 조회 제목은 "추천 내역", 본문은 "추천 결과는 저장하지 않아 등록 응답에서만 내려줍니다", 수정 페이지는 "이미 받은 추천 결과는 그대로"라고 쓴다.
- 희망 사항 응답 필드: 등록 응답은 `campus_id`와 `date`를 가지고 `campus_name`은 없다. 수정 응답은 `campus_name`, `date`, `updated_at`을 가지고 `campus_id`가 없다. 목록 조회 항목(내 것·학교·학과별)은 `campus_name`을 가지고 `date`가 없다.
- 탐방 희망 사항 등록 페이지 제목에만 기능 ID가 없다. 리뷰 작성 행 제목은 "리뷰 작성 [R-01]기능"으로 끝에 "기능"이 붙어 있다.
- 로그인과 로그아웃은 둘 다 [U-02], 내 정보 조회·수정은 둘 다 [U-03]이다. 인증 심사 목록·상세는 "[U-08 보완]", 승인·반려는 "[U-08]"이다. 코스 확정은 "[C-03, S-04]", 가게 등록·수정·상점 검색은 모두 [S-01], 코스 수정은 [C-02], 캠퍼스 장소 조회는 "[C-02 보완]"이다.
- 공통규칙의 "공통 실패" 표는 400/401/403/404/500만 정의하는데, 개별 페이지는 409, 410(E410_EXPIRED: 보호자 링크·쿠폰 둘 다), 422(E422_BUSINESS_INVALID, E422_PARTNER_REQUIRED), 502(E502_AI_FAILED)를 쓴다. 공통규칙의 성공 코드는 S200, S201만 있다.
- 공통규칙의 실패 코드 규칙은 `E{HTTP 상태}_{사유}`인데 E409(이메일 중복), E400 같은 사유 없는 코드도 개별 페이지에 쓰인다.
- 공통규칙의 `E403_VERIFICATION_REQUIRED` 설명은 verification_status가 APPROVED가 아닐 때인데, 탐방 신청 페이지는 같은 코드를 "인증 · 보호자 동의 전"으로 설명한다.
- 목록 응답 형태: 공통규칙은 `items`/`page`/`size`/`total` 또는 items만이라고 한다. 신청자 목록(A-04), 주변 상점, 내 쿠폰, 캠퍼스 기준 데이터, 캠퍼스 장소는 `items`만 내려준다. 쿠폰·신청자 목록에는 페이지 파라미터가 없다.
- 응답 예시의 `errors`는 공통규칙에서 유효성 실패일 때만 적는다고 했고, 개별 페이지의 E400 예시와 사업자 인증 422 예시에서 `errors` 배열이 보인다. 재학 인증 400 예시의 `errors` 항목은 `{ "field", "reason" }` 형태다.
- 재학 인증(POST /verifications/enrollment)은 multipart/form-data인데 body 예시가 JSON 코드 블록이고 `document`가 `"(파일)"`로 적혀 있다.
- 인증 심사 승인·반려 기능란에 "verification_status가 바뀔고"라는 문장이 있다(원문 그대로 옮김).
- 탐방 목록 항목(`GET /tours`)의 가이드는 `guide: { name, verified }`, 탐방 상세는 `guide: { name, major, intro, verified }`이다.
- 쿠폰 확인(GET /coupons/{couponCode})은 `tour_date`를 쓰고 내 쿠폰 조회 항목은 `tour_id`와 `store` 객체를 쓴다. 두 응답 모두 `valid_until`은 일시 형식이다.
- 역할 코드 `ADMIN`은 공통규칙 값 정의에 있고 /admin/* 페이지는 "운영자"라고만 쓴다. 403 E403 설명은 공통규칙에만 있다.
- 사업자 인증의 `representative_name`, `opened_at`, 로그인의 `email`/`password` 등 일부 필드는 설명 칸이 비어 있다.
