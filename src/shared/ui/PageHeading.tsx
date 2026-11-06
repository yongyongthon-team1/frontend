import { cn } from '@/shared/lib/cn';

// 탭 첫 화면(TopBar가 없는 화면)의 제목: 26/Bold(줄 높이 1.4, `\n` 줄바꿈) + 설명 13/Regular muted.
export function PageHeading({
  title,
  description,
  className,
  as: Heading = 'h1',
}: {
  title: string;
  description?: string;
  className?: string;
  // TopBar가 이미 h1인 화면(신청서 · 신청 완료)은 h2로 쓴다.
  as?: 'h1' | 'h2';
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Heading className="text-[26px] leading-[1.4] font-bold whitespace-pre-line text-ink">
        {title}
      </Heading>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
    </div>
  );
}
