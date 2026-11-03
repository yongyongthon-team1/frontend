import { describe, expect, it } from 'vitest';
import { createSeed } from '@/mocks/db/seed';
import { buildTourSummary } from './summaries';

const today = new Date('2026-11-15T01:00:00Z'); // 시연일 KST 10:00

describe('buildTourSummary', () => {
  it('시연 탐방 요약', () => {
    const db = createSeed(today);
    expect(buildTourSummary(db, db.tours[0])).toEqual({
      id: 1,
      title: '경희대 국제캠퍼스 산업디자인학과 탐방',
      universityId: 2,
      universityName: '경희대학교',
      universityShortName: '경희대',
      campusName: '국제캠퍼스',
      major: '산업디자인학과',
      guideName: '정다은',
      guideVerified: true,
      startsAt: '2026-11-15T14:00:00+09:00',
      endsAt: '2026-11-15T16:30:00+09:00',
      capacity: 5,
      approvedCount: 2,
      remainingSeats: 3,
      status: 'RECRUITING',
    });
  });

  it('본교는 캠퍼스를 생략하고 한국외대는 줄여 쓴다', () => {
    const db = createSeed(today);
    const title = (tourId: number) =>
      buildTourSummary(
        db,
        db.tours.find((t) => t.id === tourId)!,
      ).title;
    expect(title(5)).toBe('강남대 사회복지학부 탐방');
    expect(title(4)).toBe('한국외대 글로벌캠퍼스 통번역학과 탐방');
    expect(buildTourSummary(db, db.tours[3]).universityShortName).toBe('한국외대');
  });

  it('마감 탐방은 승인 수 = 정원, 남은 자리 0', () => {
    const db = createSeed(today);
    expect(buildTourSummary(db, db.tours[1])).toMatchObject({
      status: 'CLOSED',
      capacity: 3,
      approvedCount: 3,
      remainingSeats: 0,
    });
  });

  it('승인 신청이 늘면 반영하고, 가이드 인증 · 학과가 없으면 그대로 드러낸다', () => {
    const db = createSeed(today, 'APPROVED');
    const tour = db.tours[0];
    expect(buildTourSummary(db, tour)).toMatchObject({ approvedCount: 3, remainingSeats: 2 });

    db.verifications.find((v) => v.id === tour.guideId)!.status = 'PENDING';
    db.guideProfiles.find((g) => g.id === tour.guideId)!.major = null;
    expect(buildTourSummary(db, tour)).toMatchObject({
      title: '경희대 국제캠퍼스 캠퍼스 탐방',
      major: null,
      guideVerified: false,
    });
  });
});
