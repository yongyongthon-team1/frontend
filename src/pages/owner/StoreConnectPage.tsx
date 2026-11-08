import { useRef, useState, type FormEvent } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Me } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import type { University } from '@/features/campuses/model';
import { useUniversities } from '@/features/campuses/queries';
import {
  STORE_CATEGORIES,
  STORE_SEARCH_MIN,
  type StoreRegistrationInput,
  type StoreSearchItem,
} from '@/features/stores/model';
import { useLinkStore, useStoreSearch } from '@/features/stores/queries';
import { campusLabel } from '@/features/tours/model';
import { cn } from '@/shared/lib/cn';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

const SEARCH_MAX = 50;
const SEARCH_TOO_SHORT = `가게 이름을 ${STORE_SEARCH_MIN}자 이상 입력해 주세요.`;
const TAKEN_REASON = '이미 다른 사장님 계정에 연결된 가게예요.';

type LinkMutation = ReturnType<typeof useLinkStore>;

type RegisterField = 'name' | 'address' | 'category' | 'campus';
type RegisterErrors = Partial<Record<RegisterField, string>>;

/** 서버 칸 이름 → 등록 폼 칸. 좌표 오류(`latitude` · `longitude`)는 학교 칸에 보인다. */
const SERVER_FIELD: Record<string, RegisterField> = {
  name: 'name',
  address: 'address',
  category: 'category',
  latitude: 'campus',
  longitude: 'campus',
};

/** 검색 결과 한 장. 고르기(선택 표시)만 한다 — 되돌릴 수 없는 연결은 하단 `다음으로`가 한다(2B-R16). */
function CandidateCard({
  item,
  selected,
  locked,
  onPick,
}: {
  item: StoreSearchItem;
  selected: boolean;
  locked: boolean;
  onPick(): void;
}) {
  return (
    <li className="rounded-xl bg-surface p-5">
      <StatusChip tone="info">검색 결과</StatusChip>
      <h3 className="mt-3 truncate text-[19px] leading-[1.4] font-bold text-ink">{item.name}</h3>
      <p className="mt-1 mb-4 text-[13px] text-muted">
        {item.address} · {item.category}
      </p>
      <Button
        variant="soft"
        aria-label={`${item.name} 이 가게 연결하기`}
        aria-pressed={selected}
        disabled={item.registered || locked}
        hint={item.registered ? { reason: TAKEN_REASON } : undefined}
        onClick={onPick}
      >
        {selected ? '✓ 선택됨' : '이 가게 연결하기'}
      </Button>
    </li>
  );
}

