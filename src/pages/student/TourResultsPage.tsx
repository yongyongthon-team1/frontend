import { ChevronLeft, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useUniversities } from '@/features/campuses/queries';
import { useLastQuery } from '@/features/tours/lastQuery';
import { campusLabel, type WishToursResult } from '@/features/tours/model';
import { useWishTours } from '@/features/tours/queries';
import { fromWishSearch, toWishSearch, type WishSearch } from '@/features/tours/wishSearch';
import type { University } from '@/features/campuses/model';
import { formatDotDateWeekday, formatMonthDay, formatTime, seoulDateAt } from '@/shared/lib/date';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Illustration } from '@/shared/ui/Illustration';
import { ListRow } from '@/shared/ui/ListRow';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

/** 결과 제목 · 설명(제안 문구 — 정상 · 대체 · 0건). */
function headingOf(result: WishToursResult): { title: string; description: string } {
  const n = result.tours.length;
  if (n === 0) {
    return { title: '아직 모집 중인\n탐방이 없어요.', description: '다른 학교로 다시 찾아보세요.' };
  }
  if (result.fallback) {
    return {
      title: `같은 학교 탐방\n${n}개를 보여 드려요.`,
      description: '학과 · 날짜 조건을 빼고 찾았어요.',
    };
  }
  return { title: `조건에 맞는 탐방\n${n}개를 찾았어요.`, description: '날짜가 빠른 순이에요.' };
}

/** 원문 카드(`내가 남긴 희망 사항`). 주소의 희망 사항을 가공하지 않고 줄바꿈까지 그대로 보인다(2C-R16). */
function WishCard({ search, campus }: { search: WishSearch; campus: University | undefined }) {
  const meta = [
    campus ? campusLabel(campus.name, campus.campusName) : null,
    search.major,
    search.date ? `${formatMonthDay(seoulDateAt(search.date, '00:00'))} 희망` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <section aria-label="내가 남긴 희망 사항" className="mt-4 rounded-xl bg-brand-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-brand">내가 남긴 희망 사항</p>
        {/* 눌림 영역은 44로 넓히되 위아래 음수 여백으로 머리 줄(카드) 높이는 그대로다. `›`는 장식이라 링크 이름은 `내 희망 사항`. */}
        <Link
          to="/me/wishes"
          className="-my-3.5 inline-flex min-h-11 shrink-0 items-center text-[13px] font-bold text-brand"
        >
          내 희망 사항
          <span aria-hidden className="ml-0.5">
            ›
          </span>
        </Link>
      </div>
      <p
        data-testid="wish-text"
        className="mt-2 text-[15px] leading-[1.5] break-words break-keep whitespace-pre-wrap text-ink"
      >
        {search.wish}
      </p>
      <p className="mt-2 text-xs text-muted">{meta}</p>
    </section>
  );
}

/**
 * T-01 탐방 찾기 결과(hs-s04 · H02를 V2 부품으로, 결정 0011). 조건은 주소에 있다(`/tours?school&major&wish[&date]`).
 * 학교 · 학과 · 날짜에 맞는 모집 중 탐방을 날짜 빠른 순으로, 0건이면 같은 학교 탐방(대체, 경고 칩), 그것도 없으면 0건 카드(hs-a06)다.
 * 무대 ①(원문 카드 + 첫 탐방 행)이라 머리는 TopBar 없이 뒤로 가기 줄(`pt-2` + `h-12` = 56px)이 무대 측정 기준선을 만든다.
 */
export function TourResultsPage() {
  const { search: rawSearch } = useLocation();
  const search = useMemo(() => fromWishSearch(rawSearch), [rawSearch]);
  const setLastSearch = useLastQuery((s) => s.setSearch);
  const results = useWishTours(search);
  const campuses = useUniversities();

  const campus = campuses.data?.find((u) => u.id === search?.universityId);

  // 탐방 상세의 `다른 탐방 보기`가 이 결과 화면으로 돌아오게 마지막 검색을 기억한다. 캠퍼스 목록에서 학교를 찾은 뒤에만
  // 기억한다 — 목록에 없는 학교는 틀린 검색이라 아래에서 홈으로 보낸다.
  useEffect(() => {
    if (search && campus) setLastSearch(toWishSearch(search));
  }, [search, campus, setLastSearch]);

  if (search === null) return <Navigate to="/" replace />;

  // 캠퍼스 목록에 없는 학교도 틀린 검색이다(학교 이름을 보일 수 없다).
  if (campuses.data !== undefined && campus === undefined) return <Navigate to="/" replace />;

  const backToForm = `/?${toWishSearch(search)}`;
  const { data: result } = results;

  if (result === undefined) {
    return (
      <Page className="pt-2">
        <BackRow to={backToForm} />
        {/* 제목 두 줄 + 설명 한 줄 자리(결과가 오면 같은 높이의 글로 바뀐다). 오류일 때는 거둔다. */}
        {results.isError ? null : (
          <>
            <Skeleton className="h-[72px] w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </>
        )}
        <WishCard search={search} campus={campus} />
        {results.isError ? (
          <div className="mt-4">
            <ErrorState error={results.error} onRetry={() => void results.refetch()} />
          </div>
        ) : (
          <Skeleton className="mt-4 h-[180px] rounded-xl" />
        )}
      </Page>
    );
  }

  const heading = headingOf(result);
  const empty = result.tours.length === 0;
  return (
    <Page className="pt-2">
      <BackRow to={backToForm} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {result.fallback && !empty ? (
            <StatusChip tone="warning" icon={<TriangleAlert className="size-4" />} className="mb-3">
              조건에 맞는 탐방이 없어요
            </StatusChip>
          ) : null}
          <PageHeading title={heading.title} description={heading.description} />
        </div>
        <Illustration
          kind="campus"
          className="h-auto max-h-[72px] w-auto max-w-[96px] shrink-0 object-contain"
        />
      </div>

      <WishCard search={search} campus={campus} />

      {empty ? (
        <section className="mt-4 rounded-xl bg-surface p-5">
          <StatusChip tone="info">0건</StatusChip>
          <h2 className="mt-3 text-lg font-bold text-ink">
            {campus?.shortName}에 모집 중인 탐방이 없어요
          </h2>
          <p className="mt-1 text-[13px] text-muted">학교를 바꿔 다시 찾아보세요.</p>
          <Link
            to={backToForm}
            className="mt-4 flex min-h-11 items-center rounded-md bg-brand-soft px-4 text-[13px] font-bold text-brand"
          >
            조건 바꾸기 ›
          </Link>
        </section>
      ) : (
        <ul aria-label="모집 중 탐방" className="mt-4 rounded-xl bg-surface">
          {result.tours.map((tour) => (
            <li
              key={tour.id}
              className="relative before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-border first:before:hidden"
            >
              <ListRow
                to={`/tours/${tour.id}`}
                eyebrow={campusLabel(tour.universityName, tour.campusName)}
                title={tour.title}
                meta={`${formatDotDateWeekday(tour.startsAt)} ${formatTime(tour.startsAt)} · ${tour.remainingSeats}자리 남음`}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function BackRow({ to }: { to: string }) {
  return (
    <div className="flex h-12 items-center">
      <Link
        to={to}
        aria-label="뒤로 가기"
        className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink hover:bg-neutral-100"
      >
        <ChevronLeft aria-hidden className="size-6" />
      </Link>
    </div>
  );
}
