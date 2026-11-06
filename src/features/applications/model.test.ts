import { describe, expect, it } from 'vitest';
import type { TourSummary } from '@/features/tours/model';
import {
  coursePathFor,
  guideCoursePath,
  groupMyApplications,
  guideTourChip,
  isUpcomingTour,
  pickFocusTour,
  type GuideTourSummary,
  type MyApplication,
} from './model';

const tour: TourSummary = {
  id: 7,
  title: '경희대 컴퓨터공학과 탐방',
  universityId: 1,
  universityName: '경희대학교',
  universityShortName: '경희대',
  campusName: '서울캠퍼스',
  major: '컴퓨터공학과',
  guideName: '박가이드',
  guideVerified: true,
  startsAt: '2026-11-15T14:00:00+09:00',
  endsAt: '2026-11-15T17:00:00+09:00',
  capacity: 5,
  approvedCount: 2,
  remainingSeats: 3,
  status: 'RECRUITING',
};

const app: MyApplication = {
  id: 21,
  status: 'PENDING',
  motivation: '컴공이 궁금해요',
  createdAt: '2026-11-10T10:00:00+09:00',
  tour,
  courseStatus: null,
  openChatUrl: null,
  couponCount: 0,
  cancellable: true,
};

const mk = (
  id: number,
  status: MyApplication['status'],
  tourStatus: TourSummary['status'],
  startsAt: string,
): MyApplication => ({ ...app, id, status, tour: { ...tour, id, status: tourStatus, startsAt } });

describe('groupMyApplications', () => {
  const ids = (apps: MyApplication[]) => apps.map((a) => a.id);

  it('신청이 없으면 빈 묶음 셋', () =>
    expect(groupMyApplications([])).toEqual({ upcoming: [], pending: [], past: [] }));

  it('승인 + 모집 중 · 마감은 예정, 대기 + 끝나지 않은 탐방은 승인 대기', () => {
    const g = groupMyApplications([
      mk(1, 'APPROVED', 'RECRUITING', '2026-11-20T14:00:00+09:00'),
      mk(2, 'APPROVED', 'CLOSED', '2026-11-12T14:00:00+09:00'),
      mk(3, 'PENDING', 'RECRUITING', '2026-11-18T14:00:00+09:00'),
      mk(4, 'PENDING', 'CLOSED', '2026-11-14T14:00:00+09:00'),
    ]);
    expect(ids(g.upcoming)).toEqual([2, 1]); // 시작 시각 빠른 순
    expect(ids(g.pending)).toEqual([4, 3]);
    expect(g.past).toEqual([]);
  });

  it('탐방이 끝났거나 취소됐거나 신청이 거절 · 취소면 지난 탐방(최근 먼저)', () => {
    const g = groupMyApplications([
      mk(1, 'APPROVED', 'COMPLETED', '2026-10-17T14:00:00+09:00'),
      mk(2, 'APPROVED', 'CANCELED', '2026-10-29T14:00:00+09:00'),
      mk(3, 'REJECTED', 'RECRUITING', '2026-11-20T14:00:00+09:00'),
      mk(4, 'CANCELED', 'RECRUITING', '2026-11-03T14:00:00+09:00'),
      mk(5, 'PENDING', 'COMPLETED', '2026-10-01T14:00:00+09:00'),
    ]);
    expect(ids(g.past)).toEqual([3, 4, 2, 1, 5]);
    expect(g.upcoming).toEqual([]);
    expect(g.pending).toEqual([]);
  });

  it('받은 배열을 바꾸지 않는다', () => {
    const input = [
      mk(1, 'APPROVED', 'RECRUITING', '2026-11-20T14:00:00+09:00'),
      mk(2, 'APPROVED', 'RECRUITING', '2026-11-12T14:00:00+09:00'),
    ];
    groupMyApplications(input);
    expect(ids(input)).toEqual([1, 2]);
  });
});

const guideTour = (patch: Partial<GuideTourSummary> & { id: number }): GuideTourSummary => ({
  ...tour,
  counts: { total: 0, pending: 0, approved: 0 },
  courseStatus: null,
  ...patch,
});