/** 직접 등록 폼. 좌표는 사장님이 고른 `가까운 학교`의 캠퍼스 중심이다(지오코더 없음, 2B′-R21). */
function RegisterForm({
  campuses,
  link,
  locked,
  onRegister,
  serverErrors,
}: {
  campuses: University[] | undefined;
  link: LinkMutation;
  locked: boolean;
  onRegister(input: StoreRegistrationInput): void;
  serverErrors: RegisterErrors;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [campusId, setCampusId] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const shown = { ...serverErrors, ...errors };

  const clear = (field: RegisterField) => setErrors((prev) => ({ ...prev, [field]: undefined }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    const campus = campuses?.find((u) => String(u.id) === campusId);
    const found: RegisterErrors = {};
    if (name.trim() === '') found.name = '상호명을 입력해 주세요.';
    if (address.trim() === '') found.address = '가게 주소를 입력해 주세요.';
    if (category === '') found.category = '업종을 골라 주세요.';
    if (campus === undefined) found.campus = '가까운 학교를 골라 주세요.';
    setErrors(found);
    if (Object.keys(found).length > 0 || campus === undefined) return;
    onRegister({
      name: name.trim(),
      address: address.trim(),
      category,
      latitude: campus.lat,
      longitude: campus.lng,
    });
  }

  return (
    <form
      id="store-register"
      onSubmit={onSubmit}
      onKeyDown={preventImeEnter}
      noValidate
      className="mt-3 flex flex-col gap-3"
    >
      <fieldset disabled={link.isPending} className="flex min-w-0 flex-col gap-3">
        <TextField
          label="상호명 직접 입력"
          showLabel
          autoComplete="off"
          value={name}
          error={shown.name}
          onChange={(e) => {
            setName(e.target.value);
            clear('name');
          }}
        />
        <TextField
          label="가게 주소"
          showLabel
          autoComplete="off"
          hint="도로명 주소로 적어 주세요."
          value={address}
          error={shown.address}
          onChange={(e) => {
            setAddress(e.target.value);
            clear('address');
          }}
        />
        <Select
          label="업종"
          showLabel
          options={[
            { value: '', label: '업종 선택' },
            ...STORE_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
          value={category}
          error={shown.category}
          onChange={(e) => {
            setCategory(e.target.value);
            clear('category');
          }}
        />
        <Select
          label="가까운 학교"
          showLabel
          hint="지도 위치는 이 캠퍼스 근처로 잡혀요."
          options={[
            { value: '', label: '가게와 가까운 캠퍼스를 골라 주세요' },
            ...(campuses ?? []).map((u) => ({
              value: String(u.id),
              label: campusLabel(u.name, u.campusName),
            })),
          ]}
          value={campusId}
          error={shown.campus}
          onChange={(e) => {
            setCampusId(e.target.value);
            clear('campus');
          }}
        />
      </fieldset>
      <Button type="submit" variant="secondary" loading={link.isPending} disabled={locked}>
        내 가게 등록하기
      </Button>
    </form>
  );
}

/** 사업자 인증을 마치고 아직 가게가 없을 때의 본문: 검색 → 고르기 → 다음으로(확인 창), 또는 직접 등록. */
function Connect({ me, link, onLinked }: { me: Me; link: LinkMutation; onLinked(): void }) {
  const verified = me.businessVerified;
  const campuses = useUniversities();
  const locked = useRef(false);
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [searchError, setSearchError] = useState<string>();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<RegisterErrors>({});

  const search = useStoreSearch(verified ? submitted : '');
  // 줄인 입력에는 이전 결과가 남아 있다(`keepPreviousData`). 입력도 제출한 검색어도 2자 이상일 때만 결과를 보인다.
  const searchable =
    verified &&
    keyword.trim().length >= STORE_SEARCH_MIN &&
    submitted.trim().length >= STORE_SEARCH_MIN;
  const items = searchable ? search.data : undefined;
  const selected = items?.find((item) => item.storeId === selectedId && !item.registered);
  const pending = link.isPending || link.isSuccess;

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!verified) return;
    const trimmed = keyword.trim();
    setSelectedId(null);
    setSubmitted(trimmed);
    setSearchError(trimmed.length < STORE_SEARCH_MIN ? SEARCH_TOO_SHORT : undefined);
  }

  /** 연결 · 등록의 공통 실행. 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다. */
  function submitLink(input: StoreRegistrationInput) {
    if (locked.current || link.isPending) return;
    locked.current = true;
    link.mutate(input, {
      onSuccess: onLinked, // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 요청이 한 번 더 나가지 않는다.
      onError: (error) => {
        locked.current = false;
        setConfirmOpen(false);
        setSelectedId(null);
        const server: RegisterErrors = {};
        for (const [key, reason] of Object.entries(error.fieldErrors ?? {})) {
          const field = SERVER_FIELD[key];
          if (field !== undefined) server[field] = reason;
        }
        if (error.code === 'ADDRESS_NOT_FOUND') server.address = errorMessage(error.code);
        setServerErrors(server);
        if (Object.keys(server).length === 0) toast.error(errorMessage(error.code));
      },
    });
  }

  let list;
  if (items === undefined && searchable && search.isError) {
    list = <ErrorState error={search.error} onRetry={() => void search.refetch()} />;
  } else if (items === undefined && searchable && search.isLoading) {
    list = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[148px] rounded-xl" />
        <Skeleton className="h-[148px] rounded-xl" />
      </div>
    );
  } else if (items === undefined) {
    list = (
      <InfoCard
        title="가게 이름으로 찾아 주세요"
        description="2자 이상 입력하고 검색하면 공공데이터(소상공인 상가정보)에 있는 가게가 보여요."
      />
    );
  } else if (items.length === 0) {
    list = (
      <InfoCard
        title="검색 결과가 없어요"
        description="상호를 다시 확인하거나 아래에서 직접 등록해 주세요."
      />
    );
  } else {
    list = (
      <>
        <h2 className="mb-3 text-lg font-bold text-ink">검색 결과</h2>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <CandidateCard
              key={item.storeId}
              item={item}
              selected={item.storeId === selected?.storeId}
              locked={pending}
              onPick={() => setSelectedId(item.storeId)}
            />
          ))}
        </ul>
      </>
    );
  }

  const nextHint = !verified
    ? {
        reason: '사업자 인증을 마치면 가게를 연결할 수 있어요.',
        action: { label: '사업자 인증하기', to: '/owner/verify' },
      }
    : selected === undefined
      ? { reason: '연결할 가게를 먼저 골라 주세요.' }
      : undefined;

  return (
    <>
      <form
        role="search"
        onSubmit={onSearch}
        onKeyDown={preventImeEnter}
        noValidate
        className="mt-5"
      >
        <fieldset disabled={!verified || pending} className="flex min-w-0 items-start gap-2">
          <TextField
            label="가게 이름 검색"
            placeholder="예: 책방 옆 작은 카페"
            maxLength={SEARCH_MAX}
            autoComplete="off"
            enterKeyHint="search"
            value={keyword}
            error={searchError}
            onChange={(e) => {
              setKeyword(e.target.value);
              setSearchError(undefined);
            }}
          />
          <button
            type="submit"
            aria-label="검색"
            className="flex size-[var(--field-h)] shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-muted"
          >
            <Search aria-hidden className="size-5" />
          </button>
        </fieldset>
      </form>

      <div className="mt-5" aria-live="polite">
        {list}
      </div>

      <InfoCard
        tone="brand"
        className="mt-4"
        title="검색되지 않는 가게는 상호와 위치를 직접 입력할 수 있어요."
      />
      <button
        type="button"
        aria-expanded={registerOpen}
        aria-controls="store-register"
        disabled={!verified || pending}
        onClick={() => setRegisterOpen((open) => !open)}
        className="mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-ink">내 가게 직접 등록</span>
          <span className="mt-0.5 block text-xs text-muted">상호명 · 주소 · 업종 입력</span>
        </span>
        <ChevronRight
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-ink transition-transform',
            registerOpen && 'rotate-90',
          )}
        />
      </button>
      {registerOpen && verified ? (
        <RegisterForm
          campuses={campuses.data}
          link={link}
          locked={pending}
          serverErrors={serverErrors}
          onRegister={(input) => {
            setServerErrors({});
            submitLink(input);
          }}
        />
      ) : null}
      <p className="mt-4 text-xs text-muted">이미 다른 사장님 계정에 연결된 가게는 선택 불가</p>

      <BottomAction>
        <Button
          disabled={selected === undefined || !verified || pending}
          hint={nextHint}
          onClick={() => setConfirmOpen(true)}
        >
          다음으로
        </Button>
      </BottomAction>

      <ConfirmDialog
        open={confirmOpen && selected !== undefined}
        onOpenChange={setConfirmOpen}
        title="내 가게로 연결할까요?"
        description={
          selected
            ? `${selected.name} · ${selected.address} — 계정당 가게는 1개만 연결할 수 있어요.`
            : ''
        }
        confirmLabel="연결하기"
        pending={pending}
        onConfirm={() => {
          if (selected) submitLink({ storeId: selected.storeId });
        }}
      />
    </>
  );
}

