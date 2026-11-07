import { useId, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  candidateStatus,
  matchesPlace,
  MAX_COURSE_STOPS,
  pickTarget,
  samePlace,
  walkingLabel,
  type CampusPlace,
  type CandidateStatus,
  type Course,
  type NearbyStore,
  type PickTarget,
  type PlaceRef,
} from '@/features/courses/model';
import {
  useAddStop,
  useCampusPlaces,
  useGuideCourse,
  useIsCreatingDraft,
  useNearbyStores,
  useReplaceStop,
} from '@/features/courses/queries';
import { cn } from '@/shared/lib/cn';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import type { ActionLink, Tone } from '@/shared/lib/types';
import { Badge } from '@/shared/ui/Badge';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { SegmentedTabs } from '@/shared/ui/SegmentedTabs';
import { segmentedPanelProps } from '@/shared/ui/segmentedPanel';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

type Kind = 'store' | 'campus';

const TABS_ID = 'pick-tabs';
const TABS: { value: Kind; label: string }[] = [
  { value: 'store', label: '주변 상점' },
  { value: 'campus', label: '캠퍼스 장소' },
];

/** 장소 종류마다 다른 문구. 상점은 옛 2B G07 그대로, 캠퍼스와 상점 소제목은 이 계획의 제안 문구(D15). */
const KIND_COPY: Record<
  Kind,
  {
    search: string;
    placeholder: string;
    heading: string;
    list: string;
    empty: string;
    noMatch: (query: string) => string;
  }
> = {
  store: {
    search: '주변 상점 검색',
    placeholder: '문화체험 · 동네 카페 · 점심',
    heading: '가까운 주변 상점',
    list: '후보 상점',
    empty: '학교 주변에서 고를 수 있는 상점이 없어요',
    noMatch: (q) => `'${q}'에 맞는 상점이 없어요`,
  },
  campus: {
    search: '캠퍼스 장소 검색',
    placeholder: '도서관 · 학생회관',
    heading: '캠퍼스 장소',
    list: '후보 캠퍼스 장소',
    empty: '캠퍼스에서 고를 수 있는 장소가 없어요',
    noMatch: (q) => `'${q}'에 맞는 캠퍼스 장소가 없어요`,
  },
};

const STATUS_LABEL: Record<Exclude<CandidateStatus, 'SELECTABLE'>, string> = {
  IN_COURSE: '코스에 있음',
  CURRENT: '지금 지점',
};

/** 후보 카드 한 장. 상점과 캠퍼스 건물을 같은 모양으로 그린다. */
interface Candidate {
  key: string;
  place: PlaceRef;
  name: string;
  chip: { label: string; tone: Tone };
  /** 상점 `{도보} · {업종}`, 캠퍼스 설명. 없으면 줄이 없다. */
  meta: string | null;
  /** AI 리뷰 요약(상점만, 2B′-R15 — 옛 `학생 요청:` 줄 자리). */
  summary: string | null;
  /** 검색 대상: 상점 이름 · 업종, 캠퍼스 이름 · 설명. */
  texts: (string | null)[];
}

const fromStore = (s: NearbyStore): Candidate => ({
  key: `store-${s.storeId}`,
  place: { type: 'STORE', storeId: s.storeId },
  name: s.name,
  chip: s.isPartner
    ? { label: '제휴 상점', tone: 'success' }
    : { label: '일반 상점', tone: 'info' },
  meta: `${walkingLabel(s.distanceM)} · ${s.category}`,
  summary: s.reviewSummary,
  texts: [s.name, s.category],
});

const fromCampus = (p: CampusPlace): Candidate => ({
  key: `campus-${p.campusBuildingId}`,
  place: { type: 'CAMPUS', campusBuildingId: p.campusBuildingId },
  name: p.name,
  chip: { label: '캠퍼스', tone: 'info' },
  meta: p.description,
  summary: null,
  texts: [p.name, p.description],
});

