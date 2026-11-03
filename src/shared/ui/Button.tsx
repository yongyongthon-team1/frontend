import { Loader2 } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { Link } from 'react-router';
import { cn } from '@/shared/lib/cn';
import type { ActionLink } from '@/shared/lib/types';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  // 비활성 버튼에는 사유 + 다음 행동을 함께 보여 준다. reason이 null이면 사유 줄을 그리지 않는다.
  hint?: { reason: string | null; action?: ActionLink | null };
}

export function Button({
  variant = 'primary',
  size = 'lg',
  loading = false,
  hint,
  type = 'button',
  disabled,
  className,
  children,
  'aria-describedby': describedByProp,
  ...rest
}: ButtonProps) {
  const reasonId = useId();
  const hasReason = hint != null && hint.reason != null && hint.reason !== '';
  const describedBy =
    [describedByProp, hasReason ? reasonId : null].filter(Boolean).join(' ') || undefined;

  const button = (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-describedby={describedBy}
      className={cn(buttonClass(variant, size), className)}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );

  if (!hint || (!hasReason && !hint.action)) return button;

  return (
    <div className={cn('flex flex-col gap-2', size === 'lg' ? 'w-full' : 'items-start')}>
      {button}
      {hasReason ? (
        <p id={reasonId} className="px-1 text-sm text-muted">
          {hint.reason}
        </p>
      ) : null}
      {hint.action ? (
        <Link
          to={hint.action.to}
          className="inline-flex min-h-11 items-center self-start px-1 text-sm font-bold text-accent underline underline-offset-2"
        >
          {hint.action.label}
        </Link>
      ) : null}
    </div>
  );
}
