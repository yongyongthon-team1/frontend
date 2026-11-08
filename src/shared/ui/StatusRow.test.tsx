import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusRow } from './StatusRow';

describe('StatusRow', () => {
  it('라벨(13 muted)과 값(17 Bold)을 흰 상자에 그린다', () => {
    const { container } = render(
      <StatusRow label="학생증 인증" value="승인 완료" tone="success" />,
    );
    expect(screen.getByText('학생증 인증')).toHaveClass('text-[13px]', 'text-muted');
    expect(screen.getByText('승인 완료')).toHaveClass('text-[17px]', 'font-bold', 'text-success');
    expect(container.firstChild).toHaveClass('bg-surface');
  });

  it('tone을 안 주면 본문색(ink)이다', () => {
    render(<StatusRow label="보호자 참여 동의" value="동의 대기" />);
    expect(screen.getByText('동의 대기')).toHaveClass('text-ink');
  });

  it('라벨은 dt, 값은 dd라서 값이 라벨 뒤에 이어 읽힌다', () => {
    render(<StatusRow label="학생증 인증" value="심사 중" tone="warning" />);
    expect(screen.getByText('학생증 인증').tagName).toBe('DT');
    expect(screen.getByText('심사 중').tagName).toBe('DD');
    expect(screen.getByText('심사 중')).toHaveClass('text-local');
  });
});
