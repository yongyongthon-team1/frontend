import { Link } from 'react-router';
import { useLogout } from '@/features/auth/queries';
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
 * 발표 모드 배지 · 좁은 화면 시연 패널 토글이 오른쪽 위에 겹치므로 버튼은 그만큼 왼쪽으로 비켜 선다(globals.css `--header-action-clear`, 판정 R13).
 */
function Header() {
  const logout = useLogout();
  return (
    <div className="flex items-center justify-between">
      <BrandMark variant="wordmark" />
      <button
        type="button"
        onClick={() => void logout()}
        className="relative right-[var(--header-action-clear,0px)] -mr-3 inline-flex min-h-11 items-center px-3 text-sm font-bold text-muted hover:text-ink"
      >
        로그아웃
      </button>
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

/** O01-E: 연결된 가게가 없다. 가게 연결은 2B의 `/owner/store/connect`다. */
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
            // 제휴 설정 화면(`/owner/store/partnership`)은 2B에서 열린다 — 길이 생기면 이 문구를 링크로 바꾼다.
            <p className="text-[13px] font-bold text-ink">제휴 혜택을 설정해 주세요</p>
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
    </Page>
  );
}
