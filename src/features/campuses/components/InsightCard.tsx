import { useInsight } from '@/features/campuses/queries';
import { Badge } from '@/shared/ui/Badge';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * "방학 상권 인사이트" 카드(설계 5.6 데이터 인사이트 자리). 지표 · 출처는 팀 데이터 담당이 정하기 전까지 목업
 * 예시라 `isPlaceholder`면 `예시` 배지를 붙인다. 화면의 덧붙임 정보라 불러오지 못하면 카드를 그리지 않는다.
 */
export function InsightCard({ universityId }: { universityId: number }) {
  const { data: insight, isPending } = useInsight(universityId);

  if (insight === undefined) {
    return isPending ? <Skeleton className="h-32 rounded-lg" /> : null;
  }
  return (
    <InfoCard
      title={
        <span className="flex items-center justify-between gap-2">
          {insight.title}
          {insight.isPlaceholder ? <Badge>예시</Badge> : null}
        </span>
      }
      description={insight.text}
      footer={<p className="text-xs text-muted">{`출처 · ${insight.source}`}</p>}
    />
  );
}
