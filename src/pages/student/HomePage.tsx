import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useDemoToolsOn } from '@/demo/demoStore';
import { useUniversities } from '@/features/campuses/queries';
import { DEMO_WISH } from '@/features/tours/examples';
import { useLastQuery } from '@/features/tours/lastQuery';
import { campusLabel } from '@/features/tours/model';
import { useTours } from '@/features/tours/queries';
import { fromWishSearch, toWishSearch, type WishSearch } from '@/features/tours/wishSearch';
import { WishFields } from '@/features/wishes/components/WishFields';
import { toWishInput, wishFormSchema, type WishFormValues } from '@/features/wishes/model';
import { useCreateTourWish } from '@/features/wishes/queries';
import { formatDotDateWeekday } from '@/shared/lib/date';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BrandMark } from '@/shared/ui/BrandMark';
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { HeroCard } from '@/shared/ui/HeroCard';
import { ListRow } from '@/shared/ui/ListRow';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';

const MAX_TOURS = 3;
const EMPTY: WishFormValues = { universityId: '', major: '', wish: '', date: '' };
/** 서버 칸 오류(`fieldErrors`) 중 이 폼에 있는 칸. */
const FORM_FIELDS = ['universityId', 'major', 'wish', 'date'] as const;

function toFormValues(s: WishSearch): WishFormValues {
  return {
    universityId: String(s.universityId),
    major: s.major,
    wish: s.wish,
    date: s.date ?? '',
  };
}

/**
 * 고교생 홈 · T-01 희망 사항 등록(hs-s03 · H01을 V2 부품으로, 결정 0011). 학교 · 학과 · 탐방 희망 사항 · 희망 날짜(선택)를
 * `POST /tour-wishes`로 한 번 저장하고 결과 화면 `/tours?{search}`로 간다(2C-R16) — AI는 쓰지 않는다. 주소에 검색이 있으면
 * (결과 화면의 `조건 바꾸기` · 뒤로 가기) 그 값으로 칸을 채우고, 없으면 시연 도구가 켜졌을 때 `DEMO_WISH`로 미리 채운다(2C-R19).
 */
export function HomePage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const setSearch = useLastQuery((s) => s.setSearch);
  const demoOn = useDemoToolsOn();
  const campuses = useUniversities();
  const create = useCreateTourWish();
  const tours = useTours({ status: 'RECRUITING' });
  const fromAddress = useMemo(() => fromWishSearch(search), [search]);
  const form = useForm<WishFormValues>({
    resolver: zodResolver(wishFormSchema),
    defaultValues: fromAddress ? toFormValues(fromAddress) : EMPTY,
  });
  const [touched, setTouched] = useState(false);
  // 검사(비동기)를 통과한 제출이 둘 겹쳐도 등록은 한 번이다(연타). 실패하면 다시 풀린다.
  const submitting = useRef(false);

  // 사용자가 칸을 한 번이라도 고치면 시연 미리 채움을 멈춘다(`setValue`로 채운 것은 사용자 입력이 아니다).
  useEffect(() => {
    const subscription = form.watch((_values, { type }) => {
      if (type === 'change') setTouched(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // 시연 미리 채움: 시연 도구가 마운트 뒤에 켜져도(원클릭 링크) 손대지 않은 빈 칸만 채운다. 학교는 캠퍼스 목록에 그 id가
  // 있을 때만(실서버 id가 다르면 빈칸), 날짜는 채우지 않는다.
  const campusList = campuses.data;
  useEffect(() => {
    if (!demoOn || touched || fromAddress !== null) return;
    const { getValues, setValue } = form;
    if (getValues('major') === '') setValue('major', DEMO_WISH.major);
    if (getValues('wish') === '') setValue('wish', DEMO_WISH.wish);
    if (
      getValues('universityId') === '' &&
      campusList?.some((u) => u.id === DEMO_WISH.universityId)
    ) {
      setValue('universityId', String(DEMO_WISH.universityId));
    }
  }, [demoOn, touched, fromAddress, campusList, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (submitting.current) return;
    submitting.current = true;
    const input = toWishInput(values);
    create.mutate(input, {
      onSuccess: () => {
        const next = toWishSearch(input);
        setSearch(next);
        void navigate(`/tours?${next}`);
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

  const open = (tours.data ?? [])
    .filter((t) => t.remainingSeats > 0)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id)
    .slice(0, MAX_TOURS);

  return (
    <Page className={BOTTOM_ACTION_PAGE_TAB_ROOT}>
      <BrandMark variant="wordmark" />
      <PageHeading
        className="mt-3"
        title={'내가 궁금한 대학 생활,\n직접 만나보세요.'}
        description="전공 이야기부터 동네 맛집까지 함께 걸어요."
      />

      <form className="mt-5" onSubmit={onSubmit} onKeyDown={preventImeEnter} noValidate>
        <HeroCard
          title={'어떤 전공이\n궁금한가요?'}
          illustration="campus"
          titleTone="brand-strong"
          footer={<WishFields form={form} campuses={campusList} />}
        />
        {/* 제출은 폼 안의 하단 고정 띠다: 무대 화면에서도 스크롤 없이 보이고, 폼이 끝나 아래 목록에 닿으면 함께 지나간다. */}
        <BottomAction>
          <p className="mb-2 px-1 text-[13px] text-muted">
            남긴 희망 사항은 이름 없이 대학생 가이드에게 보여요.
          </p>
          <Button type="submit" loading={create.isPending}>
            희망 사항 남기고 투어 찾기
          </Button>
        </BottomAction>
      </form>

      <div className="pb-6">
        <h2 className="mt-7 mb-3 text-lg font-bold text-ink">이번 방학, 이런 투어는 어때요?</h2>
        {tours.data === undefined && tours.isError ? (
          <ErrorState error={tours.error} onRetry={() => void tours.refetch()} />
        ) : tours.data === undefined ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-[90px] rounded-[18px]" />
          </div>
        ) : open.length === 0 ? (
          <EmptyState title="지금 모집 중인 투어가 없어요" />
        ) : (
          <ul aria-label="모집 중인 투어" className="flex flex-col gap-3">
            {open.map((tour) => (
              <li key={tour.id}>
                <ListRow
                  to={`/tours/${tour.id}`}
                  eyebrow={campusLabel(tour.universityName, tour.campusName)}
                  title={tour.title}
                  meta={`${formatDotDateWeekday(tour.startsAt)} · ${tour.remainingSeats}자리 남음`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
