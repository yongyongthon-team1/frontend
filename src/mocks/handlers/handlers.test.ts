import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getApplicantsBoard,
  getGuideTour,
  getGuideTours,
  getMyApplication,
  getMyApplications,
  patchDecision,
  postApplication,
  postCancelApplication,
  postCancelTour,
  postCompleteTour,
  postTour,
} from '@/features/applications/api';
import {
  fetchMe,
  login as apiLogin,
  logout,
  patchMe,
  postSignup,
  putGuideProfile,
} from '@/features/auth/api';
import { getInsight, listCampuses } from '@/features/campuses/api';
import { getCouponLookup, getMyCoupon, getMyCoupons, postRedeem } from '@/features/coupons/api';
import {
  getCampusPlaces,
  getCourse,
  getGuideCourse,
  getNearbyStores,
  postConfirmCourse,
  postCourseDraft,
  putCourseSpots,
} from '@/features/courses/api';
import { COURSE_CRITERIA } from '@/features/courses/model';
import { buildSpots } from '@/features/courses/spots';
import { getStoreReviews, postReview } from '@/features/reviews/api';
import {
  getConsent,
  getDemoConsentToken,
  patchConsent,
  postEnrollment,
  postGuardianConsent,
} from '@/features/verification/api';
import { getMyStore, getStoreReport, getStoreReportView } from '@/features/stores/api';
import { findWishTours, getTour, listTours } from '@/features/tours/api';
import type { TourFilter } from '@/features/tours/model';
import { listGuideWishes, listMyWishes, patchTourWish, postTourWish } from '@/features/wishes/api';
import { getMockFile, putMockFile } from '@/mocks/db/files';
import { getDb, mutate, resetDb } from '@/mocks/db/store';
import { DEMO_CONSENT_TOKENS } from '@/shared/config/demoAccounts';
import { configureHttp, request, upload } from '@/shared/lib/http';
import { createDraft } from '@/mocks/rules/courses';
import { fieldError, MockApiError } from '@/mocks/rules/errors';
import { server } from '@/mocks/node';
import { testImage } from '@/test/files';
import { redeemDemoCoupon } from '@/test/renderApp';
import {
  GUIDE_PROFILE_OK,
  LOGIN_FAILED,
  LOGIN_OK,
  LOGOUT_OK,
  ME_HIGH_SCHOOL,
  ME_PATCH_OK,
  ME_UNIVERSITY,
  SIGNUP_DUPLICATE,
  SIGNUP_OK,
} from '@/test/fixtures/backend/auth';
import {
  APPLICANTS_LIST,
  APPLY_OK,
  CANCEL_OK,
  DECISION_OK,
  MY_TOURS_HIGH_SCHOOL,
  MY_TOURS_UNIVERSITY,
} from '@/test/fixtures/backend/applications';
import { CAMPUS_PLACES, CAMPUSES_LIST } from '@/test/fixtures/backend/campuses';
import {
  COURSE_CONFIRM_OK,
  COURSE_DRAFT,
  COURSE_SPOTS_OK,
  COURSE_VIEW,
} from '@/test/fixtures/backend/courses';
import {
  COUPON_LOOKUP,
  COUPON_OTHER_STORE,
  MY_COUPONS,
  REDEEM_ALREADY_USED,
  REDEEM_EXPIRED,
  REDEEM_OK,
} from '@/test/fixtures/backend/coupons';
import {
  REVIEW_ALREADY,
  REVIEW_CREATED,
  REVIEW_NOT_USED,
  STORE_REVIEWS,
} from '@/test/fixtures/backend/reviews';
import { MY_STORE, NEARBY_STORES, STORE_REPORT } from '@/test/fixtures/backend/stores';
import {
  CONSENT_DECIDE_EXPIRED,
  CONSENT_DECIDED,
  CONSENT_EXISTS,
  CONSENT_EXPIRED,
  CONSENT_PROCESSED,
  CONSENT_REQUESTED,
  CONSENT_VIEW,
  ENROLLMENT_INVALID,
  ENROLLMENT_OK,
  ENROLLMENT_SUBMITTED,
} from '@/test/fixtures/backend/verification';
import {
  TOUR_CANCEL_INVALID,
  TOUR_CANCELED,
  TOUR_COMPLETE_INVALID,
  TOUR_COMPLETED,
  TOUR_CREATED,
  TOUR_DETAIL,
  TOUR_OUTSIDE_VACATION,
  TOUR_PROFILE_REQUIRED,
  TOURS_LIST,
} from '@/test/fixtures/backend/tours';
import {
  GUIDE_WISHES,
  MY_WISHES,
  WISH_CREATED,
  WISH_UPDATED,
} from '@/test/fixtures/backend/wishes';
import { withWire } from '@/mocks/wire/envelope';
import { expectWireShape, rawFetch, wireFail } from '@/test/wire';
import { formFile, readBody, readForm } from './util';

// 핸들러를 실제 HTTP 클라이언트로 부른다. 테스트 setup이 전체 핸들러를 건 MSW 서버를 켜고,
// 지연을 0으로 두고, 매 테스트 전에 오늘 기준 시드(START)로 DB를 되돌린다.

afterEach(() => configureHttp({ getToken: () => null }));

/** 합성 로그인(`POST /auth/login` → `GET /users/me`)으로 로그인하고 그 토큰으로 이후 요청을 보낸다. */
async function login(email: string) {
  const r = await apiLogin({ email, password: 'demo1234' });
  configureHttp({ getToken: () => r.token });
  return r;
}

/** 이 콜백을 도는 동안 나간 요청을 `메서드 경로`(`/api` 뗌)로 모은다. */
async function requestsDuring(run: () => Promise<unknown>): Promise<string[]> {
  const seen: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      seen.push(`${request.method} ${url.pathname.replace(/^\/api/, '')}`);
    }
  });
  await run();
  server.events.removeAllListeners('request:start');
  return seen;
}

const userId = (email: string) => getDb().users.find((u) => u.email === email)!.id;
const applicationOf = (email: string, tourId: number) =>
  getDb().applications.find((a) => a.userId === userId(email) && a.tourId === tourId)!;
/** 그 학생의 탐방 1 신청으로 발급된 상점 쿠폰 코드. */
const demoCouponCode = (email: string, storeId: number) =>
  getDb().coupons.find(
    (c) => c.applicationId === applicationOf(email, 1).id && c.storeId === storeId,
  )!.code;
/** DB에 없는 6자리 코드. */
function unusedCode(): string {
  const codes = new Set(getDb().coupons.map((c) => c.code));
  let n = 0;
  while (codes.has(String(n).padStart(6, '0'))) n += 1;
  return String(n).padStart(6, '0');
}

const DEMO_TOUR_TITLE = '경희대 국제캠퍼스 산업디자인학과 탐방';
const DEMO_OPEN_CHAT = 'https://open.kakao.com/o/demo-khu-design';

