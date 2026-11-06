import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mutate } from '@/mocks/db/store';
import { applyToTour as applyToTourRule } from '@/mocks/rules/applications';
import { findApplicationId, renderApp } from '@/test/renderApp';

const STUDENT = 'student@demo.kr';

/** 김민지가 60일 뒤 탐방 6에 신청한 상태(취소 가능한 미래 신청)를 만든다. */
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

describe('내 탐방 · 예정 (H06)', () => {
  it('제목 · 탭 · 빈 상태', async () => {
    await renderApp('/my-tours', { as: 'student' });
    expect(await screen.findByRole('heading', { name: '내 탐방' })).toBeInTheDocument();
    expect(screen.getByText('신청한 탐방과 참여 현황을 확인해요.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '예정된 탐방' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(await screen.findByText('아직 신청한 탐방이 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '추천받으러 가기' })).toHaveAttribute('href', '/');
  });

  it('승인 대기 신청은 `승인 대기` 소제목 아래 카드이고 카드 전체가 상세 링크', async () => {
    await renderApp('/my-tours', { as: 'student', checkpoint: 'APPLIED' });
    expect(await screen.findByRole('heading', { name: '승인 대기' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '다가오는 탐방' })).not.toBeInTheDocument();
    const card = screen.getByRole('link', { name: /신청 접수 완료/ });
    expect(card).toHaveAttribute('href', `/my-tours/${findApplicationId(STUDENT, 1)}`);
    expect(within(card).getByText('승인 대기')).toBeInTheDocument();
    expect(within(card).getByText('신청 접수 완료 · 가이드 승인 대기 중')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '코스 확인하기' })).not.toBeInTheDocument();
  });

  it('코스가 확정된 승인 신청은 `참여 확정` 카드 + 코스 확인하기', async () => {
    await renderApp('/my-tours', { as: 'student', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { name: '다가오는 탐방' })).toBeInTheDocument();
    expect(screen.getByText('1건')).toBeInTheDocument();
    const id = findApplicationId(STUDENT, 1);
    const course = screen.getByRole('link', { name: '코스 확인하기' });
    expect(course).toHaveAttribute('href', `/my-tours/${id}/course`);
    const card = course.closest('article')!;
    expect(within(card).getByText('참여 확정')).toBeInTheDocument();
    expect(within(card).getByText(/명 정원/)).toBeInTheDocument();
    // 카드 윗부분은 상세로 가는 별개의 링크(링크 안에 링크가 겹치지 않는다).
    const detail = within(card).getByRole('link', { name: /참여 확정/ });
    expect(detail).toHaveAttribute('href', `/my-tours/${id}`);
    expect(detail).not.toContainElement(course);
  });

  it('승인됐지만 코스 확정 전이면 코스 확인하기 대신 안내', async () => {
    await renderApp('/my-tours', { as: 'student', checkpoint: 'APPROVED' });
    expect(await screen.findByRole('heading', { name: '다가오는 탐방' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '코스 확인하기' })).not.toBeInTheDocument();
    expect(screen.getByText('가이드가 코스를 확정하면 열려요.')).toBeInTheDocument();
  });

  it('승인 대기와 예정이 함께 있으면 두 소제목', async () => {
    // 홈에서 시작해(신청 목록을 아직 안 불러온 상태) 데이터를 만든 뒤 들어간다.
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'CONFIRMED' });
    applyFuture();
    await router.navigate('/my-tours');
    expect(await screen.findByRole('heading', { name: '승인 대기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '다가오는 탐방' })).toBeInTheDocument();
    expect(screen.getByText('1건')).toBeInTheDocument();
  });
});

describe('내 탐방 · 지난 탐방 (H09)', () => {
  it('?tab=past로 들어오면 지난 탐방 탭 · 제목이 바뀐다', async () => {
    await renderApp('/my-tours?tab=past', { as: 'student', checkpoint: 'CONFIRMED' });
    expect(await screen.findByRole('heading', { name: '지난 탐방' })).toBeInTheDocument();
    expect(screen.getByText('지금까지 다녀온 캠퍼스를 모아봤어요.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('아직 지난 탐방이 없어요.')).toBeInTheDocument();
    // 탭 ↔ 패널 연결: 선택된 탭이 패널을 가리키고 패널의 이름은 그 탭이다.
    expect(screen.getByRole('tab', { name: '지난 탐방' })).toHaveAttribute(
      'aria-controls',
      screen.getByRole('tabpanel', { name: '지난 탐방' }).id,
    );
  });

  it('탭을 바꾸면 주소(?tab=past)가 따라 바뀐다', async () => {
    const { user, router } = await renderApp('/my-tours', {
      as: 'student',
      checkpoint: 'CONFIRMED',
    });
    await user.click(await screen.findByRole('tab', { name: '지난 탐방' }));
    expect(router.state.location.search).toBe('?tab=past');
    expect(await screen.findByRole('heading', { name: '지난 탐방' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '예정된 탐방' }));
    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('heading', { name: '내 탐방' })).toBeInTheDocument();
  });

  it('끝난 탐방은 참여 완료 · 리뷰 작성 가능 + 리뷰 남기기', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'CONFIRMED' });
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.status = 'COMPLETED';
    });
    await router.navigate('/my-tours?tab=past');
    const link = await screen.findByRole('link', { name: '리뷰 남기기' });
    expect(link).toHaveAttribute('href', `/my-tours/${findApplicationId(STUDENT, 1)}/coupons`);
    const card = link.closest('article')!;
    expect(within(card).getByText('참여 완료')).toBeInTheDocument();
    expect(within(card).getByText('리뷰 작성 가능')).toBeInTheDocument();
  });

  it('끝난 탐방에 쿠폰이 없으면 탐방 기록 보기', async () => {
    const { router } = await renderApp('/', { as: 'student', checkpoint: 'APPROVED' });
    mutate((db) => {
      db.tours.find((t) => t.id === 1)!.status = 'COMPLETED';
    });
    await router.navigate('/my-tours?tab=past');
    expect(await screen.findByRole('link', { name: '탐방 기록 보기' })).toHaveAttribute(
      'href',
      `/my-tours/${findApplicationId(STUDENT, 1)}`,
    );
    expect(screen.getByText('참여 완료')).toBeInTheDocument();
    expect(screen.queryByText('리뷰 작성 가능')).not.toBeInTheDocument();
  });

  it.each([
    ['REJECTED', '신청 거절'],
    ['CANCELED', '취소됨'],
  ] as const)('%s 신청은 `%s` 칩 + 탐방 기록 보기', async (status, chip) => {
    const { router } = await renderApp('/', { as: 'student' });
    applyFuture();
    const id = findApplicationId(STUDENT, 6);
    mutate((db) => {
      db.applications.find((a) => a.id === id)!.status = status;
    });
    await router.navigate('/my-tours?tab=past');
    const link = await screen.findByRole('link', { name: '탐방 기록 보기' });
    expect(link).toHaveAttribute('href', `/my-tours/${id}`);
    expect(within(link.closest('article')!).getByText(chip)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '리뷰 남기기' })).not.toBeInTheDocument();
  });
});
