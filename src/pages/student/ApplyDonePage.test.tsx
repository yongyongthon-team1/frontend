import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

describe('신청 완료 (hs-s06)', () => {
  it('승인 대기 안내 · 신청한 탐방 · 다음 행동', async () => {
    await renderApp('/tours/1/apply/done', { as: 'student' });
    expect(await screen.findByText('⌛ 가이드 승인 대기 중')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '신청이 접수됐어요!' })).toBeInTheDocument();
    expect(
      screen.getByText('신청이 완료되었어요. 승인 결과는 내 탐방에서 확인해요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('신청한 탐방')).toBeInTheDocument();
    expect(await screen.findByText('경희대학교 국제캠퍼스')).toBeInTheDocument();
    expect(screen.getByText('가이드 승인 후 오픈채팅 링크가 공개돼요.')).toBeInTheDocument();
    expect(screen.getByText('상태 · 신청됨')).toBeInTheDocument();
    expect(screen.getByText('가이드가 신청 내용을 확인하고 있어요.')).toBeInTheDocument();
    expect(screen.getByText('거절 시 다른 추천 탐방으로 이동할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 탐방 확인하기' })).toHaveAttribute(
      'href',
      '/my-tours',
    );
    expect(screen.getByRole('link', { name: '다른 탐방 둘러보기' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).toBeNull();
  });
});
