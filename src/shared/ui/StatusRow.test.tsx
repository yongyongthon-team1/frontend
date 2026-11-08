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
    render(<StatusRow label="보호자 참여 동의" value="동의 요청 대기" />);
    expect(screen.getByText('동의 요청 대기')).toHaveClass('text-ink');
  });

  it('라벨은 dt, 값은 dd라서 값이 라벨 뒤에 이어 읽힌다', () => {
    render(<StatusRow label="학생증 인증" value="심사 중" tone="info" />);
    expect(screen.getByText('학생증 인증').tagName).toBe('DT');
    expect(screen.getByText('심사 중').tagName).toBe('DD');
    expect(screen.getByText('심사 중')).toHaveClass('text-brand');
  });

  // 주황 글자 on 흰 바탕은 약 2.1:1이라 AA 미달 — `StatusChip`과 같은 규칙: 글자는 본문색, tone은 점으로.
  it('warning은 본문색(ink) 글자 + 주황 점이다 (글자를 주황으로 칠하지 않는다)', () => {
    render(<StatusRow label="보호자 참여 동의" value="링크 만료" tone="warning" />);
    const value = screen.getByText('링크 만료');
    expect(value.tagName).toBe('DD');
    expect(value).toHaveClass('text-ink');
    expect(value).not.toHaveClass('text-local');
    const dot = value.querySelector('[aria-hidden]');
    expect(dot).toHaveClass('bg-local');
  });

  it('warning이 아닌 tone에는 점이 없다', () => {
    render(<StatusRow label="학생증 인증" value="승인 완료" tone="success" />);
    expect(screen.getByText('승인 완료').querySelector('[aria-hidden]')).toBeNull();
  });
});
