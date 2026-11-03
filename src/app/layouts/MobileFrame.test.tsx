import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { MobileFrame } from './MobileFrame';

describe('MobileFrame', () => {
  it('바텀시트가 프레임 안에 뜬다(프레임 DOM이 포털 대상)', () => {
    const { container } = render(
      <MemoryRouter>
        <MobileFrame>
          <BottomSheet open onOpenChange={() => {}} title="상점">
            내용
          </BottomSheet>
        </MobileFrame>
      </MemoryRouter>,
    );
    const frame = container.querySelector('.mobile-frame');
    expect(frame).not.toBeNull();
    expect(frame).toContainElement(screen.getByRole('dialog', { name: '상점' }));
  });

  it('옆 슬롯(aside)은 지금 비어 있다', () => {
    const { container } = render(
      <MemoryRouter>
        <MobileFrame>화면</MobileFrame>
      </MemoryRouter>,
    );
    expect(container.querySelector('aside')).toBeEmptyDOMElement();
  });
});
