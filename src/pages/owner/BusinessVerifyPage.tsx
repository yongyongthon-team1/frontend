import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/queries';
import {
  businessNotice,
  normalizeBusinessNumber,
  type BusinessVerificationInput,
} from '@/features/stores/model';
import { useVerifyBusiness } from '@/features/stores/queries';
import { useDemoToolsOn } from '@/demo/demoStore';
import { DEMO_BUSINESS } from '@/shared/config/demoAccounts';
import { seoulDateKey } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

type Field = 'businessNumber' | 'representativeName' | 'openedAt';
type Errors = Partial<Record<Field, string>>;
type Verify = ReturnType<typeof useVerifyBusiness>;

const FIELDS: readonly Field[] = ['businessNumber', 'representativeName', 'openedAt'];
const BUSINESS_NUMBER_DIGITS = 10;

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (values.businessNumber.trim() === '') {
    errors.businessNumber = '사업자등록번호를 입력해 주세요.';
  } else if (normalizeBusinessNumber(values.businessNumber).length !== BUSINESS_NUMBER_DIGITS) {
    errors.businessNumber = '사업자등록번호 10자리를 입력해 주세요.';
  }
  if (values.representativeName.trim() === '')
    errors.representativeName = '대표자명을 입력해 주세요.';
  if (values.openedAt === '') errors.openedAt = '개업일자를 입력해 주세요.';
  return errors;
}

/**
 * 제출 폼. 제출은 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다(`locked`). 실패한 사업자 정보는 결과 카드가
 * 안내(`businessNotice`)로 바뀌고 입력값은 그대로 남으며, 다시 고치면 카드가 기본으로 돌아간다. 제출 훅은 인증이 끝나 폼이
 * 사라져도 이동이 끝나도록 페이지가 가진다.
 */
function VerifyForm({ verify }: { verify: Verify }) {
  const navigate = useNavigate();
  const demoOn = useDemoToolsOn();
  const locked = useRef(false);
  const [values, setValues] = useState<Record<Field, string>>({
    businessNumber: '',
    representativeName: '',
    openedAt: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<{ title: string; description: string } | null>(null);
  const today = seoulDateKey(new Date());

  function change(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }));
    setFailure(null);
  }

  function fillDemo() {
    const { businessNumber, representativeName, openingDate } = DEMO_BUSINESS.match;
    setValues({ businessNumber, representativeName, openedAt: openingDate });
    setErrors({});
    setFailure(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current || verify.isPending) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    locked.current = true;
    const input: BusinessVerificationInput = {
      businessNumber: values.businessNumber,
      representativeName: values.representativeName.trim(),
      openedAt: values.openedAt,
    };
    verify.mutate(input, {
      onSuccess: () => {
        // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 제출이 한 번 더 나가지 않는다.
        toast('사업자 인증을 마쳤어요.');
        void navigate('/owner/store/connect', { replace: true });
      },
      onError: (error) => {
        locked.current = false; // 실패하면 다시 낼 수 있다
        const notice = businessNotice(error.code);
        if (notice) {
          setFailure(notice);
          return;
        }
        const server: Errors = {};
        for (const [key, reason] of Object.entries(error.fieldErrors ?? {})) {
          const field = FIELDS.find((f) => f === key);
          if (field !== undefined) server[field] = reason;
        }
        if (Object.keys(server).length > 0) setErrors(server);
        else toast.error(errorMessage(error.code));
      },
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={preventImeEnter}
      noValidate
      className="mt-5 flex flex-1 flex-col"
    >
      <fieldset disabled={verify.isPending} className="flex min-w-0 flex-col gap-3">
        <TextField
          label="사업자등록번호"
          showLabel
          inputMode="numeric"
          maxLength={12}
          autoComplete="off"
          hint="'-' 없이 숫자 10자리로 적어도 돼요."
          value={values.businessNumber}
          error={errors.businessNumber}
          onChange={(e) => change('businessNumber', e.target.value)}
        />
        <TextField
          label="대표자명"
          showLabel
          autoComplete="off"
          value={values.representativeName}
          error={errors.representativeName}
          onChange={(e) => change('representativeName', e.target.value)}
        />
        <TextField
          label="개업일자"
          showLabel
          type="date"
          max={today}
          value={values.openedAt}
          error={errors.openedAt}
          onChange={(e) => change('openedAt', e.target.value)}
        />
      </fieldset>

      <div aria-live="polite" className="mt-3">
        <InfoCard
          tone={failure ? 'local' : 'brand'}
          title={failure ? failure.title : '국세청 진위확인 API 연동'}
          description={failure ? failure.description : '정보 일치 · 계속사업자 여부 확인'}
        />
      </div>

      {demoOn ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-start"
          disabled={verify.isPending}
          onClick={fillDemo}
        >
          시연 사업자 정보 채우기
        </Button>
      ) : null}

      <BottomAction>
        <Button type="submit" loading={verify.isPending}>
          사업자 정보 확인
        </Button>
      </BottomAction>
    </form>
  );
}

/**
 * 사업자 인증(owner-s01, V2에 없음, U-07). 일치하면 바로 인증된다(운영자 심사 없음 — 2B-R2). 이미 인증됐으면 폼 대신 완료 카드와
 * 다음 행동. 성공하면 토스트와 함께 가게 찾기로 간다.
 */
export function BusinessVerifyPage() {
  const meQuery = useMe();
  const verify = useVerifyBusiness();
  const me = meQuery.data;
  // 제출이 끝나면 내 정보가 먼저 바뀌어 완료 카드로 깜박이지 않게, 제출 중 · 직후에는 폼을 유지한다(이동이 이어서 일어난다).
  const done = me?.businessVerified === true && !verify.isPending && !verify.isSuccess;

  let body;
  if (me === undefined && meQuery.isError) {
    body = (
      <div className="mt-5">
        <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />
      </div>
    );
  } else if (me === undefined) {
    body = <Skeleton className="mt-5 h-[300px] rounded-lg" />;
  } else if (done) {
    body = (
      <div className="mt-5">
        <InfoCard
          tone="brand"
          title="사업자 인증 완료"
          description="국세청 진위확인으로 확인된 사업자예요."
          footer={
            me.storeId === null ? (
              <Link to="/owner/store/connect" className={buttonClass('primary')}>
                가게 연결하기
              </Link>
            ) : (
              <Link to="/owner/store" className={buttonClass('primary')}>
                내 가게 보기
              </Link>
            )
          }
        />
      </div>
    );
  } else {
    body = <VerifyForm verify={verify} />;
  }

  return (
    <>
      <TopBar title="사업자 인증" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <div className="pt-3">
          <StatusChip tone="info">사업자 정보 확인</StatusChip>
        </div>
        {body}
      </Page>
    </>
  );
}
