import { describe, expect, it } from 'vitest';
import { fromWireCampus, type WireCampus } from '@/features/campuses/wire';
import { createSeed } from '@/mocks/db/seed';
import { toWireCampus } from '@/mocks/wire/campuses';
import { toCamel } from '@/shared/lib/caseKeys';
import { D01 } from '@/test/fixtures/backend/campuses';
import { TOUR_DETAIL, TOURS_LIST } from '@/test/fixtures/backend/tours';
import type { TourSummary } from './model';
import { fromWireTourDetail, fromWireTourItem, summaryOf, type WireTourItem } from './wire';
import type { WireTourDetail } from './wire';

const item = () => toCamel<WireTourItem>(TOURS_LIST.data.items[0]);
const detail = () => toCamel<WireTourDetail>(TOUR_DETAIL.data);

const SUMMARY_31: TourSummary = {
  id: 31,
  title: '단국대 죽전캠퍼스 컴퓨터공학과 투어',
  universityId: 0,
  universityName: '단국대학교',
  universityShortName: '단국대',
  campusName: '죽전캠퍼스',
  major: '컴퓨터공학과',
  guideName: '이준호',
  guideVerified: true,
  startsAt: '2027-01-15T13:00:00+09:00',
  endsAt: null,
  capacity: 5,
  approvedCount: 2,
  remainingSeats: 3,
  status: 'RECRUITING',
};

describe('fromWireTourItem', () => {
  it('명세 예시(확장 없음 · 캠퍼스 이름 불일치)는 이름을 첫 공백에서 나눠 읽는다', () => {
    expect(fromWireTourItem(item(), D01)).toEqual(SUMMARY_31);
  });

  it('campus_id 확장이 있으면 캠퍼스 목록에서 찾는다', () => {
    const db = createSeed(new Date('2026-11-15T01:00:00Z'));
    const seed = db.universities.map((u) =>
      fromWireCampus(toCamel<WireCampus>(toWireCampus(db, u))),
    );
    const read = fromWireTourItem({ ...item(), campusId: 3 }, seed);
    expect(read).toMatchObject({
      universityId: 3,
      universityName: '단국대학교',
      universityShortName: '단국대',
      campusName: '죽전캠퍼스',
      title: '단국대 죽전캠퍼스 컴퓨터공학과 투어',
    });
  });

  it('공백 없는 캠퍼스 이름은 본교로 읽고 제목에서 캠퍼스를 뺀다', () => {
    const read = fromWireTourItem({ ...item(), campusName: '강남대학교' }, []);
    expect(read).toMatchObject({ universityName: '강남대학교', campusName: '본교' });
    expect(read.title).toBe('강남대 컴퓨터공학과 투어');
  });
});

describe('fromWireTourDetail', () => {
  it('명세 예시를 TourDetail로 읽는다', () => {
    expect(fromWireTourDetail(detail(), D01)).toEqual({
      ...SUMMARY_31,
      endsAt: '2027-01-15T16:00:00+09:00',
      introduction: '캠퍼스와 근처 맛집을 함께 둘러봐요',
      guideIntroduction: '신입생 때부터 동아리 활동을 했어요',
      openChatUrl: null,
      myApplication: { id: 77, status: 'PENDING' },
    });
  });

  it('가이드 소개 · 내 신청이 없으면 null', () => {
    const wire = detail();
    const read = fromWireTourDetail(
      { ...wire, guide: { name: wire.guide.name, verified: true }, myApplication: null },
      D01,
    );
    expect(read.guideIntroduction).toBeNull();
    expect(read.myApplication).toBeNull();
  });

  it('major가 없으면(실서버가 빼면) null이고 제목은 학과 없이 만든다', () => {
    const wire = detail();
    delete wire.major;
    const read = fromWireTourDetail(wire, D01);
    expect(read.major).toBeNull();
    expect(read.title).toBe('단국대 죽전캠퍼스 캠퍼스 투어');
  });

  it('end_time이 null이면 endsAt도 null', () => {
    expect(fromWireTourDetail({ ...detail(), endTime: null }, D01).endsAt).toBeNull();
  });
});

describe('summaryOf', () => {
  it('요약 칸만 고른다(키가 TourSummary와 정확히 같다)', () => {
    const summary = summaryOf(fromWireTourDetail(detail(), D01));
    expect(Object.keys(summary).sort()).toEqual(Object.keys(SUMMARY_31).sort());
    expect(summary).toEqual({ ...SUMMARY_31, endsAt: '2027-01-15T16:00:00+09:00' });
  });
});
