import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

describe('신청 완료 (hs-s06 · V2 H08)', () => {
  it('승인 대기 안내 · 신청한 탐방 · 단계 · 다음 행동', async () => {
    await renderApp('/tours/1/apply/done', { as: 'student' });
    expect(await screen.findByText('승인 대기 중')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '신청 완료 · 승인 대기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '신청이 접수됐어요!' })).toBeInTheDocument();
    expect(screen.getByText('가이드가 신청 내용을 확인하고 있어요.')).toBeInTheDocument();
    expect(screen.getByText('확정되면 내 탐방에서 바로 확인할 수 있어요.')).toBeInTheDocument();
    expect(await screen.findByText('신청 완료')).toBeInTheDocument();
    expect(
      await screen.findByText(/^\d\d\.\d\d \(.\) · 경희대학교 국제캠퍼스$/),
    ).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toEqual(['01 신청 접수', '02 가이드 승인 대기', '03 승인 후 오픈채팅·코스 확인']);
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: '내 탐방으로 가기' })).toHaveAttribute(
      'href',
      '/my-tours',
    );
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
  });
});
