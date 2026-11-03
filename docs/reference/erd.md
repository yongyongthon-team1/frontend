# ERD 초안 (스냅샷)

> 원본: 노션 `Backend > ERD 초안` — https://app.notion.com/p/ERD-40ce0c1995d680cc8907e6452237864c
> 스냅샷: 2026-11-03. **정본은 노션이다.** 백엔드가 이 ERD를 근거로 API 명세를 작성할 예정(2026-11-03 기준 `데이터 · API 설계` 페이지는 비어 있음).
> 원본의 접힌 토글("작성 형식", "테이블 목록")은 옮기지 않았다. 표기: MySQL 계열 타입. 열 순서 = 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명.

## 상태값 요약 (프론트 라벨 매핑의 근거)

| 테이블.컬럼 | 값 |
|---|---|
| users.role | HIGH_SCHOOL, UNIVERSITY, OWNER, ADMIN |
| student_verifications.status | PENDING(기본), APPROVED, REJECTED — 레코드 없음 = 미제출 |
| guardian_consents.status | PENDING, AGREED, REJECTED (+ expires_at으로 만료 판단) |
| business_verifications.is_verified | FALSE(기본) / TRUE |
| tours.status | RECRUITING(기본), CLOSED, CANCELED, COMPLETED |
| tour_applications.status | PENDING(기본), APPROVED, REJECTED, CANCELED |
| courses.status | DRAFT(기본), CONFIRMED — 레코드 없음 = 준비 중 |
| course_stops.stop_type | CAMPUS, STORE |
| coupons.status | ISSUED(기본), USED, EXPIRED |

## 1) users (사용자) — U-01, U-02, U-03
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 사용자 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | 사용자 식별자 |
| 이메일 | email | VARCHAR(255) | NOT NULL | — | UK | 로그인 ID |
| 비밀번호 | password_hash | VARCHAR(255) | NOT NULL | — | — | 해시된 비밀번호 |
| 이름 | name | VARCHAR(100) | NOT NULL | — | — | 신청자 이름 |
| 역할 | role | VARCHAR(20) | NOT NULL | — | — | HIGH_SCHOOL, UNIVERSITY, OWNER, ADMIN |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | 가입 일시 |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | 정보 수정 일시 |

## 2) student_profiles (고등학생 프로필) — U-03, A-04
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 학생 프로필 ID | id | BIGINT | NOT NULL | — | PK, FK | users.id 참조 |
| 고등학교명 | high_school_name | VARCHAR(100) | NULL | — | — | 재학 중인 고등학교 |
| 학년 | grade | TINYINT | NULL | — | — | 1~3학년 |
| 관심 학과 | interested_major | VARCHAR(100) | NULL | — | — | 관심 있는 학과 |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

## 3) guide_profiles (가이드 프로필) — U-04, T-02
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 가이드 프로필 ID | id | BIGINT | NOT NULL | — | PK, FK | users.id 참조 |
| 대학교 ID | university_id | BIGINT | NULL | — | FK | → universities.id |
| 학과 | major | VARCHAR(100) | NULL | — | — | 대학생 전공 |
| 소개 | introduction | TEXT | NULL | — | — | 가이드 소개 |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

## 4) student_verifications (재학 인증) — U-05, U-08
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 인증 ID | id | BIGINT | NOT NULL | — | PK, FK | users.id 참조 (사용자당 1건, 재제출 시 갱신) |
| 고등학교명 | high_school_name | VARCHAR(100) | NULL | — | — | 고교생 인증 학교 |
| 대학교 ID | university_id | BIGINT | NULL | — | FK | → universities.id |
| 증빙 파일 경로 | document_url | VARCHAR(500) | NULL | — | — | 심사 완료 후 삭제 |
| 인증 상태 | status | VARCHAR(20) | NOT NULL | PENDING | — | PENDING, APPROVED, REJECTED |
| 반려 사유 | rejection_reason | TEXT | NULL | — | — | 최신 반려 사유 |
| 제출 일시 | submitted_at | DATETIME | NOT NULL | — | — | 최근 제출 시각 |
| 심사 일시 | reviewed_at | DATETIME | NULL | — | — | 심사 완료 시각 |
| 심사자 ID | reviewed_by | BIGINT | NULL | — | FK | → users.id |

