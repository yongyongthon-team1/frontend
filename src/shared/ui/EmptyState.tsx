import { Link } from 'react-router';
import type { ActionLink } from '@/shared/lib/types';
import { buttonClass } from './buttonStyles';

/** 같은 화면 안의 행동(예: `검색어 지우기`). 이동이 아니라 버튼이다. */
export interface ActionButton {
  label: string;
  onClick(): void;
}

// V2 빈 상태: 페일 블루 카드 + 문구 + 행동(이동이면 링크, 화면 안 동작이면 버튼).
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ActionLink | ActionButton;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-brand-soft px-5 py-8 text-center">
      <p className="text-[17px] font-bold text-ink">{title}</p>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      {action === undefined ? null : 'to' in action ? (
        <Link to={action.to} className={`${buttonClass('primary', 'sm')} mt-3`}>
          {action.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={action.onClick}
          className={`${buttonClass('primary', 'sm')} mt-3`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
