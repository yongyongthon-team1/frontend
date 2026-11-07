import { cn } from '@/shared/lib/cn';

/**
 * AI 추천 이유 글 앞에 붙이는 표시: 눈에는 ✦(장식, 화면 낭독기는 건너뜀), 화면 낭독기에는 `AI 추천 이유: `.
 * 같은 추천 이유가 보이는 곳(H04 시간표 · G03 지점 카드)이 같은 규칙으로 AI 결과임을 알린다(1단계 규칙).
 * 가이드가 쓴 한줄평 앞에는 붙이지 않는다.
 */
export function AiReasonPrefix({ className }: { className?: string }) {
  return (
    <>
      <span aria-hidden className={cn('mr-1 text-brand', className)}>
        ✦
      </span>
      <span className="sr-only">AI 추천 이유: </span>
    </>
  );
}
