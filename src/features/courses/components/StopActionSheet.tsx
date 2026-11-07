import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  MessageSquareText,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useId } from 'react';
import type { CourseStop } from '@/features/courses/model';
import { cn } from '@/shared/lib/cn';
import { BottomSheet } from '@/shared/ui/BottomSheet';

export interface StopActionSheetProps {
  /** 연 지점. null이면 시트가 닫혀 있다. */
  stop: CourseStop | null;
  isFirst: boolean;
  isLast: boolean;
  /** false면 `빼기`를 사유와 함께 잠근다 — 백엔드는 지점이 1곳 이상이어야 코스를 바꿀 수 있다(2C-R12 ②). */
  canRemove: boolean;
  /** 코스를 바꾸는 요청이 진행 중이면 모든 동작을 잠근다. */
  busy: boolean;
  onMoveUp(): void;
  onMoveDown(): void;
  /** 한줄평 입력(1단계 한줄평 시트)을 연다. */
  onEditNote(): void;
  /** 주면 `다른 장소로 교체`가 생긴다 — 장소 고르기(G07)의 교체 모드로 간다(2B′-R14, 지점 유형 무관). */
  onReplace?: () => void;
  /** 빼기 확인 창(1단계 문구)을 연다. */
  onRemove(): void;
  onClose(): void;
}

/** 마지막 지점의 `빼기`를 잠근 사유(제안 문구, 2C-R12 ②). */
const LAST_STOP_REASON = '지점은 1곳 이상 있어야 해요.';

/**
 * 코스 완성(G03) 지점 카드의 `≡`가 여는 시트(판정 2A-R10): 위로 · 아래로 이동 · 한줄평 · (다른 장소로 교체) · 빼기.
 * 어느 동작이든 누르면 시트를 먼저 닫고 시작한다 — 순서가 바뀌는 카드 목록이 시트에 가리지 않고, 한줄평 · 빼기는
 * 자기 창을 연다. 처리 중이면 모두 비활성이고, 지점이 1곳뿐이면 `빼기`가 그 아래 사유와 함께 비활성이다.
 */
export function StopActionSheet({
  stop,
  isFirst,
  isLast,
  canRemove,
  busy,
  onMoveUp,
  onMoveDown,
  onEditNote,
  onReplace,
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
        {onReplace ? (
          <ActionRow icon={ArrowLeftRight} disabled={busy} onClick={run(onReplace)}>
            다른 장소로 교체
          </ActionRow>
        ) : null}
        <ActionRow
          icon={Trash2}
          danger
          disabled={busy || !canRemove}
          reason={canRemove ? null : LAST_STOP_REASON}
          onClick={run(onRemove)}
        >
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
  reason = null,
  onClick,
  children,
}: {
  icon: LucideIcon;
  danger?: boolean;
  disabled: boolean;
  /** 비활성 사유. 버튼 아래(아이콘 다음 줄)에 보이고 버튼의 설명이 된다. */
  reason?: string | null;
  onClick(): void;
  children: string;
}) {
  const reasonId = useId();
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={reason === null ? undefined : reasonId}
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
      {reason === null ? null : (
        <p id={reasonId} className="pb-3 pl-8 text-[13px] text-muted">
          {reason}
        </p>
      )}
    </li>
  );
}
