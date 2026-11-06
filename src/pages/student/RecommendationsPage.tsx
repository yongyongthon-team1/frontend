import { ChevronLeft, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ALL_CHIP, buildFilterChips, filterItems } from '@/features/tours/filterChips';
import { useLastQuery } from '@/features/tours/lastQuery';
import { campusLabel } from '@/features/tours/model';
import { useRecommendations } from '@/features/tours/queries';
import { fromSearch, toSearch } from '@/features/tours/recommendationParams';
import { formatDotDate } from '@/shared/lib/date';
import { AiBadge } from '@/shared/ui/AiBadge';
import { AiLoading } from '@/shared/ui/AiLoading';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterChips } from '@/shared/ui/FilterChips';
import { Illustration } from '@/shared/ui/Illustration';
import { ListRow } from '@/shared/ui/ListRow';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StatusChip } from '@/shared/ui/StatusChip';

const LOADING_STEPS = ['관심사를 분석하고 있어요', '탐방을 비교하고 있어요'];

/**
 * AI 추천 탐방 목록(hs-s04 · V2 H02) · 추천 0건(hs-a06 · V2 H13). 검색 조건은 주소에 있다.
 * 행의 셋째 줄은 `{MM.DD} · {추천 이유}`(판정 2A-R3) — 무대에서 첫 추천 이유가 스크롤 없이 보여야 해서다.
 */
export function RecommendationsPage() {
  const { search } = useLocation();
  const q = useMemo(() => fromSearch(search), [search]);
  const setLastSearch = useLastQuery((s) => s.setSearch);
  const recommendations = useRecommendations(q);
  const [filter, setFilter] = useState(ALL_CHIP);

  // 상세에서 `다른 추천 보기`로 이 목록에 돌아올 수 있게 마지막 검색을 기억한다.
  useEffect(() => {
    if (q) setLastSearch(toSearch(q));
  }, [q, setLastSearch]);

  if (q === null) return <Navigate to="/" replace />;

  const backToForm = `/?${toSearch(q)}`;
  const { data: result } = recommendations;

  const chips = result ? buildFilterChips(result) : [];
  const active = chips.some((c) => c.value === filter) ? filter : ALL_CHIP;
  const shown = result ? filterItems(result.items, active) : [];

  return (
    <Page className="pt-2">
      <div className="flex h-12 items-center">
        <Link
          to={backToForm}
          aria-label="뒤로 가기"
          className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink hover:bg-neutral-100"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </Link>
      </div>

      {recommendations.isError && result === undefined ? (
        <>
          <h1 className="sr-only">추천 탐방</h1>
          <ErrorState
            error={recommendations.error}
            onRetry={() => void recommendations.refetch()}
          />
        </>
      ) : result === undefined ? (
        <>
          <h1 className="sr-only">추천 탐방</h1>
          <AiLoading steps={LOADING_STEPS} />
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {result.fallback ? (
                <StatusChip tone="warning" icon={<TriangleAlert className="size-4" />}>
                  조건에 맞는 추천이 없어요
                </StatusChip>
              ) : null}
              <PageHeading
                className={result.fallback ? 'mt-3' : undefined}
                title={
                  result.items.length === 0
                    ? '다른 탐방도\n찾아볼까요?'
                    : `${result.items.length}개의 탐방을\n추천해요.`
                }
                description={result.headline}
              />
            </div>
            <Illustration
              kind="campus"
              className="h-auto max-h-[72px] w-auto max-w-[96px] shrink-0 object-contain"
            />
          </div>

          {result.items.length === 0 ? (
            <section className="mt-5 rounded-xl bg-surface p-5">
              <StatusChip tone="info">추천 0건</StatusChip>
              <h2 className="mt-3 text-lg font-bold text-ink">아직 맞는 탐방이 없어요</h2>
              <p className="mt-1 text-[13px] text-muted">관심 문장을 바꿔 다시 검색해 보세요.</p>
              <Link
                to={backToForm}
                className="mt-4 flex min-h-11 items-center rounded-md bg-brand-soft px-4 text-[13px] font-bold text-brand"
              >
                다시 추천받기 ›
              </Link>
            </section>
          ) : (
            <>
              <div className="mt-4">
                <FilterChips
                  label="추천 필터"
                  // FilterChips의 kind는 keyword|school뿐이라 `전체`(all)는 keyword 모양(선택 전 brand-soft)으로 그린다.
                  chips={chips.map(({ value, label, kind }) => ({
                    value,
                    label,
                    kind: kind === 'school' ? 'school' : 'keyword',
                  }))}
                  value={active}
                  onChange={setFilter}
                />
              </div>
              <ul aria-label="추천 탐방" className="mt-4 rounded-xl bg-surface">
                {shown.map(({ tour, reason }) => (
                  <li
                    key={tour.id}
                    className="relative before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-border first:before:hidden"
                  >
                    <ListRow
                      to={`/tours/${tour.id}`}
                      eyebrow={campusLabel(tour.universityName, tour.campusName)}
                      title={tour.title}
                      metaTone="brand"
                      meta={
                        <span data-testid="recommendation-reason-line" className="block truncate">
                          <span aria-hidden>✦ </span>
                          {formatDotDate(tour.startsAt)} · {reason}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
              <section className="mt-5 rounded-xl bg-brand-soft p-5">
                <div className="-mt-1 -ml-3 flex items-center gap-1">
                  <AiBadge />
                  <p className="text-[13px] font-bold text-brand">왜 추천했나요?</p>
                </div>
                <p className="mt-1 text-[15px] leading-[1.5] text-ink">{shown[0]?.reason}</p>
              </section>
            </>
          )}
        </>
      )}
    </Page>
  );
}