## 5) guardian_consents (보호자 동의) — U-06
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 학생 ID | id | BIGINT | NOT NULL | — | PK, FK | users.id 참조, 고등학생 |
| 보호자 이름 | guardian_name | VARCHAR(100) | NOT NULL | — | — | |
| 보호자 이메일 | guardian_email | VARCHAR(255) | NOT NULL | — | — | 동의 요청 이메일 |
| 인증 토큰 해시 | token_hash | VARCHAR(255) | NULL | — | — | 이메일 동의 링크 검증 |
| 동의 상태 | status | VARCHAR(20) | NOT NULL | — | — | PENDING, AGREED, REJECTED |
| 만료 일시 | expires_at | DATETIME | NULL | — | — | 동의 링크 만료 시각 |
| 동의 완료 일시 | agreed_at | DATETIME | NULL | — | — | |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | 최초 동의 요청 시각 |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | 최근 수정 시각 |

## 6) business_verifications (사업자 인증) — U-07
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 사용자 ID | id | BIGINT | NOT NULL | — | PK, FK | → users.id |
| 인증 여부 | is_verified | BOOLEAN | NOT NULL | FALSE | — | 인증 성공 여부 |
| 인증 일시 | verified_at | DATETIME | NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

## 7) universities (대학교·캠퍼스) — D-01
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 대학교 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 대학교명 | name | VARCHAR(100) | NOT NULL | — | UK | |
| 캠퍼스명 | campus_name | VARCHAR(100) | NOT NULL | — | — | 관리 대상 캠퍼스 |
| 주소 | address | VARCHAR(255) | NULL | — | — | |
| 위도 | latitude | DECIMAL(10,7) | NOT NULL | — | — | 중심 위도 |
| 경도 | longitude | DECIMAL(10,7) | NOT NULL | — | — | 중심 경도 |
| 행정동 | administrative_dong | VARCHAR(100) | NULL | — | — | 상권 데이터 연결 기준 |

## 8) university_vacations (대학교 방학 기간) — T-03, D-01
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 방학 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 대학교 ID | university_id | BIGINT | NOT NULL | — | FK | → universities.id |
| 시작일 | start_date | DATE | NOT NULL | — | — | |
| 종료일 | end_date | DATE | NOT NULL | — | — | |
| 방학명 | label | VARCHAR(100) | NULL | — | — | 예: 2027 여름방학 |

## 9) campus_places (캠퍼스 장소) — C-01~04
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 캠퍼스 건물 ID | campus_building_id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 대학교 ID | university_id | BIGINT | NOT NULL | — | FK | → universities.id |
| 장소명 | name | VARCHAR(100) | NOT NULL | — | — | 도서관, 학생회관 등 |
| 장소 설명 | description | TEXT | NULL | — | — | |
| 위도 | latitude | DECIMAL(10,7) | NOT NULL | — | — | 지도 핀 |
| 경도 | longitude | DECIMAL(10,7) | NOT NULL | — | — | 지도 핀 |

## 10) tours (탐방) — T-01~06
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 탐방 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 가이드 ID | guide_id | BIGINT | NOT NULL | — | FK | → users.id |
| 대학교 ID | university_id | BIGINT | NOT NULL | — | FK | → universities.id |
| 시작 일시 | starts_at | DATETIME | NOT NULL | — | — | |
| 종료 일시 | ends_at | DATETIME | NULL | — | — | 종료 예정 |
| 정원 | capacity | INT | NOT NULL | — | — | |
| 탐방 소개 | introduction | TEXT | NOT NULL | — | — | |
| 오픈채팅 링크 | open_chat_url | VARCHAR(500) | NULL | — | — | 승인된 신청자에게만 공개 |
| 탐방 상태 | status | VARCHAR(20) | NOT NULL | RECRUITING | — | RECRUITING, CLOSED, CANCELED, COMPLETED |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

