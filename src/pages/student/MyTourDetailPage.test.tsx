import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { applyToTour as applyToTourRule } from '@/mocks/rules/applications';
import { findApplicationId, renderApp } from '@/test/renderApp';

const STUDENT = 'student@demo.kr';

function applyFuture() {
  mutate((db) =>
    applyToTourRule(
      db,
      db.users.find((u) => u.email === STUDENT)!.id,
      6,
      '수업이 궁금해요',
      new Date(),
    ),
  );
}

describe('신청 내역 상세 (H10)', () => {
  it('오늘 탐방 신청은 승인 대기 · 취소 버튼 비활성 + 사유', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'APPLIED' });
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}`);
    expect(await screen.findByRole('heading', { name: '신청 내역' })).toBeInTheDocument();
    expect(screen.getByText('참여 일정을 확인하고 준비해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('가이드 승인 상태')).toBeInTheDocument();
    expect(screen.getAllByText('승인 대기').length).toBeGreaterThan(0);
    const cancel = screen.getByRole('button', { name: '신청 취소하기' });
    expect(cancel).toBeDisabled();
    expect(screen.getByText('탐방 날짜가 되어 취소할 수 없어요.')).toBeInTheDocument();
    expect(
      screen.getByText('신청을 취소하면 참여 권한과 발급 쿠폰이 무효화돼요.'),
    ).toBeInTheDocument();
  });

  it('확정 코스면 참여 확정 · 코스 보기 · 오픈채팅 링크', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'CONFIRMED' });
    const id = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${id}`);
    expect(await screen.findByText('가이드 승인 상태')).toBeInTheDocument();
    expect(screen.getAllByText('참여 확정')).toHaveLength(2); // 카드 칩 + 승인 상태 행
    const course = screen.getByRole('link', { name: /코스 보기/ });
    expect(course).toHaveAttribute('href', `/my-tours/${id}/course`);
    expect(within(course).getByText('캠퍼스 · 전공 Q&A · 로컬 상점')).toBeInTheDocument();
    const chat = screen.getByRole('link', { name: /가이드 오픈채팅/ });
    expect(chat).toHaveAttribute('href', 'https://open.kakao.com/o/demo-khu-design');
    expect(chat).toHaveAttribute('target', '_blank');
    expect(chat).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(chat).getByText('승인된 참가자만 입장할 수 있어요.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '쿠폰 보기' })).not.toBeInTheDocument();
  });

  it('승인됐지만 코스 확정 전이면 코스 링크 없이 안내 문구', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'APPROVED' });
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}`);
    expect(
      await screen.findByText('가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /코스 보기/ })).not.toBeInTheDocument();
  });

  it('코스가 확정돼도 승인 대기 신청은 코스 링크 · 오픈채팅 없이 승인 안내만', async () => {
    // 체크포인트 CONFIRMED에서도 최유진의 탐방 1 신청은 승인 대기다(시드).
    const { router } = await renderApp('/', { as: 'yujin@demo.kr', checkpoint: 'CONFIRMED' });
    await router.navigate(`/my-tours/${findApplicationId('yujin@demo.kr', 1)}`);
    expect(
      await screen.findByText('가이드가 신청을 승인하면 지도와 쿠폰이 공개돼요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /코스 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /가이드 오픈채팅/ })).not.toBeInTheDocument();
    expect(
      screen.queryByText('가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.'),
    ).not.toBeInTheDocument();
  });

  it('미래 탐방 신청은 신청 취소하기로 취소 확인 화면에 간다', async () => {
    const { user, router } = await renderApp('/', { as: 'student' });
    applyFuture();
    const id = findApplicationId(STUDENT, 6);
    await router.navigate(`/my-tours/${id}`);
    await user.click(await screen.findByRole('button', { name: '신청 취소하기' }));
    expect(router.state.location.pathname).toBe(`/my-tours/${id}/cancel`);
    expect(
      await screen.findByRole('heading', { name: '정말 신청을 취소할까요?' }),
    ).toBeInTheDocument();
  });

  it.each(['REJECTED', 'CANCELED'] as const)(
    '%s 신청은 취소 버튼 · 캡션 · 코스 · 오픈채팅 · 진행 상태가 없다',
    async (status) => {
      const { router } = await renderApp('/', { as: 'student', checkpoint: 'CONFIRMED' });
      const id = findApplicationId(STUDENT, 1);
      mutate((db) => {
        db.applications.find((a) => a.id === id)!.status = status;
      });
      await router.navigate(`/my-tours/${id}`);
      expect(
        await screen.findAllByText(status === 'REJECTED' ? '신청 거절' : '취소됨'),
      ).toHaveLength(2); // 카드 칩 + 승인 상태 행
      expect(screen.queryByRole('button', { name: '신청 취소하기' })).not.toBeInTheDocument();
      expect(screen.queryByText(/신청을 취소하면/)).not.toBeInTheDocument();
      expect(screen.queryByText(/코스 보기/)).not.toBeInTheDocument();
      expect(screen.queryByText(/가이드 오픈채팅/)).not.toBeInTheDocument();
      expect(screen.queryByText(/진행 상태/)).not.toBeInTheDocument();
    },
  );

  it.each(['COMPLETED', 'CANCELED'] as const)(
    '%s 탐방의 승인된 신청은 취소 버튼 · 무효화 안내가 없고, 뒤로 가기는 지난 탐방 탭이다',
    async (tourStatus) => {
      const { router, user } = await renderApp('/my-tours?tab=past', {
        as: 'student',
        checkpoint: 'CONFIRMED',
      });
      const id = findApplicationId(STUDENT, 1);
      mutate((db) => {
        db.tours.find((t) => t.id === 1)!.status = tourStatus;
      });
      await router.navigate(`/my-tours/${id}`);
      expect(await screen.findByText('가이드 승인 상태')).toBeInTheDocument();
      expect(screen.getAllByText('참여 확정')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: '신청 취소하기' })).not.toBeInTheDocument();
      expect(screen.queryByText('탐방 날짜가 되어 취소할 수 없어요.')).not.toBeInTheDocument();
      expect(screen.queryByText(/신청을 취소하면/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
      expect(router.state.location.pathname).toBe('/my-tours');
      expect(router.state.location.search).toBe('?tab=past');
    },
  );

  it('거절된 신청의 뒤로 가기도 지난 탐방 탭이다(탐방은 아직 모집 중이어도)', async () => {
    const { router, user } = await renderApp('/', { as: 'student', checkpoint: 'CONFIRMED' });
    const id = findApplicationId(STUDENT, 1);
    mutate((db) => {
      db.applications.find((a) => a.id === id)!.status = 'REJECTED';
    });
    await router.navigate(`/my-tours/${id}`);
    await screen.findByText('가이드 승인 상태'); // 불러오는 동안의 뒤로 가기는 예정 탭이다
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.search).toBe('?tab=past');
  });

  it('진행 예정 탐방의 신청은 뒤로 가기가 예정된 탐방 탭이다', async () => {
    const { router, user } = await renderApp('/', { as: 'student', checkpoint: 'APPLIED' });
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}`);
    await screen.findByText('가이드 승인 상태');
    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));
    expect(router.state.location.pathname).toBe('/my-tours');
    expect(router.state.location.search).toBe('');
  });

  it('승인된 신청 + 완료된 탐방이면 리뷰 남기기 행이 쿠폰 목록으로 간다 (H10 · R-01 진입)', async () => {
    const { router } = await renderApp('/', { as: 'seojun@demo.kr' });
    const id = findApplicationId('seojun@demo.kr', 7);
    await router.navigate(`/my-tours/${id}`);
    const review = await screen.findByRole('link', { name: /리뷰 남기기/ });
    expect(review).toHaveAttribute('href', `/my-tours/${id}/coupons`);
    expect(within(review).getByText('다녀온 상점에 리뷰를 남겨 주세요')).toBeInTheDocument();
  });

  it('진행 예정 탐방이나 완료되지 않은 신청에는 리뷰 남기기 행이 없다 (양성 대조: 완료 탐방에는 있다)', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'CONFIRMED' });
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}`);
    await screen.findByText('가이드 승인 상태');
    expect(screen.queryByRole('link', { name: /리뷰 남기기/ })).not.toBeInTheDocument();
  });
});
