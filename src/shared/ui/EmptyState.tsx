import { Link } from 'react-router';
import type { ActionLink } from '@/shared/lib/types';
import { buttonClass } from './buttonStyles';

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
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <p className="text-base font-bold text-ink">{title}</p>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
      {action ? (
        <Link to={action.to} className={`${buttonClass('secondary', 'sm')} mt-3`}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
