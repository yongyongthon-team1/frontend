import { beforeEach, describe, expect, it } from 'vitest';
import { createSession, mutate, resetDb } from '@/mocks/db/store';
import { DEMO_EMAILS } from '@/shared/config/demoAccounts';
import { configureHttp } from '@/shared/lib/http';
import {
  getApplicantsBoard,
  getGuideTours,
  getMyApplication,
  getMyApplications,
  postApplication,
  postApprove,
  postCancelApplication,
  postReject,
} from './api';

function loginAs(email: string) {
  const token = mutate((db) => {
    const user = db.users.find((u) => u.email === email);
    if (!user) throw new Error(`${email} 없음`);
    return createSession(db, user.id);
  });
  configureHttp({ baseUrl: '/api', getToken: () => token, onUnauthorized: () => {} });
}

describe('신청 API (MSW 목업)', () => {
  beforeEach(() => {
    resetDb({ today: new Date() });
  });

  it('고교생: 신청 → 내 신청 목록 · 상세 → 취소', async () => {
    loginAs(DEMO_EMAILS.student);
    const created = await postApplication(3, '밥집이 궁금해요');
    expect(created.status).toBe('PENDING');
    expect(created.tour.id).toBe(3);

    expect((await getMyApplications()).map((a) => a.id)).toContain(created.id);
    expect((await getMyApplication(created.id)).motivation).toBe('밥집이 궁금해요');

    const canceled = await postCancelApplication(created.id);
    expect(canceled.status).toBe('CANCELED');
  });

  it('신청 실패는 에러 코드로 온다', async () => {
    loginAs(DEMO_EMAILS.student);
    await expect(postApplication(2, '밥집이 궁금해요')).rejects.toMatchObject({
      code: 'TOUR_CLOSED',
    });
  });

  it('가이드: 내 탐방 목록 · 신청자 보드 · 승인 · 거절', async () => {
    loginAs(DEMO_EMAILS.student);
    const first = await postApplication(1, '밥집이 궁금해요');

    loginAs(DEMO_EMAILS.guide);
    const tours = await getGuideTours();
    expect(tours.some((t) => t.id === 1)).toBe(true);

    const board = await getApplicantsBoard(1);
    expect(board.tour.id).toBe(1);
    expect(board.applicants.some((a) => a.id === first.id)).toBe(true);

    const approved = await postApprove(first.id);
    expect(approved.applicants.find((a) => a.id === first.id)?.status).toBe('APPROVED');
    await expect(postReject(first.id)).rejects.toMatchObject({ code: 'ALREADY_PROCESSED' });
  });
});
