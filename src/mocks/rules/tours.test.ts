import { beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/mocks/db/schema';
import { createSeed } from '@/mocks/db/seed';
import type { ErrorCode } from '@/shared/lib/errors';
import { redeemCoupon } from './coupons';
import { cancelTour, completeTour, createTour } from './tours';

// 시연일 2026-11-15, 탐방 1은 그날 14:00. 규칙 테스트는 지역 DB를 쓰고 쿠폰은 `redeemCoupon`으로 쓴다(preflight D01).
const today = new Date('2026-11-15T01:00:00Z'); // KST 10:00
const dayOf = new Date('2026-11-15T05:00:00Z'); // KST 14:00 — 사용 처리
const evening = new Date('2026-11-15T09:00:00Z'); // KST 18:00 — 완료 · 취소

let db: DB;
beforeEach(() => {
  db = createSeed(today, 'CONFIRMED');
});

const id = (email: string) => db.users.find((u) => u.email === email)!.id;
const guide = () => id('guide@demo.kr');
const tourOf = (tourId: number) => db.tours.find((t) => t.id === tourId)!;

const valid = {
  date: '2027-01-20',
  startTime: '13:00',
  endTime: '16:00',
  capacity: 5,
  intro: '캠퍼스와 근처 맛집을 함께 둘러봐요',
  openChatUrl: 'https://open.kakao.com/o/x',
};

function errorOf(run: () => unknown): {
  code?: ErrorCode;
  status?: number;
  backendCode?: string;
  fieldErrors?: Record<string, string>;
} {
  try {
    run();
  } catch (e) {
    return e as never;
  }
  return {};
}

describe('createTour (T-03)', () => {
  it('정상: 모집 중 · 제목 null · 시각은 서울 ISO · 소개와 링크는 공백을 뺀다', () => {
    const before = db.tours.length;
    const row = createTour(
      db,
      guide(),
      { ...valid, intro: '  캠퍼스를 걸어요  ', openChatUrl: ' https://open.kakao.com/o/x ' },
      today,
    );
    expect(db.tours).toHaveLength(before + 1);
    expect(db.tours.at(-1)).toBe(row);
    expect(row).toMatchObject({
      guideId: guide(),
      universityId: 2,
      title: null,
      status: 'RECRUITING',
      startsAt: '2027-01-20T13:00:00+09:00',
      endsAt: '2027-01-20T16:00:00+09:00',
      capacity: 5,
      introduction: '캠퍼스를 걸어요',
      openChatUrl: 'https://open.kakao.com/o/x',
    });
  });

  it('① 인증이 APPROVED가 아니면 NOT_VERIFIED(가장 먼저 — 형식 오류보다 앞)', () => {
    const e = errorOf(() => createTour(db, id('guide-pending@demo.kr'), { date: 'x' }, today));
    expect([e.status, e.code]).toEqual([403, 'NOT_VERIFIED']);
  });

  it('② 프로필 학과가 비었으면 GUIDE_PROFILE_REQUIRED(형식 오류보다 앞)', () => {
    db.guideProfiles.find((g) => g.id === guide())!.major = null;
    const e = errorOf(() => createTour(db, guide(), { date: 'x' }, today));
    expect([e.status, e.code]).toEqual([409, 'GUIDE_PROFILE_REQUIRED']);
  });

  it('② 공백뿐인 학과도 비었다고 본다', () => {
    db.guideProfiles.find((g) => g.id === guide())!.major = '  ';
    expect(errorOf(() => createTour(db, guide(), valid, today)).code).toBe(
      'GUIDE_PROFILE_REQUIRED',
    );
  });

  it.each([
    [{ date: '2027-1-20' }, 'date', '날짜를 골라 주세요.'],
    [{ date: undefined }, 'date', '날짜를 골라 주세요.'],
    [{ date: '2027-02-30' }, 'date', '날짜를 골라 주세요.'],
    [{ startTime: '1pm' }, 'startTime', '시작 시간을 골라 주세요.'],
    [{ startTime: '24:00' }, 'startTime', '시작 시간을 골라 주세요.'],
    [{ endTime: '' }, 'endTime', '종료 시간을 골라 주세요.'],
    [{ endTime: '13:00' }, 'endTime', '종료 시간은 시작 시간보다 늦어야 해요.'],
    [{ endTime: '12:59' }, 'endTime', '종료 시간은 시작 시간보다 늦어야 해요.'],
    [{ capacity: 0 }, 'capacity', '모집 정원은 1~10명으로 적어 주세요.'],
    [{ capacity: 11 }, 'capacity', '모집 정원은 1~10명으로 적어 주세요.'],
    [{ capacity: 2.5 }, 'capacity', '모집 정원은 1~10명으로 적어 주세요.'],
    [{ capacity: '5' }, 'capacity', '모집 정원은 1~10명으로 적어 주세요.'],
    [{ intro: '   ' }, 'intro', '탐방 소개는 1~300자로 적어 주세요.'],
    [{ intro: '가'.repeat(301) }, 'intro', '탐방 소개는 1~300자로 적어 주세요.'],
    [{ openChatUrl: '  ' }, 'openChatUrl', '연락 링크를 넣어 주세요.'],
    [{ openChatUrl: undefined }, 'openChatUrl', '연락 링크를 넣어 주세요.'],
  ] as const)('③ 형식 오류 %j → %s 칸', (patch, field, message) => {
    const e = errorOf(() => createTour(db, guide(), { ...valid, ...patch }, today));
    expect([e.status, e.code]).toEqual([400, 'VALIDATION']);
    expect(e.fieldErrors).toEqual({ [field]: message });
  });

  it('③ 경계: 정원 1 · 10과 소개 300자(공백 뺀 길이)는 통과', () => {
    expect(createTour(db, guide(), { ...valid, capacity: 1 }, today).capacity).toBe(1);
    expect(createTour(db, guide(), { ...valid, capacity: 10 }, today).capacity).toBe(10);
    const intro = ` ${'가'.repeat(300)} `;
    expect(createTour(db, guide(), { ...valid, intro }, today).introduction).toHaveLength(300);
  });

  it('③ 위에서부터 처음 걸린 칸 하나만(날짜와 정원이 모두 틀리면 날짜)', () => {
    const e = errorOf(() => createTour(db, guide(), { ...valid, date: 'x', capacity: 99 }, today));
    expect(Object.keys(e.fieldErrors ?? {})).toEqual(['date']);
  });

  it('④ 방학 밖 날짜는 명세 문장 그대로의 date 칸 오류', () => {
    const e = errorOf(() => createTour(db, guide(), { ...valid, date: '2027-03-10' }, today));
    expect([e.status, e.code]).toEqual([400, 'VALIDATION']);
    expect(e.fieldErrors).toEqual({ date: '방학 기간 안의 날짜만 선택할 수 있어요' });
  });

  it('④ 방학 첫날 · 마지막 날은 통과, 하루 밖은 실패', () => {
    expect(createTour(db, guide(), { ...valid, date: '2026-12-21' }, today).startsAt).toContain(
      '2026-12-21',
    );
    expect(createTour(db, guide(), { ...valid, date: '2027-02-28' }, today).startsAt).toContain(
      '2027-02-28',
    );
    expect(
      errorOf(() => createTour(db, guide(), { ...valid, date: '2026-12-20' }, today)).code,
    ).toBe('VALIDATION');
  });

  it('④ 오늘이나 지난 날짜도 방학 안이면 통과한다(내일 이후 규칙은 명세에 없다 — 2B′-R12)', () => {
    // 시연일 2026-11-15는 방학 밖이므로, 방학 중인 "오늘"에서 같은 날짜를 연다.
    const winter = new Date('2027-01-10T01:00:00Z');
    expect(createTour(db, guide(), { ...valid, date: '2027-01-10' }, winter).startsAt).toContain(
      '2027-01-10',
    );
  });

  it('④ 학교는 인증 행의 universityId를 우선한다(프로필과 달라도)', () => {
    // 인증 행 학교 3(단국대) · 프로필 학교 2: 단국대 방학도 같은 날짜라 통과하고 탐방은 인증 학교에 붙는다.
    db.verifications.find((v) => v.id === guide())!.universityId = 3;
    expect(createTour(db, guide(), valid, today).universityId).toBe(3);
  });

  it('인증 행에 학교가 없으면 프로필 학교로 간다', () => {
    db.verifications.find((v) => v.id === guide())!.universityId = null;
    expect(createTour(db, guide(), valid, today).universityId).toBe(2);
  });

  it('오류가 나면 DB는 그대로다', () => {
    const before = db.tours.length;
    const nextId = db.nextId;
    errorOf(() => createTour(db, guide(), { ...valid, capacity: 0 }, today));
    expect(db.tours).toHaveLength(before);
    expect(db.nextId).toBe(nextId);
  });
});

describe('completeTour (T-06)', () => {
  it('탐방 날짜 당일이면 COMPLETED(탐방 1)', () => {
    const row = completeTour(db, guide(), 1, evening);
    expect(row.status).toBe('COMPLETED');
    expect(tourOf(1).status).toBe('COMPLETED');
  });

  it('날짜 전이면 COMPLETE_BEFORE_TOUR_DATE(탐방 6) — 백엔드 코드는 E409_INVALID_TOUR_STATUS', () => {
    const e = errorOf(() => completeTour(db, guide(), 6, evening));
    expect([e.status, e.code]).toEqual([409, 'COMPLETE_BEFORE_TOUR_DATE']);
    expect(tourOf(6).status).toBe('RECRUITING');
  });

  it('이미 완료된 탐방(7)이면 TOUR_ALREADY_COMPLETED', () => {
    const e = errorOf(() => completeTour(db, guide(), 7, evening));
    expect([e.status, e.code]).toEqual([409, 'TOUR_ALREADY_COMPLETED']);
  });

  it('취소된 탐방이면 backendError(409, E409_INVALID_TOUR_STATUS, ALREADY_PROCESSED)', () => {
    cancelTour(db, guide(), 6, evening);
    const e = errorOf(() => completeTour(db, guide(), 6, evening));
    expect([e.status, e.code, e.backendCode]).toEqual([
      409,
      'ALREADY_PROCESSED',
      'E409_INVALID_TOUR_STATUS',
    ]);
  });

  it('마감(CLOSED) 탐방도 날짜가 되면 완료한다', () => {
    tourOf(1).status = 'CLOSED';
    expect(completeTour(db, guide(), 1, evening).status).toBe('COMPLETED');
  });

  it('없는 탐방 404 · 남의 탐방 403(상태 검사보다 앞)', () => {
    expect(errorOf(() => completeTour(db, guide(), 999, evening)).code).toBe('NOT_FOUND');
    const other = id('guide-dku@demo.kr');
    expect(errorOf(() => completeTour(db, other, 7, evening)).code).toBe('FORBIDDEN');
  });

  it('완료해도 신청 · 쿠폰은 건드리지 않는다', () => {
    const apps = JSON.stringify(db.applications);
    const coupons = JSON.stringify(db.coupons);
    completeTour(db, guide(), 1, evening);
    expect(JSON.stringify(db.applications)).toBe(apps);
    expect(JSON.stringify(db.coupons)).toBe(coupons);
  });
});

describe('cancelTour (T-05)', () => {
  const minji = () => id('student@demo.kr');
  const appsOf = (tourId: number) => db.applications.filter((a) => a.tourId === tourId);
  const minjiApp = () => appsOf(1).find((a) => a.userId === minji())!;
  const couponsOf = (tourId: number) => {
    const appIds = new Set(appsOf(tourId).map((a) => a.id));
    return db.coupons.filter((c) => appIds.has(c.applicationId));
  };

  it('대기 · 승인 신청을 CANCELED로, ISSUED 쿠폰을 EXPIRED로, USED 쿠폰과 거절 신청은 그대로', () => {
    // 상점 1 쿠폰 하나는 사용 처리, 대기 신청 하나는 미리 거절해 둔다.
    const used = couponsOf(1).find((c) => c.storeId === 1 && c.applicationId === minjiApp().id)!;
    redeemCoupon(db, id('owner1@demo.kr'), used.code, dayOf);
    const rejected = appsOf(1).find((a) => a.status === 'PENDING')!;
    rejected.status = 'REJECTED';
    rejected.activeUserId = null;
    const live = appsOf(1).filter((a) => a.status === 'PENDING' || a.status === 'APPROVED');
    expect(live.length).toBeGreaterThanOrEqual(3);
    expect(couponsOf(1).filter((c) => c.status === 'ISSUED').length).toBeGreaterThan(0);

    const row = cancelTour(db, guide(), 1, evening);

    expect(row.status).toBe('CANCELED');
    expect(tourOf(1).status).toBe('CANCELED');
    expect(minjiApp().status).toBe('CANCELED');
    for (const app of live) {
      const now = db.applications.find((a) => a.id === app.id)!;
      expect(now.status).toBe('CANCELED');
      expect(now.activeUserId).toBeNull();
    }
    expect(db.applications.find((a) => a.id === rejected.id)!.status).toBe('REJECTED');
    expect(db.coupons.find((c) => c.id === used.id)!.status).toBe('USED');
    expect(couponsOf(1).filter((c) => c.status === 'ISSUED')).toEqual([]);
    expect(couponsOf(1).filter((c) => c.status === 'EXPIRED').length).toBeGreaterThan(0);
  });

  it('다른 탐방의 신청 · 쿠폰은 건드리지 않는다', () => {
    const before = JSON.stringify(appsOf(2));
    cancelTour(db, guide(), 1, evening);
    expect(JSON.stringify(appsOf(2))).toBe(before);
  });

  it('두 번째 취소는 backendError ALREADY_PROCESSED(E409_INVALID_TOUR_STATUS)', () => {
    cancelTour(db, guide(), 1, evening);
    const e = errorOf(() => cancelTour(db, guide(), 1, evening));
    expect([e.status, e.code, e.backendCode]).toEqual([
      409,
      'ALREADY_PROCESSED',
      'E409_INVALID_TOUR_STATUS',
    ]);
  });

  it('완료된 탐방(7)이면 TOUR_ALREADY_COMPLETED', () => {
    const e = errorOf(() => cancelTour(db, guide(), 7, evening));
    expect([e.status, e.code]).toEqual([409, 'TOUR_ALREADY_COMPLETED']);
  });

  it('날짜 전 탐방(6)도 취소된다', () => {
    expect(cancelTour(db, guide(), 6, evening).status).toBe('CANCELED');
  });

  it('남의 탐방 403 · 없는 탐방 404', () => {
    expect(errorOf(() => cancelTour(db, id('guide-pending@demo.kr'), 1, evening)).code).toBe(
      'FORBIDDEN',
    );
    expect(errorOf(() => cancelTour(db, guide(), 999, evening)).code).toBe('NOT_FOUND');
  });
});
