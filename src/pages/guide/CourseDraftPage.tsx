import { useCallback, useEffect, useRef } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { useCreateDraft, useGuideCourse, useIsCreatingDraft } from '@/features/courses/queries';
import { AiLoading } from '@/shared/ui/AiLoading';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

const GENERATE_STEPS = [
  '신청자 관심사를 모으고 있어요',
  '주변 상점을 찾고 있어요',
  '코스를 짜고 있어요',
];

/**
 * AI 코스 초안 생성(guide-s04 · 판정 2A-R10). 화면은 생성 중 로딩뿐이고, 코스가 생기면 코스 완성(G03, `edit`)으로
 * replace한다 — 주소의 `?generate=1`도 함께 사라져 뒤로 가기 · 새로고침이 다시 만들지 않는다.
 * 코스가 없고 주소에 `?generate=1`이 있으면 초안을 한 번 만든다: StrictMode가 마운트 effect를 두 번 돌려도 ref로 한 번만
 * 보내고, 화면을 떠났다 돌아와도 이전 화면이 보낸 생성이 진행 중이면 기다린다(새로 보내지 않는다).
 * 코스가 이미 있으면 만들지 않고 G03(확정됐으면 확정 점검)으로 보낸다.
 */
export function CourseDraftPage() {
  const tourId = Number(useParams().tourId);
  const [searchParams] = useSearchParams();
  const courseQuery = useGuideCourse(tourId);
  const createDraft = useCreateDraft(tourId);
  const drafting = useIsCreatingDraft(tourId);
  const started = useRef(false);
  const course = courseQuery.data;
  const wantsGenerate = searchParams.get('generate') === '1';
  const base = `/guide/tours/${tourId}`;

  const { mutate: create } = createDraft;
  const generate = useCallback(() => create(), [create]);

  useEffect(() => {
    if (course !== null || !wantsGenerate || drafting || started.current) return;
    started.current = true;
    generate();
  }, [course, wantsGenerate, drafting, generate]);

  // 생성이 끝나 코스가 생기면(다른 화면이 보낸 생성 포함) 코스 완성으로. 진행 중인 다시 만들기는 끝날 때까지 기다린다.
  if (course != null && !drafting) {
    return (
      <Navigate
        to={`${base}/course/${course.status === 'CONFIRMED' ? 'confirm' : 'edit'}`}
        replace
      />
    );
  }

  const loading = <AiLoading steps={GENERATE_STEPS} />;
  let body;
  if (course === undefined) {
    body = courseQuery.isError ? (
      <ErrorState error={courseQuery.error} onRetry={() => void courseQuery.refetch()} />
    ) : wantsGenerate || drafting ? (
      loading
    ) : (
      <Skeleton className="mt-3 h-40 rounded-xl" />
    );
  } else if (course === null && createDraft.isError) {
    body = <ErrorState error={createDraft.error} onRetry={generate} />;
  } else if (course === null && !createDraft.isPending && !drafting && !wantsGenerate) {
    body = (
      <EmptyState
        title="아직 코스 초안이 없어요"
        action={{ label: 'AI 코스 만들기', to: `${base}/course/draft?generate=1` }}
      />
    );
  } else {
    body = loading;
  }

  return (
    <>
      <TopBar title="투어 코스 초안" back={`${base}/applicants`} />
      <Page>{body}</Page>
    </>
  );
}