> 제목 · 학과 컬럼이 없다. 화면의 "경희대 국제캠퍼스 디자인 전공 탐방" 같은 제목은 대학교명 + 가이드 학과(guide_profiles.major)로 만들어야 한다(추정).

## 11) tour_applications (탐방 신청) — A-01~04
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 신청 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 탐방 ID | tour_id | BIGINT | NOT NULL | — | FK, 복합 UK | → tours.id |
| 사용자 ID | user_id | BIGINT | NOT NULL | — | FK | → users.id |
| 신청 동기 | motivation | TEXT | NOT NULL | — | — | 하고 싶은 것 |
| 신청 상태 | status | VARCHAR(20) | NOT NULL | PENDING | — | PENDING, APPROVED, REJECTED, CANCELED |
| 유효 신청 사용자 ID | active_user_id | BIGINT | NULL | 자동 계산 | 복합 UK | PENDING 또는 APPROVED이면 user_id, 그 외 NULL (중복 신청 방지) |
| 신청 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | 상태 변경 시각 |

## 12) courses (탐방 코스) — C-01~04
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 탐방 ID | tour_id | BIGINT | NOT NULL | — | PK, FK | → tours.id (탐방당 코스 최대 1개) |
| 코스 상태 | status | VARCHAR(20) | NOT NULL | DRAFT | — | DRAFT, CONFIRMED |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | 초안 수정·재생성 시각 |
| 확정 일시 | confirmed_at | DATETIME | NULL | — | — | |

## 13) course_stops (코스 지점) — C-01~04
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 코스 지점 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 탐방 ID | tour_id | BIGINT | NOT NULL | — | FK, 복합 UK | → courses.tour_id |
| 지점 유형 | stop_type | VARCHAR(20) | NOT NULL | — | — | CAMPUS, STORE |
| 캠퍼스 건물 ID | campus_building_id | BIGINT | NULL | — | FK | → campus_places |
| 상점 ID | store_id | BIGINT | NULL | — | FK | → stores.id |
| 제휴 행사 ID | partnership_id | BIGINT | NULL | — | FK | → store_partnerships (원문 표기 `partnership_id`, 실제 PK는 `id`) |
| 방문 순서 | stop_order | INT | NOT NULL | — | 복합 UK | |
| 방문 시간 | visit_time | TIME | NULL | — | — | 예정 방문 시간 |
| 한줄평 | description | TEXT | NULL | — | — | 가이드 설명 |
| AI 추천 이유 | recommendation_reason | TEXT | NULL | — | — | |

## 14) stores (상점) — S-01, S-02
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 상점 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 사장님 ID | owner_id | BIGINT | NULL | — | FK, UK | → users.id (계정당 가게 1개) |
| 상호명 | name | VARCHAR(150) | NOT NULL | — | — | |
| 주소 | address | VARCHAR(255) | NOT NULL | — | — | |
| 업종 | category | VARCHAR(100) | NOT NULL | — | — | 식당, 카페 등 |
| 행정동 | administrative_dong | VARCHAR(100) | NULL | — | — | 상권 데이터 연결 |
| 위도 | latitude | DECIMAL(10,7) | NOT NULL | — | — | |
| 경도 | longitude | DECIMAL(10,7) | NOT NULL | — | — | |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

## 15) store_partnerships (상점 제휴 할인) — S-03
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 제휴 행사 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 상점 ID | store_id | BIGINT | NOT NULL | — | FK | → stores.id |
| 할인 내용 | discount_description | VARCHAR(255) | NOT NULL | — | — | |
| 시작일 | start_date | DATE | NOT NULL | — | — | |
| 종료일 | end_date | DATE | NOT NULL | — | — | |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

