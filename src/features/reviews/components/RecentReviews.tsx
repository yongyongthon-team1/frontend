import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatShortDate } from '@/shared/lib/date';
import { StarDisplay } from '@/shared/ui/StarRating';
import type { StoreReviewItem } from '../model';

/**
 * 최근 리뷰 목록(별점 · 내용 · 가린 작성자 · 날짜). 상점 시트의 접힌 토글(`RecentReviews`)과 사장님 리포트가 같은 항목 모양을
 * 쓰도록 접힘 없는 목록을 따로 내보낸다.
 */
export function RecentReviewList({ items }: { items: StoreReviewItem[] }) {
  return (
    <ul aria-label="최근 리뷰" className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1">
          <StarDisplay value={item.rating} />
          <p className="text-[15px] break-words text-ink">{item.content}</p>
          <p className="text-xs text-muted">{`${item.author} · ${formatShortDate(item.createdAt)}`}</p>
        </li>
      ))}
    </ul>
  );
}

/** 상점 시트의 `최근 리뷰 {n}개` 토글(처음엔 접힘). 리뷰가 없으면 아무것도 그리지 않는다. */
export function RecentReviews({ items }: { items: StoreReviewItem[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (items.length === 0) return null;
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between rounded-lg bg-bg px-4 text-[15px] font-bold text-ink"
      >
        {`최근 리뷰 ${items.length}개`}
        <ChevronDown
          aria-hidden
          className={cn('size-5 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      <div id={panelId} hidden={!open} className="mt-3">
        {open ? <RecentReviewList items={items} /> : null}
      </div>
    </section>
  );
}