/**
 * 코스 장소 고르기(V2 G07 · guide-a03, 2B′-R14 · R15): 초안 코스에 장소를 더하거나(`?mode=add`) 지점 하나를 바꾼다
 * (`?mode=replace&stopId=`). 추가는 `주변 상점` · `캠퍼스 장소` 탭(주소 `?tab=campus`)이 있고, 교체는 그 지점 유형의 목록만
 * 보인다. 상점은 캠퍼스 중심에서 가까운 순(api 순서)이고, 카드의 옛 `학생 요청:` 줄 자리에 AI 리뷰 요약이 `✦` 한 줄로 온다.
 * 코스에 이미 있는 장소 · 바꾸려는 지금 지점은 고를 수 없다(5곳 상한 · 중복은 프론트만 막는다). 적용은 전체 스팟 PUT이라
 * 되돌릴 수 없는 쓰기처럼 잠근다 — 진행 중 · 성공 뒤 이동 전에는 카드 · 버튼이 잠기고 연타해도 요청은 한 번이다.
 */
export function CoursePickPage() {
  const tourId = Number(useParams().tourId);
  const [params] = useSearchParams();
  const courseQuery = useGuideCourse(tourId);
  const base = `/guide/tours/${tourId}`;
  const mode = params.get('mode');
  const topBar = (
    <TopBar
      title={mode === 'replace' ? '코스 장소 교체' : '코스 장소 추가'}
      back={`${base}/course/edit`}
    />
  );
  const course = courseQuery.data;

  // 다시 불러오다 실패해도 받아 둔 코스는 그대로 보인다 — 오류 화면은 받은 코스가 없을 때만.
  if (course === undefined) {
    return (
      <>
        {topBar}
        <Page>
          {courseQuery.isError ? (
            <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
          ) : (
            <>
              <Skeleton className="mt-3 h-14 w-3/4" />
              <Skeleton className="mt-5 h-[var(--field-h)] rounded-md" />
              <CandidateSkeletons />
            </>
          )}
        </Page>
      </>
    );
  }
  if (course === null) return <Navigate to={`${base}/course/draft`} replace />;
  if (course.status === 'CONFIRMED') return <Navigate to={`${base}/course/confirm`} replace />;

  const target = pickTarget(course, mode, params.get('stopId'));
  if (target.kind === 'invalid') {
    return (
      <>
        {topBar}
        <Page>
          <div className="mt-3">
            <EmptyState
              title="바꿀 지점을 찾을 수 없어요"
              description="코스 편집에서 다시 골라 주세요."
              action={{ label: '코스 편집으로 돌아가기', to: `${base}/course/edit` }}
            />
          </div>
        </Page>
      </>
    );
  }
  return <PickBody tourId={tourId} course={course} target={target} topBar={topBar} />;
}

function CandidateSkeletons() {
  return (
    <>
      <Skeleton className="mt-5 h-6 w-32" />
      <Skeleton className="mt-2 h-[132px] rounded-lg" />
      <Skeleton className="mt-2 h-[132px] rounded-lg" />
      <Skeleton className="mt-2 h-[132px] rounded-lg" />
    </>
  );
}

