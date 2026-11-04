import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { server } from '@/mocks/node';
import { applyToTour as applyToTourRule } from '@/mocks/rules/applications';
import { findApplicationId, renderApp } from '@/test/renderApp';

const STUDENT = 'student@demo.kr';

afterEach(() => {
  server.events.removeAllListeners('request:start'); // setup의 resetHandlers는 리스너를 지우지 않는다
});

describe('내 탐방 (hs-a05 · hs-s07)', () => {
  it('오늘 탐방 신청은 대기 카드 + 취소 비활성', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'APPLIED' });
    expect(await screen.findByText('신청 · 가이드 승인 대기')).toBeInTheDocument();
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}`);
    expect(await screen.findByRole('button', { name: '탐방 신청 취소' })).toBeDisabled();
    expect(screen.getByText('탐방 날짜가 되어 취소할 수 없어요.')).toBeInTheDocument();
    expect(screen.getByText('⌛ 가이드 승인 대기 중')).toBeInTheDocument();
  });

  it('미래 탐방 신청은 취소된다', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });
    mutate((db) =>
      applyToTourRule(
        db,
        db.users.find((u) => u.email === STUDENT)!.id,
        6,
        '수업이 궁금해요',
        new Date(),
      ),
    );
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 6)}`);
    await user.click(await screen.findByRole('button', { name: '탐방 신청 취소' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('신청을 취소할까요?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '신청 취소' }));
    expect(await screen.findByText('취소됨')).toBeInTheDocument();
    expect(await screen.findByText('신청을 취소했어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '탐방 신청 취소' })).not.toBeInTheDocument();
  });

  it('확정 코스면 지도·쿠폰 버튼과 오픈채팅', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    expect(await screen.findByText('승인 · 코스 확정')).toBeInTheDocument();
    const id = findApplicationId(STUDENT, 1);
    await router.navigate(`/my-tours/${id}`);
    expect(await screen.findByText('✓ 신청 승인 완료')).toBeInTheDocument();
    expect(screen.getByText('진행 상태 · 코스 확정')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '코스 지도 보기' })).toHaveAttribute(
      'href',
      `/my-tours/${id}/course`,
    );
    expect(screen.getByRole('link', { name: '쿠폰 보기' })).toHaveAttribute(
      'href',
      `/my-tours/${id}/coupons`,
    );
    const chat = screen.getByRole('link', { name: '오픈채팅 바로가기 ↗' });
    expect(chat).toHaveAttribute('href', 'https://open.kakao.com/o/demo-khu-design');
    expect(chat).toHaveAttribute('target', '_blank');
    expect(chat).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('승인됐지만 코스 확정 전이면 안내 문구를 보인다', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'APPROVED' });
    expect(await screen.findByText('승인 · 코스 준비 중')).toBeInTheDocument();
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 1)}`);
    expect(
      await screen.findByText('가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '코스 지도 보기' })).not.toBeInTheDocument();
  });

  it('코스가 확정돼도 승인 대기 신청은 지도·쿠폰 버튼 없이 승인 안내만 보인다', async () => {
    // 체크포인트 CONFIRMED에서도 최유진의 탐방 1 신청은 승인 대기다(시드).
    const { router } = await renderApp('/my-tours', {
      as: 'yujin@demo.kr',
      checkpoint: 'CONFIRMED',
    });
    await router.navigate(`/my-tours/${findApplicationId('yujin@demo.kr', 1)}`);
    expect(
      await screen.findByText('가이드가 신청을 승인하면 지도와 쿠폰이 공개돼요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('⌛ 가이드 승인 대기 중')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '코스 지도 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '쿠폰 보기' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('가이드가 코스를 확정하면 지도와 쿠폰이 공개돼요.'),
    ).not.toBeInTheDocument();
  });

  it('빈 목록', async () => {
    await renderApp('/my-tours', { as: 'student' });
    expect(await screen.findByText('아직 신청한 탐방이 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '추천받으러 가기' })).toHaveAttribute('href', '/');
  });

  it('거절된 신청은 취소 버튼과 오픈채팅이 없다', async () => {
    const { router } = await renderApp('/my-tours', { as: 'student', checkpoint: 'APPLIED' });
    const id = findApplicationId(STUDENT, 1);
    mutate((db) => {
      db.applications.find((a) => a.id === id)!.status = 'REJECTED';
    });
    await router.navigate(`/my-tours/${id}`);
    expect(await screen.findByText('신청 거절')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '탐방 신청 취소' })).not.toBeInTheDocument();
    expect(screen.queryByText('캠퍼스 & 상권 코스')).not.toBeInTheDocument();
    expect(screen.queryByText('오픈채팅 바로가기 ↗')).not.toBeInTheDocument();
    expect(screen.queryByText(/진행 상태/)).not.toBeInTheDocument();
  });

  it('취소된 신청은 진행 상태 줄이 없다', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });
    mutate((db) =>
      applyToTourRule(
        db,
        db.users.find((u) => u.email === STUDENT)!.id,
        6,
        '수업이 궁금해요',
        new Date(),
      ),
    );
    await router.navigate(`/my-tours/${findApplicationId(STUDENT, 6)}`);
    expect(await screen.findByText(/진행 상태 · 코스 준비 중/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: '탐방 신청 취소' }));
    await user.click(await screen.findByRole('button', { name: '신청 취소' }));
    expect(await screen.findByText('취소됨')).toBeInTheDocument();
    expect(screen.queryByText(/진행 상태/)).not.toBeInTheDocument();
  });

  it('취소가 실패하면 토스트를 보이고 신청을 다시 불러온다', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });
    mutate((db) =>
      applyToTourRule(
        db,
        db.users.find((u) => u.email === STUDENT)!.id,
        6,
        '수업이 궁금해요',
        new Date(),
      ),
    );
    const id = findApplicationId(STUDENT, 6);
    let detailGets = 0;
    server.use(
      http.post('/api/me/applications/:id/cancel', () =>
        HttpResponse.json({ code: 'CANCEL_AFTER_TOUR_DATE', message: 'x' }, { status: 409 }),
      ),
      http.get('/api/me/applications/:id', () => {
        detailGets += 1;
        return undefined; // 기본 핸들러로 넘긴다
      }),
    );
    await router.navigate(`/my-tours/${id}`);
    await user.click(await screen.findByRole('button', { name: '탐방 신청 취소' }));
    expect(detailGets).toBe(1);
    await user.click(await screen.findByRole('button', { name: '신청 취소' }));
    expect(await screen.findByText('탐방 날짜가 되어 취소할 수 없어요.')).toBeInTheDocument();
    await waitFor(() => expect(detailGets).toBe(2));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('취소하면 그 신청의 쿠폰도 다시 불러온다(취소하면 발급된 쿠폰이 만료된다)', async () => {
    const { user, router } = await renderApp('/my-tours', { as: 'student' });
    mutate((db) =>
      applyToTourRule(
        db,
        db.users.find((u) => u.email === STUDENT)!.id,
        6,
        '수업이 궁금해요',
        new Date(),
      ),
    );
    const id = findApplicationId(STUDENT, 6);
    let couponGets = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'GET' && new URL(request.url).pathname === '/api/me/coupons') {
        couponGets++;
      }
    });
    await router.navigate(`/my-tours/${id}/coupons`);
    await waitFor(() => expect(couponGets).toBe(1));

    await router.navigate(`/my-tours/${id}`);
    await user.click(await screen.findByRole('button', { name: '탐방 신청 취소' }));
    await user.click(await screen.findByRole('button', { name: '신청 취소' }));
    expect(await screen.findByText('취소됨')).toBeInTheDocument();

    await router.navigate(`/my-tours/${id}/coupons`);
    await waitFor(() => expect(couponGets).toBe(2));
  });

  it('목록 카드는 라벨·설명을 보이고 행동만 링크다', async () => {
    await renderApp('/my-tours', { as: 'student', checkpoint: 'APPLIED' });
    expect(await screen.findByText('신청 · 가이드 승인 대기')).toBeInTheDocument();
    expect(screen.getByText('승인된 탐방의 오픈채팅 링크만 공개됩니다.')).toBeInTheDocument();
    expect(screen.getByText('신청한 탐방 · 상태별 목록')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '상세 보기 →' })).toHaveAttribute(
      'href',
      `/my-tours/${findApplicationId(STUDENT, 1)}`,
    );
  });
});
