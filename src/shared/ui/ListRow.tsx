import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/shared/lib/cn';

export interface ListRowProps {
  to?: string;
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  metaTone?: 'muted' | 'brand';
  // 오른쪽 자리. 없으면 `to`가 있을 때 `›`를 그린다.
  right?: ReactNode;
  // `to` 없이 `onClick`만 주면 같은 모양의 <button>이 된다(예: 로그아웃 줄).
  onClick?: () => void;
  disabled?: boolean;
}

// V2 Tour List Row: 흰 카드(반경 18, 높이 90 안팎). 글줄은 한 줄 말줄임이라 글꼴이 넓어도 높이가 늘지 않는다.
export function ListRow({
  to,
  eyebrow,
  title,
  meta,
  metaTone = 'muted',
  right,
  onClick,
  disabled,
}: ListRowProps) {
  // <button> 안에는 구문 콘텐츠만 둘 수 있어 버튼 모드는 div/p 대신 block span으로 그린다. 링크·div 모드는 그대로.
  const asButton = !to && !!onClick;
  const Block = asButton ? 'span' : 'div';
  const Line = asButton ? 'span' : 'p';
  const Trailing = asButton ? 'span' : 'div';

  const trailing =
    right !== undefined ? (
      <Trailing className="shrink-0">{right}</Trailing>
    ) : to ? (
      <ChevronRight aria-hidden className="size-6 shrink-0 text-muted" />
    ) : null;

  const content = (
    <>
      <Block className="block min-w-0 flex-1">
        {eyebrow ? (
          <Line className="block truncate text-xs font-medium text-muted">{eyebrow}</Line>
        ) : null}
        <Line className="block truncate text-[17px] leading-[1.4] font-bold text-ink">{title}</Line>
        {meta ? (
          <Block
            className={cn(
              'mt-1 block truncate text-xs',
              metaTone === 'brand' ? 'font-medium text-brand' : 'text-muted',
            )}
          >
            {meta}
          </Block>
        ) : null}
      </Block>
      {trailing}
    </>
  );

  const base = 'flex min-h-[90px] items-center gap-3 rounded-[18px] bg-surface p-4';
  if (to) {
    return (
      <Link to={to} className={cn(base, 'transition-colors hover:brightness-[0.98]')}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={disabled || undefined}
        className={cn(
          base,
          'w-full text-left transition-colors hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}
