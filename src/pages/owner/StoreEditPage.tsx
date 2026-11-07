import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/queries';
import { diffStoreEdit, STORE_CATEGORIES, type MyStore } from '@/features/stores/model';
import { useMyStore, useUpdateMyStore } from '@/features/stores/queries';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';
import { connectActionFor } from './noStore';

type Field = 'name' | 'address' | 'category';
type Errors = Partial<Record<Field, string>>;

const FIELDS: readonly Field[] = ['name', 'address', 'category'];

/** 업종 선택지. 지금 값이 목록에 없으면(옛 데이터 · 공공데이터 업종) 맨 앞에 더해 값을 잃지 않는다. */
function categoryOptions(current: string): { value: string; label: string }[] {
  const list: string[] = [...STORE_CATEGORIES];
  if (current !== '' && !list.includes(current)) list.unshift(current);
  return list.map((c) => ({ value: c, label: c }));
}

/**
 * 폼. `store`가 없으면 칸과 저장이 잠기고 사유와 다음 행동이 보인다. 앞뒤 공백을 뺀 값으로 바뀐 칸만 `PATCH`하고
 * (`diffStoreEdit`), 바뀐 칸이 없으면 저장이 잠긴다. 저장은 연타해도 요청이 한 번이다(`locked`).
 */
function StoreEditForm({ store }: { store: MyStore | null }) {
  const navigate = useNavigate();
  const meQuery = useMe();
  const update = useUpdateMyStore();
  const locked = useRef(false);
  const [values, setValues] = useState({
    name: store?.name ?? '',
    address: store?.address ?? '',
    category: store?.category ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const noStore = store === null;

  const trimmed = { ...values, name: values.name.trim(), address: values.address.trim() };
  const patch = store ? diffStoreEdit(store, trimmed) : {};
  const unchanged = Object.keys(patch).length === 0;

  function change(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (store === null || unchanged || locked.current || update.isPending) return;
    const found: Errors = {};
    if (trimmed.name === '') found.name = '상호명을 입력해 주세요.';
    if (trimmed.address === '') found.address = '가게 주소를 입력해 주세요.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    locked.current = true;
    update.mutate(patch, {
      onSuccess: () => {
        // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 저장이 한 번 더 나가지 않는다.
        toast('가게 정보를 저장했어요.');
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
    });
  }

  const hint = noStore
    ? {
        reason: '가게를 연결하면 가게 정보를 고칠 수 있어요.',
        action: connectActionFor(meQuery.data),
      }
    : unchanged
      ? { reason: '바뀐 내용이 없어요.' }
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={preventImeEnter}
      noValidate
      className="mt-5 flex flex-1 flex-col"
    >
      <fieldset disabled={noStore || update.isPending} className="flex min-w-0 flex-col gap-3">
        <TextField
          label="상호명"
          showLabel
          autoComplete="off"
          value={values.name}
          error={errors.name}
          onChange={(e) => change('name', e.target.value)}
        />
        <TextField
          label="가게 주소"
          showLabel
          autoComplete="off"
          value={values.address}
          error={errors.address}
          onChange={(e) => change('address', e.target.value)}
        />
        <Select
          label="업종"
          showLabel
          options={categoryOptions(store?.category ?? '')}
          value={values.category}
          error={errors.category}
          onChange={(e) => change('category', e.target.value)}
        />
      </fieldset>

      <BottomAction>
        <Button
          type="submit"
          loading={update.isPending}
          disabled={noStore || unchanged}
          hint={hint}
        >
          변경사항 저장
        </Button>
      </BottomAction>
    </form>
  );
}

/** 가게 정보 수정(V2에 없음, S-01 `PATCH`). 상호명 · 가게 주소 · 업종 중 바뀐 칸만 저장하고 `/owner/store`로 돌아간다. */
export function StoreEditPage() {
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
    body = <Skeleton className="mt-5 h-[280px] rounded-lg" />;
  } else {
    body = <StoreEditForm store={store} />;
  }

  return (
    <>
      <TopBar title="가게 정보 수정" back="/owner/store" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <PageHeading
          as="h2"
          title="가게 정보를 고쳐요."
          description="학생들이 보는 가게 이름과 주소예요."
          className="mt-3"
        />
        {body}
      </Page>
    </>
  );
}
