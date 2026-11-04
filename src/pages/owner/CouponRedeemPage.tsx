import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/queries';
import { couponNotice } from '@/features/coupons/model';
import { useCouponLookup, useRedeemCoupon } from '@/features/coupons/queries';
import { useDemoStore, useDemoToolsOn, validLastCoupon } from '@/demo/demoStore';
import { formatTime, formatTourDate } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { Button } from '@/shared/ui/Button';
import { CodeInput } from '@/shared/ui/CodeInput';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
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
 * 오류 카드의 문구는 `couponNotice`가 정하고, 서버가 준 상태만 그린다(시간 판단은 서버).
 */
export function CouponRedeemPage() {
  const [params] = useSearchParams();
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
  }

  return (
    <>
      <TopBar title="쿠폰 사용 처리" />
      <Page>
        <StatusChip>6자리 번호 입력</StatusChip>
        <div className="mt-4">
          <CodeInput value={code} onChange={setCode} />
        </div>
        {fillableCode !== null ? (
          <Button
            className="mt-2"
            variant="ghost"
            size="sm"
            disabled={code === fillableCode}
            onClick={() => setCode(fillableCode)}
          >
            최근 쿠폰 채우기
          </Button>
        ) : null}

        <div className="mt-4" aria-live="polite">
          {lookup.isLoading ? (
            <Skeleton className="h-32" />
          ) : lookupFailure ? (
            <ErrorState error={lookupFailure} onRetry={() => void lookup.refetch()} />
          ) : redeemed ? (
            <InfoCard
              title="사용 완료"
              description={`사용 시각 ${redeemed.coupon.usedAt ? formatTime(redeemed.coupon.usedAt) : ''} 기록 · 중복 사용 불가`}
            >
              <p className="text-base font-bold text-ink">
                이번 탐방으로 온 학생 {redeemed.tourVisitorCount}명
              </p>
            </InfoCard>
          ) : notice ? (
            <InfoCard title={notice.title} description={notice.description} />
          ) : data ? (
            <InfoCard title="쿠폰 확인 결과">
              <ul className="flex flex-col gap-1 text-sm text-ink">
                <li>탐방일 {formatTourDate(data.tourStartsAt)}</li>
                <li>혜택 {data.discount}</li>
                <li>학생 {data.studentName}</li>
                <li className="font-bold">내 가게 쿠폰</li>
              </ul>
            </InfoCard>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {redeemed ? null : (
            <Button
              disabled={!canRedeem}
              loading={redeem.isPending}
              hint={
                data === undefined && notice === null
                  ? { reason: '6자리 코드를 조회하면 사용 처리할 수 있어요.' }
                  : undefined
              }
              onClick={handleRedeem}
            >
              사용 처리
            </Button>
          )}
          <Button variant="secondary" onClick={reset}>
            다른 코드 입력
          </Button>
        </div>
      </Page>
    </>
  );
}
