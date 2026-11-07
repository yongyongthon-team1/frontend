import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/queries';
import {
  couponNotice,
  couponStateLabel,
  formatCouponCode,
  type CouponLookup,
  type CouponNotice,
  type RedeemResult,
} from '@/features/coupons/model';
import { useCouponLookup, useRedeemCoupon } from '@/features/coupons/queries';
import { useDemoStore, useDemoToolsOn, validLastCoupon } from '@/demo/demoStore';
import { formatDotDateWeekday, formatTime } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { CodeInput } from '@/shared/ui/CodeInput';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const CODE_LENGTH = 6;

/** `?code=` 같은 바깥 값을 CodeInput과 같은 규칙(숫자만, 6자리까지)으로 다듬는다. */
function cleanCode(raw: string | null): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/**
 * 사장님 쿠폰 사용 처리(owner-s03 · owner-a03). 6자리 코드를 조회하고 사용 가능(USABLE)이면 사용 처리한다.
 * 같은 주소(`/owner/coupons/redeem`)가 세 모습이다 — 입력과 조회(O02), 사용 완료(O07), 오류(O08). 오류 카드의 문구는
 * `couponNotice`가 정하고, 서버가 준 상태만 그린다(시간 판단은 서버).
 */
export function CouponRedeemPage() {
  const [params, setParams] = useSearchParams();
  const { key: locationKey } = useLocation();
  const urlCode = cleanCode(params.get('code'));
  const [code, setCode] = useState(urlCode);
  // 이 화면에 머문 채 `?code=`로 다시 오면(시연 패널의 쿠폰 가게 사장님 전환을 또 누름 — 같은 주소여도) 그 코드로 바꾼다.
  const [seenLocationKey, setSeenLocationKey] = useState(locationKey);
  if (locationKey !== seenLocationKey) {
    setSeenLocationKey(locationKey);
    if (urlCode !== '') setCode(urlCode);
  }
  const lookup = useCouponLookup(code);
  const redeem = useRedeemCoupon();
  const demoOn = useDemoToolsOn();
  const { data: me } = useMe();
  const lastCoupon = validLastCoupon(useDemoStore((s) => s.lastCoupon));
  // 저장된 값은 믿지 않는다(6자리 숫자 · 시연 가게만, 판정 26). 그리고 내 가게 쿠폰일 때만 채운다 — 학생이 다른 가게
  // 쿠폰을 마지막으로 봤으면 채워도 "다른 가게 쿠폰"이다(판정 32).
  const fillableCode =
    demoOn && lastCoupon !== null && lastCoupon.storeId === me?.storeId ? lastCoupon.code : null;

  const data = lookup.data;
  // 다시 불러오다 실패해도 이미 받은 조회 결과는 그대로 둔다.
  const lookupError = data === undefined && lookup.isError ? lookup.error : undefined;
  const redeemError = redeem.isError && redeem.variables === code ? redeem.error : undefined;
  const redeemed = redeem.isSuccess && redeem.variables === code ? redeem.data : undefined;

  const redeemedAt = redeemError?.details?.usedAt;
  const redeemNotice = redeemError
    ? couponNotice({
        errorCode: redeemError.code,
        usedAt: typeof redeemedAt === 'string' ? redeemedAt : null,
      })
    : null;
  const lookupNotice = couponNotice({
    errorCode: lookupError?.code,
    state: data?.state,
    usedAt: data?.usedAt,
  });
  const notice = redeemed ? null : (redeemNotice ?? lookupNotice);
  // 도메인 오류(위 카드)가 아닌 조회 실패만 ErrorState로 보여 준다.
  const lookupFailure =
    lookupError !== undefined && lookupNotice === null ? lookupError : undefined;

  const canRedeem = data?.state === 'USABLE' && notice === null && !redeemed;

  function handleRedeem() {
    redeem.mutate(code, {
      onError: (error) => {
        // 도메인 오류는 카드가 알려 준다. 그 밖의 실패(네트워크 · 서버)만 토스트.
        if (couponNotice({ errorCode: error.code }) === null) toast.error(errorMessage(error.code));
      },
    });
  }

  function reset() {
    setCode('');
    redeem.reset();
    // `?code=`로 들어왔다면 지운다 — 새로 고침해도 같은 코드로 되돌아가지 않게.
    if (params.has('code')) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('code');
          return next;
        },
        { replace: true },
      );
    }
  }

  if (redeemed) {
    return <Redeemed result={redeemed} onReset={reset} />;
  }
  if (notice) {
    return <Rejected notice={notice} onReset={reset} />;
  }

  return (
    <>
      <TopBar title="쿠폰 사용 처리" back="/owner/store" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title={'쿠폰 코드를 입력하면\n바로 확인할 수 있어요.'}
          description="학생이 보여주는 6자리 숫자를 입력해요."
          className="mt-3"
        />
        <div className="mt-8">
          <CodeInput value={code} onChange={setCode} />
        </div>
        {fillableCode !== null ? (
          <Button
            className="mt-2 self-start"
            variant="ghost"
            size="sm"
            disabled={code === fillableCode}
            onClick={() => setCode(fillableCode)}
          >
            최근 쿠폰 채우기
          </Button>
        ) : null}

        <div className="mt-6" aria-live="polite">
          {lookup.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : lookupFailure ? (
            <ErrorState error={lookupFailure} onRetry={() => void lookup.refetch()} />
          ) : data ? (
            <LookupCard lookup={data} />
          ) : null}
        </div>

        <p className="mt-6 text-[13px] text-muted">쿠폰은 한 번만 사용할 수 있어요.</p>

        <BottomAction>
          <Button
            disabled={!canRedeem}
            loading={redeem.isPending}
            hint={
              data === undefined
                ? { reason: '6자리 코드를 조회하면 사용 처리할 수 있어요.' }
                : undefined
            }
            onClick={handleRedeem}
          >
            사용 처리하기
          </Button>
        </BottomAction>
      </Page>
    </>
  );
}