function PickBody({
  tourId,
  course,
  target,
  topBar,
}: {
  tourId: number;
  course: Course;
  target: Exclude<PickTarget, { kind: 'invalid' }>;
  topBar: ReactNode;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const editPath = `/guide/tours/${tourId}/course/edit`;
  const isAdd = target.kind === 'add';
  const kind: Kind = isAdd
    ? params.get('tab') === 'campus'
      ? 'campus'
      : 'store'
    : target.stop.type === 'CAMPUS'
      ? 'campus'
      : 'store';
  // 탐방 학교를 모르면(실서버 캠퍼스 조인 실패 — 2C-R9 셋째 길) 부르지 않는다(2B′-R15). 지금 탭의 목록만 부른다.
  const universityId = course.tour.universityId === 0 ? null : course.tour.universityId;
  const storesQuery = useNearbyStores(kind === 'store' ? universityId : null);
  const placesQuery = useCampusPlaces(kind === 'campus' ? universityId : null);
  const addStop = useAddStop(tourId);
  const replaceStop = useReplaceStop(tourId);
  const drafting = useIsCreatingDraft(tourId);
  const [selected, setSelected] = useState<PlaceRef | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);

  const copy = KIND_COPY[kind];
  const heading = isAdd ? '장소를 추가해 볼까요?' : '장소를 바꿔볼까요?';
  const applying = addStop.isPending || replaceStop.isPending;
  // 성공한 뒤에도 이동할 때까지 잠근다 — 그 틈에 다시 눌러 같은 장소를 또 보내지 않게.
  const locked = applying || addStop.isSuccess || replaceStop.isSuccess || drafting;

  const pageHeading = (
    <PageHeading
      as="h2"
      title={heading}
      description="학생들의 하고 싶은 것과 연결되는 곳을 골라요."
      className="mt-3"
    />
  );

  if (universityId === null) {
    return (
      <>
        {topBar}
        <Page>
          {pageHeading}
          <div className="mt-5">
            <EmptyState
              title="학교 정보를 찾지 못해 주변 장소를 불러올 수 없어요"
              description="코스 편집에서 다시 시도해 주세요."
              action={{ label: '코스 편집으로 돌아가기', to: editPath }}
            />
          </div>
        </Page>
      </>
    );
  }

  const activeQuery = kind === 'store' ? storesQuery : placesQuery;
  const candidates: Candidate[] | undefined =
    kind === 'store' ? storesQuery.data?.map(fromStore) : placesQuery.data?.map(fromCampus);
  const statusOf = (place: PlaceRef) => candidateStatus(place, course, target);
  // 고른 장소가 그 사이 코스에 들어갔으면(다시 읽은 코스 — 409 뒤 등) 고른 것으로 치지 않는다.
  const chosen = selected !== null && statusOf(selected) === 'SELECTABLE' ? selected : null;
  const noneSelectable =
    candidates !== undefined &&
    candidates.length > 0 &&
    candidates.every((c) => statusOf(c.place) !== 'SELECTABLE');

  // 비활성 사유 + 다음 행동. 앞의 것이 먼저다.
  let block: { reason: string; action?: ActionLink } | null = null;
  if (drafting) block = { reason: 'AI 초안을 만드는 중이에요.' };
  else if (isAdd && course.stops.length >= MAX_COURSE_STOPS) {
    block = {
      reason: errorMessage('COURSE_STOP_LIMIT'),
      action: { label: '코스 편집에서 지점 빼기', to: editPath },
    };
  } else if (chosen === null && noneSelectable) {
    block = {
      reason: '고를 수 있는 후보가 없어요.',
      action: { label: '코스 편집으로 돌아가기', to: editPath },
    };
  } else if (chosen === null) block = { reason: '후보를 하나 고르면 적용할 수 있어요.' };

  function onTab(next: string) {
    setQuery('');
    setParams(next === 'campus' ? { mode: 'add', tab: 'campus' } : { mode: 'add' }, {
      replace: true,
    });
  }

  function clearSearch() {
    setQuery('');
    searchRef.current?.focus();
  }

  function onApply() {
    if (sending.current || block !== null || chosen === null) return; // 연타해도 요청은 한 번
    sending.current = true;
    const callbacks = {
      onSuccess: () => {
        toast('코스에 반영했어요.');
        void navigate(editPath, { replace: true });
      },
      // 고른 것은 그대로 둔다. 코스는 훅이 다시 받고(확정됐으면 확정 화면으로, 중복 · 상한이면 칩 · 사유가 바뀐다) 후보도 다시 받는다.
      onError: (error: { code: string }) => {
        sending.current = false;
        toast.error(errorMessage(error.code));
        void activeQuery.refetch();
      },
    };
    if (target.kind === 'replace') {
      replaceStop.mutate({ stopId: target.stop.id, place: chosen }, callbacks);
    } else {
      addStop.mutate(chosen, callbacks);
    }
  }

  let list: ReactNode;
  if (candidates === undefined) {
    list = activeQuery.isError ? (
      <ErrorState error={activeQuery.error} onRetry={() => void activeQuery.refetch()} />
    ) : (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-[132px] rounded-lg" />
        <Skeleton className="h-[132px] rounded-lg" />
        <Skeleton className="h-[132px] rounded-lg" />
      </div>
    );
  } else if (candidates.length === 0) {
    list = (
      <EmptyState title={copy.empty} action={{ label: '코스 편집으로 돌아가기', to: editPath }} />
    );
  } else {
    // 고른 후보가 검색으로 가려져도 선택은 남는다(옛 2B G07).
    const visible = candidates.filter((c) => matchesPlace(c.texts, query));
    list =
      visible.length === 0 ? (
        <EmptyState
          title={copy.noMatch(query.trim())}
          action={{ label: '검색어 지우기', onClick: clearSearch }}
        />
      ) : (
        <ul aria-label={copy.list} className="flex flex-col gap-2">
          {visible.map((c) => (
            <CandidateCard
              key={c.key}
              candidate={c}
              status={statusOf(c.place)}
              selected={samePlace(c.place, chosen)}
              locked={locked}
              onSelect={() => setSelected(c.place)}
            />
          ))}
        </ul>
      );
  }

  return (
    <>
      {topBar}
      <Page className={BOTTOM_ACTION_PAGE}>
        {pageHeading}
        {isAdd ? (
          <div className="mt-5">
            <SegmentedTabs
              id={TABS_ID}
              tabs={TABS}
              value={kind}
              onChange={onTab}
              label="장소 종류"
            />
          </div>
        ) : null}

        <div className="mb-4" {...(isAdd ? segmentedPanelProps(TABS_ID, kind) : {})}>
          <div className="mt-5">
            <TextField
              ref={searchRef}
              type="search"
              label={copy.search}
              placeholder={copy.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={preventImeEnter}
            />
          </div>
          <h3 className="mt-5 mb-2 text-lg leading-[1.4] font-bold text-ink">{copy.heading}</h3>
          {list}
          {kind === 'store' ? (
            <InfoCard
              tone="brand"
              className="mt-4"
              title="제휴 여부로 추천 순위를 정하지 않아요."
              description="최종 코스에는 제휴 상점 1곳 이상이 필요해요."
            />
          ) : null}
        </div>

        <BottomAction>
          <Button
            loading={applying}
            disabled={block !== null || addStop.isSuccess || replaceStop.isSuccess}
            hint={block ?? undefined}
            onClick={onApply}
          >
            {isAdd ? '이 장소 추가' : '이 장소로 교체'}
          </Button>
        </BottomAction>
      </Page>
    </>
  );
}

/**
 * 후보 카드: 카드 전체가 선택 버튼(`aria-pressed`)이다. 이름이 버튼 이름이고 칩 · 거리 · 요약 · 상태는 설명이다.
 * `<button>` 안에는 구문 콘텐츠만 둘 수 있어 줄은 block span, 칩은 `Badge`(span)로 그린다.
 */
function CandidateCard({
  candidate,
  status,
  selected,
  locked,
  onSelect,
}: {
  candidate: Candidate;
  status: CandidateStatus;
  selected: boolean;
  locked: boolean;
  onSelect(): void;
}) {
  const id = useId();
  const ids = {
    chip: `${id}-chip`,
    name: `${id}-name`,
    meta: `${id}-meta`,
    summary: `${id}-summary`,
    status: `${id}-status`,
  };
  const selectable = status === 'SELECTABLE';
  const describedBy = [
    ids.chip,
    candidate.meta === null ? null : ids.meta,
    candidate.summary === null ? null : ids.summary,
    selectable ? null : ids.status,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-labelledby={ids.name}
        aria-describedby={describedBy}
        disabled={!selectable || locked}
        onClick={onSelect}
        className={cn(
          'flex w-full flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors',
          'disabled:cursor-not-allowed',
          selectable ? 'bg-surface' : 'bg-neutral-100',
          selected ? 'border-brand' : 'border-transparent',
        )}
      >
        <span id={ids.chip}>
          <Badge tone={candidate.chip.tone}>{candidate.chip.label}</Badge>
        </span>
        <span id={ids.name} className="block text-[19px] leading-[1.4] font-bold text-ink">
          {candidate.name}
        </span>
        {candidate.meta === null ? null : (
          <span id={ids.meta} className="block w-full truncate text-[13px] text-muted">
            {candidate.meta}
          </span>
        )}
        {candidate.summary === null ? null : (
          <span id={ids.summary} className="block w-full truncate text-[13px] text-muted">
            <span className="sr-only">AI 리뷰 요약: </span>
            <span aria-hidden className="text-brand">
              ✦{' '}
            </span>
            {candidate.summary}
          </span>
        )}
        {selectable ? null : (
          <span id={ids.status} className="mt-1">
            <Badge>{STATUS_LABEL[status]}</Badge>
          </span>
        )}
      </button>
    </li>
  );
}
