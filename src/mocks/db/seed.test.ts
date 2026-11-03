import { describe, expect, it } from 'vitest';
import { computeCouponState } from '@/features/coupons/model';
import { DEMO_EMAILS, DEMO_MOTIVATION, DEMO_STORE_OWNERS } from '@/shared/config/demoAccounts';
import { distanceMeters } from './geo';
import { createSeed, DEMO_TOUR_ID, DEMO_UNIVERSITY_ID } from './seed';
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
      '산업디자인 작업실과 수업 이야기, 학생들이 자주 가는 대학가 식당과 카페까지 함께 둘러봐요.',
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
    expect(db.studentProfiles.map((p) => role(p.id))).toEqual(Array(8).fill('HIGH_SCHOOL'));
    expect(db.guideProfiles.map((p) => role(p.id))).toEqual(Array(5).fill('UNIVERSITY'));
    expect(db.businessVerifications.map((p) => role(p.id))).toEqual(Array(4).fill('OWNER'));
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
    expect(db.businessVerifications).toHaveLength(4);
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
