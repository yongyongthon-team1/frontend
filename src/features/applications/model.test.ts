import { describe, expect, it } from 'vitest';
import type { TourSummary } from '@/features/tours/model';
import { myTourDisplay, type MyApplication } from './model';

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

const rec = '/recommendations?q=a';

describe('myTourDisplay', () => {
  it('가이드가 탐방을 취소하면 쿠폰 만료 안내', () =>
    expect(
      myTourDisplay({ ...app, status: 'CANCELED', tour: { ...tour, status: 'CANCELED' } }, rec),
    ).toEqual({
      label: '취소 · 쿠폰 만료',
      description: '경희대 컴퓨터공학과 탐방 · 가이드가 탐방을 취소했어요',
      tone: 'neutral',
      action: null,
    }));

  it('내가 신청을 취소한 경우', () =>
    expect(myTourDisplay({ ...app, status: 'CANCELED' }, rec)).toEqual({
      label: '취소 · 쿠폰 만료',
      description: '경희대 컴퓨터공학과 탐방 · 신청을 취소했어요',
      tone: 'neutral',
      action: null,
    }));

  it('거절되면 추천 탐방으로 다시 이동', () =>
    expect(myTourDisplay({ ...app, status: 'REJECTED' }, rec)).toEqual({
      label: '거절 · 다른 탐방 보기',
      description: '경희대 컴퓨터공학과 탐방 · 신청 거절',
      tone: 'danger',
      action: { label: '추천 탐방으로 다시 이동', to: rec },
    }));

  it('승인 대기 + 취소 가능', () =>
    expect(myTourDisplay(app, rec)).toEqual({
      label: '신청 · 가이드 승인 대기',
      description: '경희대 컴퓨터공학과 탐방 · 11/15(일)',
      tone: 'warning',
      action: { label: '승인 전 직접 취소 가능', to: '/my-tours/21' },
    }));

  it('승인 대기 + 취소 불가면 상세 보기', () =>
    expect(myTourDisplay({ ...app, cancellable: false }, rec).action).toEqual({
      label: '상세 보기',
      to: '/my-tours/21',
    }));

  it('승인 + 완료된 탐방이면 리뷰 쓰기', () =>
    expect(
      myTourDisplay(
        {
          ...app,
          status: 'APPROVED',
          courseStatus: 'CONFIRMED',
          tour: { ...tour, status: 'COMPLETED' },
        },
        rec,
      ),
    ).toEqual({
      label: '탐방 완료 · 리뷰 쓰기',
      description: '경희대 컴퓨터공학과 탐방 · 다녀온 상점에 리뷰를 남겨 주세요',
      tone: 'success',
      action: { label: '쿠폰 쓴 상점 리뷰 쓰기', to: '/my-tours/21/coupons' },
    }));

  it('승인 + 확정 코스면 지도 링크', () =>
    expect(myTourDisplay({ ...app, status: 'APPROVED', courseStatus: 'CONFIRMED' }, '/')).toEqual({
      label: '승인 · 코스 확정',
      description: '경희대 컴퓨터공학과 탐방 · 지도와 쿠폰이 열렸어요',
      tone: 'success',
      action: { label: '코스 지도 보기', to: `/my-tours/${app.id}/course` },
    }));

  it.each([null, 'DRAFT'] as const)('승인 + 코스 %s면 준비 중', (courseStatus) =>
    expect(myTourDisplay({ ...app, status: 'APPROVED', courseStatus }, rec)).toEqual({
      label: '승인 · 코스 준비 중',
      description: '경희대 컴퓨터공학과 탐방 · 오픈채팅 공개',
      tone: 'info',
      action: { label: '확정되면 코스 지도와 쿠폰 열림', to: '/my-tours/21' },
    }),
  );
});
