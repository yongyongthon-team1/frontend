import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ApplicantsBoard,
  GuideTourSummary,
  MyApplication,
} from '@/features/applications/model';
import type { LoginResponse, Me } from '@/features/auth/model';
import type { Insight, University } from '@/features/campuses/model';
import type { Coupon, CouponLookup, RedeemResult } from '@/features/coupons/model';
import type { Course } from '@/features/courses/model';
import type { MyStore } from '@/features/stores/model';
import type { RecommendationResult, TourDetail, TourSummary } from '@/features/tours/model';
import { COURSE_CRITERIA } from '@/mocks/ai/course';
import { getMockFile, putMockFile } from '@/mocks/db/files';
import { getDb, mutate, resetDb } from '@/mocks/db/store';
import { configureHttp, request, upload } from '@/shared/lib/http';
import { MockApiError } from '@/mocks/rules/errors';
import { server } from '@/mocks/node';
import { testImage } from '@/test/files';
import { fieldError, formFile, readForm, withErrors } from './util';

// 핸들러를 실제 HTTP 클라이언트로 부른다. 테스트 setup이 전체 핸들러를 건 MSW 서버를 켜고,
// 지연을 0으로 두고, 매 테스트 전에 오늘 기준 시드(START)로 DB를 되돌린다.

afterEach(() => configureHttp({ getToken: () => null }));

async function login(email: string) {
  const r = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password: 'demo1234' },
  });
  configureHttp({ getToken: () => r.token });
  return r;
}

