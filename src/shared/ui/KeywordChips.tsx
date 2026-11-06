import { cn } from '@/shared/lib/cn';

// 관심 키워드 칩. `scroll`이면 줄을 바꾸지 않고 한 줄 안에서 가로로 스크롤한다(무대 화면 높이 절약). 스크롤바는
// 숨긴다(보이면 줄 높이가 늘어난다). 오른쪽 끝에서 잘린 칩이 더 있다는 표시다.
export function KeywordChips({
  keywords,
  scroll = false,
}: {
  keywords: string[];
  scroll?: boolean;
}) {
  if (keywords.length === 0) return null;
  return (
    <ul
      className={cn(
        'flex gap-2',
        scroll
          ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex-wrap',
      )}
    >
      {keywords.map((keyword) => (
        <li
          key={keyword}
          className={cn(
            'inline-flex h-[31px] items-center rounded-pill bg-brand-soft px-3 text-xs font-bold text-brand',
            scroll && 'shrink-0 whitespace-nowrap',
          )}
        >
          {keyword}
        </li>
      ))}
    </ul>
  );
}
