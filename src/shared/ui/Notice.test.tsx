import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('기본은 info: brand-soft 바탕 · muted 글자, 역할은 따로 붙이지 않는다', () => {
    render(<Notice>고교생은 탐방 신청 전 보호자 동의가 필요해요.</Notice>);
    const box = screen.getByText('고교생은 탐방 신청 전 보호자 동의가 필요해요.');
    expect(box).toHaveClass('bg-brand-soft', 'text-muted');
    expect(box).not.toHaveAttribute('role');
  });

  it('danger: danger-soft 바탕 · danger 글자', () => {
    render(<Notice tone="danger">반려 사유: 사진이 흐려요.</Notice>);
    expect(screen.getByText('반려 사유: 사진이 흐려요.')).toHaveClass(
      'bg-danger-soft',
      'text-danger',
    );
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
