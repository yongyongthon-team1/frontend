import { describe, expect, it } from 'vitest';
import { computeCouponState } from '@/features/coupons/model';
import { getLandingPath } from '@/features/auth/landing';
import { toMe } from '@/mocks/rules/views';
import {
  DEMO_BUSINESS,
  DEMO_CONSENT_TOKENS,
  DEMO_EMAILS,
  DEMO_MOTIVATION,
  DEMO_P1_ACCOUNTS,
  DEMO_STORE_OWNERS,
} from '@/shared/config/demoAccounts';
import { distanceMeters } from './geo';
import { MOCK_DOC_SAMPLE } from './files';
import { createSeed, DEMO_TOUR_ID, DEMO_UNIVERSITY_ID } from './seed';
import { MOCK_DB_VERSION } from './schema';
import type { DB } from './schema';

const today = new Date('2026-11-15T01:00:00Z'); // KST 10:00

function maxId(db: DB): number {
  const ids = [
    ...db.users,
    ...db.studentProfiles,
    ...db.guideProfiles,
    ...db.verifications,
    ...db.guardianConsents,
    ...db.businessVerifications,
    ...db.universities,
    ...db.vacations,
    ...db.tours,
    ...db.applications,
    ...db.courseStops,
    ...db.stores,
    ...db.partnerships,
    ...db.coupons,
    ...db.reviews,
    ...db.reviewSummaries,
    ...db.tourWishes,
  ].map((r) => r.id);
  return Math.max(...ids, ...db.campusPlaces.map((p) => p.campusBuildingId));
}

