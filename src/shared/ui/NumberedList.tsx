import { cn } from '@/shared/lib/cn';

// V2 번호 목록(H03 `이런 경험을 해요`): 28px 원 숫자 + 15/Medium. 항목이 둘 이상이면 마지막 원은 local 색.
export function NumberedList({ items }: { items: string[] }) {
  return (
    <ol role="list" className="flex flex-col gap-3">
      {items.map((item, index) => {
        const isLocal = items.length > 1 && index === items.length - 1;
        return (
          <li key={index} className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isLocal ? 'bg-local-soft text-ink' : 'bg-brand-soft text-brand',
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 text-[15px] font-medium text-ink">{item}</span>
          </li>
        );
      })}
    </ol>
  );
}
