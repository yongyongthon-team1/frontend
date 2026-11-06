import { ArrowDown, ArrowUp, MessageSquareText, Trash2, type LucideIcon } from 'lucide-react';
import type { CourseStop } from '@/features/courses/model';
import { cn } from '@/shared/lib/cn';
import { BottomSheet } from '@/shared/ui/BottomSheet';

export interface StopActionSheetProps {
  /** 연 지점. null이면 시트가 닫혀 있다. */
  stop: CourseStop | null;
  isFirst: boolean;
  isLast: boolean;
  /** 코스를 바꾸는 요청이 진행 중이면 모든 동작을 잠근다. */
  busy: boolean;
  onMoveUp(): void;
  onMoveDown(): void;
  /** 한줄평 입력(1단계 한줄평 시트)을 연다. */
  onEditNote(): void;
  /** 빼기 확인 창(1단계 문구)을 연다. */
  onRemove(): void;
  onClose(): void;
}

/**
 * 코스 완성(G03) 지점 카드의 `≡`가 여는 시트(판정 2A-R10): 위로 · 아래로 이동 · 한줄평 · 빼기(상점 교체는 2B).
 * 어느 동작이든 누르면 시트를 먼저 닫고 시작한다 — 순서가 바뀌는 카드 목록이 시트에 가리지 않고, 한줄평 · 빼기는
 * 자기 창을 연다. 처리 중이면 모두 비활성이다.
 */
export function StopActionSheet({
  stop,
  isFirst,
  isLast,
  busy,
  onMoveUp,
  onMoveDown,
  onEditNote,
  onRemove,
  onClose,
}: StopActionSheetProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };
  return (
    <BottomSheet
      open={stop !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={stop?.name ?? ''}
    >
      <ul className="flex flex-col divide-y divide-border">
        <ActionRow icon={ArrowUp} disabled={busy || isFirst} onClick={run(onMoveUp)}>
          위로 이동
        </ActionRow>
        <ActionRow icon={ArrowDown} disabled={busy || isLast} onClick={run(onMoveDown)}>
          아래로 이동
        </ActionRow>
        <ActionRow icon={MessageSquareText} disabled={busy} onClick={run(onEditNote)}>
          한줄평
        </ActionRow>
        <ActionRow icon={Trash2} danger disabled={busy} onClick={run(onRemove)}>
          빼기
        </ActionRow>
      </ul>
    </BottomSheet>
  );
}

function ActionRow({
  icon: Icon,
  danger = false,
  disabled,
  onClick,
  children,
}: {
  icon: LucideIcon;
  danger?: boolean;
  disabled: boolean;
  onClick(): void;
  children: string;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 text-left text-[17px] font-bold transition-colors',
          'hover:bg-bg disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent',
          danger ? 'text-danger' : 'text-ink',
        )}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
        {children}
      </button>
    </li>
  );
}