/**
 * 가게 찾기 · 연결(O05, owner-a01, S-01). 사업자 대조 후보는 없다 — 상호 검색(2자 이상)으로 찾아 고르거나 직접 등록한다(2B′-R21).
 * 연결 · 등록이 되면 제휴 설정(`/owner/store/partnership`)으로 간다. 연결 훅은 내 정보가 먼저 바뀌어도 이동이 끝나도록 페이지가 가진다.
 */
export function StoreConnectPage() {
  const navigate = useNavigate();
  const meQuery = useMe();
  const link = useLinkStore();
  const me = meQuery.data;
  // 연결이 끝나면 내 정보가 먼저 바뀌어 안내 카드로 깜박이지 않게, 연결 중 · 직후에는 본문을 유지한다(이동이 이어서 일어난다).
  const alreadyLinked =
    me !== undefined && me.storeId !== null && !link.isPending && !link.isSuccess;

  let body;
  if (me === undefined && meQuery.isError) {
    body = (
      <div className="mt-5">
        <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />
      </div>
    );
  } else if (me === undefined) {
    body = <Skeleton className="mt-5 h-[220px] rounded-lg" />;
  } else if (alreadyLinked) {
    body = (
      <InfoCard
        className="mt-5"
        title="이미 연결된 가게가 있어요"
        description="계정당 가게는 1개만 연결할 수 있어요."
        footer={
          <Link to="/owner/store" className={buttonClass('primary')}>
            내 가게 보기
          </Link>
        }
      />
    );
  } else {
    body = (
      <Connect
        me={me}
        link={link}
        onLinked={() => void navigate('/owner/store/partnership', { replace: true })}
      />
    );
  }

  return (
    <>
      <TopBar title="가게 찾기 · 연결" back="/owner/store" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="우리 가게를 연결해요."
          description="캠퍼스 주변 가게를 검색하거나 직접 등록해요."
          className="mt-3"
        />
        {body}
      </Page>
    </>
  );
}
