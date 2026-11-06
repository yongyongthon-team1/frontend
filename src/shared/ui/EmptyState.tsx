import { Link } from 'react-router';
import type { ActionLink } from '@/shared/lib/types';
import { buttonClass } from './buttonStyles';

// V2 빈 상태: 페일 블루 카드 + 문구 + 행동.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ActionLink;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-brand-soft px-5 py-8 text-center">
      <p className="text-[17px] font-bold text-ink">{title}</p>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      {action ? (
        <Link to={action.to} className={`${buttonClass('primary', 'sm')} mt-3`}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