describe('pickFocusTour', () => {
  it('목록이 비면 null', () => expect(pickFocusTour([])).toBeNull());

  it('모집 중 · 마감 중 startsAt이 가장 이른 탐방', () => {
    const late = guideTour({ id: 1, startsAt: '2026-11-20T14:00:00+09:00' });
    const early = guideTour({ id: 2, startsAt: '2026-11-12T14:00:00+09:00', status: 'CLOSED' });
    const mid = guideTour({ id: 3, startsAt: '2026-11-15T14:00:00+09:00' });
    expect(pickFocusTour([late, early, mid])?.id).toBe(2);
  });

  it('취소 · 완료된 탐방은 건너뛴다', () => {
    const done = guideTour({ id: 1, startsAt: '2026-11-01T14:00:00+09:00', status: 'COMPLETED' });
    const canceled = guideTour({
      id: 2,
      startsAt: '2026-11-02T14:00:00+09:00',
      status: 'CANCELED',
    });
    const open = guideTour({ id: 3, startsAt: '2026-11-30T14:00:00+09:00' });
    expect(pickFocusTour([done, canceled, open])?.id).toBe(3);
    expect(pickFocusTour([done, canceled])).toBeNull();
  });
});

describe('guideCoursePath', () => {
  const counts = (approved: number) => ({ total: approved, pending: 0, approved });

  it('코스 확정 → 확정 점검', () =>
    expect(
      guideCoursePath(guideTour({ id: 4, courseStatus: 'CONFIRMED', counts: counts(2) })),
    ).toBe('/guide/tours/4/course/confirm'));

  it('코스 초안 → 편집', () =>
    expect(guideCoursePath(guideTour({ id: 4, courseStatus: 'DRAFT', counts: counts(2) }))).toBe(
      '/guide/tours/4/course/edit',
    ));

  it('코스 없음 + 승인 1명 이상 → 초안 생성', () =>
    expect(guideCoursePath(guideTour({ id: 4, counts: counts(1) }))).toBe(
      '/guide/tours/4/course/draft?generate=1',
    ));

  it('코스 없음 + 승인 0명 → 신청자 보기', () =>
    expect(guideCoursePath(guideTour({ id: 4, counts: counts(0) }))).toBe(
      '/guide/tours/4/applicants',
    ));
});

describe('coursePathFor', () => {
  it('코스 확정 → 확정 점검 (승인 수와 무관)', () =>
    expect(coursePathFor(4, 'CONFIRMED', 0)).toBe('/guide/tours/4/course/confirm'));

  it('코스 초안 → 편집', () =>
    expect(coursePathFor(4, 'DRAFT', 2)).toBe('/guide/tours/4/course/edit'));

  it('코스 없음 + 승인 1명 이상 → 초안 생성', () =>
    expect(coursePathFor(4, null, 1)).toBe('/guide/tours/4/course/draft?generate=1'));

  it('코스 없음 + 승인 0명 → 신청자 보기', () =>
    expect(coursePathFor(4, null, 0)).toBe('/guide/tours/4/applicants'));
});

describe('isUpcomingTour', () => {
  it('모집 중 · 마감만 진행 예정', () => {
    expect(isUpcomingTour({ status: 'RECRUITING' })).toBe(true);
    expect(isUpcomingTour({ status: 'CLOSED' })).toBe(true);
    expect(isUpcomingTour({ status: 'COMPLETED' })).toBe(false);
    expect(isUpcomingTour({ status: 'CANCELED' })).toBe(false);
  });
});

describe('guideTourChip', () => {
  it('진행 예정: 접수 중 · 마감, 코스가 확정이면 코스 확정(success)', () => {
    expect(guideTourChip(guideTour({ id: 1 }))).toEqual({ label: '신청 접수 중', tone: 'neutral' });
    expect(guideTourChip(guideTour({ id: 1, status: 'CLOSED' }))).toEqual({
      label: '모집 마감',
      tone: 'neutral',
    });
    expect(guideTourChip(guideTour({ id: 1, courseStatus: 'CONFIRMED' }))).toEqual({
      label: '코스 확정',
      tone: 'success',
    });
    expect(guideTourChip(guideTour({ id: 1, courseStatus: 'DRAFT' })).label).toBe('신청 접수 중');
  });

  it('지난 탐방은 코스가 확정이어도 탐방 상태 이름', () => {
    expect(
      guideTourChip(guideTour({ id: 1, status: 'COMPLETED', courseStatus: 'CONFIRMED' })),
    ).toEqual({
      label: '완료',
      tone: 'neutral',
    });
    expect(guideTourChip(guideTour({ id: 1, status: 'CANCELED' })).label).toBe('취소');
  });
});