describe('auth', () => {
  it('로그인 → 합성 Me: 요청은 POST /auth/login → GET /users/me 두 번, 그 토큰으로 fetchMe()가 된다', async () => {
    let result: Awaited<ReturnType<typeof login>> | undefined;
    const seen = await requestsDuring(async () => {
      result = await login('student@demo.kr');
    });
    expect(seen).toEqual(['POST /auth/login', 'GET /users/me']);
    expect(result!.token).toEqual(expect.any(String));
    expect(result!.me.studentProfile?.highSchoolName).toBe('수원영통고등학교');
    expect((await fetchMe()).role).toBe('HIGH_SCHOOL');
  });

  it('사장님 로그인은 GET /users/me/store까지 요청 셋이고 가게 id · 사업자 인증이 합성된다', async () => {
    const seen = await requestsDuring(async () => {
      expect((await login('owner1@demo.kr')).me).toMatchObject({
        storeId: 1,
        businessVerified: true,
      });
    });
    expect(seen).toEqual(['POST /auth/login', 'GET /users/me', 'GET /users/me/store']);
  });

  it('가게 연결 전 사장님(owner-nostore)은 storeId null', async () => {
    expect((await login('owner-nostore@demo.kr')).me).toMatchObject({
      role: 'OWNER',
      storeId: null,
      businessVerified: true, // 사업자 인증은 끝났고 가게만 아직 연결 전
    });
  });

  it('가이드 로그인: 목업 확장 campus_id가 guideProfile.universityId가 된다 (guide-dku → 3)', async () => {
    expect((await login('guide-dku@demo.kr')).me.guideProfile?.universityId).toBe(3);
  });

  it('로그인 와이어: 명세 L-02 응답과 같은 모양(access_token · user)', async () => {
    const res = await rawFetch<{ code: string; data: unknown }>('/auth/login', {
      method: 'POST',
      body: { email: 'student@demo.kr', password: 'demo1234' },
    });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expectWireShape(res.body.data, LOGIN_OK.data);
  });

  it('GET /users/me 와이어: 고교생은 명세 그대로(확장 없음), 가이드는 확장 campus_id만 더한다', async () => {
    const student = await rawFetch<{ code: string; data: unknown }>('/users/me', {
      method: 'GET',
      token: (await login('student@demo.kr')).token,
    });
    expect(student.status).toBe(200);
    expect(student.body.code).toBe('S200');
    expectWireShape(student.body.data, ME_HIGH_SCHOOL.data);

    const guide = await rawFetch<{ code: string; data: unknown }>('/users/me', {
      method: 'GET',
      token: (await login('guide-dku@demo.kr')).token,
    });
    expect(guide.status).toBe(200);
    expectWireShape(guide.body.data, ME_UNIVERSITY.data, ['campus_id']);
    expect(guide.body.data).toMatchObject({ campus_id: 3, school_name: '단국대학교 죽전캠퍼스' });
  });

  it('틀린 비밀번호는 INVALID_CREDENTIALS(E401_INVALID_CREDENTIALS)이고 세션 만료(onUnauthorized)를 부르지 않는다', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ getToken: () => 'some-session', onUnauthorized });
    await expect(apiLogin({ email: 'student@demo.kr', password: 'x' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      backendCode: 'E401_INVALID_CREDENTIALS',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('fetchMe(token)은 그 토큰으로 부르고 401이어도 세션을 끊지 않는다, 토큰 인자 없는 401은 한 번 끊는다', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ getToken: () => 'some-session', onUnauthorized });
    await expect(fetchMe('mock-unknown')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await expect(fetchMe()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('명세 U-02 로그인 실패 예시(E401_INVALID_CREDENTIALS)를 그대로 받으면 INVALID_CREDENTIALS이고 세션을 끊지 않는다', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ getToken: () => 'some-session', onUnauthorized });
    server.use(
      http.post('/api/auth/login', () => HttpResponse.json(LOGIN_FAILED, { status: 401 })),
    );
    await expect(apiLogin({ email: 'a@b.kr', password: 'x' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      backendCode: 'E401_INVALID_CREDENTIALS',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('없는 이메일도 401 INVALID_CREDENTIALS', async () =>
    await expect(apiLogin({ email: 'nobody@demo.kr', password: 'demo1234' })).rejects.toMatchObject(
      { status: 401, code: 'INVALID_CREDENTIALS' },
    ));

  it('토큰이 없거나 모르는 토큰이면 401 UNAUTHORIZED', async () => {
    await expect(fetchMe()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      backendCode: 'E401',
    });
    configureHttp({ getToken: () => 'mock-unknown' });
    await expect(fetchMe()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('로그아웃은 200 S200 data null이고 그 토큰은 더 쓸 수 없다', async () => {
    const { token } = await login('student@demo.kr');
    const res = await rawFetch<{ code: string; data: unknown }>('/auth/logout', {
      method: 'POST',
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(LOGOUT_OK.code);
    expect(res.body.data).toBeNull();
    const after = await rawFetch<{ code: string }>('/users/me', { method: 'GET', token });
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('E401');
  });

  it('logout()은 토큰을 폐기한다', async () => {
    await login('student@demo.kr');
    await logout();
    await expect(fetchMe()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('고교생 Me: 인증 · 보호자 동의 · 학생 프로필', async () => {
    const { me } = await login('student@demo.kr');
    expect(me).toEqual({
      id: userId('student@demo.kr'),
      email: 'student@demo.kr',
      name: '김민지',
      role: 'HIGH_SCHOOL',
      verificationStatus: 'APPROVED',
      rejectionReason: null,
      guardianStatus: 'AGREED',
      studentProfile: {
        highSchoolName: '수원영통고등학교',
        grade: 2,
        interestedMajor: '산업디자인',
      },
      guideProfile: null,
      businessVerified: false,
      storeId: null,
    });
  });

  it('인증 · 동의 기록이 없으면 NONE, 대기 동의는 기한이 지나면 EXPIRED', async () => {
    const newbie = userId('newbie@demo.kr');
    expect((await login('newbie@demo.kr')).me).toMatchObject({
      verificationStatus: 'NONE',
      guardianStatus: 'NONE',
      studentProfile: { grade: 1, interestedMajor: null },
    });
    const consent = (expiresAt: string) =>
      mutate((db) => {
        db.guardianConsents = db.guardianConsents.filter((g) => g.id !== newbie);
        db.guardianConsents.push({
          id: newbie,
          guardianName: '최하늘 보호자',
          guardianEmail: 'guardian@demo.kr',
          tokenHash: 'hash',
          status: 'PENDING',
          expiresAt,
          agreedAt: null,
          createdAt: '2026-01-01T09:00:00+09:00',
          updatedAt: '2026-01-01T09:00:00+09:00',
        });
      });
    consent('2999-01-01T09:00:00+09:00');
    expect((await fetchMe()).guardianStatus).toBe('PENDING');
    consent('2000-01-01T09:00:00+09:00');
    expect((await fetchMe()).guardianStatus).toBe('EXPIRED');
  });

  it('가이드 Me: 가이드 프로필 · 재학 인증', async () => {
    expect((await login('guide@demo.kr')).me).toMatchObject({
      role: 'UNIVERSITY',
      verificationStatus: 'APPROVED',
      guardianStatus: 'NONE',
      studentProfile: null,
      guideProfile: {
        universityId: 2,
        major: '산업디자인학과',
        introduction: expect.stringContaining('디자인 공부'),
      },
      businessVerified: false,
      storeId: null,
    });
  });

  it('사장님 Me: 사업자 인증(APPROVED) · 내 가게', async () => {
    expect((await login('owner1@demo.kr')).me).toMatchObject({
      role: 'OWNER',
      verificationStatus: 'APPROVED',
      guardianStatus: 'NONE',
      studentProfile: null,
      guideProfile: null,
      businessVerified: true,
      storeId: 1,
    });
  });
});

describe('campuses', () => {
  it('GET /campuses: 명세 D-01 응답과 같은 봉투 · 모양(토큰 없이)', async () => {
    const res = await rawFetch<{ code: string; data: unknown }>('/campuses', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expectWireShape(res.body.data, CAMPUSES_LIST.data);
  });

  it('대학 5곳: id 순 · 짧은 이름 · 좌표 · 방학 2개(시작일 순)', async () => {
    const list = await listCampuses();
    expect(list.map((u) => u.id)).toEqual([1, 2, 3, 4, 5]);
    expect(list.map((u) => u.shortName)).toEqual([
      '강남대',
      '경희대',
      '단국대',
      '명지대',
      '한국외대',
    ]);
    expect(list.every((u) => u.vacations.length === 2)).toBe(true);
    expect(list[1]).toMatchObject({
      id: 2,
      name: '경희대학교',
      shortName: '경희대',
      campusName: '국제캠퍼스',
      address: '경기도 용인시 기흥구 덕영대로 1732',
      lat: 37.2397,
      lng: 127.0833,
      administrativeDong: null,
      vacations: [
        { startDate: '2026-12-21', endDate: '2027-02-28', label: null },
        { startDate: '2027-06-21', endDate: '2027-08-31', label: null },
      ],
    });
  });

  it('방학 상권 인사이트(확장)는 행정동을 넣은 예시 문구', async () => {
    expect(await getInsight(2)).toEqual({
      universityId: 2,
      title: '방학 상권 인사이트',
      text: '서천동은 방학이면 대학가 손님이 크게 줄어요. 이 코스는 그 상권으로 신청자들을 보내요.',
      source: '팀 데이터 담당 확정 전 예시',
      isPlaceholder: true,
    });
    const raw = await rawFetch<{ code: string; data: Record<string, unknown> }>(
      '/campuses/2/insight',
      { method: 'GET' },
    );
    expect(raw.status).toBe(200);
    expect(raw.body.code).toBe('S200');
    expect(Object.keys(raw.body.data).sort()).toEqual([
      'campus_id',
      'is_placeholder',
      'source',
      'text',
      'title',
    ]);
  });

  it('없는 캠퍼스의 인사이트는 404 NOT_FOUND', async () => {
    await expect(getInsight(99)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    const raw = await rawFetch<{ code: string }>('/campuses/99/insight', { method: 'GET' });
    expect(raw.status).toBe(404);
    expect(raw.body.code).toBe('E404');
  });
});

describe('tours', () => {
  it('탐방 목록은 모집 중만 시작 시각 순이고 학교 · 학과로 거른다', async () => {
    const campuses = await listCampuses();
    const ids = async (filter: TourFilter) => (await listTours(filter, campuses)).map((t) => t.id);
    expect(await ids({})).toEqual([1, 3, 4, 5, 6]);
    expect(await ids({ status: 'COMPLETED' })).toEqual([7]);
    expect(await ids({ universityId: 2 })).toEqual([1, 6]);
    expect(await ids({ universityId: 2, major: '산업디자인' })).toEqual([1, 6]);
    expect(await ids({ major: '없는학과' })).toEqual([]);
  });

  it('GET /tours는 쪽 봉투와 명세 모양으로 낸다(토큰 없이도)', async () => {
    const res = await rawFetch<{ code: string; data: { items: unknown[]; total: number } }>(
      '/tours?size=2',
      { method: 'GET' },
    );
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(5);
    expectWireShape(res.body.data, TOURS_LIST.data, ['campus_id']);
    // `expectWireShape`는 확장 키를 허용만 하고 요구하지 않으므로 확장이 실제로 나가는지 따로 고정한다(2C-R8).
    expect((res.body.data.items[0] as { campus_id?: number }).campus_id).toBe(2);
  });

  it('GET /tours/{tourId}는 명세 모양으로 낸다', async () => {
    const res = await rawFetch<{ code: string; data: unknown }>('/tours/1', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expectWireShape(res.body.data, TOUR_DETAIL.data, ['campus_id']);
    expect((res.body.data as { campus_id?: number }).campus_id).toBe(2);
  });

  it('탐방 상세: 승인된 신청자에게 오픈채팅과 내 신청', async () => {
    await login('seojun@demo.kr');
    expect(await getTour(1, await listCampuses())).toMatchObject({
      id: 1,
      title: DEMO_TOUR_TITLE,
      guideName: '정다은',
      guideVerified: true,
      capacity: 5,
      approvedCount: 2,
      remainingSeats: 3,
      status: 'RECRUITING',
      introduction: expect.stringContaining('산업디자인 작업실'),
      guideIntroduction: expect.stringContaining('디자인 공부'),
      openChatUrl: DEMO_OPEN_CHAT,
      myApplication: { id: applicationOf('seojun@demo.kr', 1).id, status: 'APPROVED' },
    });
  });

  it('그 탐방의 가이드에게도 오픈채팅이 있고 신청은 없다', async () => {
    await login('guide@demo.kr');
    expect(await getTour(1, await listCampuses())).toMatchObject({
      openChatUrl: DEMO_OPEN_CHAT,
      myApplication: null,
    });
  });

  it('로그인 안 했거나 대기 중이면 오픈채팅이 없다', async () => {
    const campuses = await listCampuses();
    expect(await getTour(1, campuses)).toMatchObject({ myApplication: null, openChatUrl: null });
    await login('yujin@demo.kr');
    expect(await getTour(1, campuses)).toMatchObject({
      myApplication: { id: applicationOf('yujin@demo.kr', 1).id, status: 'PENDING' },
      openChatUrl: null,
    });
  });

  it('없는 탐방은 404 NOT_FOUND(봉투 E404)', async () => {
    await expect(getTour(99, await listCampuses())).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    const res = await rawFetch<{ code: string }>('/tours/99', { method: 'GET' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('E404');
  });
});

describe('wishes', () => {
  // T-01 희망 사항 등록(`POST /tour-wishes`)은 AI 없이 저장만 하고, 탐방은 `GET /tours`의 학교 · 학과로 찾는다(2C-R16).
  const wishInput = {
    universityId: 2,
    major: '산업디자인',
    wish: '작업실을 구경하고\n학식도 먹어 보고 싶어요.',
    date: null,
  };

  it('희망 사항 등록 → 탐방 찾기 → 신청 → 내 탐방', async () => {
    await login('student@demo.kr');
    const campuses = listCampuses();
    const wish = await postTourWish(wishInput, campuses);
    expect(wish).toMatchObject({
      universityId: 2,
      campusLabel: '경희대학교 국제캠퍼스',
      major: '산업디자인',
      wish: wishInput.wish,
      date: null,
    });
    const found = await findWishTours({ ...wishInput }, campuses);
    expect(found.fallback).toBe(false);
    const app = await postApplication(found.tours[0].id, '밥집이 궁금해요', campuses);
    expect(app.status).toBe('PENDING');
    expect((await getMyApplications(campuses))[0].id).toBe(app.id);
  });

  it('POST /tour-wishes 와이어: 201 S201, 명세 T-01 예시와 같은 모양(확장 없음)이고 본문은 snake 키, 저장은 앞뒤 공백만 뺀 값', async () => {
    const { token } = await login('student@demo.kr');
    const raw = await rawFetch<{ code: string; data: Record<string, unknown> }>('/tour-wishes', {
      method: 'POST',
      token,
      body: { campus_id: 2, major: ' 산업디자인 ', wish: '  첫 줄\n둘째 줄  ', date: '2027-01-15' },
    });
    expect(raw.status).toBe(201);
    expect(raw.body.code).toBe('S201');
    expectWireShape(raw.body.data, WISH_CREATED.data);
    expect(raw.body.data).toMatchObject({
      campus_id: 2,
      major: '산업디자인',
      wish: '첫 줄\n둘째 줄',
      date: '2027-01-15',
    });
    expect(getDb().tourWishes.at(-1)).toMatchObject({
      userId: userId('student@demo.kr'),
      content: '첫 줄\n둘째 줄',
      preferredDate: '2027-01-15',
    });
  });

  it('postTourWish는 { campus_id, major, wish, date }를 보낸다(날짜가 없으면 null)', async () => {
    await login('student@demo.kr');
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && new URL(request.url).pathname === '/api/tour-wishes') {
        void request
          .clone()
          .json()
          .then((b: unknown) => bodies.push(b));
      }
    });
    await postTourWish(wishInput, listCampuses());
    server.events.removeAllListeners('request:start');
    expect(bodies).toEqual([
      { campus_id: 2, major: '산업디자인', wish: wishInput.wish, date: null },
    ]);
  });

  it('없는 캠퍼스는 VALIDATION(E400)이고 campus_id 칸 오류가 universityId 칸으로 온다', async () => {
    await login('student@demo.kr');
    const error = await postTourWish({ ...wishInput, universityId: 999 }, listCampuses()).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION',
      backendCode: 'E400',
      fieldErrors: { universityId: '학교를 골라 주세요.' },
    });
  });

  it('학과 31자 · 희망 사항 101자는 그 칸 오류', async () => {
    await login('student@demo.kr');
    await expect(
      postTourWish({ ...wishInput, major: '가'.repeat(31) }, listCampuses()),
    ).rejects.toMatchObject({ fieldErrors: { major: '학과는 1~30자로 적어 주세요.' } });
    await expect(
      postTourWish({ ...wishInput, wish: '가'.repeat(101) }, listCampuses()),
    ).rejects.toMatchObject({ fieldErrors: { wish: '희망 사항은 1~100자로 적어 주세요.' } });
  });

  it('가이드가 등록하면 FORBIDDEN(E403), 로그인하지 않았으면 UNAUTHORIZED', async () => {
    await expect(postTourWish(wishInput, listCampuses())).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
    await login('guide@demo.kr');
    await expect(postTourWish(wishInput, listCampuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      backendCode: 'E403',
    });
    expect(getDb().tourWishes).toHaveLength(4); // 시드뿐
  });
});

describe('wishes (T-07 · T-08)', () => {
  type Items = { items: Record<string, unknown>[] };
  const wishId = (email: string) => getDb().tourWishes.find((w) => w.userId === userId(email))!.id;

  it('내 희망 사항: 시연에서 처음 남기는 김민지는 비어 있다가 남긴 글이 맨 앞에 온다', async () => {
    await login('student@demo.kr');
    expect(await listMyWishes(listCampuses())).toEqual([]);
    await postTourWish(
      { universityId: 2, major: '산업디자인', wish: '작업실이 궁금해요.', date: null },
      listCampuses(),
    );
    const list = await listMyWishes(listCampuses());
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ universityId: 2, campusLabel: '경희대학교 국제캠퍼스' });
  });

  it('GET /users/me/tour-wishes 와이어: 명세 T-07 목록과 같은 모양(+ 확장 campus_id · date), 본인 것만, 고교생만', async () => {
    const { token } = await login('seojun@demo.kr');
    const raw = await rawFetch<{ code: string; data: Items & Record<string, unknown> }>(
      '/users/me/tour-wishes',
      { method: 'GET', token },
    );
    expect(raw.status).toBe(200);
    expect(raw.body.code).toBe('S200');
    expectWireShape(raw.body.data, MY_WISHES.data, ['campus_id', 'date']);
    expect(raw.body.data).toMatchObject({ page: 1, size: 20, total: 1 });
    expect(raw.body.data.items[0]).toMatchObject({
      campus_name: '명지대학교 자연캠퍼스',
      campus_id: 4,
      major: '컴퓨터공학',
      wish: '코딩 동아리가 어떤 프로젝트를 하는지 보고 싶어요.',
    });
    const guide = await login('guide@demo.kr');
    const forbidden = await rawFetch('/users/me/tour-wishes', {
      method: 'GET',
      token: guide.token,
    });
    expect(forbidden.status).toBe(403);
    expect((await rawFetch('/users/me/tour-wishes', { method: 'GET' })).status).toBe(401);
  });

  it('토큰 없이는 희망 사항 조회 · 수정 · 가이드용 목록이 모두 401(E401)', async () => {
    const id = wishId('haeun@demo.kr');
    const before = structuredClone(getDb().tourWishes.find((w) => w.id === id)!);
    for (const [path, init] of [
      ['/users/me/tour-wishes', { method: 'GET' }],
      [`/users/me/tour-wishes/${id}`, { method: 'PATCH', body: { wish: '가' } }],
      ['/tour-wishes', { method: 'GET' }],
    ] as const) {
      const raw = await rawFetch<{ code: string }>(path, init);
      expect(raw.status, path).toBe(401);
      expect(raw.body.code, path).toBe('E401');
    }
    expect(getDb().tourWishes.find((w) => w.id === id)).toEqual(before);
  });

  it('PATCH 와이어: 200 S200, 명세 예시 모양(+ 확장 campus_id · created_at)이고 보낸 칸만 바뀐다', async () => {
    const { token } = await login('haeun@demo.kr');
    const id = wishId('haeun@demo.kr');
    const before = structuredClone(getDb().tourWishes.find((w) => w.id === id)!);
    const raw = await rawFetch<{ code: string; data: Record<string, unknown> }>(
      `/users/me/tour-wishes/${id}`,
      {
        method: 'PATCH',
        token,
        body: { wish: '  학식도 먹어 보고 싶어요.  ', date: '2027-01-16' },
      },
    );
    expect(raw.status).toBe(200);
    expect(raw.body.code).toBe('S200');
    expectWireShape(raw.body.data, WISH_UPDATED.data, ['campus_id', 'created_at']);
    expect(raw.body.data).toMatchObject({
      wish_id: id,
      campus_id: 2,
      major: '시각디자인',
      wish: '학식도 먹어 보고 싶어요.',
      date: '2027-01-16',
      created_at: before.createdAt,
    });
    expect(getDb().tourWishes.find((w) => w.id === id)).toMatchObject({
      universityId: before.universityId,
      major: before.major,
      content: '학식도 먹어 보고 싶어요.',
      preferredDate: '2027-01-16',
      createdAt: before.createdAt,
    });
  });

  it('patchTourWish는 받은 칸만 snake 키로 보낸다(학교 칸 오류는 universityId로 온다)', async () => {
    await login('haeun@demo.kr');
    const id = wishId('haeun@demo.kr');
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PATCH') {
        void request
          .clone()
          .json()
          .then((b: unknown) => bodies.push(b));
      }
    });
    const updated = await patchTourWish(id, { wish: '바뀐 글' }, listCampuses());
    await patchTourWish(id, { universityId: 3, date: null }, listCampuses());
    server.events.removeAllListeners('request:start');
    expect(bodies).toEqual([{ wish: '바뀐 글' }, { campus_id: 3, date: null }]);
    expect(updated).toMatchObject({
      id,
      universityId: 2,
      campusLabel: '경희대학교 국제캠퍼스',
      wish: '바뀐 글',
    });
    await expect(patchTourWish(id, { universityId: 999 }, listCampuses())).rejects.toMatchObject({
      fieldErrors: { universityId: '학교를 골라 주세요.' },
    });
  });

  it('PATCH 오류: 남의 글 403(E403), 없는 글 404(E404), 가이드 403, 101자는 wish 칸 오류', async () => {
    await login('haeun@demo.kr');
    await expect(
      patchTourWish(wishId('seojun@demo.kr'), { wish: '가' }, listCampuses()),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', backendCode: 'E403' });
    await expect(patchTourWish(99999, { wish: '가' }, listCampuses())).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      backendCode: 'E404',
    });
    await expect(
      patchTourWish(wishId('haeun@demo.kr'), { wish: '가'.repeat(101) }, listCampuses()),
    ).rejects.toMatchObject({ fieldErrors: { wish: '희망 사항은 1~100자로 적어 주세요.' } });
    await login('guide@demo.kr');
    await expect(
      patchTourWish(wishId('haeun@demo.kr'), { wish: '가' }, listCampuses()),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('GET /tour-wishes 와이어: 명세 T-08 목록과 같은 모양(+ campus_id · date), 학생 이름은 내려주지 않는다', async () => {
    const { token } = await login('guide@demo.kr');
    const raw = await rawFetch<{ data: Items }>('/tour-wishes', { method: 'GET', token });
    expect(raw.status).toBe(200);
    expectWireShape(raw.body.data, GUIDE_WISHES.data, ['campus_id', 'date']);
    expect(raw.body.data.items.map((w) => w.major)).toEqual(['시각디자인', '산업디자인']);
    const text = JSON.stringify(raw.body);
    for (const name of ['이하은', '정우진', 'haeun', 'past1']) expect(text).not.toContain(name);
  });

  it('listGuideWishes: 학교 · 학과는 쿼리(campus_id · major)로 가고, 비우면 보내지 않는다', async () => {
    await login('guide@demo.kr');
    const urls: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === '/api/tour-wishes') urls.push(request.url);
    });
    const byMajor = await listGuideWishes({ universityId: 2, major: '산업' }, listCampuses());
    const other = await listGuideWishes({ universityId: 5 }, listCampuses());
    const mine = await listGuideWishes({}, listCampuses());
    server.events.removeAllListeners('request:start');
    expect(byMajor.map((w) => w.major)).toEqual(['산업디자인']);
    expect(other.map((w) => w.major)).toEqual(['통번역']);
    expect(mine.map((w) => w.major)).toEqual(['시각디자인', '산업디자인']);
    const queries = urls.map((u) => new URL(u).searchParams);
    expect(queries[0].get('campus_id')).toBe('2');
    expect(queries[0].get('major')).toBe('산업');
    expect(queries[1].has('major')).toBe(false);
    expect(queries[2].has('campus_id')).toBe(false);
  });

  it('GET /tour-wishes: campus_id가 숫자(양의 정수)가 아니면 오류 없이 생략한 것처럼 내 학교로 본다', async () => {
    const { token } = await login('guide@demo.kr');
    const majorsFor = async (query: string) => {
      const raw = await rawFetch<{ data: Items }>(`/tour-wishes${query}`, { method: 'GET', token });
      expect(raw.status, query).toBe(200);
      return raw.body.data.items.map((w) => w.major);
    };
    const mine = await majorsFor('');
    expect(mine).toEqual(['시각디자인', '산업디자인']);
    for (const bad of ['abc', '0', '-1', '1.5', '']) {
      expect(await majorsFor(`?campus_id=${bad}`), bad).toEqual(mine);
    }
    // 올바른 숫자는 그 학교로 걸러진다(위 결과가 '필터 없음'이 아니라 '내 학교'라는 대조).
    expect(await majorsFor('?campus_id=5')).toEqual(['통번역']);
  });

  it('GET /tour-wishes 오류: 고교생 403(E403), 인증 전 · 심사 중 가이드 403(E403_VERIFICATION_REQUIRED)', async () => {
    await login('student@demo.kr');
    await expect(listGuideWishes({}, listCampuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    for (const email of ['guide-new@demo.kr', 'guide-pending@demo.kr']) {
      await login(email);
      await expect(listGuideWishes({}, listCampuses())).rejects.toMatchObject({
        status: 403,
        code: 'NOT_VERIFIED',
        backendCode: 'E403_VERIFICATION_REQUIRED',
      });
    }
  });
});

describe('applications', () => {
  // 백엔드 와이어 + 합성 어댑터(`features/applications/api`)를 목업 끝까지 부른다(2C-R25 ③). 캠퍼스는 약속째 넘긴다.
  const campuses = () => listCampuses();
  type Envelope = { code: string; data: Record<string, unknown> };
  type Items = { items: Record<string, unknown>[] };

  it('신청 와이어: 201 S201, 명세 A-01 응답과 같은 모양이고 그 신청을 합성하면 PENDING', async () => {
    const { token } = await login('student@demo.kr');
    const res = await rawFetch<Envelope>('/tours/1/applications', {
      method: 'POST',
      token,
      body: { wish: '밥집이 궁금해요' },
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('S201');
    expectWireShape(res.body.data, APPLY_OK.data);
    expect(res.body.data).toMatchObject({ tour_id: 1, status: 'PENDING' });
    const applicationId = res.body.data.application_id as number;
    expect(await getMyApplication(applicationId, campuses())).toMatchObject({
      id: applicationId,
      status: 'PENDING',
      motivation: '밥집이 궁금해요',
      tour: { id: 1, title: DEMO_TOUR_TITLE },
      courseStatus: null,
      openChatUrl: null,
      couponCount: 0,
      cancellable: false, // 탐방 1은 오늘이다
    });
  });

  it('postApplication: 본문은 { wish }이고 201 뒤 내 신청(앞뒤 공백은 서버가 지운다)', async () => {
    await login('student@demo.kr');
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST')
        void request
          .clone()
          .json()
          .then((b) => bodies.push(b));
    });
    const app = await postApplication(3, '  밥집이 궁금해요 ', campuses());
    server.events.removeAllListeners('request:start');
    expect(bodies).toEqual([{ wish: '  밥집이 궁금해요 ' }]);
    expect(app).toMatchObject({
      status: 'PENDING',
      motivation: '밥집이 궁금해요',
      tour: { id: 3 },
    });
  });

  it('신청 오류 세분(2C-R15): 인증 · 보호자 동의 · 마감 · 모집 종료 · 중복 · 빈 값 · wish 101자 · 역할', async () => {
    const apply = (tourId: number, wish = '수업이 궁금해요') =>
      postApplication(tourId, wish, campuses());
    await expect(apply(1)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    await login('newbie@demo.kr');
    await expect(apply(1)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_VERIFIED',
      backendCode: 'E403_VERIFICATION_REQUIRED',
    });
    await login('expired@demo.kr'); // 인증 APPROVED · 보호자 동의 만료
    await expect(apply(1)).rejects.toMatchObject({
      status: 403,
      code: 'GUARDIAN_NOT_AGREED',
      backendCode: 'E403_VERIFICATION_REQUIRED',
    });
    await login('seojun@demo.kr');
    await expect(apply(1)).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_APPLICATION',
      backendCode: 'E409_ALREADY_APPLIED',
    });
    await login('student@demo.kr');
    await expect(apply(2)).rejects.toMatchObject({
      status: 409,
      code: 'TOUR_CLOSED',
      backendCode: 'E409_TOUR_FULL',
    });
    await expect(apply(7)).rejects.toMatchObject({
      status: 409,
      code: 'TOUR_NOT_RECRUITING',
      backendCode: 'E409_TOUR_FULL',
    });
    await expect(apply(1, ' ')).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });
    await expect(apply(1, '가'.repeat(101))).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      backendCode: 'E400',
      fieldErrors: { wish: '100자 이내로 적어 주세요.' },
    });
    expect(await apply(1, '가'.repeat(100))).toMatchObject({ status: 'PENDING' }); // 100자는 된다(2C-R11)
    await login('guide@demo.kr');
    await expect(apply(1)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('내 탐방 목록은 최근 신청부터, 탐방 제목 · 쿠폰 수(확장 coupon_count)', async () => {
    await login('seojun@demo.kr');
    const list = await getMyApplications(campuses());
    expect(list.map((a) => a.tour.id)).toEqual([1, 2, 7]);
    expect(list[0]).toMatchObject({
      tour: { title: DEMO_TOUR_TITLE },
      status: 'APPROVED',
      motivation: '학생들이 자주 가는 밥집이 궁금해요',
      couponCount: 0,
    });
    const past = applicationOf('seojun@demo.kr', 7);
    const pastCoupons = getDb().coupons.filter((c) => c.applicationId === past.id).length;
    expect(pastCoupons).toBeGreaterThan(0);
    expect(list[2]).toMatchObject({ id: past.id, couponCount: pastCoupons });
  });

  it('내 신청 상세: 승인이면 오픈채팅, 남의 신청은 404 NOT_FOUND', async () => {
    await login('seojun@demo.kr');
    expect(await getMyApplication(applicationOf('seojun@demo.kr', 1).id, campuses())).toMatchObject(
      {
        status: 'APPROVED',
        openChatUrl: DEMO_OPEN_CHAT,
        courseStatus: null,
        couponCount: 0,
        cancellable: false,
      },
    );
    await expect(
      getMyApplication(applicationOf('yujin@demo.kr', 1).id, campuses()),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('미래 탐방(6) 신청은 취소되고(CANCELED), 취소 후 다시 신청할 수 있다', async () => {
    await login('student@demo.kr');
    const app = await postApplication(6, '수업이 궁금해요', campuses());
    expect(app.cancellable).toBe(true);
    expect(await postCancelApplication(app.id, campuses())).toMatchObject({
      id: app.id,
      status: 'CANCELED',
      cancellable: false,
    });
    expect((await getTour(6, campuses())).myApplication).toBeNull();
    await expect(postCancelApplication(app.id, campuses())).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
    });

    const again = await postApplication(6, '수업이 궁금해요', campuses());
    expect((await getTour(6, campuses())).myApplication).toEqual({
      id: again.id,
      status: 'PENDING',
    });
    expect((await getMyApplications(campuses())).map((a) => [a.id, a.status])).toEqual([
      [again.id, 'PENDING'],
      [app.id, 'CANCELED'],
    ]);
    await login('guide@demo.kr');
    const board = await getApplicantsBoard(6, campuses());
    expect(board.applicants.map((a) => a.id)).toEqual([again.id]); // 취소한 신청은 빠진다
  });

  it('탐방 당일 취소는 CANCEL_AFTER_TOUR_DATE(백엔드 E409_INVALID_APPLICATION_STATUS를 신청을 다시 읽어 세분)', async () => {
    await login('seojun@demo.kr');
    await expect(
      postCancelApplication(applicationOf('seojun@demo.kr', 1).id, campuses()),
    ).rejects.toMatchObject({
      status: 409,
      code: 'CANCEL_AFTER_TOUR_DATE',
      backendCode: 'E409_INVALID_APPLICATION_STATUS',
    });
  });

  it('가이드 탐방 목록: 시작 시각 순, 신청 집계(승인 + 대기)와 코스 상태(확정 전이면 코스 조회로 합성)', async () => {
    await login('guide@demo.kr');
    const list = await getGuideTours(campuses());
    expect(list.map((t) => t.id)).toEqual([7, 1, 6]);
    expect(list[1]).toMatchObject({
      id: 1,
      title: DEMO_TOUR_TITLE,
      counts: { total: 3, pending: 1, approved: 2 },
      courseStatus: null,
    });
    mutate((db) => createDraft(db, userId('guide@demo.kr'), 1, new Date()));
    expect((await getGuideTours(campuses())).find((t) => t.id === 1)?.courseStatus).toBe('DRAFT');
  });

  it('학생은 가이드 API FORBIDDEN', async () => {
    await login('student@demo.kr');
    await expect(getApplicantsBoard(1, campuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await expect(
      patchDecision(1, applicationOf('yujin@demo.kr', 1).id, 'APPROVED', campuses()),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('신청자 보드: 신청 순서 · 학년 · 인증, 남의 탐방은 403', async () => {
    await login('guide@demo.kr');
    const board = await getApplicantsBoard(1, campuses());
    expect(board.tour).toMatchObject({ id: 1, title: DEMO_TOUR_TITLE });
    expect(board.counts).toEqual({ pending: 1, approved: 2, remaining: 3 });
    expect(board.course).toBeNull();
    expect(board.applicants).toEqual([
      {
        id: applicationOf('seojun@demo.kr', 1).id,
        userName: '박서준',
        grade: 3,
        motivation: '학생들이 자주 가는 밥집이 궁금해요',
        status: 'APPROVED',
        verified: true,
      },
      expect.objectContaining({ userName: '이하은', grade: 3, status: 'APPROVED' }),
      expect.objectContaining({ userName: '최유진', grade: 2, status: 'PENDING' }),
    ]);
    await expect(getApplicantsBoard(2, campuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('가이드 승인(PATCH decision APPROVED) → 보드 갱신, 다시 처리하면 ALREADY_PROCESSED', async () => {
    await login('guide@demo.kr');
    const yujin = applicationOf('yujin@demo.kr', 1).id;
    const board = await patchDecision(1, yujin, 'APPROVED', campuses());
    expect(board.counts).toEqual({ pending: 0, approved: 3, remaining: 2 });
    expect(board.applicants.find((a) => a.id === yujin)?.status).toBe('APPROVED');
    await expect(patchDecision(1, yujin, 'APPROVED', campuses())).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_ALREADY_PROCESSED',
    });
  });

  it('정원이 찬 탐방의 승인은 CAPACITY_EXCEEDED(승인 · 거절의 E409_TOUR_FULL)', async () => {
    await login('guide@demo.kr');
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.capacity = 2; // 승인 2명 = 정원
    });
    await expect(
      patchDecision(1, applicationOf('yujin@demo.kr', 1).id, 'APPROVED', campuses()),
    ).rejects.toMatchObject({
      status: 409,
      code: 'CAPACITY_EXCEEDED',
      backendCode: 'E409_TOUR_FULL',
    });
  });

  it('거절하면 보드에 남고, 그 학생은 다시 신청할 수 없다(REAPPLY_AFTER_REJECT — 목업 확장 코드)', async () => {
    await login('guide@demo.kr');
    const yujin = applicationOf('yujin@demo.kr', 1).id;
    const board = await patchDecision(1, yujin, 'REJECTED', campuses());
    expect(board.counts).toEqual({ pending: 0, approved: 2, remaining: 3 });
    expect(board.applicants.find((a) => a.id === yujin)?.status).toBe('REJECTED');

    await login('yujin@demo.kr');
    expect((await getTour(1, campuses())).myApplication).toEqual({
      id: yujin,
      status: 'REJECTED',
    });
    await expect(postApplication(1, '다시 할게요', campuses())).rejects.toMatchObject({
      status: 409,
      code: 'REAPPLY_AFTER_REJECT',
      backendCode: 'E409_REAPPLY_AFTER_REJECT',
    });
  });

  it('decision이 승인 · 거절이 아니면 E400과 decision 칸 오류', async () => {
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Envelope & { errors: unknown }>(
      `/applications/${applicationOf('yujin@demo.kr', 1).id}/decision`,
      { method: 'PATCH', token, body: { decision: 'MAYBE' } },
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'E400',
      errors: [{ field: 'decision', reason: '승인 또는 거절을 골라 주세요.' }],
    });
    expect(applicationOf('yujin@demo.kr', 1).status).toBe('PENDING');
  });

  it('와이어: 내 탐방(고교생 · 대학생) · 신청자 목록 · 승인 · 취소가 명세 T-04 · A-02~04 예시와 같은 모양', async () => {
    const seojun = await login('seojun@demo.kr');
    const mine = await rawFetch<Envelope>('/users/me/tours', {
      method: 'GET',
      token: seojun.token,
    });
    expect([mine.status, mine.body.code]).toEqual([200, 'S200']);
    expectWireShape(mine.body.data, MY_TOURS_HIGH_SCHOOL.data, [
      'wish',
      'created_at',
      'coupon_count',
    ]);
    // 확장(2C-R8)이 실제로 나간다.
    expect((mine.body.data as Items).items[0]).toMatchObject({
      tour_id: 1,
      application_status: 'APPROVED',
      course_confirmed: false,
      wish: '학생들이 자주 가는 밥집이 궁금해요',
      created_at: expect.stringMatching(/\+09:00$/),
      coupon_count: 0,
    });

    const guide = await login('guide@demo.kr');
    const tours = await rawFetch<Envelope>('/users/me/tours', {
      method: 'GET',
      token: guide.token,
    });
    expect([tours.status, tours.body.code]).toEqual([200, 'S200']);
    expectWireShape(tours.body.data, MY_TOURS_UNIVERSITY.data);
    expect((tours.body.data as Items).items.map((t) => t.tour_id)).toEqual([7, 1, 6]);

    const list = await rawFetch<Envelope>('/tours/1/applications', {
      method: 'GET',
      token: guide.token,
    });
    expect([list.status, list.body.code]).toEqual([200, 'S200']);
    expectWireShape(list.body.data, APPLICANTS_LIST.data);
    const pendingOnly = await rawFetch<Envelope>('/tours/1/applications?status=PENDING', {
      method: 'GET',
      token: guide.token,
    });
    expect((pendingOnly.body.data as Items).items.map((a) => a.name)).toEqual(['최유진']);

    const yujin = applicationOf('yujin@demo.kr', 1).id;
    const decided = await rawFetch<Envelope>(`/applications/${yujin}/decision`, {
      method: 'PATCH',
      token: guide.token,
      body: { decision: 'APPROVED' },
    });
    expect([decided.status, decided.body.code]).toEqual([200, 'S200']);
    expectWireShape(decided.body.data, DECISION_OK.data);
    expect(decided.body.data).toEqual({
      application_id: yujin,
      status: 'APPROVED',
      tour_status: 'RECRUITING',
    });

    const student = await login('student@demo.kr');
    const applied = await rawFetch<Envelope>('/tours/6/applications', {
      method: 'POST',
      token: student.token,
      body: { wish: '수업이 궁금해요' },
    });
    const id = applied.body.data.application_id as number;
    const canceled = await rawFetch<Envelope>(`/applications/${id}/cancel`, {
      method: 'POST',
      token: student.token,
    });
    expect([canceled.status, canceled.body.code]).toEqual([200, 'S200']);
    expectWireShape(canceled.body.data, CANCEL_OK.data);
    expect(canceled.body.data).toEqual({ application_id: id, status: 'CANCELED' });

    const owner = await login('owner1@demo.kr');
    const ownerTours = await rawFetch<Envelope>('/users/me/tours', {
      method: 'GET',
      token: owner.token,
    });
    expect([ownerTours.status, ownerTours.body.code]).toEqual([403, 'E403']);
  });

  it('내 탐방 ?status=는 탐방 상태로 거른다', async () => {
    const { token } = await login('seojun@demo.kr');
    const res = await rawFetch<Envelope>('/users/me/tours?status=COMPLETED', {
      method: 'GET',
      token,
    });
    expect((res.body.data as Items).items.map((t) => t.tour_id)).toEqual([7]);
  });
});

describe('탐방 개설 · 취소 · 완료 (POST /tours · /cancel · /complete)', () => {
  // 백엔드 T-03 · T-05 · T-06 와이어와 가이드 탐방 합성(`getGuideTour`). 409 하나를 탐방을 다시 읽어 세분한다(2B′-R13).
  const campuses = () => listCampuses();
  type Envelope = { code: string; data: Record<string, unknown> | null; errors?: unknown };
  const NEW_TOUR = {
    date: '2027-01-20',
    startTime: '13:00',
    endTime: '16:00',
    capacity: 5,
    introduction: '캠퍼스와 근처 맛집을 함께 둘러봐요',
    openChatUrl: 'https://open.kakao.com/o/x',
  };

  it('T-03: 본문 여섯 키 그대로 보내고(intro) 새 탐방이 파생 제목 · 서울 시각으로 읽힌다', async () => {
    await login('guide@demo.kr');
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST')
        void request
          .clone()
          .json()
          .then((b) => bodies.push(b));
    });
    const id = await postTour(NEW_TOUR);
    server.events.removeAllListeners('request:start');
    expect(Object.keys(bodies[0] as object)).toEqual([
      'date',
      'start_time',
      'end_time',
      'capacity',
      'intro',
      'open_chat_url',
    ]);
    const tour = await getTour(id, campuses());
    expect(tour).toMatchObject({
      id,
      title: DEMO_TOUR_TITLE,
      startsAt: '2027-01-20T13:00:00+09:00',
      endsAt: '2027-01-20T16:00:00+09:00',
      status: 'RECRUITING',
      capacity: 5,
      introduction: NEW_TOUR.introduction,
      openChatUrl: NEW_TOUR.openChatUrl,
    });
    expect((await listTours({ status: 'RECRUITING' }, campuses())).map((t) => t.id)).toContain(id);
    expect((await getGuideTours(campuses())).map((t) => t.id)).toContain(id);
  });

  it('T-03 와이어: 201 S201, 명세 예시와 같은 모양', async () => {
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Envelope>('/tours', {
      method: 'POST',
      token,
      body: {
        date: '2027-01-20',
        start_time: '13:00',
        end_time: '16:00',
        capacity: 5,
        intro: '소개',
        open_chat_url: 'https://open.kakao.com/o/x',
      },
    });
    expect([res.status, res.body.code]).toEqual([201, 'S201']);
    expectWireShape(res.body.data, TOUR_CREATED.data);
    expect(res.body.data).toMatchObject({ status: 'RECRUITING' });
  });

  it('T-03 검증: 칸 오류는 훅이 읽는 이름(introduction)으로 오고, 방학 밖 날짜는 명세 문장', async () => {
    await login('guide@demo.kr');
    await expect(postTour({ ...NEW_TOUR, introduction: '' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { introduction: '탐방 소개는 1~300자로 적어 주세요.' },
    });
    await expect(postTour({ ...NEW_TOUR, capacity: 11 })).rejects.toMatchObject({
      fieldErrors: { capacity: '모집 정원은 1~10명으로 적어 주세요.' },
    });
    await expect(postTour({ ...NEW_TOUR, openChatUrl: ' ' })).rejects.toMatchObject({
      fieldErrors: { openChatUrl: '연락 링크를 넣어 주세요.' },
    });
    await expect(postTour({ ...NEW_TOUR, date: '2027-03-10' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { date: '방학 기간 안의 날짜만 선택할 수 있어요' },
    });
    // 실패한 개설은 탐방을 만들지 않는다.
    expect(getDb().tours.filter((t) => t.openChatUrl === NEW_TOUR.openChatUrl)).toEqual([]);
  });

  it('T-03 방학 밖 날짜 오류 봉투는 명세 예시와 같은 모양', async () => {
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Envelope>('/tours', {
      method: 'POST',
      token,
      body: {
        date: '2027-03-10',
        start_time: '13:00',
        end_time: '16:00',
        capacity: 5,
        intro: 'a',
        open_chat_url: 'u',
      },
    });
    expect([res.status, res.body.code]).toEqual([400, TOUR_OUTSIDE_VACATION.code]);
    expect(res.body.errors).toEqual(TOUR_OUTSIDE_VACATION.errors);
  });

  it('T-03 권한: 비로그인 401 · 고교생 403 · 인증 전 가이드 NOT_VERIFIED · 학과 없음 GUIDE_PROFILE_REQUIRED', async () => {
    configureHttp({ getToken: () => null });
    await expect(postTour(NEW_TOUR)).rejects.toMatchObject({ status: 401 });
    await login('student@demo.kr');
    await expect(postTour(NEW_TOUR)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    await login('guide-pending@demo.kr');
    await expect(postTour(NEW_TOUR)).rejects.toMatchObject({ status: 403, code: 'NOT_VERIFIED' });
    mutate((db) => {
      db.guideProfiles.find((g) => g.id === userId('guide@demo.kr'))!.major = null;
    });
    const { token } = await login('guide@demo.kr');
    await expect(postTour(NEW_TOUR)).rejects.toMatchObject({
      status: 409,
      code: 'GUIDE_PROFILE_REQUIRED',
      backendCode: TOUR_PROFILE_REQUIRED.code,
    });
    const res = await rawFetch<Envelope>('/tours', { method: 'POST', token, body: {} });
    expect(res.body.code).toBe(TOUR_PROFILE_REQUIRED.code);
  });

  it('T-06: 탐방 1(오늘) 완료 → COMPLETED, 와이어는 명세 예시와 같은 모양', async () => {
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Envelope>('/tours/1/complete', { method: 'POST', token });
    expect([res.status, res.body.code]).toEqual([200, 'S200']);
    expectWireShape(res.body.data, TOUR_COMPLETED.data);
    expect(res.body.data).toEqual({ tour_id: 1, status: 'COMPLETED' });
    expect((await getTour(1, campuses())).status).toBe('COMPLETED');
  });

  it('T-06 postCompleteTour: 성공하면 값 없이 끝나고 탐방이 COMPLETED', async () => {
    await login('guide@demo.kr');
    await expect(postCompleteTour(1, campuses())).resolves.toBeUndefined();
    expect((await getTour(1, campuses())).status).toBe('COMPLETED');
  });

  it('T-06 오류 세 갈래: 날짜 전 · 이미 완료 · 취소됨 — 모두 E409_INVALID_TOUR_STATUS', async () => {
    await login('guide@demo.kr');
    await expect(postCompleteTour(6, campuses())).rejects.toMatchObject({
      status: 409,
      code: 'COMPLETE_BEFORE_TOUR_DATE',
      backendCode: 'E409_INVALID_TOUR_STATUS',
    });
    await expect(postCompleteTour(7, campuses())).rejects.toMatchObject({
      status: 409,
      code: 'TOUR_ALREADY_COMPLETED',
      backendCode: 'E409_INVALID_TOUR_STATUS',
    });
    await postCancelTour(6, campuses());
    await expect(postCompleteTour(6, campuses())).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_INVALID_TOUR_STATUS',
    });
    // 와이어는 세 경우 모두 같은 코드 하나다(명세).
    const { token } = await login('guide@demo.kr');
    for (const tourId of [6, 7]) {
      const res = await rawFetch<Envelope & { message: string }>(`/tours/${tourId}/complete`, {
        method: 'POST',
        token,
      });
      expect([res.status, res.body.code]).toEqual([409, TOUR_COMPLETE_INVALID.code]);
    }
  });

  it('T-06: 서버가 E409_INVALID_TOUR_STATUS만 주면 탐방을 다시 읽어 세분한다(실서버 대리)', async () => {
    await login('guide@demo.kr');
    server.use(
      http.post('/api/tours/:tourId/complete', () => wireFail('E409_INVALID_TOUR_STATUS')),
    );
    await expect(postCompleteTour(6, campuses())).rejects.toMatchObject({
      code: 'COMPLETE_BEFORE_TOUR_DATE', // RECRUITING
      backendCode: 'E409_INVALID_TOUR_STATUS',
    });
    await expect(postCompleteTour(7, campuses())).rejects.toMatchObject({
      code: 'TOUR_ALREADY_COMPLETED',
    });
    mutate((db) => {
      db.tours.find((t) => t.id === 6)!.status = 'CANCELED';
    });
    await expect(postCompleteTour(6, campuses())).rejects.toMatchObject({
      code: 'ALREADY_PROCESSED',
    });
  });

  it('T-06/T-05: 다시 읽기가 실패하면 기본 표의 코드를 그대로 둔다', async () => {
    await login('guide@demo.kr');
    server.use(
      http.post('/api/tours/:tourId/complete', () => wireFail('E409_INVALID_TOUR_STATUS')),
      http.get('/api/tours/:tourId', () => wireFail('E500')),
    );
    await expect(postCompleteTour(6, campuses())).rejects.toMatchObject({
      status: 409,
      backendCode: 'E409_INVALID_TOUR_STATUS',
      code: 'ALREADY_PROCESSED', // 기본 표의 코드(`E409_INVALID_TOUR_STATUS`)
    });
  });

  it('T-05 와이어: 취소하면 CANCELED, 명세 예시와 같은 모양', async () => {
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Envelope>('/tours/6/cancel', { method: 'POST', token });
    expect([res.status, res.body.code]).toEqual([200, 'S200']);
    expectWireShape(res.body.data, TOUR_CANCELED.data);
    expect(res.body.data).toEqual({ tour_id: 6, status: 'CANCELED' });
  });

  it('T-05 오류: 이미 완료 TOUR_ALREADY_COMPLETED · 이미 취소 ALREADY_PROCESSED(둘 다 E409_INVALID_TOUR_STATUS)', async () => {
    await login('guide@demo.kr');
    await expect(postCancelTour(7, campuses())).rejects.toMatchObject({
      status: 409,
      code: 'TOUR_ALREADY_COMPLETED',
      backendCode: 'E409_INVALID_TOUR_STATUS',
    });
    await postCancelTour(6, campuses());
    await expect(postCancelTour(6, campuses())).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_INVALID_TOUR_STATUS',
    });
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Envelope>('/tours/7/cancel', { method: 'POST', token });
    expect([res.status, res.body.code]).toEqual([409, TOUR_CANCEL_INVALID.code]);
  });

  it('T-05: 서버가 E409_INVALID_TOUR_STATUS만 주면 완료 → TOUR_ALREADY_COMPLETED, 그 밖 → ALREADY_PROCESSED', async () => {
    await login('guide@demo.kr');
    server.use(http.post('/api/tours/:tourId/cancel', () => wireFail('E409_INVALID_TOUR_STATUS')));
    await expect(postCancelTour(7, campuses())).rejects.toMatchObject({
      code: 'TOUR_ALREADY_COMPLETED',
    });
    await expect(postCancelTour(6, campuses())).rejects.toMatchObject({
      code: 'ALREADY_PROCESSED', // RECRUITING인데도 서버가 거절 — 날짜 전/후 구분이 없는 취소는 이쪽
    });
  });

  it('권한: 남의 탐방 · 고교생 · 비로그인은 완료 · 취소 모두 FORBIDDEN / UNAUTHORIZED', async () => {
    await login('guide-dku@demo.kr');
    await expect(postCancelTour(1, campuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await expect(postCompleteTour(1, campuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await login('student@demo.kr');
    await expect(postCancelTour(1, campuses())).rejects.toMatchObject({ status: 403 });
    configureHttp({ getToken: () => null });
    await expect(postCompleteTour(1, campuses())).rejects.toMatchObject({ status: 401 });
    expect(getDb().tours.find((t) => t.id === 1)!.status).toBe('RECRUITING');
  });

  it('취소는 학생 쪽에 퍼진다: 내 신청 CANCELED · 쿠폰 EXPIRED(USED는 그대로) · 남의 신청 목록에서 칩', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    redeemDemoCoupon(1); // 김민지 상점 1 쿠폰 USED
    await login('student@demo.kr');
    const before = await getMyApplications(campuses());
    expect(before.find((a) => a.tour.id === 1)).toMatchObject({
      status: 'APPROVED',
      couponCount: 2,
    });

    await login('guide@demo.kr');
    await postCancelTour(1, campuses());

    await login('student@demo.kr');
    const after = await getMyApplications(campuses());
    expect(after.find((a) => a.tour.id === 1)).toMatchObject({
      status: 'CANCELED',
      tour: { status: 'CANCELED' },
      cancellable: false,
    });
    const coupons = await getMyCoupons(undefined, campuses());
    const ofTour1 = coupons.filter((c) => c.tourId === 1);
    expect(ofTour1.map((c) => c.status).sort()).toEqual(['EXPIRED', 'USED']);
    expect(ofTour1.find((c) => c.status === 'USED')!.storeId).toBe(1);

    // 대기였던 유진과 승인이었던 서준 · 하은도 모두 취소됐다.
    const apps = getDb().applications.filter((a) => a.tourId === 1);
    expect(apps.map((a) => a.status)).toEqual(apps.map(() => 'CANCELED'));
    expect(apps.every((a) => a.activeUserId === null)).toBe(true);
  });

  it('getGuideTour: 확정 코스 3곳 · 오늘 탐방은 완료 · 취소 모두 가능', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('guide@demo.kr');
    const detail = await getGuideTour(1, campuses());
    expect(detail.tour).toMatchObject({ id: 1, title: DEMO_TOUR_TITLE, status: 'RECRUITING' });
    expect(detail.courseStopCount).toBe(3);
    expect(detail.actions).toEqual({ completable: true, cancellable: true });
  });

  it('getGuideTour: 날짜 전 탐방(6)은 완료 불가 · 취소 가능, 코스가 없으면 0곳', async () => {
    await login('guide@demo.kr');
    const detail = await getGuideTour(6, campuses());
    expect(detail.courseStopCount).toBe(0);
    expect(detail.actions).toEqual({ completable: false, cancellable: true });
  });

  it('getGuideTour: 완료 · 취소된 탐방은 둘 다 불가', async () => {
    await login('guide@demo.kr');
    expect((await getGuideTour(7, campuses())).actions).toEqual({
      completable: false,
      cancellable: false,
    });
    await postCancelTour(6, campuses());
    expect((await getGuideTour(6, campuses())).actions).toEqual({
      completable: false,
      cancellable: false,
    });
  });

  it('getGuideTour: 남의 탐방은 코스 조회가 403이라 FORBIDDEN을 그대로 낸다', async () => {
    await login('guide-dku@demo.kr');
    await expect(getGuideTour(1, campuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('getGuideTour: 탐방 상세와 코스를 함께 부른다(직렬이 아니다)', async () => {
    await login('guide@demo.kr');
    const seen = await requestsDuring(() => getGuideTour(6, campuses()));
    expect(seen.sort()).toEqual(['GET /campuses', 'GET /tours/6', 'GET /tours/6/course']);
  });
});

describe('courses', () => {
  /** 코스 스팟의 목업 확장(2C-R8). */
  const SPOT_EXT = ['spot_id', 'discount_text', 'review_average', 'review_count', 'coupon_count'];

  it('코스가 아직 없는 가이드는 getGuideCourse가 null(404 E404)', async () => {
    const { token } = await login('guide@demo.kr');
    expect(await getGuideCourse(1, await listCampuses())).toBeNull();
    const res = await rawFetch<{ code: string }>('/tours/1/course', { method: 'GET', token });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('E404');
  });

  it('확정 전이면 승인된 학생에게 COURSE_NOT_READY(409 E409_COURSE_NOT_READY) — 초안이 있어도', async () => {
    await login('seojun@demo.kr');
    const campuses = await listCampuses();
    await expect(getCourse(1, campuses)).rejects.toMatchObject({
      status: 409,
      code: 'COURSE_NOT_READY',
      backendCode: 'E409_COURSE_NOT_READY',
    });
    await login('guide@demo.kr');
    await postCourseDraft(1, campuses);
    await login('seojun@demo.kr');
    await expect(getCourse(1, campuses)).rejects.toMatchObject({
      status: 409,
      code: 'COURSE_NOT_READY',
    });
  });

  it('승인된 신청자 · 그 가이드가 아니면 FORBIDDEN(403 E403)', async () => {
    const campuses = await listCampuses();
    await login('yujin@demo.kr'); // 대기 중
    await expect(getCourse(1, campuses)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      backendCode: 'E403',
    });
    await login('guide@demo.kr');
    await expect(getGuideCourse(2, campuses)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await expect(postCourseDraft(2, campuses)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await login('seojun@demo.kr');
    await expect(postCourseDraft(1, campuses)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('AI 초안(201 · 명세 C-01 모양) → 스팟 PUT으로 순서 · 한줄평 · 빼기 → 확정 → 학생 코스', async () => {
    resetDb({ today: new Date(), checkpoint: 'APPROVED' }); // 탐방 1 승인: 박서준 · 이하은 · 김민지
    const { token } = await login('guide@demo.kr');
    const campuses = await listCampuses();

    const created = await rawFetch<{ code: string; data: Record<string, unknown> }>(
      '/tours/1/course',
      { method: 'POST', token },
    );
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('S201');
    expectWireShape(created.body.data, COURSE_DRAFT.data, SPOT_EXT);

    const draft = (await getGuideCourse(1, campuses))!;
    expect(draft).toMatchObject({
      tourId: 1,
      status: 'DRAFT',
      tour: {
        id: 1,
        title: DEMO_TOUR_TITLE,
        universityId: 2,
        universityShortName: '경희대',
        campusName: '국제캠퍼스',
        startsAt: expect.stringMatching(/T14:00:00\+09:00$/),
        endsAt: expect.stringMatching(/T16:30:00\+09:00$/),
      },
      criteria: COURSE_CRITERIA,
      issuedCouponCount: 0,
    });
    expect(draft.stops.map((s) => [s.order, s.visitTime, s.type, s.name])).toEqual([
      [1, '14:00', 'CAMPUS', '예술·디자인대학'],
      [2, '15:10', 'STORE', '서천 밥상'],
      [3, '16:00', 'STORE', '카페 모래시계'],
    ]);
    expect(draft.stops.map((s) => s.campusBuildingId)).toEqual([3, null, null]);

    // 둘째를 첫째 앞으로: 시각은 위치 슬롯 그대로, 지점 id는 지킨다(같은 상점 · 건물).
    const [campus, meal, cafe] = draft.stops;
    const reordered = await putCourseSpots(
      1,
      buildSpots(draft, { kind: 'reorder', stopIds: [meal.id, campus.id, cafe.id] }),
      campuses,
    );
    expect(reordered.stops.map((s) => [s.id, s.order, s.visitTime])).toEqual([
      [meal.id, 1, '14:00'],
      [campus.id, 2, '15:10'],
      [cafe.id, 3, '16:00'],
    ]);
    expect(reordered.stops.map((s) => s.recommendationReason)).toEqual([
      meal.recommendationReason,
      campus.recommendationReason,
      cafe.recommendationReason,
    ]);

    const described = await putCourseSpots(
      1,
      buildSpots(reordered, {
        kind: 'note',
        stopId: cafe.id,
        description: '  과제하기 좋은 카페  ',
      }),
      campuses,
    );
    expect(described.stops.find((s) => s.id === cafe.id)?.description).toBe('과제하기 좋은 카페');

    const removed = await putCourseSpots(
      1,
      buildSpots(described, { kind: 'remove', stopId: campus.id }),
      campuses,
    );
    expect(removed.stops.map((s) => [s.id, s.order, s.visitTime])).toEqual([
      [meal.id, 1, '14:00'],
      [cafe.id, 2, '15:10'],
    ]);
    expect(removed.stops[1].description).toBe('과제하기 좋은 카페');

    const confirmed = await postConfirmCourse(1, campuses);
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', issuedCouponCount: 6 }); // 승인 3 × 제휴 2
    await expect(
      putCourseSpots(1, buildSpots(confirmed, { kind: 'remove', stopId: meal.id }), campuses),
    ).rejects.toMatchObject({
      status: 409,
      code: 'COURSE_NOT_DRAFT',
      backendCode: 'E409_COURSE_CONFIRMED',
    });

    await login('seojun@demo.kr');
    expect(await getCourse(1, campuses)).toEqual(confirmed);
  });

  it('와이어 모양: 스팟 PUT · 확정 · 조회가 명세 C-02 · C-03 · C-04 예시와 같고 확장이 실제로 나간다', async () => {
    resetDb({ today: new Date(), checkpoint: 'APPROVED' });
    const { token } = await login('guide@demo.kr');
    await postCourseDraft(1, await listCampuses());

    const put = await rawFetch<{ code: string; data: Record<string, unknown> }>(
      '/tours/1/course/spots',
      {
        method: 'PUT',
        token,
        body: {
          spots: [
            { stop_type: 'STORE', store_id: 1, start_time: '14:00', comment: '든든한 밥집' },
            { stop_type: 'CAMPUS', campus_building_id: 3, start_time: '15:10' },
            { stop_type: 'STORE', store_id: 2, start_time: '16:00' },
          ],
        },
      },
    );
    expect(put.status).toBe(200);
    expect(put.body.code).toBe('S200');
    expectWireShape(put.body.data, COURSE_SPOTS_OK.data, SPOT_EXT);
    const [meal, campus] = put.body.data.spots as Record<string, unknown>[];
    expect(meal).toMatchObject({
      stop_type: 'STORE',
      store_id: 1,
      campus_building_id: null,
      category: '한식',
      comment: '든든한 밥집',
      is_partner: true,
      spot_id: expect.any(Number),
      discount_text: '식사 금액 10% 할인',
      review_average: 4.6,
      review_count: 5,
    });
    expect(campus).toMatchObject({
      stop_type: 'CAMPUS',
      store_id: null,
      campus_building_id: 3,
      category: null,
      address: null,
      is_partner: false,
      review_summary: null,
    });
    expect(campus).not.toHaveProperty('discount_text');

    const confirm = await rawFetch<{ code: string; data: unknown }>('/tours/1/course/confirm', {
      method: 'POST',
      token,
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.code).toBe('S200');
    expectWireShape(confirm.body.data, COURSE_CONFIRM_OK.data);
    expect(confirm.body.data).toEqual({ tour_id: 1, status: 'CONFIRMED', coupon_count: 6 });

    const view = await rawFetch<{ code: string; data: Record<string, unknown> }>(
      '/tours/1/course',
      { method: 'GET', token },
    );
    expect(view.status).toBe(200);
    expect(view.body.code).toBe('S200');
    expectWireShape(view.body.data, COURSE_VIEW.data, SPOT_EXT);
    expect(view.body.data.coupon_count).toBe(6);
  });

  it('스팟 PUT 규칙 오류: 빈 배열 · 한줄평 101자는 E400과 spots 칸 오류', async () => {
    resetDb({ today: new Date(), checkpoint: 'APPROVED' });
    await login('guide@demo.kr');
    const campuses = await listCampuses();
    await postCourseDraft(1, campuses);
    await expect(putCourseSpots(1, [], campuses)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      backendCode: 'E400',
      fieldErrors: { spots: '지점을 1곳 이상 넣어 주세요.' },
    });
    await expect(
      putCourseSpots(
        1,
        [{ stopType: 'STORE', storeId: 1, startTime: '14:00', comment: '가'.repeat(101) }],
        campuses,
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { spots: '한줄평은 100자 이내로 적어 주세요.' },
    });
  });

  it('승인 0명인 탐방의 초안은 NO_APPROVED_APPLICANTS(E409_NO_APPROVED_APPLICANT)', async () => {
    await login('guide@demo.kr');
    await expect(postCourseDraft(6, await listCampuses())).rejects.toMatchObject({
      status: 409,
      code: 'NO_APPROVED_APPLICANTS',
      backendCode: 'E409_NO_APPROVED_APPLICANT',
    });
  });

  it('확정 코스 지점: 이름 · 분류 · 제휴 · 리뷰 요약 · 데이터 출처', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const campuses = await listCampuses();
    const course = await getCourse(1, campuses);
    expect(course).toMatchObject({ status: 'CONFIRMED', issuedCouponCount: 6 });
    expect(course.stops[0]).toEqual({
      id: expect.any(Number),
      order: 1,
      visitTime: '14:00',
      type: 'CAMPUS',
      name: '예술·디자인대학',
      category: '캠퍼스',
      lat: 37.2411,
      lng: 127.0815,
      description: null,
      recommendationReason: '산업디자인학과 전공 공간에서 실제 수업 이야기를 들어요.',
      storeId: null,
      campusBuildingId: 3,
      partnership: null,
      review: null,
      dataSource: null,
    });
    expect(course.stops[1]).toEqual({
      id: expect.any(Number),
      order: 2,
      visitTime: '15:10',
      type: 'STORE',
      name: '서천 밥상',
      category: '한식',
      lat: 37.2417,
      lng: 127.0848,
      description: null,
      recommendationReason: expect.stringContaining('신청자 2명이'),
      storeId: 1,
      campusBuildingId: null,
      partnership: { discount: '식사 금액 10% 할인' },
      review: {
        average: 4.6,
        count: 5,
        summary:
          '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.',
      },
      dataSource: '공공데이터(인허가) 기반',
    });
    expect(course.stops[2]).toMatchObject({
      name: '카페 모래시계',
      category: '카페',
      partnership: { discount: '음료 1,000원 할인' },
      review: { average: 4.4, count: 5 },
    });

    await login('guide@demo.kr');
    expect(await getGuideCourse(1, campuses)).toEqual(course);
  });

  it('리뷰 없는 상점 · 탐방 날짜에 제휴가 없는 상점', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    mutate((db) => {
      const [, meal, cafe] = db.courseStops
        .filter((s) => s.tourId === 1)
        .sort((a, b) => a.stopOrder - b.stopOrder);
      meal.storeId = 5; // 죽전 돼지국밥: 제휴 · 리뷰 없음
      db.partnerships.find((p) => p.storeId === cafe.storeId)!.endDate = '2000-01-01';
    });
    await login('guide@demo.kr');
    const [, meal, cafe] = (await getGuideCourse(1, await listCampuses()))!.stops;
    expect(meal).toMatchObject({
      name: '죽전 돼지국밥',
      partnership: null,
      review: { average: null, count: 0, summary: null },
      dataSource: '공공데이터(인허가) 기반',
    });
    expect(cafe).toMatchObject({ name: '카페 모래시계', partnership: null });
  });
});

describe('주변 상점 · 캠퍼스 장소 (GET /stores/nearby · GET /campuses/:campusId/places)', () => {
  type Items = { code: string; data: { items: Record<string, unknown>[] } };

  it('S-02 와이어: 명세 예시와 같은 모양(학생 토큰), 경희대는 반경 1km 안 상점 1 · 2 · 3 · 4', async () => {
    const { token } = await login('student@demo.kr');
    const res = await rawFetch<Items>('/stores/nearby?campus_id=2', { method: 'GET', token });
    expect([res.status, res.body.code]).toEqual([200, 'S200']);
    expectWireShape(res.body.data, NEARBY_STORES.data);
    expect(res.body.data.items.map((i) => i.store_id)).toEqual([1, 2, 3, 4]); // 목업은 id 순, 거리 순서는 프론트 몫
    expect(res.body.data.items.every((i) => i.is_partner === true)).toBe(true);
    expect(Object.keys(res.body.data.items[0]).sort()).toEqual(
      Object.keys(NEARBY_STORES.data.items[0]).sort(),
    );
  });

  it('category 쿼리는 같은 업종만 남긴다', async () => {
    const { token } = await login('student@demo.kr');
    const all = await rawFetch<Items>('/stores/nearby?campus_id=2', { method: 'GET', token });
    const cafes = await rawFetch<Items>(
      `/stores/nearby?campus_id=2&category=${encodeURIComponent('카페')}`,
      { method: 'GET', token },
    );
    expect(cafes.body.data.items.length).toBeGreaterThan(0);
    expect(cafes.body.data.items.length).toBeLessThan(all.body.data.items.length);
    expect(cafes.body.data.items.every((i) => i.category === '카페')).toBe(true);
  });

  it('getNearbyStores: 단국대는 [6, 5](가까운 순) · 비제휴, 경희대는 거리 오름차순 · 모두 제휴 · 상점 1은 시드 AI 요약', async () => {
    await login('student@demo.kr');
    const campuses = await listCampuses();
    const dankook = await getNearbyStores(3, campuses);
    expect(dankook.map((s) => s.storeId)).toEqual([6, 5]);
    expect(dankook.every((s) => !s.isPartner)).toBe(true);

    const khu = await getNearbyStores(2, campuses);
    expect(new Set(khu.map((s) => s.storeId))).toEqual(new Set([1, 2, 3, 4]));
    expect(khu.map((s) => s.distanceM)).toEqual(
      [...khu.map((s) => s.distanceM)].sort((a, b) => a - b),
    );
    expect(khu.every((s) => s.isPartner)).toBe(true);
    const seeded = getDb()
      .reviewSummaries.filter((r) => r.storeId === 1)
      .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt) || b.id - a.id)[0];
    expect(seeded.summary).not.toBe('');
    expect(khu.find((s) => s.storeId === 1)?.reviewSummary).toBe(seeded.summary);
  });

  it('요약이 없는 상점은 reviewSummary null', async () => {
    await login('student@demo.kr');
    const dankook = await getNearbyStores(3, await listCampuses());
    expect(dankook.map((s) => s.reviewSummary)).toEqual([null, null]);
  });

  it('제휴 기간이 지난 상점은 isPartner false', async () => {
    mutate((db) => {
      for (const p of db.partnerships) if (p.storeId === 1) p.endDate = '2000-01-01';
    });
    await login('student@demo.kr');
    const khu = await getNearbyStores(2, await listCampuses());
    expect(khu.find((s) => s.storeId === 1)?.isPartner).toBe(false);
    expect(khu.find((s) => s.storeId === 2)?.isPartner).toBe(true);
  });

  it('없는 캠퍼스는 요청 없이 NOT_FOUND(어댑터), 서버는 404 E404', async () => {
    const { token } = await login('student@demo.kr');
    const campuses = await listCampuses();
    // 양성 대조: 있는 캠퍼스는 요청이 나간다.
    expect(await requestsDuring(() => getNearbyStores(3, campuses))).toEqual([
      'GET /stores/nearby',
    ]);
    let error: unknown;
    const seen = await requestsDuring(async () => {
      error = await getNearbyStores(0, campuses).catch((e: unknown) => e);
    });
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(seen).toEqual([]);
    const raw = await rawFetch<{ code: string }>('/stores/nearby?campus_id=99', {
      method: 'GET',
      token,
    });
    expect([raw.status, raw.body.code]).toEqual([404, 'E404']);
  });

  it('campus_id가 없거나 양의 정수가 아니면 400 E400 + campus_id 칸 오류, 로그인 없이는 401', async () => {
    const { token } = await login('student@demo.kr');
    for (const q of ['', '?campus_id=0', '?campus_id=-1', '?campus_id=abc', '?campus_id=1.5']) {
      const res = await rawFetch<{
        code: string;
        errors: { field: string; reason: string }[];
      }>(`/stores/nearby${q}`, { method: 'GET', token });
      expect([res.status, res.body.code]).toEqual([400, 'E400']);
      expect(res.body.errors).toEqual([{ field: 'campus_id', reason: '캠퍼스를 골라 주세요.' }]);
    }
    const anonymous = await rawFetch('/stores/nearby?campus_id=2', { method: 'GET' });
    expect(anonymous.status).toBe(401);
  });

  it('C-02 보완 와이어: 명세 예시와 같은 모양, getCampusPlaces는 건물 id 순', async () => {
    const { token } = await login('guide@demo.kr');
    const res = await rawFetch<Items>('/campuses/2/places', { method: 'GET', token });
    expect([res.status, res.body.code]).toEqual([200, 'S200']);
    expectWireShape(res.body.data, CAMPUS_PLACES.data);
    expect(Object.keys(res.body.data.items[0]).sort()).toEqual(
      Object.keys(CAMPUS_PLACES.data.items[0]).sort(),
    );
    const places = await getCampusPlaces(2);
    expect(places.map((p) => p.name)).toEqual(['예술·디자인대학', '중앙도서관', '학생회관']);
    const ids = places.map((p) => p.campusBuildingId);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('없는 캠퍼스는 404 E404, 로그인 없이는 401', async () => {
    const { token } = await login('guide@demo.kr');
    await expect(getCampusPlaces(99)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    const raw = await rawFetch<{ code: string }>('/campuses/99/places', { method: 'GET', token });
    expect([raw.status, raw.body.code]).toEqual([404, 'E404']);
    const anonymous = await rawFetch('/campuses/2/places', { method: 'GET' });
    expect(anonymous.status).toBe(401);
  });

  it('초안에 캠퍼스 장소를 add로 보내면 지점 4개 · 끝은 중앙도서관 · 추천 이유 null(Review Focus 4)', async () => {
    resetDb({ today: new Date(), checkpoint: 'APPROVED' });
    await login('guide@demo.kr');
    const campuses = await listCampuses();
    const draft = await postCourseDraft(1, campuses);
    const library = (await getCampusPlaces(2)).find((p) => p.name === '중앙도서관')!;
    const next = await putCourseSpots(
      1,
      buildSpots(draft, {
        kind: 'add',
        place: { type: 'CAMPUS', campusBuildingId: library.campusBuildingId },
      }),
      campuses,
    );
    expect(next.stops).toHaveLength(4);
    expect(next.stops.map((s) => s.name).slice(0, 3)).toEqual(draft.stops.map((s) => s.name));
    expect(next.stops[3]).toMatchObject({
      type: 'CAMPUS',
      name: '중앙도서관',
      recommendationReason: null,
    });
  });
});

describe('coupons', () => {
  // 백엔드 와이어 + 합성 어댑터(`features/coupons/api`)를 목업 끝까지 부른다(2C-R25 ③). 캠퍼스는 약속째 넘긴다.
  const campuses = () => listCampuses();
  type Envelope = { code: string; data: Record<string, unknown> | null };

  it('내 쿠폰: id 순서, 신청으로 거르기, 상태는 어댑터가 계산', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const app = applicationOf('student@demo.kr', 1);
    const list = await getMyCoupons(undefined, campuses());
    expect(list.map((c) => c.storeName)).toEqual(['서천 밥상', '카페 모래시계']);
    expect(list[0].id).toBeLessThan(list[1].id);
    expect(list[0]).toEqual({
      id: expect.any(Number),
      code: demoCouponCode('student@demo.kr', 1),
      status: 'ISSUED',
      state: 'USABLE',
      discount: '식사 금액 10% 할인',
      storeId: 1,
      storeName: '서천 밥상',
      storeCategory: '한식',
      applicationId: app.id,
      tourId: 1,
      tourTitle: DEMO_TOUR_TITLE,
      tourStartsAt: expect.stringMatching(/T14:00:00\+09:00$/),
      expiresAt: expect.stringMatching(/T23:59:59\+09:00$/),
      usedAt: null,
      reviewWritten: false,
    });
    expect(await getMyCoupons(app.id, campuses())).toEqual(list);
    expect(await getMyCoupons(999999, campuses())).toEqual([]);
    expect(await getMyCoupon(list[1].id, campuses())).toEqual(list[1]);
    expect((await getMyApplication(app.id, campuses())).couponCount).toBe(2);
  });

  it('지난 탐방 쿠폰은 사용 완료 · 리뷰 작성, 남의 쿠폰은 NOT_FOUND', async () => {
    await login('seojun@demo.kr');
    const list = await getMyCoupons(undefined, campuses());
    expect(list.map((c) => [c.tourId, c.storeId, c.state, c.reviewWritten])).toEqual([
      [7, 1, 'USED', true],
      [7, 2, 'USED', true],
    ]);
    const others = getDb().coupons.find(
      (c) => c.applicationId === applicationOf('haeun@demo.kr', 7).id,
    )!;
    await expect(getMyCoupon(others.id, campuses())).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('쿠폰 목록은 고교생만 — 다른 역할은 403', async () => {
    await login('owner1@demo.kr');
    await expect(getMyCoupons(undefined, campuses())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('S-05 목록 와이어: 명세 예시와 같은 모양, tour_id · store_id로 거른다, 확장 store.category가 나간다', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const student = await login('student@demo.kr');
    const all = await rawFetch<Envelope>('/users/me/coupons', {
      method: 'GET',
      token: student.token,
    });
    expect([all.status, all.body.code]).toEqual([200, 'S200']);
    expectWireShape(all.body.data, MY_COUPONS.data, ['category']);
    const items = (all.body.data as { items: { store: { category?: string } }[] }).items;
    expect(items).toHaveLength(2);
    expect(items[0].store.category).toBe('한식');
    expect(all.body.data).not.toHaveProperty('total'); // 쪽 없는 목록(명세)

    const filtered = await rawFetch<Envelope>('/users/me/coupons?tour_id=1&store_id=2', {
      method: 'GET',
      token: student.token,
    });
    expect((filtered.body.data as { items: { store: { store_id: number } }[] }).items).toEqual([
      expect.objectContaining({ tour_id: 1, store: expect.objectContaining({ store_id: 2 }) }),
    ]);
    const none = await rawFetch<Envelope>('/users/me/coupons?tour_id=2', {
      method: 'GET',
      token: student.token,
    });
    expect((none.body.data as { items: unknown[] }).items).toEqual([]);
  });

  it('사장님 쿠폰 확인: 내 가게 쿠폰, 다른 가게 COUPON_OTHER_STORE, 없는 코드 COUPON_NOT_FOUND', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const code = demoCouponCode('student@demo.kr', 1);
    await login('owner1@demo.kr');
    expect(await getCouponLookup(code)).toEqual({
      code,
      state: 'USABLE',
      discount: '식사 금액 10% 할인',
      storeName: '서천 밥상',
      tourTitle: DEMO_TOUR_TITLE,
      tourStartsAt: expect.stringMatching(/T00:00:00\+09:00$/), // 응답에는 탐방 날짜뿐이다
      studentName: '김민지',
      usedAt: null,
    });
    await expect(getCouponLookup(demoCouponCode('student@demo.kr', 2))).rejects.toMatchObject({
      status: 403,
      code: 'COUPON_OTHER_STORE',
      backendCode: 'E403_OTHER_STORE',
    });
    await expect(getCouponLookup(unusedCode())).rejects.toMatchObject({
      status: 404,
      code: 'COUPON_NOT_FOUND',
    });
    await login('student@demo.kr');
    await expect(getCouponLookup(code)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('S-06 확인 · 사용 처리 와이어: 명세 예시와 같은 모양이고 확장이 실제로 나간다', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const code = demoCouponCode('student@demo.kr', 1);
    const owner = await login('owner1@demo.kr');
    const lookup = await rawFetch<Envelope>(`/coupons/${code}`, {
      method: 'GET',
      token: owner.token,
    });
    expect([lookup.status, lookup.body.code]).toEqual([200, 'S200']);
    expectWireShape(lookup.body.data, COUPON_LOOKUP.data, [
      'used_at',
      'tour_title',
      'student_name',
    ]);
    expect(lookup.body.data).toMatchObject({
      status: 'ISSUED',
      tour_date: expect.stringMatching(/^\d{4}-\d\d-\d\d$/),
      used_at: null,
      tour_title: DEMO_TOUR_TITLE,
      student_name: '김민지',
    });

    const redeem = await rawFetch<Envelope>(`/coupons/${code}/redeem`, {
      method: 'POST',
      token: owner.token,
    });
    expect([redeem.status, redeem.body.code]).toEqual([200, 'S200']);
    expectWireShape(redeem.body.data, REDEEM_OK.data, [
      'tour_visitor_count',
      'total_visitor_count',
    ]);
    expect(redeem.body.data).toMatchObject({
      status: 'USED',
      used_at: expect.stringMatching(/\+09:00$/),
      tour_visitor_count: 1,
      total_visitor_count: 6, // 지난 탐방(7)의 사용 쿠폰 5장 + 1
    });

    // 이미 사용: 409 E409_ALREADY_USED, 확장 data.used_at
    const again = await rawFetch<Envelope>(`/coupons/${code}/redeem`, {
      method: 'POST',
      token: owner.token,
    });
    expect([again.status, again.body.code]).toEqual([409, 'E409_ALREADY_USED']);
    expect(again.body.data).toEqual({ used_at: (redeem.body.data as { used_at: string }).used_at });
    expect(again.body.code).toBe(REDEEM_ALREADY_USED.code);
  });

  it('S-06 오류 와이어: 다른 가게 403 · 없는 코드 404 · 만료 410(데이터 없음)', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const owner = await login('owner1@demo.kr');
    const other = await rawFetch<Envelope>(`/coupons/${demoCouponCode('student@demo.kr', 2)}`, {
      method: 'GET',
      token: owner.token,
    });
    expect([other.status, other.body.code, other.body.data]).toEqual([
      403,
      COUPON_OTHER_STORE.code,
      null,
    ]);
    const missing = await rawFetch<Envelope>(`/coupons/${unusedCode()}/redeem`, {
      method: 'POST',
      token: owner.token,
    });
    expect([missing.status, missing.body.code]).toEqual([404, 'E404']);

    const code = demoCouponCode('student@demo.kr', 1);
    mutate((db) => {
      db.coupons.find((c) => c.code === code)!.status = 'EXPIRED';
    });
    const expired = await rawFetch<Envelope>(`/coupons/${code}/redeem`, {
      method: 'POST',
      token: owner.token,
    });
    expect([expired.status, expired.body.code, expired.body.data]).toEqual([
      410,
      REDEEM_EXPIRED.code,
      null,
    ]);
  });

  it('사장님 쿠폰 사용 · 이미 사용 · 학생 쪽 반영', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const code = demoCouponCode('student@demo.kr', 1);
    await login('owner1@demo.kr');
    const result = await postRedeem(code);
    expect(result).toMatchObject({
      coupon: { code, state: 'USED', usedAt: expect.any(String) },
      tourVisitorCount: 1,
      totalVisitorCount: 6, // 지난 탐방(7)의 사용 쿠폰 5장 + 1
    });
    await expect(postRedeem(code)).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_ALREADY_USED',
      details: { usedAt: result.coupon.usedAt },
    });

    await login('student@demo.kr');
    expect((await getMyCoupons(undefined, campuses()))[0]).toMatchObject({
      code,
      status: 'USED',
      state: 'USED',
      usedAt: result.coupon.usedAt,
    });
  });

  it('하루 한 장 규칙은 목업에 없다 — 같은 날 같은 가게의 두 번째 쿠폰도 쓸 수 있다(2C-R11)', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const mine = demoCouponCode('student@demo.kr', 1);
    const second = getDb().coupons.find(
      (c) => c.storeId === 1 && c.status === 'ISSUED' && c.code !== mine,
    )!.code;
    await login('owner1@demo.kr');
    await postRedeem(mine);
    await expect(postRedeem(second)).resolves.toMatchObject({ coupon: { state: 'USED' } });
    // 클라이언트는 코드와 문구만 갖춘다.
    server.use(http.post('/api/coupons/:couponCode/redeem', () => wireFail('E409_DAILY_LIMIT')));
    await expect(postRedeem(mine)).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_DAILY_LIMIT',
    });
  });
});

describe('reviews', () => {
  // R-02 상점 리뷰 · 요약 조회와 R-01 리뷰 작성. 저장하면 목업이 그 상점의 요약을 바로 다시 만든다(2B′-R18).
  const campuses = () => listCampuses();
  type Envelope = { code: string; data: Record<string, unknown> | null };

  it('R-02: 시드 상점 1 — 전체 수 5 · 평균 4.6 · 시드 요약, 최근 3개(시각이 같아 id 내림차순)', async () => {
    await login('student@demo.kr');
    const reviews = await getStoreReviews(1);
    expect(reviews).toMatchObject({
      count: 5,
      average: 4.6,
      summary:
        '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.',
    });
    expect(reviews.items).toHaveLength(3);
    expect(reviews.items[0]).toMatchObject({
      rating: 4,
      content: '시험 기간엔 사람이 많지만 음식은 빨리 나와요.',
      author: '한*영',
    });
    const ids = reviews.items.map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('R-02: 가이드 · 사장님도 읽는다(로그인한 누구나), 로그인 없이는 401, 없는 상점은 NOT_FOUND', async () => {
    await login('guide@demo.kr');
    expect((await getStoreReviews(2)).count).toBe(5);
    await login('owner1@demo.kr');
    expect((await getStoreReviews(1)).count).toBe(5);
    await expect(getStoreReviews(999)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    configureHttp({ getToken: () => null });
    await expect(getStoreReviews(1)).rejects.toMatchObject({ status: 401 });
  });

  it('R-02 와이어: 명세 예시와 같은 모양, 쪽 매개변수가 요청대로 나간다', async () => {
    const student = await login('student@demo.kr');
    const res = await rawFetch<Envelope>('/stores/1/reviews', {
      method: 'GET',
      token: student.token,
    });
    expect([res.status, res.body.code]).toEqual([200, 'S200']);
    expectWireShape(res.body.data, STORE_REVIEWS.data);
    expect(res.body.data).toMatchObject({ review_count: 5, page: 1, size: 20, total: 5 });
    const paged = await rawFetch<Envelope>('/stores/1/reviews?page=2&size=2', {
      method: 'GET',
      token: student.token,
    });
    expect(paged.body.data).toMatchObject({ page: 2, size: 2, total: 5, review_count: 5 });
    expect((paged.body.data as { items: unknown[] }).items).toHaveLength(2);
  });

  it('R-01: 쓰면 공백을 뺀 내용이 저장되고 요약 · 수 · 코스 지점이 바뀐다', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const couponId = redeemDemoCoupon(1);
    const created = await postReview({
      storeId: 1,
      couponId,
      rating: 4,
      content: '  양이 많아요  ',
    });
    expect(created).toMatchObject({ storeId: 1, rating: 4, content: '양이 많아요' });

    const reviews = await getStoreReviews(1);
    expect(reviews.count).toBe(6);
    expect(reviews.average).toBe(4.5);
    expect(reviews.summary).toContain('"양이 많아요"');
    expect(reviews.summary).toContain('학생 6명이');
    expect(reviews.items[0]).toMatchObject({
      id: created.id,
      content: '양이 많아요',
      author: '김*지',
    });

    const course = await getCourse(1, campuses());
    const spot = course.stops.find((s) => s.storeId === 1)!;
    expect(spot.review).toMatchObject({ count: 6, average: 4.5 });
    expect(
      (await getMyCoupons(undefined, campuses())).find((c) => c.id === couponId)!.reviewWritten,
    ).toBe(true);
  });

  it('R-01: 두 번째는 REVIEW_DUPLICATE(E409_ALREADY_REVIEWED), ISSUED 쿠폰은 REVIEW_NOT_ALLOWED(E403_COUPON_NOT_USED)', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const couponId = redeemDemoCoupon(1);
    await postReview({ storeId: 1, couponId, rating: 5, content: '좋아요' });
    await expect(
      postReview({ storeId: 1, couponId, rating: 5, content: '또 좋아요' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'REVIEW_DUPLICATE',
      backendCode: 'E409_ALREADY_REVIEWED',
    });

    const issued = getDb().coupons.find((c) => c.storeId === 2 && c.status === 'ISSUED')!;
    await expect(
      postReview({ storeId: 2, couponId: issued.id, rating: 5, content: '아직 안 썼어요' }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'REVIEW_NOT_ALLOWED',
      backendCode: 'E403_COUPON_NOT_USED',
    });
  });

  it('R-01: 칸 오류는 fieldErrors, 가이드는 FORBIDDEN', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const couponId = redeemDemoCoupon(1);
    await expect(
      postReview({ storeId: 1, couponId, rating: 6, content: '좋아요' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { rating: '별점은 1~5점으로 골라 주세요.' },
    });
    await expect(
      postReview({ storeId: 1, couponId, rating: 5, content: '   ' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { content: '한 줄 평은 1~100자로 적어 주세요.' },
    });
    await expect(
      postReview({ storeId: 999, couponId, rating: 5, content: '좋아요' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    await login('guide@demo.kr');
    await expect(
      postReview({ storeId: 1, couponId, rating: 5, content: '좋아요' }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('R-01 와이어: 201 + 명세 예시와 같은 모양, 오류 봉투 코드는 명세와 같다', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const student = await login('student@demo.kr');
    const couponId = redeemDemoCoupon(1);
    const post = (body: unknown) =>
      rawFetch<Envelope>('/stores/1/reviews', { method: 'POST', token: student.token, body });
    const created = await post({ coupon_id: couponId, rating: 5, content: '양도 많고 맛있었어요' });
    expect([created.status, created.body.code]).toEqual([201, 'S201']);
    expectWireShape(created.body.data, REVIEW_CREATED.data);
    expect(created.body.data).toMatchObject({
      store_id: 1,
      rating: 5,
      content: '양도 많고 맛있었어요',
    });

    const again = await post({ coupon_id: couponId, rating: 5, content: '또' });
    expect([again.status, again.body.code, again.body.data]).toEqual([
      409,
      REVIEW_ALREADY.code,
      REVIEW_ALREADY.data,
    ]);
    const issued = getDb().coupons.find((c) => c.storeId === 1 && c.status === 'ISSUED');
    const notUsed = await rawFetch<Envelope>('/stores/2/reviews', {
      method: 'POST',
      token: student.token,
      body: { coupon_id: issued?.id ?? 999999, rating: 5, content: '아직' },
    });
    expect([notUsed.status, notUsed.body.code, notUsed.body.data]).toEqual([
      403,
      REVIEW_NOT_USED.code,
      REVIEW_NOT_USED.data,
    ]);
  });
});

describe('demo', () => {
  it('헬스 체크는 목업 모드(백엔드 봉투)', async () => {
    const res = await rawFetch<{ code: string; data: unknown }>('/health', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expect(res.body.data).toEqual({ ok: true, mode: 'mock' });
    expect(await request('/health')).toEqual({ ok: true, mode: 'mock' });
  });

  it('시연 초기화는 체크포인트를 적용', async () => {
    await login('student@demo.kr');
    expect(await getMyCoupons(undefined, listCampuses())).toEqual([]);
    expect(
      await request('/demo/reset', { method: 'POST', body: { checkpoint: 'CONFIRMED' } }),
    ).toEqual({ ok: true });
    // 세션을 새 DB로 옮기므로 같은 토큰으로 계속 부른다
    expect(await getMyCoupons(undefined, listCampuses())).toHaveLength(2);
  });

  it('시연 초기화는 올려 둔 목업 파일도 지운다', async () => {
    const ref = putMockFile(testImage());
    await request('/demo/reset', { method: 'POST' });
    expect(getMockFile(ref)).toBeNull();
  });

  it('체크포인트 없이 초기화하면 처음 상태', async () => {
    await login('student@demo.kr');
    await postApplication(1, '궁금해요', listCampuses());
    await request('/demo/reset', { method: 'POST' });
    expect(await getMyApplications(listCampuses())).toEqual([]);
  });

  it('모르는 체크포인트는 400 VALIDATION이고 DB는 그대로', async () => {
    await login('student@demo.kr');
    await postApplication(1, '궁금해요', listCampuses());
    await expect(
      request('/demo/reset', { method: 'POST', body: { checkpoint: 'DONE' } }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION', backendCode: 'E400' });
    const raw = await rawFetch<{ code: string }>('/demo/reset', {
      method: 'POST',
      body: { checkpoint: 'DONE' },
    });
    expect(raw.status).toBe(400);
    expect(raw.body.code).toBe('E400');
    expect(await getMyApplications(listCampuses())).toHaveLength(1);
  });

  it('시연 초기화 응답은 성공 봉투 { ok: true }', async () => {
    const res = await rawFetch<{ code: string; data: unknown }>('/demo/reset', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expect(res.body.data).toEqual({ ok: true });
  });
});

describe('사장님 내 가게 (GET /users/me/store)', () => {
  it('사장님: 명세 S-01 보완 응답과 같은 봉투 · 모양(확장 없음)', async () => {
    const { token } = await login('owner1@demo.kr');
    const res = await rawFetch<{ code: string; data: Record<string, unknown> }>('/users/me/store', {
      method: 'GET',
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('S200');
    expectWireShape(res.body.data, MY_STORE.data);
    expect(res.body.data).toMatchObject({
      store_id: 1,
      name: '서천 밥상',
      partnership: { discount_text: '식사 금액 10% 할인' },
    });
  });

  it('제휴가 없으면 partnership은 null', async () => {
    const { token } = await login('owner1@demo.kr');
    mutate((db) => {
      db.partnerships = db.partnerships.filter((p) => p.storeId !== 1);
    });
    const res = await rawFetch<{ data: { partnership: unknown } }>('/users/me/store', {
      method: 'GET',
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.partnership).toBeNull();
  });

  it('가게가 없으면 404 E404, 사장님이 아니면 403 E403, 토큰이 없으면 401 E401', async () => {
    const { token } = await login('owner1@demo.kr');
    mutate((db) => {
      db.stores.find((s) => s.id === 1)!.ownerId = null;
    });
    const none = await rawFetch<{ code: string }>('/users/me/store', { method: 'GET', token });
    expect(none.status).toBe(404);
    expect(none.body.code).toBe('E404');

    const student = await login('student@demo.kr');
    const forbidden = await rawFetch<{ code: string }>('/users/me/store', {
      method: 'GET',
      token: student.token,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('E403');

    const anonymous = await rawFetch<{ code: string }>('/users/me/store', { method: 'GET' });
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe('E401');
  });

  it('어댑터 끝까지: 내 가게 · 가게 없음(null) · 학생은 FORBIDDEN', async () => {
    await login('owner1@demo.kr');
    expect(await getMyStore()).toMatchObject({
      id: 1,
      name: '서천 밥상',
      partnership: { discount: '식사 금액 10% 할인', state: 'ACTIVE' },
    });

    mutate((db) => {
      db.stores.find((s) => s.id === 1)!.ownerId = null;
    });
    expect(await getMyStore()).toBeNull();

    await login('student@demo.kr');
    await expect(getMyStore()).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      backendCode: 'E403',
    });
    configureHttp({ getToken: () => null });
    await expect(getMyStore()).rejects.toMatchObject({ status: 401 });
  });
});

describe('사장님 방문 · 리뷰 리포트 (GET /users/me/store/report)', () => {
  type Envelope = { code: string; data: Record<string, unknown> | null };

  it('S-07 와이어: 명세 예시와 같은 모양, 기본 기간으로 방문 5 · 리뷰 5 · 평균 4.6', async () => {
    const { token } = await login('owner1@demo.kr');
    const res = await rawFetch<Envelope>('/users/me/store/report', { method: 'GET', token });
    expect([res.status, res.body.code]).toEqual([200, 'S200']);
    expectWireShape(res.body.data, STORE_REPORT.data);
    expect(res.body.data).toMatchObject({ visit_count: 5, review_count: 5, average_rating: 4.6 });
  });

  it('from · to 쿼리가 기간으로 나간다 — 잘못된 날짜는 400 E400 + 칸 오류', async () => {
    const { token } = await login('owner1@demo.kr');
    const narrow = await rawFetch<Envelope>(
      '/users/me/store/report?from=2000-01-01&to=2000-01-31',
      {
        method: 'GET',
        token,
      },
    );
    expect(narrow.body.data).toMatchObject({
      from: '2000-01-01',
      to: '2000-01-31',
      visit_count: 0,
      review_count: 0,
      average_rating: null,
    });
    const bad = await rawFetch<Envelope & { errors: { field: string }[] }>(
      '/users/me/store/report?from=어제',
      { method: 'GET', token },
    );
    expect([bad.status, bad.body.code]).toEqual([400, 'E400']);
    expect(bad.body.errors[0].field).toBe('from');
  });

  it('가게가 없으면 404 E404, 학생이면 403, 토큰이 없으면 401', async () => {
    const nostore = await login('owner-nostore@demo.kr');
    const none = await rawFetch<Envelope>('/users/me/store/report', {
      method: 'GET',
      token: nostore.token,
    });
    expect([none.status, none.body.code]).toEqual([404, 'E404']);
    const student = await login('student@demo.kr');
    const forbidden = await rawFetch<Envelope>('/users/me/store/report', {
      method: 'GET',
      token: student.token,
    });
    expect(forbidden.status).toBe(403);
    const anonymous = await rawFetch<Envelope>('/users/me/store/report', { method: 'GET' });
    expect(anonymous.status).toBe(401);
  });

  it('어댑터: getStoreReportView는 리포트 · 내 가게 · 상점 리뷰 세 요청을 합성한다', async () => {
    await login('owner1@demo.kr');
    let view: Awaited<ReturnType<typeof getStoreReportView>> = null;
    const seen = await requestsDuring(async () => {
      view = await getStoreReportView();
    });
    expect(view).toMatchObject({
      report: { visitCount: 5, reviewCount: 5, averageRating: 4.6 },
      store: { id: 1 },
      reviews: { count: 5 },
    });
    expect([...seen].sort()).toEqual([
      'GET /stores/1/reviews',
      'GET /users/me/store',
      'GET /users/me/store/report',
    ]);
  });

  it('가게가 연결되지 않은 사장님은 getStoreReportView가 null, getStoreReport는 STORE_NOT_LINKED', async () => {
    await login('owner-nostore@demo.kr');
    expect(await getStoreReportView()).toBeNull();
    await expect(getStoreReport()).rejects.toMatchObject({ status: 404, code: 'STORE_NOT_LINKED' });
  });

  it('쿠폰을 사용 처리하면 방문이 늘어난다(CONFIRMED + 사용 처리 → 6)', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    redeemDemoCoupon(1);
    await login('owner1@demo.kr');
    expect((await getStoreReportView())?.report.visitCount).toBe(6);
  });
});

describe('가입 · 프로필 (POST /auth/signup · PATCH /users/me · PUT /users/me/guide-profile)', () => {
  const signupBody = {
    email: 'Fresh@Demo.kr',
    password: 'demo1234',
    name: '한새봄',
    role: 'HIGH_SCHOOL' as const,
  };

  it('가입 와이어: 로그인 없이 201 S201, 토큰 없이 명세 U-01 응답과 같은 모양', async () => {
    const res = await rawFetch<{ code: string; data: unknown }>('/auth/signup', {
      method: 'POST',
      body: signupBody,
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('S201');
    expectWireShape(res.body.data, SIGNUP_OK.data); // access_token이 있으면 "명세에 없는 키"로 실패한다
    expect(res.body.data).toMatchObject({ email: 'fresh@demo.kr', name: '한새봄' });
  });

  it('postSignup: 응답에 토큰이 없어도 이어서 로그인해 토큰 + Me를 준다 (요청 셋: 가입 → 로그인 → 내 정보)', async () => {
    let result: Awaited<ReturnType<typeof postSignup>> | undefined;
    const seen = await requestsDuring(async () => {
      result = await postSignup(signupBody);
    });
    expect(seen).toEqual(['POST /auth/signup', 'POST /auth/login', 'GET /users/me']);
    expect(result!.token).toEqual(expect.any(String));
    expect(result!.me).toMatchObject({
      email: 'fresh@demo.kr',
      name: '한새봄',
      role: 'HIGH_SCHOOL',
      verificationStatus: 'NONE',
      guardianStatus: 'NONE',
      studentProfile: { highSchoolName: null, grade: null, interestedMajor: null },
      guideProfile: null,
    });

    configureHttp({ getToken: () => result!.token });
    expect(await fetchMe()).toEqual(result!.me);
  });

  it('가입한 계정으로 같은 자격으로 다시 로그인할 수 있다', async () => {
    await postSignup(signupBody);
    const { me } = await apiLogin({ email: 'fresh@demo.kr', password: 'demo1234' });
    expect(me.name).toBe('한새봄');
  });

  it('중복 이메일은 EMAIL_DUPLICATE(E409)와 fieldErrors.email, 실패한 가입은 아무것도 남기지 않는다', async () => {
    await expect(postSignup({ ...signupBody, email: 'STUDENT@demo.kr' })).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_DUPLICATE',
      backendCode: 'E409',
      fieldErrors: { email: '이미 가입된 이메일이에요.' },
    });
    expect(getDb().users.filter((u) => u.email === 'fresh@demo.kr')).toHaveLength(0);
  });

  it('칸 오류: 영문만 있는 비밀번호는 fieldErrors.password, 이름 21자는 fieldErrors.name (VALIDATION)', async () => {
    await expect(postSignup({ ...signupBody, password: 'abcdefgh' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      backendCode: 'E400',
      fieldErrors: { password: '비밀번호는 영문과 숫자를 섞어 8자 이상으로 입력해 주세요.' },
    });
    await expect(postSignup({ ...signupBody, name: '가'.repeat(21) })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { name: '이름은 1~20자로 입력해 주세요.' },
    });
  });

  it('칸 오류가 없는 실서버 중복 응답(E409, errors 없음)도 fieldErrors.email을 채운다', async () => {
    server.use(http.post('/api/auth/signup', () => wireFail('E409')));
    await expect(postSignup(signupBody)).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_DUPLICATE',
      backendCode: 'E409',
      fieldErrors: { email: '이미 가입된 이메일이에요.' },
    });
  });

  it('명세 U-01 이메일 중복 예시(E409, errors 없음)를 그대로 받으면 EMAIL_DUPLICATE + 어댑터가 채운 fieldErrors.email', async () => {
    server.use(
      http.post('/api/auth/signup', () => HttpResponse.json(SIGNUP_DUPLICATE, { status: 409 })),
    );
    await expect(postSignup(signupBody)).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_DUPLICATE',
      backendCode: 'E409',
      fieldErrors: { email: '이미 가입된 이메일이에요.' },
    });
  });

  it('명세 U-03 PATCH 응답 예시(다섯 칸)를 받아도 patchMe는 본문을 쓰지 않고 GET /users/me로 다시 읽는다', async () => {
    await login('student@demo.kr');
    server.use(http.patch('/api/users/me', () => HttpResponse.json(ME_PATCH_OK, { status: 200 })));
    const seen = await requestsDuring(async () => {
      expect(
        await patchMe({
          name: '김하늘',
          highSchoolName: null,
          grade: null,
          interestedMajor: null,
        }),
      ).toMatchObject({
        role: 'HIGH_SCHOOL',
        studentProfile: { highSchoolName: '수원영통고등학교' },
      });
    });
    expect(seen).toEqual(['PATCH /users/me', 'GET /users/me']);
  });

  it('patchMe: 새 Me를 주고(이름도 바뀐다) PATCH 응답은 GET /users/me와 같은 모양', async () => {
    const { token } = await login('student@demo.kr');
    const me = await patchMe({
      name: '김민지2',
      highSchoolName: '수원고',
      grade: 3,
      interestedMajor: null,
    });
    expect(me).toMatchObject({
      name: '김민지2',
      studentProfile: { highSchoolName: '수원고', grade: 3, interestedMajor: null },
    });
    expect(await fetchMe()).toEqual(me);

    const raw = await rawFetch<{ code: string; data: unknown }>('/users/me', {
      method: 'PATCH',
      token,
      body: { name: '김민지3' },
    });
    expect(raw.status).toBe(200);
    expect(raw.body.code).toBe('S200');
    expectWireShape(raw.body.data, ME_HIGH_SCHOOL.data);
    // 보낸 필드만 바뀐다.
    expect(await fetchMe()).toMatchObject({
      name: '김민지3',
      studentProfile: { highSchoolName: '수원고', grade: 3 },
    });
  });

  it('patchMe 칸 오류: 학교 51자는 school_name → fieldErrors.highSchoolName, 학년 5는 fieldErrors.grade, 관심 학과 31자는 fieldErrors.interestedMajor', async () => {
    await login('student@demo.kr');
    const input = { name: '김민지', highSchoolName: null, grade: null, interestedMajor: null };
    await expect(patchMe({ ...input, highSchoolName: 'x'.repeat(51) })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { highSchoolName: '학교 이름은 50자 이하로 입력해 주세요.' },
    });
    await expect(patchMe({ ...input, grade: 5 })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { grade: expect.any(String) },
    });
    await expect(patchMe({ ...input, interestedMajor: 'x'.repeat(31) })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { interestedMajor: '관심 학과는 30자 이하로 입력해 주세요.' },
    });
  });

  it('patchMe: 가이드가 학교를 보내면 403 FORBIDDEN, 로그인 전이면 401', async () => {
    await login('guide@demo.kr');
    await expect(
      patchMe({ name: '박서준', highSchoolName: '수원고', grade: null, interestedMajor: null }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    configureHttp({ getToken: () => null });
    await expect(
      patchMe({ name: '박서준', highSchoolName: null, grade: null, interestedMajor: null }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('가이드는 이름만 보내면 바꿀 수 있다', async () => {
    const { token } = await login('guide@demo.kr');
    const raw = await rawFetch<{ code: string }>('/users/me', {
      method: 'PATCH',
      token,
      body: { name: '새이름' },
    });
    expect(raw.status).toBe(200);
    expect((await fetchMe()).name).toBe('새이름');
  });

  it('putGuideProfile: 새 Me를 주고 학교는 그대로, 와이어는 명세 U-04 응답과 같은 모양', async () => {
    const { token, me: before } = await login('guide@demo.kr');
    const me = await putGuideProfile({ major: '컴퓨터공학과', introduction: '안녕하세요.' });
    expect(me.guideProfile).toEqual({
      universityId: before.guideProfile!.universityId,
      major: '컴퓨터공학과',
      introduction: '안녕하세요.',
    });

    const raw = await rawFetch<{ code: string; data: unknown }>('/users/me/guide-profile', {
      method: 'PUT',
      token,
      body: { major: '컴퓨터공학과', intro: '안녕하세요.' },
    });
    expect(raw.status).toBe(200);
    expect(raw.body.code).toBe('S200');
    expectWireShape(raw.body.data, GUIDE_PROFILE_OK.data);
  });

  it('putGuideProfile 칸 오류: 소개 빈 문자열은 intro → fieldErrors.introduction, 학과 31자는 fieldErrors.major', async () => {
    await login('guide@demo.kr');
    await expect(
      putGuideProfile({ major: '컴퓨터공학과', introduction: '' }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { introduction: '소개는 1~200자로 입력해 주세요.' },
    });
    await expect(
      putGuideProfile({ major: '가'.repeat(31), introduction: '안녕하세요.' }),
    ).rejects.toMatchObject({ status: 400, fieldErrors: { major: expect.any(String) } });
    await expect(
      putGuideProfile({ major: '컴퓨터공학과', introduction: '가'.repeat(201) }),
    ).rejects.toMatchObject({ status: 400, fieldErrors: { introduction: expect.any(String) } });
  });

  it('putGuideProfile: 가이드가 아니면 403 FORBIDDEN', async () => {
    await login('student@demo.kr');
    await expect(putGuideProfile({ major: 'x', introduction: '소개' })).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

describe('P1 목업 도구 (fieldError · readForm · formFile)', () => {
  it('readBody는 snake 본문을 camelCase로 읽는다', async () => {
    server.use(
      http.post('/api/_body', async ({ request }) => HttpResponse.json(await readBody(request))),
    );
    // rawFetch는 본문을 변환하지 않는다 — 보낸 snake 키와 돌려받은 camel 키는 readBody만이 이어 준다.
    const res = await rawFetch('/_body', {
      method: 'POST',
      body: { interest_major: 'a', spots: [{ store_id: 2 }] },
    });
    expect(res.body).toEqual({ interestMajor: 'a', spots: [{ storeId: 2 }] });
  });

  it('fieldError: 400 VALIDATION 오류 봉투(errors[])에 코드 표 문구와 칸 오류가 실린다', async () => {
    server.use(
      http.post(
        '/api/_probe',
        withWire(async () => {
          throw fieldError('email', '이메일 형식이 맞지 않아요.');
        }),
      ),
    );
    const res = await fetch('/api/_probe', { method: 'POST' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: 'E400',
      message: '입력값을 다시 확인해 주세요.',
      data: null,
      errors: [{ field: 'email', reason: '이메일 형식이 맞지 않아요.' }],
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/),
    });
    await expect(request('/_probe', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      backendCode: 'E400',
      fieldErrors: { email: '이메일 형식이 맞지 않아요.' },
    });
  });

  it('fieldError: 문구를 생략하면 기본 문구, 코드와 상태를 바꿀 수 있다', async () => {
    server.use(
      http.post(
        '/api/_probe',
        withWire(async () => {
          throw fieldError('email');
        }),
      ),
      http.put(
        '/api/_probe',
        withWire(async () => {
          throw fieldError('email', '이미 가입된 이메일이에요.', 'EMAIL_DUPLICATE', 409);
        }),
      ),
    );
    await expect(request('/_probe', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { email: '입력값을 확인해 주세요.' },
    });
    await expect(
      request('/_probe', { method: 'PUT', errorMap: { E409: 'EMAIL_DUPLICATE' } }),
    ).rejects.toMatchObject({
      status: 409,
      backendCode: 'E409',
      code: 'EMAIL_DUPLICATE',
      message: '이미 가입된 이메일이에요.',
      fieldErrors: { email: '이미 가입된 이메일이에요.' },
    });
  });

  it('fieldErrors가 없는 MockApiError의 봉투는 errors: null', async () => {
    server.use(
      http.post(
        '/api/_probe',
        withWire(async () => {
          throw new MockApiError(404, 'NOT_FOUND');
        }),
      ),
    );
    const res = await fetch('/api/_probe', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'E404', data: null, errors: null });
  });

  describe('multipart', () => {
    function useUploadProbe() {
      server.use(
        http.post(
          '/api/_upload',
          withWire(async ({ request: req }) => {
            const form = await readForm(req);
            const file = formFile(form, 'document');
            return HttpResponse.json({
              grade: form.get('grade'),
              file: file && { name: file.name, type: file.type, size: file.size },
            });
          }),
        ),
      );
    }

    it('readForm → formFile: 파일의 이름 · 형식 · 크기와 일반 필드를 읽는다', async () => {
      useUploadProbe();
      const form = new FormData();
      form.append('document', testImage('card.png', { type: 'image/png' }));
      form.append('grade', '2');
      expect(await upload('/_upload', form)).toEqual({
        grade: '2',
        file: { name: 'card.png', type: 'image/png', size: 4 },
      });
    });

    it('파일 칸이 없거나 문자열이면 formFile은 null', async () => {
      useUploadProbe();
      const none = new FormData();
      none.append('grade', '1');
      expect(await upload('/_upload', none)).toEqual({ grade: '1', file: null });
      const text = new FormData();
      text.append('document', '사진 아님');
      expect(await upload('/_upload', text)).toEqual({ grade: null, file: null });
    });

    it('선택 없이 보낸 파일 칸(이름 빈 값 · 크기 0)은 formFile이 null', async () => {
      useUploadProbe();
      const boundary = 'xyz';
      const body =
        `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename=""\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="grade"\r\n\r\n2\r\n--${boundary}--\r\n`;
      const res = await fetch('/api/_upload', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });
      expect(await res.json()).toEqual({ grade: '2', file: null });
    });

    it('JSON 요청은 400 VALIDATION', async () => {
      useUploadProbe();
      await expect(
        request('/_upload', { method: 'POST', body: { document: 'x' } }),
      ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });
    });

    it('본문이 없는 요청도 400 VALIDATION', async () => {
      useUploadProbe();
      await expect(request('/_upload', { method: 'POST' })).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION',
      });
    });

    it('formFile은 realm이 달라도 name · type · size가 있는 객체면 파일로 본다', () => {
      const form = new FormData();
      const foreign = { name: 'a.jpg', type: 'image/jpeg', size: 3 };
      // FormData.get이 돌려주는 값만 보는 함수라, get만 가진 틀로 시험한다.
      const fake = {
        get: (key: string) => (key === 'document' ? foreign : null),
      } as unknown as FormData;
      expect(formFile(fake, 'document')).toBe(foreign);
      expect(formFile(fake, 'other')).toBeNull();
      expect(formFile(form, 'document')).toBeNull();
    });
  });
});

describe('재학 인증 · 보호자 동의 (U-05 · U-06)', () => {
  type Envelope = {
    code: string;
    data: Record<string, unknown> | null;
    errors: { field: string; reason: string }[] | null;
  };
  const DOC_MESSAGE = 'jpg, png 형식의 5MB 이하 파일만 올릴 수 있어요';
  const HS_SUBMIT = {
    role: 'HIGH_SCHOOL',
    schoolName: '수원영통고등학교',
    grade: 1,
    document: testImage(),
  } as const;
  const GUARDIAN = { guardianName: '최보호', guardianEmail: 'parent@example.com' };

  afterEach(() => server.events.removeAllListeners('request:start'));

  /** 이 테스트 동안 나간 `POST /api/verifications/enrollment`의 폼 칸 이름. */
  function captureEnrollmentKeys(): string[][] {
    const seen: string[][] = [];
    server.events.on('request:start', ({ request }) => {
      if (
        request.method === 'POST' &&
        new URL(request.url).pathname === '/api/verifications/enrollment'
      ) {
        void request
          .clone()
          .formData()
          .then((form) => seen.push([...form.keys()]));
      }
    });
    return seen;
  }

  /** `/api/guardian-consents/…` 요청에 실린 `Authorization` 값(없으면 null). */
  function captureConsentAuth(): (string | null)[] {
    const seen: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.startsWith('/api/guardian-consents/')) {
        seen.push(request.headers.get('Authorization'));
      }
    });
    return seen;
  }

  /** 멀티파트 `POST /api/verifications/enrollment`를 직접 보낸다(`rawFetch`는 JSON 전용). */
  async function postEnrollmentRaw(token: string, fields: Record<string, string | File>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    const res = await fetch(new URL('/api/verifications/enrollment', window.location.origin), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: res.status, body: (await res.json()) as Envelope };
  }

  it('고교생 제출: 인증 상태가 PENDING이 되고 폼 칸은 school_name · document다', async () => {
    const keys = captureEnrollmentKeys();
    await login('newbie@demo.kr');
    expect((await fetchMe()).verificationStatus).toBe('NONE');
    await expect(postEnrollment(HS_SUBMIT)).resolves.toBeUndefined();
    expect((await fetchMe()).verificationStatus).toBe('PENDING');
    await vi.waitFor(() => expect(keys).toEqual([['school_name', 'document']]));
    // 학교는 제출 때 프로필에 반영되고, 학년은 둘째 쓰기(PATCH /users/me)의 몫이다.
    expect((await fetchMe()).studentProfile).toMatchObject({ highSchoolName: '수원영통고등학교' });
  });

  it('대학생 제출: 칸은 campus_id(문자열) · document, 가이드 프로필의 학교가 맞춰진다', async () => {
    const keys = captureEnrollmentKeys();
    await login('guide-new@demo.kr');
    await postEnrollment({ role: 'UNIVERSITY', universityId: 2, document: testImage() });
    expect((await fetchMe()).verificationStatus).toBe('PENDING');
    await vi.waitFor(() => expect(keys).toEqual([['campus_id', 'document']]));
    expect((await fetchMe()).guideProfile?.universityId).toBe(2);
  });

  it('형식 오류는 VALIDATION + fieldErrors.document(명세 문장), 그 뒤 제출 · 재제출은 ALREADY_PROCESSED', async () => {
    await login('newbie@demo.kr');
    await expect(
      postEnrollment({ ...HS_SUBMIT, document: testImage('x.pdf', { type: 'application/pdf' }) }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { document: DOC_MESSAGE },
    });
    expect((await fetchMe()).verificationStatus).toBe('NONE');
    await postEnrollment(HS_SUBMIT);
    await expect(postEnrollment(HS_SUBMIT)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_ALREADY_SUBMITTED',
    });
  });

  it('학교 이름 · 캠퍼스 칸 오류는 화면 칸 이름(schoolName · campusId)으로 돌아온다', async () => {
    await login('newbie@demo.kr');
    await expect(postEnrollment({ ...HS_SUBMIT, schoolName: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { schoolName: '학교 이름은 50자 이하로 입력해 주세요.' },
    });
    await login('guide-new@demo.kr');
    await expect(
      postEnrollment({ role: 'UNIVERSITY', universityId: 6, document: testImage() }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { campusId: '5개교 이외 학교 선택 시 제출할 수 없어요.' },
    });
  });

  it('413(본문 없음)은 FILE_TOO_LARGE', async () => {
    server.use(
      http.post('/api/verifications/enrollment', () => new HttpResponse(null, { status: 413 })),
    );
    await login('newbie@demo.kr');
    await expect(postEnrollment(HS_SUBMIT)).rejects.toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
    });
  });

  it('요청 → 시연 토큰 → 보호자 조회(Authorization 없음) → 동의 → 토큰 사라짐 → 다시 동의는 ALREADY_PROCESSED', async () => {
    const auth = captureConsentAuth();
    await login('newbie@demo.kr');
    expect(await getDemoConsentToken()).toBeNull();
    await postGuardianConsent(GUARDIAN);
    expect((await fetchMe()).guardianStatus).toBe('PENDING');
    const token = await getDemoConsentToken();
    expect(token).toEqual(expect.any(String));

    // 대기 중 다시 요청은 막힌다(명세 E409_CONSENT_EXISTS).
    await expect(postGuardianConsent(GUARDIAN)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_CONSENT_EXISTS',
    });

    expect(await getConsent(token!)).toMatchObject({
      studentName: '최하늘',
      schoolName: '수원영통고등학교',
      status: 'PENDING',
    });
    await expect(patchConsent(token!, 'AGREED')).resolves.toBe('AGREED');
    expect((await fetchMe()).guardianStatus).toBe('AGREED');
    expect(await getDemoConsentToken()).toBeNull();
    await expect(patchConsent(token!, 'AGREED')).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_PROCESSED',
      backendCode: 'E409_ALREADY_PROCESSED',
    });
    // 처리된 링크의 조회는 200 + 그 상태.
    expect((await getConsent(token!)).status).toBe('AGREED');
    // 로그인한 채 불러도 보호자 조회 · 결정에는 토큰을 싣지 않는다.
    expect(auth.length).toBeGreaterThan(0);
    expect(auth.every((value) => value === null)).toBe(true);
  });

  it('거부하면 REJECTED, 다시 요청하면 새 링크가 열리고 예전 링크는 CONSENT_LINK_INVALID', async () => {
    await login('waiting@demo.kr');
    await expect(patchConsent(DEMO_CONSENT_TOKENS.valid, 'REJECTED')).resolves.toBe('REJECTED');
    expect((await fetchMe()).guardianStatus).toBe('REJECTED');
    await postGuardianConsent(GUARDIAN);
    expect((await fetchMe()).guardianStatus).toBe('PENDING');
    await expect(getConsent(DEMO_CONSENT_TOKENS.valid)).rejects.toMatchObject({
      status: 404,
      code: 'CONSENT_LINK_INVALID',
    });
    expect(await getDemoConsentToken()).not.toBe(DEMO_CONSENT_TOKENS.valid);
  });

  it('시드 링크: rejected 계정은 재요청되고 예전 토큰은 404, waiting 계정은 409', async () => {
    await login('rejected@demo.kr');
    await postGuardianConsent(GUARDIAN);
    await expect(getConsent(DEMO_CONSENT_TOKENS.rejected)).rejects.toMatchObject({ status: 404 });
    await login('waiting@demo.kr');
    await expect(postGuardianConsent(GUARDIAN)).rejects.toMatchObject({
      backendCode: 'E409_CONSENT_EXISTS',
    });
  });

  it('만료 링크는 조회 · 결정 모두 410 CONSENT_LINK_EXPIRED, 모르는 토큰은 404 CONSENT_LINK_INVALID', async () => {
    await expect(getConsent(DEMO_CONSENT_TOKENS.expired)).rejects.toMatchObject({
      status: 410,
      code: 'CONSENT_LINK_EXPIRED',
    });
    await expect(patchConsent(DEMO_CONSENT_TOKENS.expired, 'AGREED')).rejects.toMatchObject({
      status: 410,
      code: 'CONSENT_LINK_EXPIRED',
    });
    await expect(getConsent('bad')).rejects.toMatchObject({
      status: 404,
      code: 'CONSENT_LINK_INVALID',
    });
    await expect(patchConsent('bad', 'AGREED')).rejects.toMatchObject({
      code: 'CONSENT_LINK_INVALID',
    });
  });

  it('보호자 조회 · 결정의 401은 지금 세션을 만료 처리하지 않는다(auth: false)', async () => {
    const onUnauthorized = vi.fn();
    configureHttp({ getToken: () => 'some-token', onUnauthorized });
    server.use(
      http.get('/api/guardian-consents/:token', () => wireFail('E401')),
      http.patch('/api/guardian-consents/:token', () => wireFail('E401')),
    );
    await expect(getConsent('t')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    await expect(patchConsent('t', 'AGREED')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    configureHttp({ onUnauthorized: () => {} });
  });

  it('PATCH 본문은 { agree } 불리언이다', async () => {
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (
        request.method === 'PATCH' &&
        new URL(request.url).pathname.startsWith('/api/guardian-consents/')
      ) {
        void request
          .clone()
          .json()
          .then((body: unknown) => bodies.push(body));
      }
    });
    await patchConsent(DEMO_CONSENT_TOKENS.valid, 'REJECTED');
    await vi.waitFor(() => expect(bodies).toEqual([{ agree: false }]));
  });

  it('서버의 400 형식 오류 예시는 fieldErrors.document로 읽는다', async () => {
    server.use(
      http.post('/api/verifications/enrollment', () =>
        HttpResponse.json(ENROLLMENT_INVALID, { status: 400 }),
      ),
    );
    await login('newbie@demo.kr');
    await expect(postEnrollment(HS_SUBMIT)).rejects.toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { document: DOC_MESSAGE },
    });
  });

  describe('와이어', () => {
    it('POST /verifications/enrollment: 201 + 명세 예시와 같은 모양, 재제출은 명세 409 코드', async () => {
      const { token } = await login('newbie@demo.kr');
      const res = await postEnrollmentRaw(token, {
        school_name: '용인고등학교',
        document: testImage(),
      });
      expect([res.status, res.body.code]).toEqual([201, ENROLLMENT_OK.code]);
      expectWireShape(res.body.data, ENROLLMENT_OK.data);
      expect(res.body.data).toMatchObject({ status: 'PENDING' });

      const again = await postEnrollmentRaw(token, {
        school_name: '용인고등학교',
        document: testImage(),
      });
      expect([again.status, again.body.code]).toEqual([409, ENROLLMENT_SUBMITTED.code]);
    });

    it('POST /verifications/enrollment: 형식 오류는 400 E400 + errors[document]', async () => {
      const { token } = await login('newbie@demo.kr');
      const res = await postEnrollmentRaw(token, {
        school_name: '용인고등학교',
        document: testImage('x.pdf', { type: 'application/pdf' }),
      });
      expect([res.status, res.body.code]).toEqual([400, ENROLLMENT_INVALID.code]);
      expect(res.body.errors).toEqual(ENROLLMENT_INVALID.errors);
    });

    it('POST /verifications/enrollment: JSON 본문은 400', async () => {
      const { token } = await login('newbie@demo.kr');
      const res = await rawFetch<Envelope>('/verifications/enrollment', {
        method: 'POST',
        token,
        body: { school_name: '용인고등학교' },
      });
      expect(res.status).toBe(400);
    });

    it('POST /guardian-consents: 201 + 명세 예시와 같은 모양, 다시 요청하면 명세 409 코드', async () => {
      const { token } = await login('newbie@demo.kr');
      const body = { guardian_name: '최보호', guardian_email: 'parent@example.com' };
      const res = await rawFetch<Envelope>('/guardian-consents', { method: 'POST', token, body });
      expect([res.status, res.body.code]).toEqual([201, CONSENT_REQUESTED.code]);
      expectWireShape(res.body.data, CONSENT_REQUESTED.data);
      expect(res.body.data).toMatchObject({ status: 'PENDING' });

      const again = await rawFetch<Envelope>('/guardian-consents', { method: 'POST', token, body });
      expect([again.status, again.body.code]).toEqual([409, CONSENT_EXISTS.code]);
    });

    it('GET /guardian-consents/:token: 토큰 없이 200 + 명세 예시와 같은 모양', async () => {
      const res = await rawFetch<Envelope>(`/guardian-consents/${DEMO_CONSENT_TOKENS.valid}`, {
        method: 'GET',
      });
      expect([res.status, res.body.code]).toEqual([200, CONSENT_VIEW.code]);
      expectWireShape(res.body.data, CONSENT_VIEW.data);
      expect(res.body.data).toMatchObject({ student_name: '강하린', status: 'PENDING' });
    });

    it('GET /guardian-consents/:token: 만료는 410 E410_EXPIRED, 모르는 토큰은 404 E404', async () => {
      const expired = await rawFetch<Envelope>(
        `/guardian-consents/${DEMO_CONSENT_TOKENS.expired}`,
        {
          method: 'GET',
        },
      );
      expect([expired.status, expired.body.code]).toEqual([410, CONSENT_EXPIRED.code]);
      const bad = await rawFetch<Envelope>('/guardian-consents/bad', { method: 'GET' });
      expect([bad.status, bad.body.code]).toEqual([404, 'E404']);
    });

    it('PATCH /guardian-consents/:token: 200 + 명세 예시 모양, 다시 처리하면 409, 만료는 410', async () => {
      const res = await rawFetch<Envelope>(`/guardian-consents/${DEMO_CONSENT_TOKENS.valid}`, {
        method: 'PATCH',
        body: { agree: true },
      });
      expect([res.status, res.body.code]).toEqual([200, CONSENT_DECIDED.code]);
      expectWireShape(res.body.data, CONSENT_DECIDED.data);
      expect(res.body.data).toEqual({ status: 'AGREED' });

      const again = await rawFetch<Envelope>(`/guardian-consents/${DEMO_CONSENT_TOKENS.valid}`, {
        method: 'PATCH',
        body: { agree: true },
      });
      expect([again.status, again.body.code]).toEqual([409, CONSENT_PROCESSED.code]);

      const expired = await rawFetch<Envelope>(
        `/guardian-consents/${DEMO_CONSENT_TOKENS.expired}`,
        {
          method: 'PATCH',
          body: { agree: true },
        },
      );
      expect([expired.status, expired.body.code]).toEqual([410, CONSENT_DECIDE_EXPIRED.code]);
    });

    it('PATCH /guardian-consents/:token: agree가 불리언이 아니면 400 + errors[agree]', async () => {
      const res = await rawFetch<Envelope>(`/guardian-consents/${DEMO_CONSENT_TOKENS.valid}`, {
        method: 'PATCH',
        body: { agree: 'yes' },
      });
      expect(res.status).toBe(400);
      expect(res.body.errors?.map((e) => e.field)).toEqual(['agree']);
    });

    it('GET /users/me: 동의 대기(기한 전)인 고교생에게만 확장 guardian_consent_token', async () => {
      const waiting = await login('waiting@demo.kr');
      const me = await rawFetch<Envelope>('/users/me', { method: 'GET', token: waiting.token });
      expectWireShape(me.body.data, ME_HIGH_SCHOOL.data, ['guardian_consent_token']);
      expect(me.body.data).toMatchObject({
        guardian_consent_status: 'PENDING',
        guardian_consent_token: DEMO_CONSENT_TOKENS.valid,
      });
      expect(await getDemoConsentToken()).toBe(DEMO_CONSENT_TOKENS.valid);

      // 동의 완료 · 거부 · 기한 지남 · 요청 전 · 가이드에는 키가 없다.
      for (const email of [
        'student@demo.kr',
        'rejected@demo.kr',
        'expired@demo.kr',
        'newbie@demo.kr',
        'guide@demo.kr',
      ]) {
        const { token } = await login(email);
        const other = await rawFetch<Envelope>('/users/me', { method: 'GET', token });
        expect(other.body.data).not.toHaveProperty('guardian_consent_token');
        expect(await getDemoConsentToken()).toBeNull();
      }
    });
  });
});
