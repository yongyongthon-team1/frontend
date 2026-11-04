# MVP 1단계 계획 — 실행 중 판정(Rulings)

계획 `2026-11-04-mvp1-foundation-golden-path.md`를 실행하면서 정한 판정이다. **같은 태스크에서 계획 본문과 이 문서가 다르면 이 문서가 우선한다.** 근거는 독립 계획 리뷰(2026-11-04, 지적 49건 — 인터페이스 일관성 24 · 테스트 기댓값 25)와 태스크 리뷰다. 형식: 판정 — 이유 — 틀렸을 때 비용.

## 전역

- G1. 모든 태스크의 통과 확인은 `npm run test:run && npm run typecheck && npm run lint`(빌드가 걸린 태스크는 `&& npm run build`). — Vitest는 타입 검사를 하지 않아 타입 오류가 E2E 빌드에서야 드러난다. — 확인 시간 몇 초.
- G2. Review Focus 4는 "역할 전환 시 `queryClient.clear()`가 불리고 이전 역할의 데이터(예: `qk.myApplications`)가 캐시에 없다"로 읽는다(쿼리 개수 0이 아니다). — 전환 직후 새 역할 쿼리가 바로 채워진다. — 없음.
- G3. 테스트 환경 변수는 커밋된 `.env.test`로 고정한다(`VITE_API_BASE_URL=/api`, `VITE_API_MODE=mock`, `VITE_MOCK_DOMAINS=all`, `VITE_DEMO_TOOLS=false`, `VITE_KAKAO_MAP_KEY=`, `VITE_DEMO_PASSWORD=demo1234`). Playwright `webServer.env`에는 VITE_* 전부를 명시한다. — 개발자의 `.env.local`이 테스트 · E2E 빌드에 섞이면 로컬과 CI 결과가 갈린다. — 없음.
- G4. 시연 탐방 시각은 와이어프레임대로 14:00–16:30을 유지한다(설계 5.5의 "발표 시간대 이후" 문구와 다름). — 쿠폰 · 취소 규칙은 날짜만 보므로 기능 차이가 없고, 와이어 · 테스트 기댓값과 맞다. — 시드 상수 1개와 테스트 기댓값 몇 개.
- G5. 업무 규칙 "취소 후 재신청 허용, 거절 후 불가"는 확정(설계 9장 #9, ERD `active_user_id`). Task 9가 `docs/api/frontend-needs.md` 6절에 한 줄 명시한다.
- G6. `handleUnauthorized()`는 세션 토큰이 없으면 아무것도 하지 않는다(로그인 실패 401에서 로그아웃 · 재로그인 루프 방지).

## Task 6 (목업 DB)

- 탐방 7(COMPLETED) 리뷰 작성자 = 박서준 · 이하은 · 최유진 · past1 · past2(각자 상점 1 · 2의 USED 쿠폰 1장 + 리뷰 1건). 김민지는 어느 탐방에도 신청 · 쿠폰이 없다.
- 탐방 6 소개문은 `겨울방학 캠퍼스 생활과 동아리 이야기를 나눠요.`(디자인 키워드 없음), 탐방 2~5 · 7은 학과에 맞는 서로 다른 한 문장.
- `getDb()`는 저장된 DB의 `seedDay`가 오늘(`mockNow()` 기준 서울 날짜)이 아니면 다시 시드한다.
- 시드 쿠폰 코드는 `000000`이 아니다.
- 서천 밥상 · 카페 모래시계는 대학 중심과 `예술·디자인대학` 장소 양쪽에서 각각 가장 가까운 식당 · 카페다.
- `clearDbCache()`(테스트 헬퍼)를 setup의 afterEach에서 부른다.

## Task 7 (규칙 — 신청 · 승인 · 취소 · 쿠폰)

- 쿠폰 테스트 준비: 탐방 1에 상점 1 · 2 지점이 있는 CONFIRMED 코스를 넣고 최유진을 승인해 쿠폰을 받게 한다. 발급 수는 `db.coupons.filter(c => c.applicationId === app.id)`로 센다(시드의 탐방 7 USED 쿠폰 10장이 섞이지 않게).
- 사용 처리 시각은 `const dayOf = new Date('2026-11-15T05:00:00Z')`(당일 14:00 KST). 만료는 다음 날, 아직 아님은 전날 `now`를 따로 넘긴다.
- `generateCouponCode`는 시드 쿠폰 코드와도 겹치지 않아야 한다(`db.coupons` 전체 코드로 집합을 만든다).

## Task 8 (목업 AI · 코스 규칙)

- 추천 점수: 가이드 학과가 추출 학과 키를 **포함**하면 +3, 소개문에 **질의에서 추출된 키워드**가 있으면 키워드당 +1(키워드마다 한 번만). headline 계열은 질의에서 처음 추출된 학과의 MAJOR_FAMILY. 동점이면 날짜 오름차순.
- 테스트 단언은 제목 대신 `expect(r.items[0].tour.id).toBe(DEMO_TOUR_ID)`.
- 반경 · "가장 가까움"은 모두 **대학 중심**(universities 좌표)에서 `distanceMeters`로 잰다. 캠퍼스 장소는 가이드 학과가 포함하는 첫 키의 계열 단어(예: `디자인`)가 이름에 들어간 첫 장소, 없으면 첫 장소.
- **관련 업종에 제휴 상점이 없으면 제휴 없이 만든다(관련 없는 업종의 제휴 상점을 덧붙이지 않는다)** — 사용자 결정(4장)이 "관련 후보 중 제휴 1곳 이상"이다. 계획의 "반경 안 아무 제휴 상점을 덧붙인다" 규칙과 그 테스트는 "관련 업종 상점이 모두 비제휴면 제휴 지점 없이 만들고, 확정 시 쿠폰 0장"으로 바꾼다.
- `stopOrder`는 1부터, 순서 변경 · 삭제 뒤 1..n으로 다시 매긴다. "순서를 바꾸면" 테스트에 `expect(after.map(s => s.stopOrder)).toEqual([1, 2, 3])` 추가.
- 코스 조회 권한을 둘로 나눈다: `isCourseAudience(db, userId, tourId)`(그 탐방의 APPROVED 신청자이거나 가이드) + 코스 상태. `canViewCourse` = audience && CONFIRMED(유지). 테스트도 둘로.
- 목업 전용 컬럼 `CourseRow.interests: string[]`(초안 생성 때 저장).
- `CampusPlaceRow`의 PK는 ERD대로 `campusBuildingId` — DTO의 `CourseStop.id`는 지점 행 id를 쓴다.

## Task 9 (핸들러 · 부트스트랩)

- `src/demo/demoStore.ts`를 Files에 포함: `useDemoStore`(zustand persist 훅), `readDemoOverride()`, `isDemoToolsOn()`(비구독), **`useDemoToolsOn()`(구독 훅: `useDemoStore(s => s.enabled) || env.demoTools`)**.
- 목업 `POST /api/demo/reset`은 `X-Demo-Key`를 검사하지 않고(403은 실서버 전용), **기존 `sessions`를 새 DB로 옮긴다**(시드 사용자 id가 결정적이라 로그인 유지).
- 인사이트 핸들러: 5개교 모두 `{ universityId, title: '방학 상권 인사이트', text: '{행정동}은 방학이면 대학가 손님이 크게 줄어요. 이 코스는 그 상권으로 신청자들을 보내요.', source: '팀 데이터 담당 확정 전 예시', isPlaceholder: true }`(핸들러 상수).
- 학생 코스 조회 판정 순서: audience 아님 → 403 FORBIDDEN, 코스 없음 또는 DRAFT → 404 COURSE_NOT_READY, 그 밖 → 200.
- `toCourse`: `interests` = `CourseRow.interests`, `issuedCouponCount` = 이 탐방 신청들의 쿠폰 중 이 코스 지점 상점의 쿠폰 수.
- 내 쿠폰 목록은 쿠폰 id 오름차순.
- `docs/api/frontend-needs.md` 6절에 G5 한 줄 추가.

## Task 10 (공통 UI)

- `Button.hint` 타입은 `{ reason: string | null; action?: ActionLink | null }`(reason이 null이면 사유 줄을 그리지 않는다).
- `CodeInput`의 `label` 기본값은 `'6자리 쿠폰 코드'`.

## Task 11 (앱 셸)

- `createQueryClient()`의 retry: `(count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1`(4xx는 재시도 안 함 — 오류 화면이 1초 늦어지지 않게).
- `providers.tsx`에 `declare module '@tanstack/react-query' { interface Register { defaultError: ApiError } }` — 화면이 `@/shared/lib/http`를 import하지 않고도 `error.code` · `error.details`를 쓴다.
- 가드 분리: `RequireAuth`는 토큰만 본다. `useMe`는 토큰이 있을 때만 그려지는 안쪽 `MeGate`(로딩 → Skeleton, 성공 → Outlet)에서 부른다.
- `useLogout` 순서: 서버 로그아웃(실패 무시) → `setToken(null)` → `await navigate('/login', { replace: true })` → `queryClient.clear()`. 테스트 단언은 `queryClient.getQueryData(qk.me)`가 undefined이고 `getAll().every(q => q.state.data === undefined)`.
- `session.ts`에 `registerQueryClient(qc)`(handleUnauthorized · 시연 도구가 쓰는 인스턴스). `main.tsx`와 `renderApp`이 호출한다. G6 적용.
- `renderApp`: 렌더 전에 `configureHttp({ baseUrl: '/api', getToken: () => useSession.getState().token, onUnauthorized: handleUnauthorized })`, `as`가 없으면 `useSession.setState({ token: null })`, `registerQueryClient(qc)`. `as`가 있으면 `qk.me` 쿼리가 성공할 때까지 기다린 뒤 resolve한다.
- 테스트 헬퍼 추가: `demoCouponCode(storeId: number): string` — 김민지의 탐방 1 신청에 발급된 그 상점의 ISSUED 쿠폰 코드.

## Task 12 (배포 준비)

- `tsconfig.node.json` include에 `playwright.config.ts`, `e2e` 추가.
- Playwright `webServer.env`: `VITE_API_BASE_URL: '/api'`, `VITE_API_MODE: 'mock'`, `VITE_MOCK_DOMAINS: 'all'`, `VITE_DEMO_TOOLS: 'true'`, `VITE_KAKAO_MAP_KEY: ''`, `VITE_DEMO_PASSWORD: 'demo1234'`.
- Step 7: 배포 URL에서 SPA 새로고침 · MSW가 확인되면 체크포인트는 `🟨`(`/api` 프록시 · 카카오 도메인 미확인 — 백엔드 주소 · 키 대기)로 두고 팀 요청 행에 연결한다.

## Task 13 (홈 · 추천)

- fallback일 때 상단 칩은 고정 문구 `조건에 맞는 추천이 없어요`(warning), 제목은 `result.headline`. fallback이 아니면 칩 `AI가 관심사를 분석했어요 ✦`.
- 테스트: `expect(screen.getAllByText('경희대학교 국제캠퍼스')[0]).toBeInTheDocument()`와 첫 카드 링크의 href가 `/tours/1`.
- 카드 전체가 `Link`(`to=/tours/{id}`)이고, footer의 `자세히 보기 →`는 링크가 아닌 텍스트다.

## Task 14 (상세 · 신청)

- 와이어 hs-s05 하단 각주는 따로 그리지 않는다(Button hint가 대신한다).
- 시연 미리 채움은 `useDemoToolsOn()`으로 판단한다.

## Task 15 (내 탐방)

- 첫 테스트의 구조분해는 `const { router } = …`(쓰지 않는 `user` 제거).

## Task 16 (지도 · 코스 지도)

- `getGuideCourse(tourId): Promise<Course | null>` — 404면 null(코스 없음). `useGuideCourse`의 data가 null이면 "코스 없음".
- `useKakaoMaps`는 키가 없거나 `forceSchematic`이면 **첫 렌더부터** `'fallback'`.
- 데이터에 의존하는 테스트 단언은 `findBy*`(`학교에서 동네까지, 2시간 30분`, `schematic-map`).
- `endsAt`이 null이면 소요 시간 문구를 생략한다.

## Task 17 (쿠폰)

- "사장님이 사용하면" 테스트는 `useDemoStore.getState().lastCoupon`의 상점 사장님(`DEMO_STORE_OWNERS`) 계정으로 사용 처리한다.

## Task 18 (가이드 목록 · 신청자 관리)

- 이동 경로는 모두 절대 경로(`/guide/tours/${tourId}/applicants`, `/guide/tours/${tourId}/course/draft?generate=1`, `/guide/tours/${tourId}/course/edit`, `/guide/tours/${tourId}/course/confirmed`).
- "탐방 1이 먼저" 테스트는 첫 `신청자 보기` 링크의 href가 `/guide/tours/1/applicants`인지로 확인한다.

## Task 19 (코스 초안 · 편집 · 확정)

- 이동 경로는 모두 절대 경로.
- 초안 화면은 `useGuideCourse(tourId).data === null`이고 `?generate=1`이면 생성한다.
- CourseConfirmedPage의 승인 수는 `useApplicantsBoard(tourId).data.counts.approved`.

## Task 20 (사장님 쿠폰)

- 테스트는 `await screen.findByLabelText('6자리 쿠폰 코드')`, 코드는 `demoCouponCode(storeId)`, `?code=` 테스트도 `{ as: 'owner' }`.

## Task 21 (시연 도구)

- `resetDemoData(opts: { checkpoint?: SeedCheckpoint }, deps: { queryClient: QueryClient })`. `main.tsx`의 reset이 실패하면 토스트만 띄우고 렌더는 계속한다. reset 처리 때 세션 토큰과 `activeDemoEmail`도 비운다.
- `RoleBadge`는 TopBar가 아니라 앱 계층(MobileFrame 안 오른쪽 위 오버레이)에서 그린다 — `shared`가 `demo` · `features`를 import하지 않게. Task 21의 TopBar 수정은 하지 않는다.
- 시연 패널은 DOM 하나로 두고 배치만 CSS로 바꾼다. 표시 여부는 `useDemoToolsOn()`.
- `useLogout`은 `activeDemoEmail`도 비운다.

## Task 22 (E2E)

- 무대 해상도: `{ width: 1366, height: 620 }`, `{ width: 1280, height: 600 }`, `{ width: 1280, height: 590, deviceScaleFactor: 1.5 }`(브라우저 UI를 뺀 실제 페이지 영역). 스크린샷 이름에 `@{dsf}x` 포함.
- `신청자 보기`는 `.first()`.

## 실행 중 컨트롤러 판정 (태스크 리뷰 · 최종 리뷰에서)

계획 실행 중 브리프 빈칸 · 리뷰 지적에 대해 내린 판정이다. 형식은 위와 같다(판정 — 틀렸을 때 비용). 위 태스크별 판정과 겹치는 항목은 적지 않는다.

- C1. 테스트 setup은 매 테스트 뒤 목업 DB 모듈 캐시도 비운다(`clearDbCache`). — 테스트 헬퍼 하나.
- C2. 학과 매칭은 "포함" 기준(`산업디자인학과` ⊃ `산업디자인`), 추천 계열은 질의에서 처음 뽑힌 학과 기준. — 추천 점수 규칙 한 줄.
- C3. 세션 토큰이 없으면 401 처리는 아무것도 하지 않는다(G6 확장). — 401 분기 한 줄.
- C4. 취소 후 재신청 허용 · 거절 후 불가(G5)를 계약 6절에 명시. — 백엔드가 1인 1신청이면 신청 버튼이 409 토스트.
- C5. 시연 탐방 14:00–16:30 유지(G4). — 시드 상수 · 테스트 몇 개.
- C6. 목업 `mutate`는 트랜잭션(던지면 되돌림). — 무시 가능한 복제 비용.
- C7. 시연 빠른 로그인 비밀번호: 목업은 시드 상수(`DEMO_SEED_PASSWORD`), 실서버는 `VITE_DEMO_PASSWORD`. 목업 워커 실패는 패널에 표시. — env만 바꾸면 목업 빠른 로그인 401.
- C8. 하단 탭은 하위 화면에서도 활성(`TabItem.match` 경로 접두). 고교생 상세 `/tours/*`는 `탐색` 탭. — 탭 하이라이트만.
- C9. 추천 결과는 `staleTime: Infinity` · `retry: false`(AI 30초 제한, 포커스 재요청 금지). — 같은 질문 결과가 세션 동안 고정.
- C10. 추천 0건 빈 상태 문구 · 추천 화면이 유효 쿼리를 `lastQuery`에 저장 · 학과 없으면 날짜만. — 문구 한 줄.
- C11. 신청 성공 시 추천 캐시는 무효화하지 않는다(남은 자리는 승인 때만 바뀜). — 실서버 여러 기기에서 목록 잔여 자리가 새로고침 전까지 낡음.
- C12. 상세 칩 · 선택 표시 규칙(모집 중 · 마감 · 라벨만), 실패 시 상세 재조회, 제출 중 비활성, 히스토리 뒤로. — 표시 몇 줄.
- C13. 내 탐방 카드는 action만 링크, 끝난 신청(거절 · 취소)엔 코스 카드 · 취소 버튼 · `진행 상태` 줄 없음, 취소 실패 시 재조회. — 표시 몇 줄.
- C14. 카카오 SDK 로더는 단일 promise(실패도 세션 동안 캐시), 늦은 load 가드, 지도 높이 토큰 `--map-h`. — 폴백 재시도 정책.
- C15. 지점 카드는 한줄평(없으면 AI 이유)과 제휴 안내를 함께 보인다. — 카드 한 줄.
- C16. 지도 · 쿠폰 버튼과 코스 지도는 APPROVED + CONFIRMED에서만, 승인 대기는 `가이드 승인을 기다리고 있어요`. — 문구 두 줄.
- C17. 쿠폰 상세는 와이어 순서(상점 → 코드). 폴링 · 재조회 실패에도 받은 데이터는 그대로(데이터 우선 렌더링 — 이후 모든 화면에 적용). — 낡은 데이터가 잠시 보임.
- C18. 가이드 승인 · 거절은 처리 중 전부 비활성, 남은 자리 0이면 승인 비활성 + 사유, 실패 시 보드 재조회, 진행 중 탐방은 시작 순. — 버튼 비활성 범위.
- C19. 코스 초안 · 편집 · 확정 세부(지점 분류 함수 `stopKindLabel`, 생성 후 `?generate=1` 제거, 초안 생성 중복 방지, 처리 중 확인 대화상자 닫기 막기, 지점 0개면 확정 비활성 + 행동). — 문구 · 비활성 조건.
- C20. **무대 예산은 본문 위 약 400px**(판정 뷰포트 1280×590의 본문 409px 기준, 설계 5.7의 450px 대체). 초안 화면은 관심사 한 줄 · 작은 칩 · 66px 카드로 압축. — 초안 화면 밀도(하이파이에서 재조정).
- C21. 사장님 쿠폰 화면은 반응형 `useDemoToolsOn()`, 최근 쿠폰은 형식 검사 후, 오류 카드 매핑은 순수 함수, `?code=` 변경에 반응. — hint 문구 · 채우기 조건.
- C22. 시연 도구 의존 방향은 demo → features → shared만(자동 재로그인은 `setUnauthorizedRecovery` 등록 지점), `?as=` 로그인은 첫 렌더 전. — 부트 순서 몇 줄.
- C23. 역할 전환은 "로그인 먼저, 그다음 한 번에 교체"(로그인 화면 0프레임, 실패하면 현재 세션 유지). 로그인 요청은 `auth: false`. — quickLogin 순서.
- C24. 골든 패스 E2E는 실제 로케이터로, 무대 점검은 `toBeInViewport` + 탭바 위 직접 단언, 실패 시 배치를 고친다. — 로케이터 몇 줄.
- C25. 발표 모드 세로 막대의 `사장님`은 유효한 최근 쿠폰이 있으면 그 가게 사장님으로 전환 + `?code=`(전체 패널은 두 버튼 그대로). 초기화는 최근 쿠폰도 비우고, `최근 쿠폰 채우기`는 내 가게 쿠폰일 때만. — 발표 모드 버튼 동작 한 갈래.
- C26. 원클릭 `reset=1`은 AI 속도 · 지도 모드도 기본값으로, 세로 막대에 API 모드와 기본값이 아닌 설정 표시, `?mode=`는 `demo=1`과 함께일 때만 저장, README 무대 링크는 `mode=` 명시. — 링크 · 표시 몇 줄.
- C27. R-02 최근 리뷰는 계약 필드(`CourseStop.review.recent`)만 먼저 고정, 타입 · 목업 · 화면은 2단계. — 필드 하나 개명.
- C28. 화면 오류는 앱 셸 안에서(프레임 · 탭바 · 시연 패널 유지) 보여 준다. — 에러 화면 배치.
- C29. 남긴 항목(2단계 · 3단계): 401이 어떤 토큰의 것인지 구분 · 복구 예산 로그인당 리셋 · 수동 로그인 시 `activeDemoEmail` · 세션 교체 함수 통합 · MeGate 재로그인 중 깜빡임 · 모든 404를 "코스 없음"으로 보는 점 · 루트 ErrorPage의 패널 · 발표 모드에서 목업 워커 실패 표시 · 대화상자 포커스 복귀 · 테스트 고정 시계. — 실서버 교체(11/9–12) 때 처리.
