import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TourWish } from '../model';
import { WishCard } from './WishCard';

const wish: TourWish = {
  id: 1,
  universityId: 2,
  campusLabel: '경희대학교 국제캠퍼스',
  major: '산업디자인',
  wish: '첫 줄\n둘째 줄',
  date: null,
  createdAt: '2026-11-04T21:00:00+09:00',
};

describe('WishCard', () => {
  it('학교 · 학과, 줄바꿈 그대로의 원문, `{MM.DD} 남김`, 오른쪽 action', () => {
    render(<WishCard wish={wish} action={<a href="/x">고치기</a>} />);
    expect(screen.getByText('경희대학교 국제캠퍼스 · 산업디자인')).toBeInTheDocument();
    const text = screen.getByTestId('wish-text');
    expect(text.textContent).toBe('첫 줄\n둘째 줄');
    expect(text).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(screen.getByText('11.04 남김')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '고치기' })).toBeInTheDocument();
  });

  it('남긴 시각을 모르면(실서버 수정 응답) 왼쪽을 비우고, action이 없어도 그려진다', () => {
    render(<WishCard wish={{ ...wish, createdAt: null }} />);
    expect(screen.queryByText(/남김/)).toBeNull();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
