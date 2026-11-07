import { useState, type FormEvent } from 'react';
import { useMe } from '@/features/auth/queries';
import { campusLabel } from '@/features/tours/model';
import { useUniversities } from '@/features/campuses/queries';
import { WishCard } from '@/features/wishes/components/WishCard';
import type { GuideWishFilter } from '@/features/wishes/model';
import { useGuideWishes } from '@/features/wishes/queries';
import { preventImeEnter } from '@/shared/lib/ime';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

/**
 * T-08 고교생 희망 사항(V2 부품, 시안 없음 — 결정 0011). 대학생 가이드가 탐방을 준비하며 학생들이 남긴 글을 원문 그대로 본다
 * (이름 같은 개인정보는 서버가 내려주지 않는다). 학교는 내 학교를 고른 채 시작하고(모르면 `내 학교` = 서버 기본), 조건은
 * `찾기`를 누를 때만 바뀐다(2C-R22). 재학 인증이 승인되기 전에는 안내만 보이고 요청하지 않는다.
 */
export function GuideWishesPage() {
  const me = useMe();
  if (me.data === undefined) {
    return (
      <>
        <TopBar title="고교생 희망 사항" back="/guide" />
        <Page>
          {me.isError ? (
            <ErrorState error={me.error} onRetry={() => void me.refetch()} />
          ) : (
            <Skeleton className="h-14" />
          )}
        </Page>
      </>
    );
  }
  if (me.data.verificationStatus !== 'APPROVED') {
    return (
      <>
        <TopBar title="고교생 희망 사항" back="/guide" />
        <Page>
          <EmptyState
            title="재학 인증이 승인된 뒤에 볼 수 있어요"
            action={{ label: '인증 상태 보기', to: '/guide/verify' }}
          />
        </Page>
      </>
    );
  }
  return <ApprovedWishes ownUniversityId={me.data.guideProfile?.universityId ?? null} />;
}

function ApprovedWishes({ ownUniversityId }: { ownUniversityId: number | null }) {
  const campuses = useUniversities();
  // 입력 중인 조건(draft)과 실제로 찾은 조건(applied)은 따로다 — `찾기`를 눌러야 바뀐다.
  const [school, setSchool] = useState(ownUniversityId === null ? '' : String(ownUniversityId));
  const [major, setMajor] = useState('');
  const [applied, setApplied] = useState<GuideWishFilter>(
    ownUniversityId === null ? {} : { universityId: ownUniversityId },
  );
  const query = useGuideWishes(applied);
  const { data: wishes } = query;

  const schoolOptions = [
    ...(ownUniversityId === null ? [{ value: '', label: '내 학교' }] : []),
    ...(campuses.data ?? []).map((u) => ({
      value: String(u.id),
      label: campusLabel(u.name, u.campusName),
    })),
  ];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = major.trim();
    setApplied({
      ...(school === '' ? {} : { universityId: Number(school) }),
      ...(trimmed === '' ? {} : { major: trimmed }),
    });
  }

  return (
    <>
      <TopBar title="고교생 희망 사항" back="/guide" />
      <Page className="flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          고교생이 남긴 그대로예요. 이름 같은 개인정보는 보이지 않아요.
        </p>

        <form
          onSubmit={onSubmit}
          onKeyDown={preventImeEnter}
          noValidate
          className="flex flex-col gap-3"
        >
          <Select
            label="학교"
            showLabel
            options={schoolOptions}
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
          <TextField
            label="학과 (선택)"
            showLabel
            placeholder="예: 산업디자인"
            maxLength={30}
            autoComplete="off"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
          />
          <Button type="submit" size="sm" variant="secondary" className="self-end">
            찾기
          </Button>
        </form>

        {wishes === undefined ? (
          query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-[120px] rounded-xl" />
            </div>
          )
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-ink">희망 사항 {wishes.length}개</h2>
            {wishes.length === 0 ? (
              <EmptyState
                title="조건에 맞는 희망 사항이 아직 없어요"
                description="학과를 비우거나 다른 학교로 찾아보세요."
              />
            ) : (
              <ul aria-label="고교생 희망 사항" className="flex flex-col gap-3">
                {wishes.map((wish) => (
                  <li key={wish.id}>
                    <WishCard wish={wish} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </Page>
    </>
  );
}
