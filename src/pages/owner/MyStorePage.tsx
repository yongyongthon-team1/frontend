import { Link } from 'react-router';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import {
  partnershipStateLabel,
  type MyStore,
  type PartnershipState,
} from '@/features/stores/model';
import { useMyStore } from '@/features/stores/queries';
import type { Tone } from '@/shared/lib/types';
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { BrandMark } from '@/shared/ui/BrandMark';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { HeroCard } from '@/shared/ui/HeroCard';
import { Illustration, type IllustrationKind } from '@/shared/ui/Illustration';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';

const STATE_TONE: Record<PartnershipState, Tone> = {
  ACTIVE: 'success',
  SCHEDULED: 'info',
  ENDED: 'neutral',
};

/** `쿠폰 사용 방법` 아래 텍스트 링크. 제휴 혜택 수정은 제휴가 있을 때만(없으면 위 카드의 문구가 같은 주소다). */
const LINKS = [
  { to: '/owner/report', label: '방문 · 리뷰 리포트' },
  { to: '/owner/store/partnership', label: '제휴 혜택 수정' },
  { to: '/owner/store/edit', label: '가게 정보 수정' },
] as const;

const HOW_TO = [
  { no: '01', label: '학생이 쿠폰 제시' },
  { no: '02', label: '코드 입력 후 처리' },
];

/** 가게 업종에 어울리는 일러스트(V2 O01의 카페는 업종 `카페`). 모르는 업종은 일상 장면이다. */
function illustrationFor(category: string): IllustrationKind {
  if (category.includes('카페')) return category.includes('보드게임') ? 'play' : 'cafe';
  if (category === '한식' || category === '분식') return 'dining';
  return 'daily';
}

/**
 * 맨 위 줄: 왼쪽 로고, 오른쪽 `로그아웃` 텍스트 버튼(사장님 탭에는 MY가 없다 — 2A-R9). 모든 상태에서 보인다.
 * 발표 모드 배지 · 좁은 화면 시연 패널 토글이 오른쪽 위에 겹치므로 버튼은 그만큼 왼쪽으로 비켜 선다(globals.css `--header-action-clear`, 실행 판정: 발표 배지가 머리 줄 조작을 가리지 않음). 로그아웃 동작과 연타 잠금은 공용 `LogoutButton`이 가진다.
 */
function Header() {
  return (
    <div className="flex items-center justify-between">
      <BrandMark variant="wordmark" />
      <LogoutButton
        variant="ghost"
        size="sm"
        className="relative right-[var(--header-action-clear,0px)] -mr-3 w-auto px-3 hover:bg-transparent hover:text-ink"
      />
    </div>
  );
}

/** 사장님 내 가게(owner-s02): 가게가 있으면 O01, 연결된 가게가 없으면(`null`) O01-E. */
export function MyStorePage() {
  const query = useMyStore();
  const { data: store } = query;

  if (store === undefined) {
    return (
      <Page className="pt-6">
        <h1 className="sr-only">내 가게</h1>
        <Header />
        {query.isError ? (
          <div className="mt-6">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <>
            <Skeleton className="mt-5 h-[72px] w-3/4" />
            <Skeleton className="mt-6 h-[190px] rounded-xl" />
            <Skeleton className="mt-4 h-14" />
          </>
        )}
      </Page>
    );
  }

  return store === null ? <NotLinked /> : <StoreHome store={store} />;
}

/** O01-E: 연결된 가게가 없다. 가게 연결은 `/owner/store/connect`(O05)다. */
function NotLinked() {
  return (
    <Page className={BOTTOM_ACTION_PAGE_TAB_ROOT}>
      <Header />
      <PageHeading
        title={'아직 연결된 가게가\n없어요.'}
        description="내 가게를 연결하고 학생들에게 제휴 혜택을 소개해 보세요."
        className="mt-5"
      />
      <section className="mt-8 flex flex-col items-center rounded-xl bg-brand-soft px-5 py-6 text-center">
        <p className="text-xs font-bold text-brand">MY LOCAL SHOP</p>
        <Illustration kind="cafe" className="mt-3 h-auto max-h-[120px] w-auto object-contain" />
        <p className="mt-3 text-[15px] font-bold text-ink">가게 연결을 시작해 볼까요?</p>
      </section>
      <p className="mt-5 text-xs text-muted">
        연결 후에는 제휴 할인과 쿠폰 사용을 관리할 수 있어요.
      </p>

      <BottomAction>
        <Link to="/owner/store/connect" className={buttonClass('primary')}>
          내 가게 연결하기
        </Link>
      </BottomAction>
    </Page>
  );
}

/** O01: 가게 카드(제휴 상태) · 쿠폰 코드 입력 · 쿠폰 사용 방법. */
function StoreHome({ store }: { store: MyStore }) {
  const { partnership } = store;
  return (
    <Page className="pt-6">
      <Header />
      <PageHeading
        title={'학생들이 가게를\n더 쉽게 찾고 있어요.'}
        description="동네 탐방과 함께 새로운 손님을 맞이해요."
        className="mt-5"
      />

      <div className="mt-6">
        <HeroCard
          tone="local"
          eyebrow="MY LOCAL SHOP"
          title={store.name}
          illustration={illustrationFor(store.category)}
        >
          {partnership ? (
            <>
              <p className="text-[13px] text-muted">{partnership.discount} 운영 중</p>
              <StatusChip
                tone={STATE_TONE[partnership.state]}
                icon={
                  partnership.state === 'ACTIVE' ? (
                    <span className="size-2 rounded-full bg-success" />
                  ) : undefined
                }
                className="mt-4 bg-surface"
              >
                {partnershipStateLabel(partnership.state)}
              </StatusChip>
            </>
          ) : (
            <Link
              to="/owner/store/partnership"
              className="inline-flex min-h-11 items-center text-[13px] font-bold text-ink"
            >
              제휴 혜택을 설정해 주세요
              <span aria-hidden> ›</span>
            </Link>
          )}
        </HeroCard>
      </div>

      <Link to="/owner/coupons/redeem" className={`${buttonClass('primary')} mt-4`}>
        쿠폰 코드 입력하기
      </Link>

      <h2 className="mt-8 mb-3 text-lg font-bold text-ink">쿠폰 사용 방법</h2>
      <ol className="grid grid-cols-2 divide-x divide-border rounded-xl bg-surface py-5">
        {HOW_TO.map(({ no, label }) => (
          <li key={no} className="min-w-0 px-5">
            <p className="text-2xl font-bold text-ink">{no}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </li>
        ))}
      </ol>

      {/* 링크 셋은 한 줄에 모아 무대 높이를 아낀다(좁으면 줄이 바뀐다). `쿠폰 코드 입력하기` 자리는 그대로다. */}
      <div className="mt-2 flex flex-wrap gap-x-5">
        {LINKS.filter((link) => link.to !== '/owner/store/partnership' || partnership).map(
          ({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-11 items-center text-[13px] font-bold text-brand"
            >
              {label}
              <span aria-hidden> ›</span>
            </Link>
          ),
        )}
      </div>
    </Page>
  );
}
