import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMyApplication } from '@/features/applications/queries';
import { couponStateLabel, type Coupon } from '@/features/coupons/model';
import { useMyCoupon } from '@/features/coupons/queries';
import { REVIEW_CONTENT_MAX, reviewBlock, reviewLandingPath } from '@/features/reviews/model';
import { useCreateReview } from '@/features/reviews/queries';
import { campusLabel } from '@/features/tours/model';
import { useTour } from '@/features/tours/queries';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StarRating } from '@/shared/ui/StarRating';
import { StatusChip } from '@/shared/ui/StatusChip';
import { Textarea } from '@/shared/ui/Textarea';
import { TopBar } from '@/shared/ui/TopBar';

const TITLE = '방문 리뷰 작성';
const CONTENT_LABEL = '좋았던 점과 아쉬웠던 점';
const GONE_CODES = new Set(['NOT_FOUND', 'FORBIDDEN']);

/** 앞 화면이 있으면 뒤로, 주소로 바로 들어왔으면 쿠폰(알면) 또는 내 탐방으로. */
function useBack(couponId: number | null): boolean | string {
  const { key } = useLocation();
  if (key !== 'default') return true;
  return couponId === null ? '/my-tours' : `/coupons/${couponId}`;
}

function NotFound() {
  return (
    <>
      <TopBar title={TITLE} back="/my-tours" />
      <Page>
        <EmptyState
          title="리뷰를 쓸 쿠폰을 찾을 수 없어요."
          action={{ label: '내 탐방 확인하기', to: '/my-tours' }}
        />
      </Page>
    </>
  );
}

/**
 * 방문 리뷰 쓰기(H12 · R-01). `?couponId=`의 쿠폰이 사용 완료이고 아직 리뷰가 없을 때만 폼이 열리고, 아니면 사유 + 다음 행동이다.
 * 되돌릴 수 없으므로 저장 중에는 버튼이 로딩이고 입력이 잠기며 연타해도 요청은 한 번이다. 저장하면 신청이 승인 상태일 때
 * 그 상점 시트를 연 코스 지도로 간다(AI 요약 갱신이 보이는 곳).
 */
export function ReviewNewPage() {
  const raw = useSearchParams()[0].get('couponId');
  const couponId = raw !== null && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
  // 잘못된 id는 쿠폰을 부르지 않는다.
  if (couponId === null) return <NotFound />;
  return <ReviewLoader couponId={couponId} />;
}

function ReviewLoader({ couponId }: { couponId: number }) {
  const query = useMyCoupon(couponId);
  const back = useBack(couponId);
  const { data: coupon } = query;

  // 다시 불러오다 실패해도 이미 받은 쿠폰은 그대로 보인다 — 오류 화면은 받은 데이터가 없을 때만.
  if (coupon === undefined && query.isError) {
    if (GONE_CODES.has(query.error.code)) return <NotFound />;
    return (
      <>
        <TopBar title={TITLE} back={back} />
        <Page>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Page>
      </>
    );
  }
  if (coupon === undefined) {
    return (
      <>
        <TopBar title={TITLE} back={back} />
        <Page>
          <Skeleton className="mt-3 h-12 w-3/4" />
          <Skeleton className="mt-4 h-[96px] rounded-xl" />
          <Skeleton className="mt-3 h-[140px] rounded-xl" />
          <Skeleton className="mt-3 h-[120px] rounded-xl" />
        </Page>
      </>
    );
  }
  return <ReviewForm coupon={coupon} back={back} />;
}

interface FormErrors {
  rating?: string;
  content?: string;
}

function validate(rating: number | null, content: string): FormErrors {
  const errors: FormErrors = {};
  if (rating === null) errors.rating = '별점을 선택해 주세요.';
  if (content === '') errors.content = '한 줄 평을 입력해 주세요.';
  else if (content.length > REVIEW_CONTENT_MAX) errors.content = '100자 이내로 적어 주세요.';
  return errors;
}

