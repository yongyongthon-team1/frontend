import { describe, expect, it } from 'vitest';
import type { TourSummary } from '@/features/tours/model';
import {
  cancelActionState,
  completeActionState,
  computeCancellable,
  computeTourActions,
  coursePathFor,
  guideCoursePath,
  groupMyApplications,
  guideTourChip,
  isUpcomingTour,
  pickFocusTour,
  STUDENT_APPLICATION_STATUS,
  type GuideTourDetail,
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

describe('STUDENT_APPLICATION_STATUS', () => {
  it('신청 상태마다 칩 문구 · 색이 하나씩 — 참여 확정은 승인된 신청뿐', () => {
    expect(
      Object.entries(STUDENT_APPLICATION_STATUS).map(([status, v]) => [
        status,
        v.label,
        v.chipTone,
      ]),
    ).toEqual([
      ['APPROVED', '참여 확정', 'success'],
      ['PENDING', '승인 대기', 'neutral'],
      ['REJECTED', '신청 거절', 'danger'],
      ['CANCELED', '취소됨', 'neutral'],
    ]);
  });
});

describe('computeCancellable (어댑터 전용 — 목업 isCancellable도 이 규칙을 부른다)', () => {
  const tourStartsAt = '2026-11-15T14:00:00+09:00';

  it('대기 · 승인 신청은 탐방 전날(서울 날짜)까지 취소할 수 있다', () => {
    const dayBefore = new Date('2026-11-14T23:59:59+09:00');
    expect(computeCancellable('PENDING', tourStartsAt, dayBefore)).toBe(true);
    expect(computeCancellable('APPROVED', tourStartsAt, dayBefore)).toBe(true);
  });

  it('탐방 당일부터는 취소할 수 없다(시작 전이어도)', () => {
    const tourDay = new Date('2026-11-15T00:00:00+09:00');
    expect(computeCancellable('PENDING', tourStartsAt, tourDay)).toBe(false);
    expect(
      computeCancellable('APPROVED', tourStartsAt, new Date('2026-11-16T09:00:00+09:00')),
    ).toBe(false);
  });

  it('거절 · 취소된 신청은 날짜와 상관없이 취소할 수 없다', () => {
    const early = new Date('2026-11-01T12:00:00+09:00');
    expect(computeCancellable('REJECTED', tourStartsAt, early)).toBe(false);
    expect(computeCancellable('CANCELED', tourStartsAt, early)).toBe(false);
  });
});

describe('computeTourActions (2B′-R13)', () => {
  const today = new Date('2026-11-15T05:00:00Z'); // 서울 2026-11-15 14:00
  const at = (status: TourSummary['status'], startsAt: string) =>
    computeTourActions({ status, startsAt }, today);

  it('모집 중 · 탐방이 오늘이면 완료도 취소도 할 수 있다(당일 허용)', () => {
    expect(at('RECRUITING', '2026-11-15T14:00:00+09:00')).toEqual({
      completable: true,
      cancellable: true,
    });
  });

  it('모집 중 · 탐방이 내일이면 취소만 된다', () => {
    expect(at('RECRUITING', '2026-11-16T14:00:00+09:00')).toEqual({
      completable: false,
      cancellable: true,
    });
  });

  it('마감 · 탐방이 어제였으면 둘 다 된다', () => {
    expect(at('CLOSED', '2026-11-14T14:00:00+09:00')).toEqual({
      completable: true,
      cancellable: true,
    });
  });

  it('완료 · 취소된 탐방은 둘 다 안 된다', () => {
    expect(at('COMPLETED', '2026-11-14T14:00:00+09:00')).toEqual({
      completable: false,
      cancellable: false,
    });
    expect(at('CANCELED', '2026-11-20T14:00:00+09:00')).toEqual({
      completable: false,
      cancellable: false,
    });
  });
});

describe('completeActionState · cancelActionState (G09 · G10)', () => {
  const detail = (
    status: TourSummary['status'],
    actions: GuideTourDetail['actions'],
    startsAt = '2026-12-02T14:00:00+09:00',
  ): GuideTourDetail => ({
    tour: {
      ...tour,
      id: 6,
      status,
      startsAt,
      introduction: '',
      guideIntroduction: null,
      openChatUrl: null,
      myApplication: null,
    },
    courseStopCount: 0,
    actions,
  });
  const MY_TOURS = { label: '내가 개설한 탐방', to: '/guide/tours' };

  it('서버가 가능이라 하면 켜지고 사유 · 행동이 없다', () => {
    const open = detail('RECRUITING', { completable: true, cancellable: true });
    expect(completeActionState(open)).toEqual({ enabled: true, reason: null, action: null });
    expect(cancelActionState(open)).toEqual({ enabled: true, reason: null, action: null });
  });

  it('완료된 탐방: 완료는 이미 완료됐다고, 취소는 완료된 탐방은 취소할 수 없다고 한다', () => {
    const done = detail('COMPLETED', { completable: false, cancellable: false });
    expect(completeActionState(done)).toEqual({
      enabled: false,
      reason: '이미 완료된 탐방이에요.',
      action: MY_TOURS,
    });
    expect(cancelActionState(done)).toEqual({
      enabled: false,
      reason: '완료된 탐방은 취소할 수 없습니다.',
      action: MY_TOURS,
    });
  });

  it('취소된 탐방', () => {
    const canceled = detail('CANCELED', { completable: false, cancellable: false });
    expect(completeActionState(canceled)).toEqual({
      enabled: false,
      reason: '취소된 탐방은 완료할 수 없어요.',
      action: MY_TOURS,
    });
    expect(cancelActionState(canceled)).toEqual({
      enabled: false,
      reason: '이미 취소된 탐방이에요.',
      action: MY_TOURS,
    });
  });

  it('날짜 전: 완료는 날짜를 알리고 신청자 관리로 보낸다, 취소는 가능하다', () => {
    const before = detail('RECRUITING', { completable: false, cancellable: true });
    expect(completeActionState(before)).toEqual({
      enabled: false,
      reason: '탐방 날짜(12/02(수)) 이후에 완료할 수 있어요.',
      action: { label: '신청자 관리로 이동', to: '/guide/tours/6/applicants' },
    });
    expect(cancelActionState(before)).toEqual({ enabled: true, reason: null, action: null });
  });

  it('서버가 취소를 막는 그 밖의 경우(모집 중인데 불가)는 일반 사유', () => {
    const odd = detail('CLOSED', { completable: false, cancellable: false });
    expect(cancelActionState(odd)).toEqual({
      enabled: false,
      reason: '지금은 취소할 수 없어요.',
      action: MY_TOURS,
    });
  });
});
