import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/queries';
import { PARTNERSHIP_DISCOUNT_MAX, type MyStore } from '@/features/stores/model';
import { useMyStore, useSavePartnership } from '@/features/stores/queries';
import { addDaysKey, seoulDateKey } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';
import { connectActionFor } from './noStore';

type Field = 'discount' | 'startDate' | 'endDate';
type Errors = Partial<Record<Field, string>>;

const FIELDS: readonly Field[] = ['discount', 'startDate', 'endDate'];
/** 제휴가 아직 없을 때 기간 기본값의 길이(오늘 ~ 오늘 + 90일, 2B-R17). */
const DEFAULT_PERIOD_DAYS = 90;

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {};
  const discount = values.discount.trim();
  if (discount === '') errors.discount = '제휴 혜택 이름을 입력해 주세요.';
  else if (discount.length > PARTNERSHIP_DISCOUNT_MAX) {
    errors.discount = `${PARTNERSHIP_DISCOUNT_MAX}자 이내로 적어 주세요.`;
  }
  if (values.startDate === '') errors.startDate = '제휴 시작일을 골라 주세요.';
  if (values.endDate === '') errors.endDate = '제휴 종료일을 골라 주세요.';
  else if (values.startDate !== '' && values.endDate < values.startDate) {
    errors.endDate = '종료 날짜는 시작 날짜와 같거나 뒤여야 해요.';
  }
  return errors;
}

/** 칸 초깃값: 이 가게에 제휴가 있으면 그 값, 없으면 비운 이름과 오늘 ~ 오늘 + 90일. */
function initialValues(store: MyStore | null): Record<Field, string> {
  if (store?.partnership) {
    const { discount, startDate, endDate } = store.partnership;
    return { discount, startDate, endDate };
  }
  const today = seoulDateKey(new Date());
  return { discount: '', startDate: today, endDate: addDaysKey(today, DEFAULT_PERIOD_DAYS) };
}

/**
 * 폼. `store`가 없으면(연결된 가게 없음) 칸과 저장이 잠기고 사유와 다음 행동이 보인다. 저장은 되돌릴 수 없어 처리 중에 잠기고
 * 연타해도 요청은 한 번이다(`locked`).
 */
function PartnershipForm({ store }: { store: MyStore | null }) {
  const navigate = useNavigate();
  const meQuery = useMe();
  const save = useSavePartnership();
  const locked = useRef(false);
  // 처음 열 때 제휴가 없었으면 `연결 완료` 칩을 단다(방금 가게를 연결하고 온 길).
  const [fresh] = useState(!store?.partnership);
  const [values, setValues] = useState(() => initialValues(store));
  const [errors, setErrors] = useState<Errors>({});
  const noStore = store === null;

  function change(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (noStore || locked.current || save.isPending) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    locked.current = true;
    save.mutate(
      {
        discount: values.discount.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      },
      {
        onSuccess: () => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 저장이 한 번 더 나가지 않는다.
          toast('제휴 혜택을 저장했어요.');
          void navigate('/owner/store', { replace: true });
        },
        onError: (error) => {
          locked.current = false;
          const server: Errors = {};
          for (const [key, reason] of Object.entries(error.fieldErrors ?? {})) {
            const field = FIELDS.find((f) => f === key);
            if (field !== undefined) server[field] = reason;
          }
          if (Object.keys(server).length > 0) setErrors(server);
          else toast.error(errorMessage(error.code));
        },
      },
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={preventImeEnter}
      noValidate
      className="mt-5 flex flex-1 flex-col"
    >
      {store ? (
        <section className="mb-3 rounded-xl bg-surface p-5">
          {fresh ? <StatusChip tone="success">연결 완료</StatusChip> : null}
          <h3
            className={`${fresh ? 'mt-3 ' : ''}truncate text-[19px] leading-[1.4] font-bold text-ink`}
          >
            {store.name}
          </h3>
          <p className="mt-1 text-[13px] text-muted">
            {store.address} · {store.category}
          </p>
        </section>
      ) : null}
      <fieldset disabled={noStore || save.isPending} className="flex min-w-0 flex-col gap-3">
        <TextField
          label="혜택 이름"
          showLabel
          placeholder="예: 음료 10% 할인"
          autoComplete="off"
          value={values.discount}
          error={errors.discount}
          onChange={(e) => change('discount', e.target.value)}
        />
        <TextField
          label="제휴 시작일"
          showLabel
          type="date"
          value={values.startDate}
          error={errors.startDate}
          onChange={(e) => change('startDate', e.target.value)}
        />
        <TextField
          label="제휴 종료일"
          showLabel
          type="date"
          min={values.startDate || undefined}
          value={values.endDate}
          error={errors.endDate}
          onChange={(e) => change('endDate', e.target.value)}
        />
      </fieldset>
      <InfoCard
        tone="brand"
        className="mt-3"
        title="제휴 여부 자체가 AI 추천 순위에 영향을 주지는 않아요."
      />

      <BottomAction>
        <Button
          type="submit"
          loading={save.isPending}
          disabled={noStore}
          hint={
            noStore
              ? {
                  reason: '가게를 연결하면 제휴 혜택을 설정할 수 있어요.',
                  action: connectActionFor(meQuery.data),
                }
              : undefined
          }
        >
          제휴 혜택 저장
        </Button>
      </BottomAction>
    </form>
  );
}

/** 제휴 할인 설정(O06, owner-s02, S-03). 처음이면 칩 `연결 완료`, 저장하면 `/owner/store`로(토스트). */
export function PartnershipPage() {
  const query = useMyStore();
  const store = query.data;

  let body;
  if (store === undefined && query.isError) {
    body = (
      <div className="mt-5">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  } else if (store === undefined) {
    body = <Skeleton className="mt-5 h-[320px] rounded-lg" />;
  } else {
    body = <PartnershipForm store={store} />;
  }

  return (
    <>
      <TopBar title="제휴 할인 설정" back="/owner/store" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="제휴 혜택을 설정해요."
          description="참가자에게 제공할 혜택을 등록해 주세요."
          className="mt-3"
        />
        {body}
      </Page>
    </>
  );
}