/** 상태 코드(201 · 204)를 직접 볼 때 쓰는 fetch. */
function rawFetch(path: string, init: { method: string; token?: string; body?: unknown }) {
  return fetch(new URL(`/api${path}`, window.location.origin), {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
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
  it('로그인 → /me', async () => {
    await login('student@demo.kr');
    expect((await request<Me>('/me')).role).toBe('HIGH_SCHOOL');
  });

  it('틀린 비밀번호는 401 INVALID_CREDENTIALS', async () =>
    await expect(
      request('/auth/login', {
        method: 'POST',
        body: { email: 'student@demo.kr', password: 'x' },
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' }));

  it('없는 이메일도 401 INVALID_CREDENTIALS', async () =>
    await expect(
      request('/auth/login', {
        method: 'POST',
        body: { email: 'nobody@demo.kr', password: 'demo1234' },
      }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' }));

  it('토큰이 없거나 모르는 토큰이면 401 UNAUTHORIZED', async () => {
    await expect(request('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    configureHttp({ getToken: () => 'mock-unknown' });
    await expect(request('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('로그아웃은 204이고 그 토큰은 더 쓸 수 없다', async () => {
    const { token } = await login('student@demo.kr');
    expect((await rawFetch('/auth/logout', { method: 'POST', token })).status).toBe(204);
    await expect(request('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
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
    expect((await request<Me>('/me')).guardianStatus).toBe('PENDING');
    consent('2000-01-01T09:00:00+09:00');
    expect((await request<Me>('/me')).guardianStatus).toBe('EXPIRED');
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

  it('사장님 Me: 사업자 인증 · 내 가게', async () => {
    expect((await login('owner1@demo.kr')).me).toMatchObject({
      role: 'OWNER',
      verificationStatus: 'NONE',
      guardianStatus: 'NONE',
      studentProfile: null,
      guideProfile: null,
      businessVerified: true,
      storeId: 1,
    });
  });
});

describe('campuses', () => {
  it('대학 5곳: 짧은 이름 · 좌표 · 방학', async () => {
    const list = await request<University[]>('/universities');
    expect(list.map((u) => u.shortName)).toEqual([
      '강남대',
      '경희대',
      '단국대',
      '명지대',
      '한국외대',
    ]);
    expect(list[1]).toEqual({
      id: 2,
      name: '경희대학교',
      shortName: '경희대',
      campusName: '국제캠퍼스',
      address: '경기도 용인시 기흥구 덕영대로 1732',
      lat: 37.2397,
      lng: 127.0833,
      administrativeDong: '서천동',
      vacations: [
        { startDate: '2026-12-21', endDate: '2027-02-28', label: '2026 겨울방학' },
        { startDate: '2027-06-21', endDate: '2027-08-31', label: '2027 여름방학' },
      ],
    });
  });

  it('방학 상권 인사이트는 행정동을 넣은 예시 문구', async () => {
    expect(await request<Insight>('/universities/2/insight')).toEqual({
      universityId: 2,
      title: '방학 상권 인사이트',
      text: '서천동은 방학이면 대학가 손님이 크게 줄어요. 이 코스는 그 상권으로 신청자들을 보내요.',
      source: '팀 데이터 담당 확정 전 예시',
      isPlaceholder: true,
    });
  });

  it('없는 대학의 인사이트는 404 NOT_FOUND', async () =>
    await expect(request('/universities/99/insight')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    }));
});

describe('tours', () => {
  it('추천 → 신청 → 내 탐방', async () => {
    await login('student@demo.kr');
    const rec = await request<RecommendationResult>('/recommendations', {
      method: 'POST',
      body: { q: '산업디자인 공부' },
    });
    const app = await request<MyApplication>(`/tours/${rec.items[0].tour.id}/applications`, {
      method: 'POST',
      body: { motivation: '밥집이 궁금해요' },
    });
    expect(app.status).toBe('PENDING');
    expect((await request<MyApplication[]>('/me/applications'))[0].id).toBe(app.id);
  });

  it('빈 추천 문장은 400 VALIDATION', async () => {
    await login('student@demo.kr');
    await expect(
      request('/recommendations', { method: 'POST', body: { q: '  ' } }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });
  });

  it('탐방 목록은 시작 시각 순이고 상태 · 학교로 거른다', async () => {
    const ids = async (query: string) =>
      (await request<TourSummary[]>(`/tours${query}`)).map((t) => t.id);
    expect(await ids('')).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(await ids('?status=RECRUITING')).toEqual([1, 3, 4, 5, 6]);
    expect(await ids('?universityId=2')).toEqual([7, 1, 6]);
    expect(await ids('?status=RECRUITING&universityId=2')).toEqual([1, 6]);
    expect(await ids('?status=&universityId=')).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });

  it('탐방 상세: 승인된 신청자에게 오픈채팅과 내 신청', async () => {
    await login('seojun@demo.kr');
    expect(await request<TourDetail>('/tours/1')).toMatchObject({
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

  it('로그인 안 했거나 대기 중이면 오픈채팅이 없다', async () => {
    expect(await request<TourDetail>('/tours/1')).toMatchObject({
      myApplication: null,
      openChatUrl: null,
    });
    await login('yujin@demo.kr');
    expect(await request<TourDetail>('/tours/1')).toMatchObject({
      myApplication: { id: applicationOf('yujin@demo.kr', 1).id, status: 'PENDING' },
      openChatUrl: null,
    });
  });

  it('없는 탐방은 404 NOT_FOUND', async () =>
    await expect(request('/tours/99')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' }));
});

describe('applications', () => {
  it('신청은 201과 MyApplication', async () => {
    const { token } = await login('student@demo.kr');
    const res = await rawFetch('/tours/1/applications', {
      method: 'POST',
      token,
      body: { motivation: '밥집이 궁금해요' },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      status: 'PENDING',
      motivation: '밥집이 궁금해요',
      tour: { id: 1, title: DEMO_TOUR_TITLE },
      courseStatus: null,
      openChatUrl: null,
      couponCount: 0,
      cancellable: false, // 탐방 1은 오늘이다
    });
  });

  it('신청 규칙 오류를 상태 코드와 코드로 준다', async () => {
    const apply = (tourId: number, motivation = '수업이 궁금해요') =>
      request(`/tours/${tourId}/applications`, { method: 'POST', body: { motivation } });
    await expect(apply(1)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    await login('newbie@demo.kr');
    await expect(apply(1)).rejects.toMatchObject({ status: 403, code: 'NOT_VERIFIED' });
    await login('seojun@demo.kr');
    await expect(apply(1)).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_APPLICATION' });
    await login('student@demo.kr');
    await expect(apply(2)).rejects.toMatchObject({ status: 409, code: 'TOUR_CLOSED' });
    await expect(apply(7)).rejects.toMatchObject({ status: 409, code: 'TOUR_NOT_RECRUITING' });
    await expect(apply(1, ' ')).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });
    await login('guide@demo.kr');
    await expect(apply(1)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('내 탐방 목록은 최근 신청부터', async () => {
    await login('seojun@demo.kr');
    const list = await request<MyApplication[]>('/me/applications');
    expect(list.map((a) => a.tour.id)).toEqual([1, 2, 7]);
  });

  it('내 신청 상세: 승인이면 오픈채팅, 남의 신청은 404', async () => {
    await login('seojun@demo.kr');
    expect(
      await request<MyApplication>(`/me/applications/${applicationOf('seojun@demo.kr', 1).id}`),
    ).toMatchObject({
      status: 'APPROVED',
      openChatUrl: DEMO_OPEN_CHAT,
      courseStatus: null,
      couponCount: 0,
      cancellable: false,
    });
    await expect(
      request(`/me/applications/${applicationOf('yujin@demo.kr', 1).id}`),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('미래 탐방 신청은 취소되고, 취소 후 다시 신청할 수 있다', async () => {
    await login('student@demo.kr');
    const motivation = { motivation: '수업이 궁금해요' };
    const app = await request<MyApplication>('/tours/6/applications', {
      method: 'POST',
      body: motivation,
    });
    expect(app.cancellable).toBe(true);
    expect(
      await request<MyApplication>(`/me/applications/${app.id}/cancel`, { method: 'POST' }),
    ).toMatchObject({ id: app.id, status: 'CANCELED', cancellable: false });
    expect((await request<TourDetail>('/tours/6')).myApplication).toBeNull();
    await expect(
      request(`/me/applications/${app.id}/cancel`, { method: 'POST' }),
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_PROCESSED' });

    const again = await request<MyApplication>('/tours/6/applications', {
      method: 'POST',
      body: motivation,
    });
    expect((await request<TourDetail>('/tours/6')).myApplication).toEqual({
      id: again.id,
      status: 'PENDING',
    });
    await login('guide@demo.kr');
    const board = await request<ApplicantsBoard>('/guide/tours/6/applicants');
    expect(board.applicants.map((a) => a.id)).toEqual([again.id]); // 취소한 신청은 빠진다
  });

  it('탐방 당일 취소는 409 CANCEL_AFTER_TOUR_DATE', async () => {
    await login('seojun@demo.kr');
    await expect(
      request(`/me/applications/${applicationOf('seojun@demo.kr', 1).id}/cancel`, {
        method: 'POST',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CANCEL_AFTER_TOUR_DATE' });
  });

  it('가이드 탐방 목록: 시작 시각 순, 신청 집계와 코스 상태', async () => {
    await login('guide@demo.kr');
    const list = await request<GuideTourSummary[]>('/guide/tours');
    expect(list.map((t) => t.id)).toEqual([7, 1, 6]);
    expect(list[1]).toMatchObject({
      id: 1,
      title: DEMO_TOUR_TITLE,
      counts: { total: 3, pending: 1, approved: 2 },
      courseStatus: null,
    });
  });

  it('학생은 가이드 API 403', async () => {
    await login('student@demo.kr');
    await expect(request('/guide/tours')).rejects.toMatchObject({ status: 403 });
  });

  it('신청자 보드: 신청 순서 · 학년 · 인증, 남의 탐방은 403', async () => {
    await login('guide@demo.kr');
    const board = await request<ApplicantsBoard>('/guide/tours/1/applicants');
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
    await expect(request('/guide/tours/2/applicants')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('가이드 승인 → 보드 갱신', async () => {
    await login('guide@demo.kr');
    const yujin = applicationOf('yujin@demo.kr', 1).id;
    const board = await request<ApplicantsBoard>(`/guide/applications/${yujin}/approve`, {
      method: 'POST',
    });
    expect(board.counts).toEqual({ pending: 0, approved: 3, remaining: 2 });
    expect(board.applicants.find((a) => a.id === yujin)?.status).toBe('APPROVED');
    await expect(
      request(`/guide/applications/${yujin}/approve`, { method: 'POST' }),
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_PROCESSED' });
  });

  it('거절하면 보드에 남고, 그 학생은 다시 신청할 수 없다', async () => {
    await login('guide@demo.kr');
    const yujin = applicationOf('yujin@demo.kr', 1).id;
    const board = await request<ApplicantsBoard>(`/guide/applications/${yujin}/reject`, {
      method: 'POST',
    });
    expect(board.counts).toEqual({ pending: 0, approved: 2, remaining: 3 });
    expect(board.applicants.find((a) => a.id === yujin)?.status).toBe('REJECTED');

    await login('yujin@demo.kr');
    expect((await request<TourDetail>('/tours/1')).myApplication).toEqual({
      id: yujin,
      status: 'REJECTED',
    });
    await expect(
      request('/tours/1/applications', { method: 'POST', body: { motivation: '다시 할게요' } }),
    ).rejects.toMatchObject({ status: 409, code: 'REAPPLY_AFTER_REJECT' });
  });
});

describe('courses', () => {
  it('미확정 코스 조회는 404 COURSE_NOT_READY', async () => {
    await login('seojun@demo.kr');
    await expect(request('/tours/1/course')).rejects.toMatchObject({
      status: 404,
      code: 'COURSE_NOT_READY',
    });
  });

  it('승인된 신청자 · 가이드가 아니면 학생 코스 조회는 403', async () => {
    await login('yujin@demo.kr'); // 대기 중
    await expect(request('/tours/1/course')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('AI 초안 → 순서 변경 → 한줄평 → 지점 삭제 → 확정', async () => {
    await login('guide@demo.kr');
    await expect(request('/guide/tours/1/course')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });

    const draft = await request<Course>('/guide/tours/1/course/draft', { method: 'POST' });
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
      interests: ['전공 수업', '캠퍼스 시설', '식사', '카페'],
      criteria: COURSE_CRITERIA,
      confirmedAt: null,
      issuedCouponCount: 0,
    });
    expect(draft.stops.map((s) => [s.order, s.visitTime, s.type, s.name])).toEqual([
      [1, '14:00', 'CAMPUS', '예술·디자인대학'],
      [2, '15:10', 'STORE', '서천 밥상'],
      [3, '16:00', 'STORE', '카페 모래시계'],
    ]);
    expect(await request<Course>('/guide/tours/1/course')).toEqual(draft);

    const [campus, meal, cafe] = draft.stops;
    const reordered = await request<Course>('/guide/tours/1/course/order', {
      method: 'PUT',
      body: { stopIds: [campus.id, cafe.id, meal.id] },
    });
    expect(reordered.stops.map((s) => [s.id, s.order, s.visitTime])).toEqual([
      [campus.id, 1, '14:00'],
      [cafe.id, 2, '15:10'],
      [meal.id, 3, '16:00'],
    ]);

    const described = await request<Course>(`/guide/tours/1/course/stops/${cafe.id}`, {
      method: 'PATCH',
      body: { description: '  과제하기 좋은 카페  ' },
    });
    expect(described.stops.find((s) => s.id === cafe.id)?.description).toBe('과제하기 좋은 카페');

    const removed = await request<Course>(`/guide/tours/1/course/stops/${campus.id}`, {
      method: 'DELETE',
    });
    expect(removed.stops.map((s) => [s.id, s.order, s.visitTime])).toEqual([
      [cafe.id, 1, '14:00'],
      [meal.id, 2, '15:10'],
    ]);

    const confirmed = await request<Course>('/guide/tours/1/course/confirm', { method: 'POST' });
    expect(confirmed).toMatchObject({
      status: 'CONFIRMED',
      confirmedAt: expect.any(String),
      issuedCouponCount: 4, // 승인 2명 × 제휴 상점 2곳
    });
    await expect(
      request('/guide/tours/1/course/order', {
        method: 'PUT',
        body: { stopIds: [meal.id, cafe.id] },
      }),
    ).rejects.toMatchObject({ status: 409, code: 'COURSE_NOT_DRAFT' });

    await login('seojun@demo.kr');
    expect(await request<Course>('/tours/1/course')).toEqual(confirmed);
  });

  it('코스 규칙 오류를 상태 코드와 코드로 준다', async () => {
    await login('guide@demo.kr');
    await expect(request('/guide/tours/6/course/draft', { method: 'POST' })).rejects.toMatchObject({
      status: 409,
      code: 'NO_APPROVED_APPLICANTS',
    });
    await expect(request('/guide/tours/2/course/draft', { method: 'POST' })).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await expect(request('/guide/tours/2/course')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    await request('/guide/tours/1/course/draft', { method: 'POST' });
    await expect(
      request('/guide/tours/1/course/order', { method: 'PUT', body: { stopIds: [1] } }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });

    await login('seojun@demo.kr');
    await expect(request('/guide/tours/1/course/draft', { method: 'POST' })).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    // 초안이어도 학생에게는 아직 준비 중이다
    await expect(request('/tours/1/course')).rejects.toMatchObject({
      status: 404,
      code: 'COURSE_NOT_READY',
    });
  });

  it('확정 코스 지점: 이름 · 분류 · 제휴 · 리뷰 요약 · 데이터 출처', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const course = await request<Course>('/tours/1/course');
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
    expect(await request<Course>('/tours/1/course')).toEqual(course);
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
    const [, meal, cafe] = (await request<Course>('/guide/tours/1/course')).stops;
    expect(meal).toMatchObject({
      name: '죽전 돼지국밥',
      partnership: null,
      review: { average: null, count: 0, summary: null },
      dataSource: '공공데이터(인허가) 기반',
    });
    expect(cafe).toMatchObject({ name: '카페 모래시계', partnership: null });
  });
});

describe('coupons', () => {
  it('내 쿠폰: id 순서, 신청으로 거르기, 상태는 서버가 계산', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    await login('student@demo.kr');
    const app = applicationOf('student@demo.kr', 1);
    const list = await request<Coupon[]>('/me/coupons');
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
    expect(await request<Coupon[]>(`/me/coupons?applicationId=${app.id}`)).toEqual(list);
    expect(await request<Coupon[]>('/me/coupons?applicationId=999999')).toEqual([]);
    expect(await request<Coupon>(`/me/coupons/${list[1].id}`)).toEqual(list[1]);
    expect((await request<MyApplication>(`/me/applications/${app.id}`)).couponCount).toBe(2);
  });

  it('지난 탐방 쿠폰은 사용 완료 · 리뷰 작성, 남의 쿠폰은 404', async () => {
    await login('seojun@demo.kr');
    const list = await request<Coupon[]>('/me/coupons');
    expect(list.map((c) => [c.tourId, c.storeId, c.state, c.reviewWritten])).toEqual([
      [7, 1, 'USED', true],
      [7, 2, 'USED', true],
    ]);
    const others = getDb().coupons.find(
      (c) => c.applicationId === applicationOf('haeun@demo.kr', 7).id,
    )!;
    await expect(request(`/me/coupons/${others.id}`)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('사장님 쿠폰 조회: 내 가게 쿠폰, 다른 가게 403, 없는 코드 404', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const code = demoCouponCode('student@demo.kr', 1);
    await login('owner1@demo.kr');
    expect(await request<CouponLookup>(`/owner/coupons/${code}`)).toEqual({
      code,
      state: 'USABLE',
      discount: '식사 금액 10% 할인',
      storeName: '서천 밥상',
      tourTitle: DEMO_TOUR_TITLE,
      tourStartsAt: expect.stringMatching(/T14:00:00\+09:00$/),
      studentName: '김민지',
      usedAt: null,
    });
    await expect(
      request(`/owner/coupons/${demoCouponCode('student@demo.kr', 2)}`),
    ).rejects.toMatchObject({ status: 403, code: 'COUPON_OTHER_STORE' });
    await expect(request(`/owner/coupons/${unusedCode()}`)).rejects.toMatchObject({
      status: 404,
      code: 'COUPON_NOT_FOUND',
    });
    await login('student@demo.kr');
    await expect(request(`/owner/coupons/${code}`)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('사장님 쿠폰 사용 · 이미 사용', async () => {
    resetDb({ today: new Date(), checkpoint: 'CONFIRMED' });
    const code = demoCouponCode('student@demo.kr', 1);
    await login('owner1@demo.kr');
    const result = await request<RedeemResult>(`/owner/coupons/${code}/redeem`, {
      method: 'POST',
    });
    expect(result).toMatchObject({
      coupon: { code, state: 'USED', usedAt: expect.any(String) },
      tourVisitorCount: 1,
      totalVisitorCount: 6, // 지난 탐방(7)의 사용 쿠폰 5장 + 1
    });
    await expect(
      request(`/owner/coupons/${code}/redeem`, { method: 'POST' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'COUPON_ALREADY_USED',
      details: { usedAt: result.coupon.usedAt },
    });

    await login('student@demo.kr');
    expect((await request<Coupon[]>('/me/coupons'))[0]).toMatchObject({
      code,
      status: 'USED',
      state: 'USED',
      usedAt: result.coupon.usedAt,
    });
  });
});

describe('demo', () => {
  it('헬스 체크는 목업 모드', async () =>
    expect(await request('/health')).toEqual({ ok: true, mode: 'mock' }));

  it('시연 초기화는 체크포인트를 적용', async () => {
    await login('student@demo.kr');
    expect(await request<Coupon[]>('/me/coupons')).toEqual([]);
    expect(
      await request('/demo/reset', { method: 'POST', body: { checkpoint: 'CONFIRMED' } }),
    ).toEqual({ ok: true });
    // 세션을 새 DB로 옮기므로 같은 토큰으로 계속 부른다
    expect(await request<Coupon[]>('/me/coupons')).toHaveLength(2);
  });

  it('시연 초기화는 올려 둔 목업 파일도 지운다', async () => {
    const ref = putMockFile(testImage());
    await request('/demo/reset', { method: 'POST' });
    expect(getMockFile(ref)).toBeNull();
  });

  it('체크포인트 없이 초기화하면 처음 상태', async () => {
    await login('student@demo.kr');
    await request('/tours/1/applications', { method: 'POST', body: { motivation: '궁금해요' } });
    await request('/demo/reset', { method: 'POST' });
    expect(await request<MyApplication[]>('/me/applications')).toEqual([]);
  });

  it('모르는 체크포인트는 400 VALIDATION이고 DB는 그대로', async () => {
    await login('student@demo.kr');
    await request('/tours/1/applications', { method: 'POST', body: { motivation: '궁금해요' } });
    await expect(
      request('/demo/reset', { method: 'POST', body: { checkpoint: 'DONE' } }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION' });
    expect(await request<MyApplication[]>('/me/applications')).toHaveLength(1);
  });
});

describe('사장님 내 가게 (GET /owner/store)', () => {
  it('사장님: 내 가게 · 제휴, 가게가 없으면 404 STORE_NOT_LINKED, 사장님이 아니면 403', async () => {
    await login('owner1@demo.kr');
    expect(await request<MyStore>('/owner/store')).toMatchObject({
      id: 1,
      name: '서천 밥상',
      partnership: { discount: '식사 금액 10% 할인', state: 'ACTIVE' },
    });

    mutate((db) => {
      db.stores.find((s) => s.id === 1)!.ownerId = null;
    });
    await expect(request('/owner/store')).rejects.toMatchObject({
      status: 404,
      code: 'STORE_NOT_LINKED',
    });

    await login('student@demo.kr');
    await expect(request('/owner/store')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    configureHttp({ getToken: () => null });
    await expect(request('/owner/store')).rejects.toMatchObject({ status: 401 });
  });
});

describe('가입 · 프로필 (POST /auth/signup · PUT /me/student-profile · PUT /me/guide-profile)', () => {
  const signupBody = {
    email: 'Fresh@Demo.kr',
    password: 'demo1234',
    name: '한새봄',
    role: 'HIGH_SCHOOL',
  };

  it('가입은 로그인 없이 201과 토큰 + Me를 주고, 그 토큰으로 /me를 읽는다', async () => {
    const res = await rawFetch('/auth/signup', { method: 'POST', body: signupBody });
    expect(res.status).toBe(201);
    const { token, me } = (await res.json()) as LoginResponse;
    expect(token).toEqual(expect.any(String));
    expect(me).toMatchObject({
      email: 'fresh@demo.kr',
      name: '한새봄',
      role: 'HIGH_SCHOOL',
      verificationStatus: 'NONE',
      guardianStatus: 'NONE',
      studentProfile: { highSchoolName: null, grade: null, interestedMajor: null },
      guideProfile: null,
    });

    configureHttp({ getToken: () => token });
    expect(await request<Me>('/me')).toEqual(me);
  });

  it('가입한 계정으로 같은 자격으로 다시 로그인할 수 있다', async () => {
    await rawFetch('/auth/signup', { method: 'POST', body: signupBody });
    const { me } = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email: 'fresh@demo.kr', password: 'demo1234' },
    });
    expect(me.name).toBe('한새봄');
  });

  it('칸 오류는 400 VALIDATION과 fieldErrors, 중복 이메일은 409 EMAIL_DUPLICATE의 fieldErrors.email', async () => {
    await expect(
      request('/auth/signup', {
        method: 'POST',
        body: { ...signupBody, password: '123' },
        auth: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { password: expect.any(String) },
    });
    await expect(
      request('/auth/signup', {
        method: 'POST',
        body: { ...signupBody, email: 'STUDENT@demo.kr' },
        auth: false,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_DUPLICATE',
      fieldErrors: { email: expect.any(String) },
    });
    // 실패한 가입은 아무것도 남기지 않는다.
    expect(getDb().users.filter((u) => u.email === 'fresh@demo.kr')).toHaveLength(0);
  });

  it('고교생 프로필 저장은 새 Me를 주고 이름도 바뀐다, 고교생이 아니면 403, 로그인 전이면 401', async () => {
    await login('student@demo.kr');
    const me = await request<Me>('/me/student-profile', {
      method: 'PUT',
      body: { name: '김민지2', highSchoolName: '수원고', grade: 3, interestedMajor: null },
    });
    expect(me).toMatchObject({
      name: '김민지2',
      studentProfile: { highSchoolName: '수원고', grade: 3, interestedMajor: null },
    });
    expect(await request<Me>('/me')).toEqual(me);
    await expect(
      request('/me/student-profile', {
        method: 'PUT',
        body: { name: '김민지', highSchoolName: null, grade: 5, interestedMajor: null },
      }),
    ).rejects.toMatchObject({ status: 400, fieldErrors: { grade: expect.any(String) } });

    await login('guide@demo.kr');
    await expect(request('/me/student-profile', { method: 'PUT', body: me })).rejects.toMatchObject(
      { status: 403, code: 'FORBIDDEN' },
    );
    configureHttp({ getToken: () => null });
    await expect(request('/me/student-profile', { method: 'PUT', body: {} })).rejects.toMatchObject(
      {
        status: 401,
      },
    );
  });

  it('가이드 프로필 저장은 새 Me를 주고 학교는 그대로, 가이드가 아니면 403', async () => {
    const before = (await login('guide@demo.kr')).me.guideProfile!;
    const me = await request<Me>('/me/guide-profile', {
      method: 'PUT',
      body: { major: '컴퓨터공학과', introduction: '' },
    });
    expect(me.guideProfile).toEqual({
      universityId: before.universityId,
      major: '컴퓨터공학과',
      introduction: null,
    });
    await expect(
      request('/me/guide-profile', {
        method: 'PUT',
        body: { major: '가'.repeat(31), introduction: null },
      }),
    ).rejects.toMatchObject({ status: 400, fieldErrors: { major: expect.any(String) } });

    await login('student@demo.kr');
    await expect(
      request('/me/guide-profile', { method: 'PUT', body: { major: 'x', introduction: null } }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('P1 목업 도구 (fieldError · readForm · formFile)', () => {
  it('fieldError: 400 VALIDATION에 코드 표 문구와 fieldErrors 본문', async () => {
    server.use(
      http.post(
        '/api/_probe',
        withErrors(async () => {
          throw fieldError('email', '이메일 형식이 맞지 않아요.');
        }),
      ),
    );
    const res = await fetch('/api/_probe', { method: 'POST' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: 'VALIDATION',
      message: '입력값을 다시 확인해 주세요.',
      fieldErrors: { email: '이메일 형식이 맞지 않아요.' },
    });
    await expect(request('/_probe', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      fieldErrors: { email: '이메일 형식이 맞지 않아요.' },
    });
  });

  it('fieldError: 문구를 생략하면 기본 문구, 코드와 상태를 바꿀 수 있다', async () => {
    server.use(
      http.post(
        '/api/_probe',
        withErrors(async () => {
          throw fieldError('email');
        }),
      ),
      http.put(
        '/api/_probe',
        withErrors(async () => {
          throw fieldError('email', '이미 가입된 이메일이에요.', 'EMAIL_DUPLICATE', 409);
        }),
      ),
    );
    await expect(request('/_probe', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { email: '입력값을 확인해 주세요.' },
    });
    await expect(request('/_probe', { method: 'PUT' })).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_DUPLICATE',
      message: '이미 가입된 이메일이에요.',
      fieldErrors: { email: '이미 가입된 이메일이에요.' },
    });
  });

  it('fieldErrors가 없는 MockApiError의 본문에는 fieldErrors가 없다', async () => {
    server.use(
      http.post(
        '/api/_probe',
        withErrors(async () => {
          throw new MockApiError(404, 'NOT_FOUND');
        }),
      ),
    );
    const res = await fetch('/api/_probe', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(await res.json()).not.toHaveProperty('fieldErrors');
  });

  describe('multipart', () => {
    function useUploadProbe() {
      server.use(
        http.post(
          '/api/_upload',
          withErrors(async ({ request: req }) => {
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