/** O02 조회 카드: 칩 · 상점 · 혜택(brand 19/Bold) · 구분선 · `{탐방 제목} · {MM.DD (요일)}`. */
function LookupCard({ lookup }: { lookup: CouponLookup }) {
  return (
    <section className="rounded-xl bg-surface p-5">
      <StatusChip tone="success">{couponStateLabel(lookup.state, lookup.usedAt)}</StatusChip>
      <h3 className="mt-3 truncate text-[17px] font-bold text-ink">{lookup.storeName}</h3>
      <p className="mt-2 text-[19px] leading-[1.4] font-bold text-brand">{lookup.discount}</p>
      <p className="mt-4 truncate border-t border-border pt-4 text-[13px] text-muted">
        {lookup.tourTitle} · {formatDotDateWeekday(lookup.tourStartsAt)}
      </p>
    </section>
  );
}

/** O07: 사용 처리 성공. 2A-R13 — 시연의 상권 효과 장면이라 `이번 탐방으로 온 학생 {n}명`을 카드 아래에 남긴다(실서버는 방문 수를 주지 않아 null이면 숨긴다, 2C-R12 ⑤). */
function Redeemed({ result, onReset }: { result: RedeemResult; onReset(): void }) {
  const { coupon } = result;
  return (
    <>
      <TopBar title="쿠폰 사용 처리 완료" back="/owner/store" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="쿠폰 사용이 완료됐어요."
          description="학생에게 사용 완료를 안내해 주세요."
          className="mt-3"
        />
        <section className="mt-6 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-surface text-brand"
          >
            <Check className="size-6" strokeWidth={2.5} />
          </span>
          <h3 className="mt-3 text-xl leading-snug font-bold text-ink">쿠폰 처리 성공</h3>
          <p className="mt-1 text-[13px] text-muted">
            중복 사용 방지를 위해 사용 완료 상태로 저장했어요.
          </p>
        </section>
        <section className="mt-3 rounded-xl bg-surface p-5">
          <StatusChip tone="success">사용 완료</StatusChip>
          <h3 className="mt-3 truncate text-[19px] leading-[1.4] font-bold text-ink">
            {coupon.storeName}
          </h3>
          <p className="mt-1 text-[13px] text-muted">
            {coupon.discount} · 코드 {formatCouponCode(coupon.code)}
          </p>
          {coupon.usedAt ? (
            <p className="mt-2 text-[13px] text-muted">
              {formatDotDateWeekday(coupon.usedAt)} · {formatTime(coupon.usedAt)} 사용
            </p>
          ) : null}
        </section>
        {result.tourVisitorCount !== null ? (
          <p className="mt-4 px-1 text-[13px] font-bold text-ink">
            이번 탐방으로 온 학생 {result.tourVisitorCount}명
          </p>
        ) : null}

        <BottomAction>
          <Button onClick={onReset}>다른 쿠폰 확인하기</Button>
        </BottomAction>
      </Page>
    </>
  );
}

/** O08: 조회 · 사용 처리 오류. 카드 문구는 1단계 `couponNotice`의 제목 · 설명이다. */
function Rejected({ notice, onReset }: { notice: CouponNotice; onReset(): void }) {
  return (
    <>
      <TopBar title="쿠폰 오류 · 만료" back="/owner/store" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="코드를 다시 확인해 주세요."
          description="해당 쿠폰을 사용할 수 없는 상태예요."
          className="mt-3"
        />
        <section role="alert" className="mt-6 rounded-xl bg-brand-soft p-5">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-xl font-bold text-danger"
          >
            !
          </span>
          <h3 className="mt-3 text-xl leading-snug font-bold text-ink">{notice.title}</h3>
          <p className="mt-1 text-[13px] text-muted">{notice.description}</p>
        </section>
        <p className="mt-3 rounded-lg bg-danger-soft px-4 py-3 text-xs text-danger">
          확인 항목: 코드 6자리 · 사용 여부 · 탐방 당일 유효 여부
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-ink">다른 코드 입력하기</span>
            <span className="mt-0.5 block text-xs text-muted">
              학생에게 새 코드를 확인해 주세요.
            </span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-ink" />
        </button>

        <BottomAction>
          <Button onClick={onReset}>다시 입력하기</Button>
        </BottomAction>
      </Page>
    </>
  );
}
