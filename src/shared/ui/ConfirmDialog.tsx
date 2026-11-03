import * as Dialog from '@radix-ui/react-dialog';
import { useFrameContainer } from '@/app/layouts/FrameContext';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm(): void;
  // 처리 중이면 확인 버튼을 비활성(+ 스피너)으로 둬 연타를 막고, 닫기 요청(Esc · 바깥 클릭 · 돌아가기)도 받지 않는다 —
  // 요청이 끝나면 호출한 쪽이 `open`을 내려 닫는다.
  pending?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = '돌아가기',
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  const container = useFrameContainer();
  const position = container ? 'absolute' : 'fixed';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay
          className={cn(
            position,
            'inset-0 z-40 animate-fade-in bg-scrim motion-reduce:animate-none',
          )}
        />
        <Dialog.Content
          role="alertdialog"
          className={cn(
            position,
            'inset-x-[var(--gutter)] top-1/2 z-50 -translate-y-1/2 animate-fade-in rounded-lg bg-bg p-5 motion-reduce:animate-none',
          )}
        >
          <Dialog.Title className="text-lg font-bold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">{description}</Dialog.Description>
          <div className="mt-5 flex gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" className="min-w-0 flex-1" disabled={pending}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button className="min-w-0 flex-1" loading={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
