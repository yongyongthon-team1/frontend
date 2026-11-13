import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { hasGuideProfile } from '@/features/auth/guide';
import { getLandingPath } from '@/features/auth/landing';
import { GUIDE_INTRO_MAX, GUIDE_MAJOR_MAX, type Me } from '@/features/auth/model';
import { useMe, useSaveGuideProfile } from '@/features/auth/queries';
import { useUniversities } from '@/features/campuses/queries';
import { campusLabel } from '@/features/tours/model';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Textarea } from '@/shared/ui/Textarea';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

type Field = 'major' | 'introduction';
type Errors = Partial<Record<Field, string>>;

function validate(major: string, introduction: string): Errors {
  const errors: Errors = {};
  if (major === '') errors.major = '전공 / 학과를 입력해 주세요.';
  else if (major.length > GUIDE_MAJOR_MAX) {
    errors.major = `${GUIDE_MAJOR_MAX}자 이내로 입력해 주세요.`;
  }
  if (introduction === '') errors.introduction = '소개 한마디를 입력해 주세요.';
  else if (introduction.length > GUIDE_INTRO_MAX) {
    errors.introduction = `${GUIDE_INTRO_MAX}자 이내로 적어 주세요.`;
  }
  return errors;
}

/**
 * 프로필 폼. 학교는 재학 인증 제출 때 정해져 읽기만 한다(프로필 저장은 학교를 받지 않는다). 저장은 되돌릴 수 없는 쓰기는 아니지만
 * 연타해도 요청은 한 번이다(`locked`). 처음 저장이면 새 내 정보로 첫 화면을 다시 정하고, 수정이면 MY로 돌아간다.
 */
function ProfileForm({ me }: { me: Me }) {
  const navigate = useNavigate();
  const universities = useUniversities();
  const save = useSaveGuideProfile();
  const locked = useRef(false);
  const [major, setMajor] = useState(me.guideProfile?.major ?? '');
  const [introduction, setIntroduction] = useState(me.guideProfile?.introduction ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const universityId = me.guideProfile?.universityId ?? null;
  const university =
    universityId === null ? undefined : universities.data?.find((u) => u.id === universityId);
  const schoolLabel = university ? campusLabel(university.name, university.campusName) : '';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current || save.isPending) return;
    const trimmedMajor = major.trim();
    const trimmedIntro = introduction.trim();
    const found = validate(trimmedMajor, trimmedIntro);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // 저장이 끝나면 내 정보가 바뀌므로 처음 저장인지는 지금 정해 둔다.
    const first = !hasGuideProfile(me);
    locked.current = true;
    save.mutate(
      { major: trimmedMajor, introduction: trimmedIntro },
      {
        onSuccess: (newMe) => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 저장이 한 번 더 나가지 않는다.
          toast('가이드 프로필을 저장했어요.');
          void navigate(first ? getLandingPath(newMe) : '/guide/me', { replace: true });
        },
        onError: (error) => {
          locked.current = false;
          const server: Errors = {};
          for (const [name, reason] of Object.entries(error.fieldErrors ?? {})) {
            if (name === 'major' || name === 'introduction') server[name] = reason;
          }
          if (Object.keys(server).length > 0) setErrors(server);
          else toast.error(errorMessage(error.code));
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <TextField
        label="전공"
        showLabel
        value={major}
        error={errors.major}
        autoComplete="off"
        onKeyDown={preventImeEnter}
        onChange={(e) => {
          setMajor(e.target.value);
          setErrors((prev) => ({ ...prev, major: undefined }));
        }}
      />
      <TextField
        label="학교 · 캠퍼스"
        showLabel
        readOnly
        value={schoolLabel}
        placeholder="재학 인증 후 채워져요"
      />
      <Textarea
        label="소개 한마디"
        showLabel
        placeholder="디자인 전공의 실제 하루를 함께 보여드릴게요."
        value={introduction}
        error={errors.introduction}
        onChange={(e) => {
          setIntroduction(e.target.value);
          setErrors((prev) => ({ ...prev, introduction: undefined }));
        }}
      />
      <Button type="submit" loading={save.isPending} disabled={save.isPending}>
        프로필 저장
      </Button>
    </form>
  );
}

/** G05 가이드 프로필 등록 · 수정(guide-s01). 전공 · 소개를 `PUT /users/me/guide-profile`로 저장한다. */
export function GuideProfilePage() {
  const meQuery = useMe();
  const me = meQuery.data;

  let body;
  if (me === undefined && meQuery.isError) {
    body = <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />;
  } else if (me === undefined) {
    body = <Skeleton className="h-[320px] rounded-lg" />;
  } else {
    body = <ProfileForm me={me} />;
  }

  return (
    <>
      <TopBar title="가이드 프로필 등록" back="/guide/me" />
      <Page className="flex flex-col gap-4">
        <PageHeading
          as="h2"
          title="내 이야기를 소개해 주세요."
          description="투어 참가자에게 보여줄 가이드 정보예요."
        />
        {body}
      </Page>
    </>
  );
}
