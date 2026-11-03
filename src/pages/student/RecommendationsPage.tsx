import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { TourCard } from '@/features/tours/components/TourCard';
import { useLastQuery } from '@/features/tours/lastQuery';
import { useRecommendations } from '@/features/tours/queries';
import { fromSearch, toSearch } from '@/features/tours/recommendationParams';
import { cn } from '@/shared/lib/cn';
import { formatShortDate, formatTime } from '@/shared/lib/date';
import { AiLoading } from '@/shared/ui/AiLoading';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { KeywordChips } from '@/shared/ui/KeywordChips';
import { Page } from '@/shared/ui/Page';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const LOADING_STEPS = ['관심사를 분석하고 있어요', '탐방을 비교하고 있어요'];

/** AI 추천 탐방 목록(hs-s04) · 추천 0건 대체 목록(hs-a06). 검색 조건은 주소에 있다. */
export function RecommendationsPage() {
  const { search } = useLocation();
  const q = useMemo(() => fromSearch(search), [search]);
  const setLastSearch = useLastQuery((s) => s.setSearch);
  const recommendations = useRecommendations(q);

  // 상세에서 `다른 추천 보기`로 이 목록에 돌아올 수 있게 마지막 검색을 기억한다.
  useEffect(() => {
    if (q) setLastSearch(toSearch(q));
  }, [q, setLastSearch]);

  if (q === null) return <Navigate to="/" replace />;

  const backToForm = `/?${toSearch(q)}`;
  const { data: result } = recommendations;

  return (
    <>
      <TopBar title="추천 탐방" back="/" />
      <Page>
        {recommendations.isError ? (
          <ErrorState
            error={recommendations.error}
            onRetry={() => void recommendations.refetch()}
          />
        ) : result === undefined ? (
          <AiLoading steps={LOADING_STEPS} />
        ) : (
          <>
            {result.fallback ? (
              <StatusChip tone="warning" icon={<TriangleAlert className="size-4" />}>
                조건에 맞는 추천이 없어요
              </StatusChip>
            ) : (
              <StatusChip>AI가 관심사를 분석했어요 ✦</StatusChip>
            )}
            <h2 className="mt-4 text-2xl leading-snug font-bold text-ink">{result.headline}</h2>
            <div className="mt-3">
              <KeywordChips keywords={result.keywords} />
            </div>
            <p className="mt-3 text-sm text-muted">추천 이유와 남은 자리를 확인해보세요.</p>

            {result.items.length === 0 ? (
              <EmptyState
                title="지금 모집 중인 탐방이 없어요"
                description="학교나 날짜를 바꿔 다시 찾아보세요."
                action={{ label: '학교 · 날짜 다시 선택', to: backToForm }}
              />
            ) : (
              <>
                <ul className="mt-4 flex flex-col gap-3">
                  {result.items.map(({ tour, reason }) => (
                    <li key={tour.id}>
                      <TourCard
                        to={`/tours/${tour.id}`}
                        title={`${tour.universityName} ${tour.campusName}`}
                        lines={[
                          `${tour.major ? `${tour.major} · ` : ''}${formatShortDate(tour.startsAt)} ${formatTime(tour.startsAt)}`,
                        ]}
                        reason={reason}
                        footer={
                          <>
                            <span>잔여 {tour.remainingSeats}자리</span>
                            <span>자세히 보기 →</span>
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
                <Link to={backToForm} className={cn(buttonClass('secondary'), 'mt-5')}>
                  학교 · 날짜 다시 선택
                </Link>
                <p className="mt-3 px-1 text-sm text-muted">
                  탐방이 없다면 같은 학교의 모집 중 탐방을 보여줘요.
                </p>
              </>
            )}
          </>
        )}
      </Page>
    </>
  );
}
