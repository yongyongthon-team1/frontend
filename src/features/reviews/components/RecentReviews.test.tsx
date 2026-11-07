import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { formatShortDate } from '@/shared/lib/date';
import type { StoreReviewItem } from '../model';
import { RecentReviewList, RecentReviews } from './RecentReviews';

const ITEMS: StoreReviewItem[] = [
  {
    id: 5,
    rating: 4,
    content: '시험 기간엔 사람이 많지만 음식은 빨리 나와요.',
    author: '한*영',
    createdAt: '2026-10-09T15:00:00+09:00',
  },
  {
    id: 4,
    rating: 5,
    content: '양이 많고 친절해요.',
    author: '김*늘',
    createdAt: '2026-10-08T15:00:00+09:00',
  },
  {
    id: 3,
    rating: 3,
    content: '보통이에요.',
    author: '이*준',
    createdAt: '2026-10-07T15:00:00+09:00',
  },
];

describe('RecentReviews (R-02)', () => {
  it('처음엔 접혀 있어 내용이 안 보이고, 누르면 항목 3개가 펼쳐진다', async () => {
    const user = userEvent.setup();
    render(<RecentReviews items={ITEMS} />);
    const toggle = screen.getByRole('button', { name: '최근 리뷰 3개' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('양이 많고 친절해요.')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '최근 리뷰' })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list', { name: '최근 리뷰' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    // 별점이 서로 다른 셋(5 · 4 · 3) — 별점 이미지가 항목마다 하나씩 읽힌다(preflight D03).
    expect(within(list).getByRole('img', { name: '별점 4점' })).toBeInTheDocument();
    expect(within(list).getByRole('img', { name: '별점 5점' })).toBeInTheDocument();
    expect(within(list).getByRole('img', { name: '별점 3점' })).toBeInTheDocument();
    expect(
      within(list).getByText('시험 기간엔 사람이 많지만 음식은 빨리 나와요.'),
    ).toBeInTheDocument();
    expect(
      within(list).getByText(`한*영 · ${formatShortDate('2026-10-09T15:00:00+09:00')}`),
    ).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: '최근 리뷰' })).not.toBeInTheDocument();
  });

  it('항목이 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<RecentReviews items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RecentReviewList (리포트와 공유)', () => {
  it('접힘 없이 목록을 바로 그린다', () => {
    render(<RecentReviewList items={ITEMS} />);
    expect(
      within(screen.getByRole('list', { name: '최근 리뷰' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });
});