## 16) coupons (쿠폰) — S-04, S-05, S-06
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 쿠폰 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 신청 ID | application_id | BIGINT | NOT NULL | — | FK, 복합 UK | → tour_applications.id |
| 상점 ID | store_id | BIGINT | NOT NULL | — | FK, 복합 UK | → stores.id |
| 제휴 행사 ID | partnership_id | BIGINT | NOT NULL | — | FK | → store_partnerships.id |
| 쿠폰 코드 | code | CHAR(6) | NOT NULL | — | UK | 6자리 코드 |
| 쿠폰 상태 | status | VARCHAR(20) | NOT NULL | ISSUED | — | ISSUED, USED, EXPIRED |
| 할인 내용 사본 | discount_snapshot | VARCHAR(255) | NOT NULL | — | — | 발급 당시 할인 내용 |
| 발급 일시 | issued_at | DATETIME | NOT NULL | — | — | |
| 만료 일시 | expires_at | DATETIME | NOT NULL | — | — | |
| 사용 일시 | used_at | DATETIME | NULL | — | — | |

## 17) reviews (상점 리뷰) — R-01, R-02
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 리뷰 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 작성자 ID | user_id | BIGINT | NOT NULL | — | FK, 복합 UK | → users.id |
| 탐방 ID | tour_id | BIGINT | NOT NULL | — | FK, 복합 UK | → tours.id |
| 상점 ID | store_id | BIGINT | NOT NULL | — | FK, 복합 UK | → stores.id |
| 쿠폰 ID | coupon_id | BIGINT | NOT NULL | — | FK, UK | → coupons.id |
| 별점 | rating | TINYINT | NOT NULL | — | — | 1~5점 |
| 한줄평 | content | TEXT | NOT NULL | — | — | |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

## 18) store_review_summaries (상점 리뷰 AI 요약) — R-03
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 요약 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 상점 ID | store_id | BIGINT | NOT NULL | — | FK, UK | → stores.id |
| AI 요약 | summary | TEXT | NOT NULL | — | — | 리뷰 요약 2~3문장 |
| 리뷰 수 | review_count | INT | NOT NULL | — | — | 요약 생성 시 반영한 리뷰 수 |
| 생성 일시 | generated_at | DATETIME | NOT NULL | — | — | |

## 19) tour_wishes (희망 탐방) — 근거 기능 ID 없음
| 논리명 | 컬럼 | 타입 | NULL | 기본값 | 키 | 설명 |
|---|---|---|---|---|---|---|
| 희망 ID | id | BIGINT | NOT NULL | AUTO_INCREMENT | PK | |
| 작성자 ID | user_id | BIGINT | NOT NULL | — | FK | → users.id, 고교생 |
| 희망 대학교 ID | university_id | BIGINT | NOT NULL | — | FK | → universities.id |
| 관심 학과 | major | VARCHAR(100) | NOT NULL | — | — | 탐방을 희망하는 학과 |
| 하고 싶은 것 | content | TEXT | NOT NULL | — | — | 고교생이 자유롭게 작성한 탐방 희망 내용 |
| 희망 날짜 | preferred_date | DATE | NULL | — | — | |
| 생성 일시 | created_at | DATETIME | NOT NULL | — | — | |
| 수정 일시 | updated_at | DATETIME | NOT NULL | — | — | |

> 기능 명세 · 유저 플로우 · 와이어프레임 어디에도 대응 기능이 없다. 필드 구성이 홈의 AI 추천 입력(T-01: 하고 싶은 것 · 관심 학과 · 학교 · 날짜)과 같아서 추천 요청 기록용일 가능성이 있다(추정, 단 university_id가 NOT NULL이라 학교 선택 필수와 충돌).
