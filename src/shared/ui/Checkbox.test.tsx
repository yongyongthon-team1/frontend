import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

function Controlled({ onChange }: { onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="[필수] 이용약관 · 개인정보 처리 동의"
      checked={checked}
      onChange={(e) => {
        setChecked(e.target.checked);
        onChange?.(e.target.checked);
      }}
    />
  );
}

describe('Checkbox', () => {
  it('라벨 이름의 checkbox이고, 라벨 글자를 눌러도 바뀐다', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: '[필수] 이용약관 · 개인정보 처리 동의' });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('[필수] 이용약관 · 개인정보 처리 동의'));
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(box);
    expect(box).not.toBeChecked();
  });

  it('키보드: Tab으로 초점을 받고 Space로 바꾼다', async () => {
    render(<Controlled />);
    await userEvent.tab();
    const box = screen.getByRole('checkbox');
    expect(box).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('줄 높이는 44px 이상(min-h-11)이고 체크 상자는 22px이다', () => {
    const { container } = render(<Controlled />);
    expect(container.querySelector('label')).toHaveClass('min-h-11');
    expect(container.querySelector('[data-checkbox-box]')).toHaveClass('size-[22px]');
  });

  it('체크 전 테두리는 비텍스트 대비 3:1을 넘는 border-muted이고, 체크하면 브랜드색이 이긴다', () => {
    const { container } = render(<Controlled />);
    const box = container.querySelector('[data-checkbox-box]');
    expect(box).toHaveClass('border-muted', 'peer-checked:border-brand');
    expect(box).not.toHaveClass('border-border');
  });

  it('disabled면 바뀌지 않는다', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="동의" checked={false} onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole('checkbox', { name: '동의' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('error는 role=alert로 알리고 aria-describedby로 잇는다', () => {
    render(<Checkbox label="동의" checked={false} onChange={() => {}} error="동의해 주세요." />);
    const box = screen.getByRole('checkbox', { name: '동의' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('동의해 주세요.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box.getAttribute('aria-describedby')).toBe(alert.id);
  });
});