function ReviewForm({ coupon, back }: { coupon: Coupon; back: boolean | string }) {
  const navigate = useNavigate();
  const create = useCreateReview();
  const applicationQuery = useMyApplication(coupon.applicationId);
  const tourQuery = useTour(coupon.tourId);
  const [rating, setRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const sending = useRef(false);
  // 저장이 끝날 때의 신청 상태로 착지한다 — 신청을 아직 받아 오는 중에 눌렀다면 그 값을 마저 받는다.
  const applicationStatus = useRef(applicationQuery.data?.status ?? null);
  applicationStatus.current = applicationQuery.data?.status ?? null;
  const { refetch: refetchApplication } = applicationQuery;

  async function land(): Promise<void> {
    const status = applicationStatus.current ?? (await refetchApplication()).data?.status ?? null;
    void navigate(reviewLandingPath(coupon, status), { replace: true });
  }

  const block = reviewBlock(coupon, applicationQuery.data?.status ?? null);
  const locked = block !== null || create.isPending;
  const tour = tourQuery.data;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (block !== null || sending.current) return; // 연타해도 요청은 한 번
    const trimmed = content.trim();
    const found = validate(rating, trimmed);
    setErrors(found);
    if (found.rating || found.content || rating === null) return;
    sending.current = true;
    create.mutate(
      { storeId: coupon.storeId, couponId: coupon.id, rating, content: trimmed },
      {
        onSuccess: () => {
          toast('리뷰를 등록했어요.');
          void land();
        },
        onError: (error) => {
          const fieldErrors = error.fieldErrors ?? {};
          if (fieldErrors.rating || fieldErrors.content) {
            setErrors({ rating: fieldErrors.rating, content: fieldErrors.content });
          } else {
            toast.error(errorMessage(error.code));
          }
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  }

  return (
    <>
      <TopBar title={TITLE} back={back} />
      <Page className={BOTTOM_ACTION_PAGE}>
        <form
          onSubmit={onSubmit}
          onKeyDown={preventImeEnter}
          noValidate
          className="flex flex-1 flex-col"
        >
          <PageHeading
            as="h2"
            title="오늘 탐방은 어땠나요?"
            description="경험을 남기면 다른 학생에게도 도움이 돼요."
            className="mt-3"
          />

          <section className="mt-5 rounded-xl bg-surface p-4">
            <StatusChip tone={coupon.state === 'USED' ? 'success' : 'neutral'}>
              {coupon.state === 'USED'
                ? '참여 완료'
                : couponStateLabel(coupon.state, coupon.usedAt)}
            </StatusChip>
            <h3 className="mt-2 text-[17px] leading-snug font-bold text-ink">{coupon.storeName}</h3>
            {tour ? (
              <p className="mt-1 text-[13px] text-muted">
                {`${campusLabel(tour.universityName, tour.campusName)} 주변`}
              </p>
            ) : null}
          </section>

          <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
            <div className="mt-3 rounded-xl bg-surface p-4">
              <StarRating
                label="방문 경험을 평가해 주세요"
                value={rating}
                onChange={(value) => {
                  setRating(value);
                  setErrors((prev) => ({ ...prev, rating: undefined }));
                }}
                disabled={locked}
                error={errors.rating}
              />
            </div>

            <div className="mt-3">
              <Textarea
                showLabel
                label={CONTENT_LABEL}
                placeholder="방문한 가게나 코스에서 느낀 점을 적어 주세요."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setErrors((prev) => ({ ...prev, content: undefined }));
                }}
                error={errors.content}
              />
            </div>
          </fieldset>

          <p className="mt-3 mb-4 rounded-lg bg-brand-soft px-4 py-3 text-[13px] text-muted">
            리뷰는 개인 정보 없이 가게의 경험 요약에 활용될 수 있어요.
          </p>

          <BottomAction>
            <Button
              type="submit"
              loading={create.isPending}
              disabled={block !== null}
              hint={block ?? undefined}
            >
              리뷰 등록하기
            </Button>
          </BottomAction>
        </form>
      </Page>
    </>
  );
}
