import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('기본은 info: brand-soft 바탕 · muted 글자, 역할은 따로 붙이지 않는다', () => {
    render(<Notice>고교생은 투어 신청 전 보호자 동의가 필요해요.</Notice>);
    const box = screen.getByText('고교생은 투어 신청 전 보호자 동의가 필요해요.');
    expect(box).toHaveClass('bg-brand-soft', 'text-muted');
    expect(box).not.toHaveAttribute('role');
  });

  it('danger: danger-soft 바탕 · 본문색(ink) 글자 + danger 왼쪽 띠 (danger 글자는 대비 AA 미달)', () => {
    render(<Notice tone="danger">반려 사유: 사진이 흐려요.</Notice>);
    const box = screen.getByText('반려 사유: 사진이 흐려요.');
    expect(box).toHaveClass('bg-danger-soft', 'text-ink', 'border-l-4', 'border-danger');
    expect(box).not.toHaveClass('text-danger');
  });

  it('role · className을 넘길 수 있다', () => {
    render(
      <Notice role="alert" className="mt-4">
        알림
      </Notice>,
    );
    expect(screen.getByRole('alert')).toHaveClass('mt-4');
  });
});
