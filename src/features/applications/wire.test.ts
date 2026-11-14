import { describe, expect, it } from 'vitest';
import { summaryOf } from '@/features/tours/wire';
import { toCamel } from '@/shared/lib/caseKeys';
import {
  APPLICANTS_LIST,
  MY_TOURS_HIGH_SCHOOL,
  MY_TOURS_UNIVERSITY,
} from '@/test/fixtures/backend/applications';
import { TOUR_31 } from '@/test/fixtures/backend/tours';
import type { MyApplication } from './model';
import {
  fromWireApplicants,
  fromWireGuideTourRow,
  fromWireMyTourRow,
  type WireApplicant,
  type WireGuideTourRow,
  type WireMyTourRow,
} from './wire';

const NOW = new Date('2026-11-07T12:00:00+09:00');
const studentRow = () => toCamel<WireMyTourRow>(MY_TOURS_HIGH_SCHOOL.data.items[0]);
const guideRow = () => toCamel<WireGuideTourRow>(MY_TOURS_UNIVERSITY.data.items[0]);
const applicants = () => toCamel<WireApplicant[]>(APPLICANTS_LIST.data.items);

describe('fromWireMyTourRow (명세 T-04 고교생 예시, 확장 없음)', () => {
  it('확장이 없으면 동기 · 신청 시각은 빈 문자열, 탐방은 상세의 요약, 코스는 확정 여부만', () => {
    expect(fromWireMyTourRow(studentRow(), TOUR_31, 0, NOW)).toEqual({
      id: 77,
      status: 'APPROVED',
      motivation: '',
      createdAt: '',
      tour: summaryOf(TOUR_31),
      courseStatus: 'CONFIRMED',
      openChatUrl: null,
      couponCount: 0,
      cancellable: true, // 2026-11-07 < 2027-01-15
    } satisfies MyApplication);
  });

  it('확장(wish · created_at)이 있으면 그 값, 쿠폰 수는 받은 값 그대로', () => {
    const row = { ...studentRow(), wish: '게임 동아리', createdAt: '2026-11-04T21:00:00+09:00' };
    expect(fromWireMyTourRow(row, TOUR_31, 3, NOW)).toMatchObject({
      motivation: '게임 동아리',
      createdAt: '2026-11-04T21:00:00+09:00',
      couponCount: 3,
    });
  });

  it('코스가 확정 전이면 courseStatus null(학생 화면은 초안을 준비 중으로 같이 본다, 2C-R27)', () => {
    const row = { ...studentRow(), courseConfirmed: false };
    expect(fromWireMyTourRow(row, TOUR_31, 0, NOW).courseStatus).toBeNull();
  });

  it('오픈채팅은 승인된 신청만 — 같은 탐방의 다른(승인) 신청 때문에 상세에 링크가 와도 이 행이 승인이 아니면 null', () => {
    const tour = { ...TOUR_31, openChatUrl: 'https://open.kakao.com/o/x' };
    expect(fromWireMyTourRow(studentRow(), tour, 0, NOW).openChatUrl).toBe(
      'https://open.kakao.com/o/x',
    );
    const canceled = { ...studentRow(), applicationStatus: 'CANCELED' as const };
    expect(fromWireMyTourRow(canceled, tour, 0, NOW).openChatUrl).toBeNull();
  });

  it('취소 가능 여부는 computeCancellable(상태 · 탐방 날짜 · 지금)', () => {
    const tourDay = new Date('2027-01-15T09:00:00+09:00');
    expect(fromWireMyTourRow(studentRow(), TOUR_31, 0, tourDay).cancellable).toBe(false);
    const rejected = { ...studentRow(), applicationStatus: 'REJECTED' as const };
    expect(fromWireMyTourRow(rejected, TOUR_31, 0, NOW).cancellable).toBe(false);
  });
});

describe('fromWireGuideTourRow (명세 T-04 대학생 예시)', () => {
  it('요약은 탐방 상세, 집계는 행의 승인 · 대기(total = 승인 + 대기, 거절 제외 — 2C-R27)', () => {
    expect(fromWireGuideTourRow(guideRow(), TOUR_31, null)).toEqual({
      ...summaryOf(TOUR_31),
      counts: { total: 5, pending: 3, approved: 2 },
      courseStatus: null,
    });
  });

  it('확정이 아니면 받은 코스 상태(초안 여부, getGuideCourseStatus), 확정이면 CONFIRMED', () => {
    expect(fromWireGuideTourRow(guideRow(), TOUR_31, 'DRAFT').courseStatus).toBe('DRAFT');
    expect(
      fromWireGuideTourRow({ ...guideRow(), courseConfirmed: true }, TOUR_31, null).courseStatus,
    ).toBe('CONFIRMED');
  });
});

describe('fromWireApplicants (명세 A-04 예시)', () => {
  const canceled: WireApplicant = {
    applicationId: 76,
    name: '이바다',
    grade: 1,
    wish: '취소했어요',
    status: 'CANCELED',
    createdAt: '2026-11-03T10:00:00+09:00',
  };

  it('취소한 신청은 빼고, 인증은 늘 true(A-01이 인증 APPROVED만 받는다), 남은 자리는 탐방 상세', () => {
    expect(fromWireApplicants([...applicants(), canceled], TOUR_31, null)).toEqual({
      tour: summaryOf(TOUR_31),
      counts: { pending: 1, approved: 0, remaining: 3 },
      applicants: [
        {
          id: 77,
          userName: '김하늘',
          grade: 2,
          motivation: '게임 동아리 구경하고 싶고 맛집도 가보고 싶어요',
          status: 'PENDING',
          verified: true,
        },
      ],
      course: null,
    });
  });

  it('신청 시각이 빠른 순(같으면 id 순), 거절은 남긴다, 코스 상태가 있으면 { status }', () => {
    const at = (iso: string, id: number, status: WireApplicant['status']): WireApplicant => ({
      ...applicants()[0],
      applicationId: id,
      createdAt: iso,
      status,
    });
    const board = fromWireApplicants(
      [
        at('2026-11-05T10:00:00+09:00', 3, 'PENDING'),
        at('2026-11-04T10:00:00+09:00', 9, 'APPROVED'),
        at('2026-11-04T10:00:00+09:00', 8, 'REJECTED'),
      ],
      TOUR_31,
      'DRAFT',
    );
    expect(board.applicants.map((a) => a.id)).toEqual([8, 9, 3]);
    expect(board.counts).toEqual({ pending: 1, approved: 1, remaining: 3 });
    expect(board.course).toEqual({ status: 'DRAFT' });
  });

  it('학년이 없으면 null 그대로', () => {
    const [first] = applicants();
    expect(
      fromWireApplicants([{ ...first, grade: null }], TOUR_31, null).applicants[0].grade,
    ).toBeNull();
  });
});
