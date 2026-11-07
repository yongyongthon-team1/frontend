import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CourseStop } from '@/features/courses/model';
import { StopActionSheet, type StopActionSheetProps } from './StopActionSheet';

const STOP: CourseStop = {
  id: 7,
  order: 2,
  visitTime: '15:10',
  type: 'STORE',
  name: '서천 밥상',
  category: '한식',
  lat: 0,
  lng: 0,
  description: null,
  recommendationReason: '신청자 2명이 궁금해했어요.',
  storeId: 1,
  campusBuildingId: null,
  partnership: { discount: '10% 할인' },
  review: null,
  dataSource: null,
};

function renderSheet(props: Partial<StopActionSheetProps> = {}) {
  const calls: string[] = [];
  const handlers = {
    onMoveUp: vi.fn(() => calls.push('up')),
    onMoveDown: vi.fn(() => calls.push('down')),
    onEditNote: vi.fn(() => calls.push('note')),
    onRemove: vi.fn(() => calls.push('remove')),
    onClose: vi.fn(() => calls.push('close')),
  };
  render(
    <StopActionSheet
      stop={STOP}
      isFirst={false}
      isLast={false}
      canRemove
      busy={false}
      {...handlers}
      {...props}
    />,
  );
  return { calls, handlers, user: userEvent.setup() };
}

const ACTIONS = ['위로 이동', '아래로 이동', '한줄평', '빼기'];

describe('StopActionSheet (G03 ≡ 시트)', () => {
  it('제목은 지점 이름, 버튼은 위로 이동 · 아래로 이동 · 한줄평 · 빼기', () => {
    renderSheet();
    const sheet = screen.getByRole('dialog', { name: '서천 밥상' });
    for (const name of ACTIONS) {
      expect(within(sheet).getByRole('button', { name })).toBeEnabled();
    }
  });

  it('첫 지점은 위로 이동, 마지막 지점은 아래로 이동을 누를 수 없다', () => {
    renderSheet({ isFirst: true, isLast: true });
    expect(screen.getByRole('button', { name: '위로 이동' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '아래로 이동' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '한줄평' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '빼기' })).toBeEnabled();
  });

  it('지점이 1곳뿐이면(canRemove false) 빼기는 비활성이고 사유가 버튼 설명이다 (2C-R12 ②)', () => {
    renderSheet({ canRemove: false });
    const remove = screen.getByRole('button', { name: '빼기' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription('지점은 1곳 이상 있어야 해요.');
    expect(screen.getByRole('button', { name: '한줄평' })).toBeEnabled();
  });

  it('뺄 수 있으면 사유가 없다', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: '빼기' })).not.toHaveAccessibleDescription();
    expect(screen.queryByText('지점은 1곳 이상 있어야 해요.')).toBeNull();
  });

  it('처리 중이면 모두 비활성', () => {
    renderSheet({ busy: true });
    for (const name of ACTIONS) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it.each([
    ['위로 이동', 'up'],
    ['아래로 이동', 'down'],
    ['한줄평', 'note'],
    ['빼기', 'remove'],
  ])('%s를 누르면 시트를 먼저 닫고 그 동작을 시작한다', async (name, call) => {
    const { calls, user } = renderSheet();
    await user.click(screen.getByRole('button', { name }));
    expect(calls).toEqual(['close', call]);
  });

  it('onReplace를 주면 한줄평 다음 · 빼기 앞에 `다른 장소로 교체`, 누르면 시트를 먼저 닫고 시작한다 (2B′-R14)', async () => {
    const onReplace = vi.fn();
    const { calls, user } = renderSheet({ onReplace: () => (onReplace(), calls.push('replace')) });
    const sheet = screen.getByRole('dialog', { name: '서천 밥상' });
    expect(within(sheet).getAllByRole('button', { name: /이동|한줄평|교체|빼기/ })).toEqual([
      within(sheet).getByRole('button', { name: '위로 이동' }),
      within(sheet).getByRole('button', { name: '아래로 이동' }),
      within(sheet).getByRole('button', { name: '한줄평' }),
      within(sheet).getByRole('button', { name: '다른 장소로 교체' }),
      within(sheet).getByRole('button', { name: '빼기' }),
    ]);
    await user.click(within(sheet).getByRole('button', { name: '다른 장소로 교체' }));
    expect(calls).toEqual(['close', 'replace']);
    expect(onReplace).toHaveBeenCalledOnce();
  });

  it('onReplace가 없으면 `다른 장소로 교체`가 없다', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: '다른 장소로 교체' })).toBeNull();
  });

  it('처리 중이면 `다른 장소로 교체`도 비활성', () => {
    renderSheet({ busy: true, onReplace: vi.fn() });
    expect(screen.getByRole('button', { name: '다른 장소로 교체' })).toBeDisabled();
  });

  it('지점이 없으면 닫혀 있다', () => {
    renderSheet({ stop: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
