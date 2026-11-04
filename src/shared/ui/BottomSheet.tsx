import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { useFrameContainer } from './FrameContext';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
}

// 모바일 프레임 안(포털 대상 = 프레임)의 아래쪽에 붙는 시트. 프레임이 없으면 화면 기준으로 그린다.
export function BottomSheet({ open, onOpenChange, title, children }: BottomSheetProps) {
  const container = useFrameContainer();
  const position = container ? 'absolute' : 'fixed';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay
          className={cn(
            position,
            'inset-0 z-40 animate-fade-in bg-scrim motion-reduce:animate-none',
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            position,
            'inset-x-0 bottom-0 z-50 max-h-[85%] animate-sheet-in overflow-y-auto rounded-t-lg bg-bg px-[var(--gutter)] pt-3 pb-8 motion-reduce:animate-none',
          )}
        >
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title className="text-lg font-bold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="닫기"
              className="-mr-3 flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
