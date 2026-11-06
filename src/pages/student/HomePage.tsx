import { Search } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useDemoToolsOn } from '@/demo/demoStore';
import { EXAMPLE_QUERIES } from '@/features/tours/examples';
import { useLastQuery } from '@/features/tours/lastQuery';
import { campusLabel } from '@/features/tours/model';
import { useTours } from '@/features/tours/queries';
import { fromSearch, toSearch } from '@/features/tours/recommendationParams';
import { formatDotDateWeekday } from '@/shared/lib/date';
import { preventImeEnter } from '@/shared/lib/ime';
import { Button } from '@/shared/ui/Button';
import { BrandMark } from '@/shared/ui/BrandMark';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { HeroCard } from '@/shared/ui/HeroCard';
import { ListRow } from '@/shared/ui/ListRow';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';

const MIN_QUERY_LENGTH = 5;
const MAX_TOURS = 3;
const QUERY_ERROR = '하고 싶은 것을 한 문장 이상 적어 주세요.';

/**
 * 고교생 홈 · AI 탐방 추천(hs-s03 · V2 H01). 추천 요청은 문장 하나(`q`)뿐이다(판정 2A-R1). 시연 도구가 켜져 있으면
 * 입력칸에 첫 예시 문장이 미리 채워진다(무대에서 한글을 치지 않게). 주소에 검색이 있으면(추천 목록에서 `다시 추천받기`로
 * 돌아온 경우) 그 문장으로 채운다.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const setSearch = useLastQuery((s) => s.setSearch);
  const demoOn = useDemoToolsOn();
  const savedQ = fromSearch(search)?.q;
  const [q, setQ] = useState(savedQ ?? (demoOn ? EXAMPLE_QUERIES[0] : ''));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const inputId = useId();
  const errorId = useId();
  const tours = useTours({ status: 'RECRUITING' });

  // 시연 도구가 마운트 뒤에 켜져도(원클릭 링크) 손대지 않은 빈 입력칸은 예시 문장으로 채운다.
  useEffect(() => {
    if (demoOn && !touched && savedQ === undefined) {
      setQ((cur) => (cur === '' ? EXAMPLE_QUERIES[0] : cur));
    }
  }, [demoOn, touched, savedQ]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      setError(QUERY_ERROR);
      return;
    }
    const next = toSearch({ q: text });
    setSearch(next);
    void navigate(`/recommendations?${next}`);
  };

  const open = (tours.data ?? [])
    .filter((t) => t.remainingSeats > 0)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id)
    .slice(0, MAX_TOURS);

  return (
    <Page className="pt-6">
      <BrandMark variant="wordmark" />
      <PageHeading
        className="mt-3"
        title={'내가 궁금한 대학 생활,\n직접 만나보세요.'}
        description="전공 이야기부터 동네 맛집까지 함께 걸어요."
      />

      <form className="mt-5" onSubmit={onSubmit} onKeyDown={preventImeEnter} noValidate>
        <HeroCard
          title={'어떤 전공이\n궁금한가요?'}
          illustration="campus"
          footer={
            <>
              <label htmlFor={inputId} className="sr-only">
                하고 싶은 것
              </label>
              <div className="flex h-14 items-center gap-2 rounded-lg bg-surface px-4">
                <Search aria-hidden className="size-4 shrink-0 text-brand" />
                <input
                  id={inputId}
                  type="text"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setTouched(true);
                    setError(undefined);
                  }}
                  placeholder="예: 제품을 만들고 디자인해보고 싶어요"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-[13px] placeholder:font-medium placeholder:text-muted focus:outline-none"
                />
              </div>
              {error ? (
                <p id={errorId} role="alert" className="mt-2 px-1 text-[13px] text-danger">
                  {error}
                </p>
              ) : null}
            </>
          }
        />
        <Button type="submit" className="mt-4">
          나에게 맞는 탐방 추천받기
        </Button>
      </form>

      <h2 className="mt-7 mb-3 text-lg font-bold text-ink">이번 방학, 이런 탐방은 어때요?</h2>
      {tours.data === undefined && tours.isError ? (
        <ErrorState error={tours.error} onRetry={() => void tours.refetch()} />
      ) : tours.data === undefined ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[90px] rounded-[18px]" />
        </div>
      ) : open.length === 0 ? (
        <EmptyState title="지금 모집 중인 탐방이 없어요" />
      ) : (
        <ul aria-label="모집 중인 탐방" className="flex flex-col gap-3">
          {open.map((tour) => (
            <li key={tour.id}>
              <ListRow
                to={`/tours/${tour.id}`}
                eyebrow={campusLabel(tour.universityName, tour.campusName)}
                title={tour.title}
                meta={`${formatDotDateWeekday(tour.startsAt)} · ${tour.remainingSeats}자리 남음`}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
