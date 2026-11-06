import { Navigate } from 'react-router';
import { guideCoursePath, pickFocusTour } from '@/features/applications/model';
import { useGuideTours } from '@/features/applications/queries';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TopBar } from '@/shared/ui/TopBar';

/**
 * `코스 편집` 탭(`/guide/course`): 다가오는 탐방(`pickFocusTour`)의 코스 화면으로 `replace` 이동한다.
 * 다가오는 탐방이 없으면 개설한 탐방 목록으로 보낸다.
 */
export function GuideCourseRedirect() {
  const query = useGuideTours();
  const { data: tours } = query;

  if (tours === undefined) {
    return (
      <>
        <TopBar title="코스 편집" />
        <Page>
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <Skeleton className="h-12" />
              <Skeleton className="mt-4 h-32" />
            </>
          )}
        </Page>
      </>
    );
  }

  const focus = pickFocusTour(tours);
  return <Navigate replace to={focus ? guideCoursePath(focus) : '/guide/tours'} />;
}
