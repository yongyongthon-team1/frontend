import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

describe('내가 개설한 탐방 (guide-a02)', () => {
  it('가이드 목록에 탐방 1이 먼저 보인다', async () => {
    await renderApp('/guide/tours', { as: 'guide' });
    expect(
      (await screen.findAllByText('경희대 국제캠퍼스 산업디자인학과 탐방'))[0],
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: '신청자 보기' });
    expect(links[0]).toHaveAttribute('href', '/guide/tours/1/applicants');
  });
});
