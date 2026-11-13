import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { University } from '@/features/campuses/model';
import { useUniversities } from '@/features/campuses/queries';
import { WishFields } from '@/features/wishes/components/WishFields';
import {
  diffWishPatch,
  toWishInput,
  wishFormSchema,
  type TourWish,
  type WishFormValues,
} from '@/features/wishes/model';
import { useMyWishes, useUpdateTourWish } from '@/features/wishes/queries';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

/** 서버 칸 오류(`fieldErrors`) 중 이 폼에 있는 칸. */
const FORM_FIELDS = ['universityId', 'major', 'wish', 'date'] as const;

/**
 * T-07 희망 사항 고치기(V2 부품, 시안 없음 — 결정 0011). 값은 목록 캐시의 그 항목이고, 바뀐 칸만 `PATCH`로 보낸다(2C-R21).
 * 목록을 받은 뒤 그 id가 없으면(없는 글 · 남의 글) 목록으로 돌려보낸다.
 */
export function EditWishPage() {
  const wishId = Number(useParams().wishId);
  const query = useMyWishes();
  const campuses = useUniversities();
  const { data: wishes } = query;

  if (wishes === undefined) {
    return (
      <>
        <TopBar title="희망 사항 고치기" back="/me/wishes" />
        <Page>
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-[120px]" />
              <Skeleton className="h-14" />
            </div>
          )}
        </Page>
      </>
    );
  }
  const wish = wishes.find((w) => w.id === wishId);
  if (wish === undefined) return <Navigate to="/me/wishes" replace />;
  return <EditWishForm wish={wish} campuses={campuses.data} />;
}

function toFormValues(wish: TourWish): WishFormValues {
  return {
    universityId: wish.universityId === null ? '' : String(wish.universityId),
    major: wish.major,
    wish: wish.wish,
    date: wish.date ?? '',
  };
}

function EditWishForm({ wish, campuses }: { wish: TourWish; campuses: University[] | undefined }) {
  const navigate = useNavigate();
  const update = useUpdateTourWish(wish.id);
  const form = useForm<WishFormValues>({
    resolver: zodResolver(wishFormSchema),
    defaultValues: toFormValues(wish),
  });
  // 검사(비동기)를 통과한 제출이 둘 겹쳐도 수정은 한 번이다(연타). 실패하면 다시 풀린다.
  const submitting = useRef(false);

  const changed = Object.keys(diffWishPatch(wish, toWishInput(form.watch()))).length > 0;

  const onSubmit = form.handleSubmit((values) => {
    if (submitting.current) return;
    const patch = diffWishPatch(wish, toWishInput(values));
    if (Object.keys(patch).length === 0) return;
    submitting.current = true;
    update.mutate(patch, {
      onSuccess: () => {
        toast('희망 사항을 고쳤어요.');
        void navigate('/me/wishes', { replace: true });
      },
      onError: (error) => {
        submitting.current = false;
        const fieldErrors = error.fieldErrors ?? {};
        let shown = false;
        for (const name of FORM_FIELDS) {
          const message = fieldErrors[name];
          if (message) {
            form.setError(name, { message });
            shown = true;
          }
        }
        if (!shown) toast.error(errorMessage(error.code));
      },
    });
  });

  return (
    <>
      <TopBar title="희망 사항 고치기" back="/me/wishes" />
      <Page className={BOTTOM_ACTION_PAGE}>
        <form
          onSubmit={onSubmit}
          onKeyDown={preventImeEnter}
          noValidate
          className="flex flex-1 flex-col"
        >
          <WishFields form={form} campuses={campuses} />
          <p className="mt-3 text-[13px] text-muted">
            고쳐도 이미 본 투어 결과는 바뀌지 않아요. 새로 찾으려면 홈에서 다시 남겨 주세요.
          </p>
          <BottomAction>
            <Button
              type="submit"
              loading={update.isPending}
              disabled={!changed}
              hint={changed ? undefined : { reason: '바뀐 내용이 없어요.' }}
            >
              저장하기
            </Button>
          </BottomAction>
        </form>
      </Page>
    </>
  );
}
