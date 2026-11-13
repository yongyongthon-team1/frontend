import { describe, expect, it } from 'vitest';
import type { Me } from '@/features/auth/model';
import { applyButtonState, type TourDetail } from './model';

const base: Me = {
  id: 1,
  email: 'a@b.c',
  name: '김민지',
  role: 'HIGH_SCHOOL',
  verificationStatus: 'APPROVED',
  rejectionReason: null,
  guardianStatus: 'AGREED',
  studentProfile: null,
  guideProfile: null,
  businessVerified: false,
  storeId: null,
};

const tour: TourDetail = {
  id: 7,
  title: '경희대 컴퓨터공학과 투어',
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
  introduction: '캠퍼스를 함께 걸어요.',
  guideIntroduction: null,
  openChatUrl: null,
  myApplication: null,
};

const rec = '/tours?school=2&major=a&wish=b';
const recAction = { label: '다른 투어 보기', to: rec };

describe('applyButtonState', () => {
  it('비로그인이면 로그인 유도(활성)', () =>
    expect(applyButtonState(null, tour, rec)).toEqual({
      kind: 'LOGIN',
      enabled: true,
      label: '로그인하고 신청하기',
      reason: null,
      action: { label: '로그인', to: '/login?next=/tours/7' },
    }));

  it('고교생이 아니면 신청 불가(사유·행동 없음)', () =>
    expect(applyButtonState({ ...base, role: 'UNIVERSITY' }, tour, rec)).toEqual({
      kind: 'NOT_STUDENT',
      enabled: false,
      label: '고교생만 신청할 수 있어요',
      reason: null,
      action: null,
    }));

  it.each(['PENDING', 'APPROVED'] as const)('내 신청이 %s면 신청됨', (status) =>
    expect(applyButtonState(base, { ...tour, myApplication: { id: 11, status } }, rec)).toEqual({
      kind: 'APPLIED',
      enabled: false,
      label: '신청됨',
      reason: '이미 신청한 투어예요.',
      action: { label: '내 투어에서 상태 확인', to: '/my-tours' },
    }),
  );

  it('내 신청이 거절이면 신청 불가', () =>
    expect(
      applyButtonState(base, { ...tour, myApplication: { id: 11, status: 'REJECTED' } }, rec),
    ).toEqual({
      kind: 'REJECTED',
      enabled: false,
      label: '신청 불가',
      reason: '거절된 투어에는 다시 신청할 수 없어요.',
      action: recAction,
    }));

  it.each(['CANCELED', 'COMPLETED'] as const)('투어가 %s면 모집 종료', (status) =>
    expect(applyButtonState(base, { ...tour, status }, rec)).toEqual({
      kind: 'NOT_RECRUITING',
      enabled: false,
      label: '모집 종료',
      reason: '모집이 끝난 투어예요.',
      action: recAction,
    }),
  );

  it('CLOSED면 정원 마감', () =>
    expect(applyButtonState(base, { ...tour, status: 'CLOSED' }, rec)).toEqual({
      kind: 'CLOSED',
      enabled: false,
      label: '정원 마감',
      reason: '남은 자리가 없어요.',
      action: recAction,
    }));

  it('남은 자리가 0이면 모집 중이어도 정원 마감', () =>
    expect(applyButtonState(base, { ...tour, remainingSeats: 0 }, rec).kind).toBe('CLOSED'));

  it('마감 투어는 인증보다 마감 사유가 먼저', () => {
    const s = applyButtonState(
      { ...base, verificationStatus: 'PENDING' },
      { ...tour, status: 'CLOSED', remainingSeats: 0 },
      '/tours?school=2&major=a&wish=b',
    );
    expect(s).toMatchObject({
      kind: 'CLOSED',
      enabled: false,
      reason: '남은 자리가 없어요.',
      action: { label: '다른 투어 보기', to: '/tours?school=2&major=a&wish=b' },
    });
  });

  it('내 신청 거절은 모집 종료보다 먼저', () =>
    expect(
      applyButtonState(
        base,
        { ...tour, status: 'COMPLETED', myApplication: { id: 11, status: 'REJECTED' } },
        rec,
      ).kind,
    ).toBe('REJECTED'));

  it('내 신청이 취소 상태면 다시 신청할 수 있다', () =>
    expect(
      applyButtonState(base, { ...tour, myApplication: { id: 11, status: 'CANCELED' } }, rec).kind,
    ).toBe('APPLY'));

  it('재학 인증 전이면 인증 단계로', () =>
    expect(applyButtonState({ ...base, verificationStatus: 'PENDING' }, tour, '/')).toEqual({
      kind: 'NEED_VERIFICATION',
      enabled: false,
      label: '투어 신청하기',
      reason: '학생증 승인·보호자 동의 완료 후 신청할 수 있어요.',
      action: { label: '역할 인증 단계로 이동', to: '/verify' },
    }));

  it('보호자 동의 전이면 보호자 동의 요청 화면으로', () =>
    expect(applyButtonState({ ...base, guardianStatus: 'PENDING' }, tour, '/').action).toEqual({
      label: '역할 인증 단계로 이동',
      to: '/verify/guardian',
    }));

  it('모든 조건을 갖추면 신청 가능(활성)', () =>
    expect(applyButtonState(base, tour, rec)).toEqual({
      kind: 'APPLY',
      enabled: true,
      label: '투어 신청하기',
      reason: null,
      action: { label: '투어 신청하기', to: '/tours/7/apply' },
    }));
});