describe('createSeed', () => {
  it('희망 사항 4행(김민지는 없다) · DB 버전 4', () => {
    const db = createSeed(today);
    expect(db.version).toBe(4);
    expect(MOCK_DB_VERSION).toBe(4);
    const emailOf = (userId: number) => db.users.find((u) => u.id === userId)?.email;
    expect(
      db.tourWishes.map((w) => [
        w.id,
        emailOf(w.userId),
        w.universityId,
        w.major,
        w.content,
        w.preferredDate,
        w.createdAt,
      ]),
    ).toEqual([
      [
        1,
        'haeun@demo.kr',
        2,
        '시각디자인',
        '디자인 작업실에서 선배들이 과제하는 모습을 보고, 학생 식당도 가 보고 싶어요.',
        null,
        '2026-11-12T19:20:00+09:00',
      ],
      [
        2,
        'past1@demo.kr',
        2,
        '산업디자인',
        '제품 디자인 수업에서 무엇을 만드는지 궁금해요.\n실기 준비 이야기도 듣고 싶어요.',
        null,
        '2026-11-09T21:05:00+09:00',
      ],
      [
        3,
        'seojun@demo.kr',
        4,
        '컴퓨터공학',
        '코딩 동아리가 어떤 프로젝트를 하는지 보고 싶어요.',
        '2026-12-30',
        '2026-11-11T20:10:00+09:00',
      ],
      [
        4,
        'yujin@demo.kr',
        5,
        '통번역',
        '통역 실습실을 구경하고 선배에게 어학 공부법을 묻고 싶어요.',
        null,
        '2026-11-13T18:40:00+09:00',
      ],
    ]);
    expect(db.tourWishes.every((w) => w.updatedAt === w.createdAt)).toBe(true);
  });

  it('대학 5곳', () =>
    expect(createSeed(today).universities.map((u) => u.name)).toEqual([
      '강남대학교',
      '경희대학교',
      '단국대학교',
      '명지대학교',
      '한국외국어대학교',
    ]));

  it('시연 탐방은 오늘 14:00 · 모집 중 · 승인 2명', () => {
    const db = createSeed(today);
    const t = db.tours.find((x) => x.id === DEMO_TOUR_ID)!;
    expect([t.startsAt, t.endsAt, t.status]).toEqual([
      '2026-11-15T14:00:00+09:00',
      '2026-11-15T16:30:00+09:00',
      'RECRUITING',
    ]);
    expect(t.universityId).toBe(DEMO_UNIVERSITY_ID);
    expect(db.applications.filter((a) => a.tourId === 1 && a.status === 'APPROVED')).toHaveLength(
      2,
    );
    expect(db.applications.filter((a) => a.tourId === 1 && a.status === 'PENDING')).toHaveLength(1);
  });

  it('탐방 7개: 상태와 날짜가 오늘 기준 상대값', () => {
    const db = createSeed(today);
    expect(db.tours.map((t) => [t.id, t.status, t.startsAt.slice(0, 10)])).toEqual([
      [1, 'RECRUITING', '2026-11-15'],
      [2, 'CLOSED', '2026-12-25'],
      [3, 'RECRUITING', '2026-12-30'],
      [4, 'RECRUITING', '2027-01-01'],
      [5, 'RECRUITING', '2027-01-06'],
      [6, 'RECRUITING', '2027-01-14'],
      [7, 'COMPLETED', '2026-10-16'],
    ]);
  });

  it('탐방 소개는 시연 탐방만 브리프 문구이고 6번은 디자인 얘기가 없다', () => {
    const db = createSeed(today);
    const intros = db.tours.map((t) => t.introduction);
    expect(intros[0]).toBe(
      '산업디자인 작업실과 수업 이야기\n학생들이 자주 가는 대학가 식당과 카페까지 함께 둘러봐요.',
    );
    expect(intros[5]).toBe('겨울방학 캠퍼스 생활과 동아리 이야기를 나눠요.');
    expect(new Set(intros).size).toBe(intros.length);
  });

  it('다른 날로 시드하면 날짜가 따라간다', () => {
    const db = createSeed(new Date('2026-12-01T03:00:00Z'));
    expect(db.seedDay).toBe('2026-12-01');
    expect(db.tours[0].startsAt).toBe('2026-12-01T14:00:00+09:00');
  });

  it('경희대 1km 안의 식사·카페 상점은 모두 오늘 유효한 제휴이고 사장님이 있다', () => {
    const db = createSeed(today);
    const khu = db.universities.find((u) => u.id === DEMO_UNIVERSITY_ID)!;
    const center = { lat: khu.latitude, lng: khu.longitude };
    const near = db.stores.filter(
      (s) => distanceMeters(center, { lat: s.latitude, lng: s.longitude }) < 1000,
    );
    expect(near.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    for (const s of near) {
      const p = db.partnerships.filter((x) => x.storeId === s.id);
      expect(p).toHaveLength(1);
      expect(p[0].startDate <= '2026-11-15' && '2026-11-15' <= p[0].endDate).toBe(true);
      expect(s.ownerId).not.toBeNull();
    }
    expect(db.stores.map((s) => s.category).slice(0, 4)).toEqual([
      '한식',
      '카페',
      '분식',
      '보드게임카페',
    ]);
  });

  it('서천 밥상이 가장 가까운 식당, 카페 모래시계가 가장 가까운 카페', () => {
    const db = createSeed(today);
    const khu = db.universities.find((u) => u.id === DEMO_UNIVERSITY_ID)!;
    const d = (id: number) => {
      const s = db.stores.find((x) => x.id === id)!;
      return distanceMeters(
        { lat: khu.latitude, lng: khu.longitude },
        { lat: s.latitude, lng: s.longitude },
      );
    };
    const meals = db.stores.filter((s) => ['한식', '분식'].includes(s.category));
    const cafes = db.stores.filter((s) => s.category === '카페');
    const nearest = (rows: typeof meals) => rows.reduce((a, b) => (d(a.id) <= d(b.id) ? a : b)).id;
    expect(db.stores[0].name).toBe('서천 밥상');
    expect(nearest(meals)).toBe(1);
    expect(db.stores[1].name).toBe('카페 모래시계');
    expect(nearest(cafes)).toBe(2);
  });

  it('경희대 중심과 예술·디자인대학 모두에서 서천 밥상이 가장 가까운 식당, 카페 모래시계가 가장 가까운 카페', () => {
    const db = createSeed(today);
    const khu = db.universities.find((u) => u.id === DEMO_UNIVERSITY_ID)!;
    const design = db.campusPlaces.find(
      (p) => p.universityId === DEMO_UNIVERSITY_ID && p.name === '예술·디자인대학',
    )!;
    for (const origin of [
      { lat: khu.latitude, lng: khu.longitude },
      { lat: design.latitude, lng: design.longitude },
    ]) {
      const distance = (id: number) => {
        const s = db.stores.find((x) => x.id === id)!;
        return distanceMeters(origin, { lat: s.latitude, lng: s.longitude });
      };
      const nearest = (categories: string[]) =>
        db.stores
          .filter((s) => categories.includes(s.category))
          .sort((a, b) => distance(a.id) - distance(b.id))[0].name;
      expect(nearest(['한식', '분식'])).toBe('서천 밥상');
      expect(nearest(['카페'])).toBe('카페 모래시계');
    }
  });

  it('경희대 밖 비제휴 상점 2곳은 단국대 근처다', () => {
    const db = createSeed(today);
    const khu = db.universities[1];
    const dku = db.universities[2];
    const far = db.stores.filter((s) => s.id > 4);
    expect(far).toHaveLength(2);
    expect(far.map((s) => s.category)).toEqual(['한식', '카페']);
    for (const s of far) {
      expect(db.partnerships.some((p) => p.storeId === s.id)).toBe(false);
      expect(s.ownerId).toBeNull();
      const p = { lat: s.latitude, lng: s.longitude };
      expect(distanceMeters({ lat: khu.latitude, lng: khu.longitude }, p)).toBeGreaterThan(1000);
      expect(distanceMeters({ lat: dku.latitude, lng: dku.longitude }, p)).toBeLessThan(1000);
    }
  });

  it('시연 계정이 모두 있다', () => {
    const db = createSeed(today);
    for (const email of Object.values(DEMO_EMAILS)) {
      expect(db.users.some((u) => u.email === email)).toBe(true);
    }
    for (const [storeId, email] of Object.entries(DEMO_STORE_OWNERS)) {
      const owner = db.users.find((u) => u.email === email)!;
      expect(db.stores.find((s) => s.id === Number(storeId))!.ownerId).toBe(owner.id);
    }
    expect(db.users.every((u) => u.password === 'demo1234')).toBe(true);
  });

  it('사용자 id는 순서대로 1부터 이어진다', () => {
    const db = createSeed(today);
    expect(db.users.map((u) => u.id)).toEqual(db.users.map((_, i) => i + 1));
    expect(db.users[0].email).toBe('student@demo.kr');
    expect(db.users[2].email).toBe('seojun@demo.kr');
    expect(db.users.find((u) => u.email === 'guide@demo.kr')!.name).toBe('정다은');
  });

  it('프로필 · 인증 · 동의의 id는 사용자 id와 같다', () => {
    const db = createSeed(today);
    const role = (id: number) => db.users.find((u) => u.id === id)?.role;
    expect(db.studentProfiles.map((p) => role(p.id))).toEqual(Array(11).fill('HIGH_SCHOOL'));
    expect(db.guideProfiles.map((p) => role(p.id))).toEqual(Array(7).fill('UNIVERSITY'));
    expect(db.businessVerifications.map((p) => role(p.id))).toEqual(Array(5).fill('OWNER'));
    expect(db.verifications.every((v) => role(v.id) !== undefined)).toBe(true);
    expect(
      db.verifications
        .map((v) => v.reviewedBy)
        .filter((x) => x !== null)
        .every((id) => role(id!) === 'ADMIN'),
    ).toBe(true);
  });

  it('고교생 인증 · 보호자 동의 상태', () => {
    const db = createSeed(today);
    const id = (email: string) => db.users.find((u) => u.email === email)!.id;
    expect(db.verifications.find((v) => v.id === id('student@demo.kr'))!.status).toBe('APPROVED');
    expect(db.verifications.find((v) => v.id === id('pending@demo.kr'))!.status).toBe('PENDING');
    expect(db.verifications.some((v) => v.id === id('newbie@demo.kr'))).toBe(false);
    expect(db.guardianConsents.find((c) => c.id === id('student@demo.kr'))!.status).toBe('AGREED');
    expect(db.guardianConsents.some((c) => c.id === id('newbie@demo.kr'))).toBe(false);
    expect(db.businessVerifications.every((b) => b.isVerified)).toBe(true);
    expect(db.businessVerifications).toHaveLength(5);
  });

  it('가이드 학과: 탐방 제목의 근거', () => {
    const db = createSeed(today);
    const majorOf = (tourId: number) =>
      db.guideProfiles.find((g) => g.id === db.tours.find((t) => t.id === tourId)!.guideId)!.major;
    expect([1, 2, 3, 4, 5, 6, 7].map(majorOf)).toEqual([
      '산업디자인학과',
      '커뮤니케이션디자인학과',
      '컴퓨터공학과',
      '통번역학과',
      '사회복지학부',
      '산업디자인학과',
      '산업디자인학과',
    ]);
  });

  it('탐방 2는 승인 3명으로 마감', () => {
    const db = createSeed(today);
    const approved = db.applications.filter((a) => a.tourId === 2 && a.status === 'APPROVED');
    expect(approved).toHaveLength(db.tours[1].capacity);
  });

  it('김민지에겐 신청도 쿠폰도 없다', () => {
    const db = createSeed(today);
    const minji = db.users.find((u) => u.email === DEMO_EMAILS.student)!;
    const apps = db.applications.filter((a) => a.userId === minji.id);
    expect(apps).toEqual([]);
    expect(db.reviews.filter((r) => r.userId === minji.id)).toEqual([]);
  });

  it('리뷰: 상점 1은 평균 4.6, 상점 2는 평균 4.4, 상점 3·4는 0개', () => {
    const db = createSeed(today);
    const ratings = (storeId: number) =>
      db.reviews.filter((r) => r.storeId === storeId).map((r) => r.rating);
    expect(ratings(1)).toEqual([5, 5, 4, 5, 4]);
    expect(ratings(2)).toEqual([5, 4, 4, 5, 4]);
    expect(ratings(3)).toEqual([]);
    expect(ratings(4)).toEqual([]);
    expect(db.reviewSummaries.map((s) => [s.storeId, s.reviewCount])).toEqual([
      [1, 5],
      [2, 5],
    ]);
    expect(db.reviewSummaries[0].summary).toBe(
      '학생들은 양이 넉넉하고 사장님이 친절하다고 해요. 시험 기간엔 줄이 길다는 평이 있어요.',
    );
    expect(db.reviewSummaries[1].summary).toBe(
      '콘센트 자리가 많아 과제하기 좋다는 평이 많아요. 디저트는 일찍 떨어진대요.',
    );
  });

  it('리뷰는 탐방 7의 승인 신청 · 사용 쿠폰에 묶이고 (작성자, 탐방, 상점)은 겹치지 않는다', () => {
    const db = createSeed(today);
    const keys = db.reviews.map((r) => `${r.userId}/${r.tourId}/${r.storeId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(db.reviews.map((r) => r.couponId)).size).toBe(db.reviews.length);
    for (const r of db.reviews) {
      expect(r.tourId).toBe(7);
      const coupon = db.coupons.find((c) => c.id === r.couponId)!;
      const app = db.applications.find((a) => a.id === coupon.applicationId)!;
      expect([coupon.status, coupon.storeId, app.userId, app.tourId, app.status]).toEqual([
        'USED',
        r.storeId,
        r.userId,
        7,
        'APPROVED',
      ]);
      expect(coupon.usedAt!.startsWith('2026-10-16')).toBe(true);
    }
  });

  it('쿠폰 코드는 6자리이고 겹치지 않는다', () => {
    const db = createSeed(today);
    const codes = db.coupons.map((c) => c.code);
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(codes).not.toContain('000000');
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('신청은 (탐방, 사용자)가 겹치지 않고 activeUserId가 상태와 맞다', () => {
    const db = createSeed(today);
    const keys = db.applications.map((a) => `${a.tourId}/${a.userId}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of db.applications) {
      const active = a.status === 'PENDING' || a.status === 'APPROVED';
      expect(a.activeUserId).toBe(active ? a.userId : null);
    }
  });

  it('같은 날이면 항상 같은 DB가 나온다', () => {
    expect(createSeed(today)).toEqual(createSeed(new Date('2026-11-15T05:30:00Z')));
  });

  it('nextId는 시드된 모든 id보다 크다', () => {
    const db = createSeed(today);
    expect(db.nextId).toBeGreaterThan(maxId(db));
    expect(db.sessions).toEqual([]);
  });

  it('제휴 문구와 기간', () => {
    const db = createSeed(today);
    expect(db.partnerships.map((p) => p.discountDescription)).toEqual([
      '식사 금액 10% 할인',
      '음료 1,000원 할인',
      '떡볶이 세트 1,500원 할인',
      '1시간 무료 연장',
    ]);
    expect(
      db.partnerships.every((p) => p.startDate === '2026-10-16' && p.endDate === '2027-02-13'),
    ).toBe(true);
  });

  it('방학은 대학마다 겨울 · 여름', () => {
    const db = createSeed(today);
    expect(db.vacations).toHaveLength(10);
    const v = db.vacations.filter((x) => x.universityId === 2);
    expect(v.map((x) => [x.startDate, x.endDate])).toEqual([
      ['2026-12-21', '2027-02-28'],
      ['2027-06-21', '2027-08-31'],
    ]);
  });

  it('캠퍼스 장소: 대학마다 2~3곳, 경희대는 3곳', () => {
    const db = createSeed(today);
    for (const u of db.universities) {
      const n = db.campusPlaces.filter((p) => p.universityId === u.id).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
    expect(db.campusPlaces.filter((p) => p.universityId === 2).map((p) => p.name)).toEqual([
      '예술·디자인대학',
      '중앙도서관',
      '학생회관',
    ]);
  });
});

describe('P1 상태 계정(시드 v3)', () => {
  const db = createSeed(today);
  const user = (email: string) => db.users.find((u) => u.email === email)!;
  const verificationOf = (email: string) => db.verifications.find((v) => v.id === user(email).id);
  const consentOf = (email: string) => db.guardianConsents.find((c) => c.id === user(email).id);
  const landing = (email: string) => getLandingPath(toMe(db, user(email).id, today));
  const stamp = (key: string, hhmm: string) => `${key}T${hhmm}:00+09:00`;

  it('운영자(18) 뒤에 새 계정 8명이 이 순서로 이어진다', () => {
    expect(db.users[17].email).toBe('admin@demo.kr');
    expect(db.users.slice(18).map((u) => [u.id, u.email, u.name, u.role])).toEqual([
      [19, 'rejected@demo.kr', '윤서아', 'HIGH_SCHOOL'],
      [20, 'waiting@demo.kr', '강하린', 'HIGH_SCHOOL'],
      [21, 'expired@demo.kr', '임채원', 'HIGH_SCHOOL'],
      [22, 'guide-new@demo.kr', '윤가온', 'UNIVERSITY'],
      [23, 'guide-pending@demo.kr', '한도윤', 'UNIVERSITY'],
      [24, 'guide-rejected@demo.kr', '서지안', 'UNIVERSITY'],
      [25, 'owner-new@demo.kr', '정해린', 'OWNER'],
      [26, 'owner-nostore@demo.kr', '윤가람', 'OWNER'],
    ]);
  });

  it('윤서아: 반려 · 동의 거부 · 첫 화면 /verify', () => {
    expect(verificationOf('rejected@demo.kr')).toMatchObject({
      status: 'REJECTED',
      rejectionReason: '학생증 사진이 흐려서 학교 이름을 읽을 수 없어요.',
      submittedAt: stamp('2026-11-12', '20:00'),
      reviewedAt: stamp('2026-11-13', '10:00'),
      documentUrl: null,
    });
    expect(consentOf('rejected@demo.kr')).toMatchObject({
      status: 'REJECTED',
      tokenHash: DEMO_CONSENT_TOKENS.rejected,
      guardianName: '윤서아 보호자',
      guardianEmail: 'guardian-19@demo.kr',
    });
    expect(db.studentProfiles.find((p) => p.id === 19)).toMatchObject({
      highSchoolName: '수원영통고등학교',
      grade: 2,
      interestedMajor: '시각디자인',
    });
    expect(landing('rejected@demo.kr')).toBe('/verify');
  });

  it('강하린: 심사 중 · 동의 대기(요청 어제 22:45, 만료 +7일) · 첫 화면 /', () => {
    expect(verificationOf('waiting@demo.kr')).toMatchObject({
      status: 'PENDING',
      documentUrl: MOCK_DOC_SAMPLE.HIGH_SCHOOL,
      submittedAt: stamp('2026-11-14', '22:40'),
    });
    expect(consentOf('waiting@demo.kr')).toMatchObject({
      status: 'PENDING',
      tokenHash: DEMO_CONSENT_TOKENS.valid,
      createdAt: stamp('2026-11-14', '22:45'),
      expiresAt: stamp('2026-11-21', '22:45'),
      guardianName: '강하린 보호자',
      guardianEmail: 'guardian-20@demo.kr',
    });
    expect(db.studentProfiles.find((p) => p.id === 20)).toMatchObject({
      highSchoolName: '수원영통고등학교',
      grade: 2,
      interestedMajor: '경영학',
    });
    expect(toMe(db, 20, today).guardianStatus).toBe('PENDING');
    expect(landing('waiting@demo.kr')).toBe('/');
  });

  it('임채원: 재학 승인 · 동의 링크 만료 · 첫 화면 /verify', () => {
    expect(verificationOf('expired@demo.kr')).toMatchObject({
      status: 'APPROVED',
      reviewedAt: stamp('2026-11-06', '09:00'),
    });
    expect(consentOf('expired@demo.kr')).toMatchObject({
      status: 'PENDING',
      tokenHash: DEMO_CONSENT_TOKENS.expired,
      expiresAt: stamp('2026-11-14', '09:00'),
      guardianName: '임채원 보호자',
      guardianEmail: 'guardian-21@demo.kr',
    });
    expect(db.studentProfiles.find((p) => p.id === 21)).toMatchObject({
      highSchoolName: '용인홍천고등학교',
      grade: 3,
      interestedMajor: '통번역',
    });
    expect(toMe(db, 21, today).guardianStatus).toBe('EXPIRED');
    expect(landing('expired@demo.kr')).toBe('/verify');
  });

  it('오지호: 사진 · 제출 어제 21:30 · 동의 완료 토큰', () => {
    expect(verificationOf('pending@demo.kr')).toMatchObject({
      status: 'PENDING',
      documentUrl: MOCK_DOC_SAMPLE.HIGH_SCHOOL,
      submittedAt: stamp('2026-11-14', '21:30'),
    });
    expect(consentOf('pending@demo.kr')).toMatchObject({
      status: 'AGREED',
      tokenHash: DEMO_CONSENT_TOKENS.agreed,
    });
  });

  it('동의 토큰은 네 개이고 서로 다르다. 기존 동의 완료 행은 토큰이 없다', () => {
    expect(DEMO_CONSENT_TOKENS).toEqual({
      valid: 'demo-consent-valid',
      expired: 'demo-consent-expired',
      rejected: 'demo-consent-rejected',
      agreed: 'demo-consent-agreed',
    });
    const tokens = db.guardianConsents.map((c) => c.tokenHash).filter((t) => t !== null);
    expect([...tokens].sort()).toEqual(Object.values(DEMO_CONSENT_TOKENS).sort());
    expect(consentOf('student@demo.kr')!.tokenHash).toBeNull();
  });

  it('윤가온: 인증 기록도 프로필도 없다 · /guide/verify', () => {
    expect(verificationOf('guide-new@demo.kr')).toBeUndefined();
    expect(db.guideProfiles.some((p) => p.id === 22)).toBe(false);
    expect(landing('guide-new@demo.kr')).toBe('/guide/verify');
  });

  it('한도윤: 심사 중 · 단국대 · 프로필 학과 없음 · /guide/me/profile', () => {
    expect(verificationOf('guide-pending@demo.kr')).toMatchObject({
      status: 'PENDING',
      universityId: 3,
      highSchoolName: null,
      documentUrl: MOCK_DOC_SAMPLE.UNIVERSITY,
      submittedAt: stamp('2026-11-14', '18:05'),
    });
    expect(db.guideProfiles.find((p) => p.id === 23)).toMatchObject({
      universityId: 3,
      major: null,
      introduction: null,
    });
    expect(landing('guide-pending@demo.kr')).toBe('/guide/me/profile');
  });

  it('서지안: 반려 · 명지대 · 프로필 있음 · /guide/verify', () => {
    expect(verificationOf('guide-rejected@demo.kr')).toMatchObject({
      status: 'REJECTED',
      universityId: 4,
      rejectionReason:
        '학생증 사진이 흐려 학교 이름을 확인할 수 없어요. 밝은 곳에서 다시 찍어 올려 주세요.',
      documentUrl: null,
      reviewedAt: stamp('2026-11-14', '16:00'),
    });
    expect(db.guideProfiles.find((p) => p.id === 24)).toMatchObject({
      universityId: 4,
      major: '기계공학과',
      introduction: '기계공학과 실험 수업과 동아리 생활을 편하게 이야기해 드릴게요.',
    });
    expect(landing('guide-rejected@demo.kr')).toBe('/guide/verify');
  });

  it('사장님 둘: 사업자 인증 전 · 가게 연결 전', () => {
    expect(db.businessVerifications.some((b) => b.id === 25)).toBe(false);
    expect(db.stores.some((s) => s.ownerId === 25)).toBe(false);
    expect(landing('owner-new@demo.kr')).toBe('/owner/verify');
    expect(db.businessVerifications.find((b) => b.id === 26)).toMatchObject({
      isVerified: true,
      verifiedAt: stamp('2026-11-14', '09:00'),
    });
    expect(db.stores.some((s) => s.ownerId === 26)).toBe(false);
    expect(landing('owner-nostore@demo.kr')).toBe('/owner/store/connect');
  });

  it('기존 계정의 첫 화면은 그대로다', () => {
    expect(landing('student@demo.kr')).toBe('/');
    expect(landing('newbie@demo.kr')).toBe('/verify');
    expect(landing('guide@demo.kr')).toBe('/guide');
    expect(landing('owner1@demo.kr')).toBe('/owner/store');
    expect(landing('admin@demo.kr')).toBe('/admin/verifications');
  });

  it('운영자 대기열(START): 한도윤 → 오지호 → 강하린 (제출 오래된 순)', () => {
    const queue = db.verifications
      .filter((v) => v.status === 'PENDING')
      .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt))
      .map((v) => db.users.find((u) => u.id === v.id)!.name);
    expect(queue).toEqual(['한도윤', '오지호', '강하린']);
  });

  it('처리 내역: 서지안 → 윤서아 → 임채원 → 기존 승인 11건(모두 임채원보다 먼저 처리됨)', () => {
    const processed = db.verifications
      .filter((v) => v.reviewedAt !== null)
      .sort((a, b) => Date.parse(b.reviewedAt!) - Date.parse(a.reviewedAt!));
    const names = processed.map((v) => db.users.find((u) => u.id === v.id)!.name);
    expect(names.slice(0, 3)).toEqual(['서지안', '윤서아', '임채원']);
    expect(processed).toHaveLength(14);
    const stamps = processed.map((v) => Date.parse(v.reviewedAt!));
    expect(new Set(stamps.slice(0, 3)).size).toBe(3);
    const existing = processed.slice(3);
    expect(existing.every((v) => v.status === 'APPROVED')).toBe(true);
    for (const v of existing) expect(Date.parse(v.reviewedAt!)).toBeLessThan(stamps[2]);
  });

  it('DEMO_P1_ACCOUNTS: 열 개, 이메일이 모두 시드에 있다', () => {
    expect(DEMO_P1_ACCOUNTS.map((a) => a.email)).toEqual([
      'newbie@demo.kr',
      'waiting@demo.kr',
      'rejected@demo.kr',
      'expired@demo.kr',
      'pending@demo.kr',
      'guide-new@demo.kr',
      'guide-pending@demo.kr',
      'guide-rejected@demo.kr',
      'owner-new@demo.kr',
      'owner-nostore@demo.kr',
    ]);
    for (const a of DEMO_P1_ACCOUNTS) {
      expect(db.users.some((u) => u.email === a.email)).toBe(true);
      expect(a.label.length).toBeGreaterThan(0);
    }
    expect(DEMO_EMAILS).toMatchObject({
      unverifiedGuide: 'guide-new@demo.kr',
      ownerUnverified: 'owner-new@demo.kr',
      ownerNoStore: 'owner-nostore@demo.kr',
    });
  });

  it('DEMO_BUSINESS: 세 항목 모두 번호 · 대표자명 · 개업일을 갖는다', () => {
    expect(DEMO_BUSINESS.match).toEqual({
      businessNumber: '123-45-67890',
      representativeName: '정해린',
      openingDate: '2021-03-02',
    });
    expect(DEMO_BUSINESS.mismatch.businessNumber).toBe('111-11-11111');
    expect(DEMO_BUSINESS.closed.businessNumber).toBe('999-99-99999');
    for (const entry of Object.values(DEMO_BUSINESS)) {
      expect(entry.representativeName.length).toBeGreaterThan(0);
      expect(entry.openingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // 불일치: 번호는 알려져 있지만 대표자명 또는 개업일이 일치 항목과 다르다.
    expect(
      DEMO_BUSINESS.mismatch.representativeName !== DEMO_BUSINESS.match.representativeName ||
        DEMO_BUSINESS.mismatch.openingDate !== DEMO_BUSINESS.match.openingDate,
    ).toBe(true);
  });

  it('후보 상점 5 · 6은 주인이 없는 일반 상점이다', () => {
    expect(db.stores.filter((s) => s.id >= 5).map((s) => [s.id, s.ownerId])).toEqual([
      [5, null],
      [6, null],
    ]);
  });

  it('견본 학생증 경로', () => {
    expect(MOCK_DOC_SAMPLE).toEqual({
      HIGH_SCHOOL: '/mock-docs/student-id-hs.svg',
      UNIVERSITY: '/mock-docs/student-id-univ.svg',
    });
  });

  it('탐방 · 제휴의 새 칸: title · condition은 null, 제휴 1~4만 사용 조건', () => {
    expect(db.tours.every((t) => t.title === null)).toBe(true);
    expect(db.partnerships.map((p) => p.condition)).toEqual(
      Array(4).fill('탐방 당일 · 1회 사용 가능'),
    );
  });
});

describe('체크포인트 시드', () => {
  const AT = '2026-11-15T10:00:00+09:00'; // 시드 날 10:00(KST)에 규칙 함수로 만든다
  const userId = (db: DB, email: string) => db.users.find((u) => u.email === email)!.id;
  const minjiApp = (db: DB) =>
    db.applications.find(
      (a) => a.tourId === DEMO_TOUR_ID && a.userId === userId(db, DEMO_EMAILS.student),
    );
  const approvedOf = (db: DB) =>
    db.applications.filter((a) => a.tourId === DEMO_TOUR_ID && a.status === 'APPROVED');

  it('START는 체크포인트를 주지 않은 시드와 같다', () =>
    expect(createSeed(today, 'START')).toEqual(createSeed(today)));

  it('APPLIED: 김민지가 시연 동기로 탐방 1에 신청(승인 대기)', () => {
    const db = createSeed(today, 'APPLIED');
    const minji = userId(db, DEMO_EMAILS.student);
    expect(minjiApp(db)).toEqual({
      id: 1000,
      tourId: DEMO_TOUR_ID,
      userId: minji,
      motivation: DEMO_MOTIVATION,
      status: 'PENDING',
      activeUserId: minji,
      createdAt: AT,
      updatedAt: AT,
    });
    expect(approvedOf(db)).toHaveLength(2);
    expect([db.courses, db.courseStops, db.nextId]).toEqual([[], [], 1001]);
  });

  it('APPROVED: + 정다은이 승인 → 승인 3명(박서준 · 이하은 · 김민지), 코스 · 새 쿠폰 없음', () => {
    const db = createSeed(today, 'APPROVED');
    expect(minjiApp(db)).toMatchObject({ status: 'APPROVED', updatedAt: AT });
    expect(approvedOf(db).map((a) => db.users.find((u) => u.id === a.userId)!.name)).toEqual([
      '박서준',
      '이하은',
      '김민지',
    ]);
    expect(db.tours[0].status).toBe('RECRUITING');
    expect([db.courses, db.courseStops]).toEqual([[], []]);
    expect(db.coupons.filter((c) => c.applicationId === minjiApp(db)!.id)).toEqual([]);
  });

  it('CONFIRMED: + 초안 생성 · 확정 → 캠퍼스 → 서천 밥상 → 카페 모래시계, 승인 3명 × 제휴 2곳 = 쿠폰 6장', () => {
    const db = createSeed(today, 'CONFIRMED');
    expect(db.courses).toEqual([
      {
        tourId: DEMO_TOUR_ID,
        status: 'CONFIRMED',
        createdAt: AT,
        updatedAt: AT,
        confirmedAt: AT,
        interests: ['전공 수업', '캠퍼스 시설', '식사', '카페'],
      },
    ]);
    const stops = [...db.courseStops].sort((a, b) => a.stopOrder - b.stopOrder);
    expect(stops.map((s) => [s.id, s.stopOrder, s.visitTime, s.storeId, s.partnershipId])).toEqual([
      [1001, 1, '14:00', null, null],
      [1002, 2, '15:10', 1, 1],
      [1003, 3, '16:00', 2, 2],
    ]);
    const approvedIds = approvedOf(db).map((a) => a.id);
    const issued = db.coupons.filter((c) => approvedIds.includes(c.applicationId));
    expect(issued.map((c) => c.id)).toEqual([1004, 1005, 1006, 1007, 1008, 1009]);
    expect(db.nextId).toBe(1010);
  });

  it('CONFIRMED 체크포인트: 김민지 쿠폰 2장, 오늘 사용 가능', () => {
    const db = createSeed(today, 'CONFIRMED');
    const coupons = db.coupons.filter((c) => c.applicationId === minjiApp(db)!.id);
    expect(coupons.map((c) => [c.storeId, c.status, c.discountSnapshot])).toEqual([
      [1, 'ISSUED', '식사 금액 10% 할인'],
      [2, 'ISSUED', '음료 1,000원 할인'],
    ]);
    const tourStartsAt = db.tours[0].startsAt;
    for (const c of coupons) {
      expect(c).toMatchObject({ issuedAt: AT, expiresAt: '2026-11-15T23:59:59+09:00' });
      expect(c.code).toMatch(/^\d{6}$/);
      const { status, expiresAt } = c;
      expect(computeCouponState({ status, tourStartsAt, expiresAt }, today)).toBe('USABLE');
    }
  });

  it('체크포인트도 시드 날짜를 따른다', () => {
    const db = createSeed(new Date('2026-12-01T03:00:00Z'), 'CONFIRMED');
    expect(minjiApp(db)!.createdAt).toBe('2026-12-01T10:00:00+09:00');
    expect(db.courses[0].confirmedAt).toBe('2026-12-01T10:00:00+09:00');
  });

  it('같은 날 같은 체크포인트면 쿠폰 코드 말고는 같은 DB', () => {
    const withoutCodes = (db: DB) => ({
      ...db,
      coupons: db.coupons.map((c) => ({ ...c, code: '' })),
    });
    for (const checkpoint of ['APPLIED', 'APPROVED', 'CONFIRMED'] as const) {
      expect(withoutCodes(createSeed(today, checkpoint))).toEqual(
        withoutCodes(createSeed(new Date('2026-11-15T05:30:00Z'), checkpoint)),
      );
    }
  });
});
