import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { HIGH_SCHOOL_NAME_MAX, INTEREST_MAJOR_MAX, NAME_MAX, type Me } from '@/features/auth/model';
import { useMe, useUpdateStudentProfile } from '@/features/auth/queries';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

type Field = 'name' | 'highSchoolName' | 'interestedMajor';
type Errors = Partial<Record<Field, string>>;

const FIELDS: readonly Field[] = ['name', 'highSchoolName', 'interestedMajor'];

function validate(name: string, school: string, major: string): Errors {
  const errors: Errors = {};
  if (name === '') errors.name = '이름을 입력해 주세요.';
  else if (name.length > NAME_MAX) errors.name = `${NAME_MAX}자 이내로 적어 주세요.`;
  if (school.length > HIGH_SCHOOL_NAME_MAX) {
    errors.highSchoolName = `${HIGH_SCHOOL_NAME_MAX}자 이내로 적어 주세요.`;
  }
  if (major.length > INTEREST_MAJOR_MAX) {
    errors.interestedMajor = `${INTEREST_MAJOR_MAX}자 이내로 적어 주세요.`;
  }
  return errors;
}

/**
 * 폼. 학년은 칸이 없고 지금 값이 있으면 그대로 함께 보낸다(재학 인증이 정한 학년을 지우지 않는다). 아직 없으면(`null`) 어댑터가 `grade` 키를 뺀다.
 * 학교 · 관심 전공을 비우면 지움(`null`)이다. 저장은 연타해도 요청이 한 번이다(`locked`).
 */
function EditForm({ me }: { me: Me }) {
  const navigate = useNavigate();
  const save = useUpdateStudentProfile();
  const locked = useRef(false);
  const profile = me.studentProfile;
  const [name, setName] = useState(me.name);
  const [school, setSchool] = useState(profile?.highSchoolName ?? '');
  const [major, setMajor] = useState(profile?.interestedMajor ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const change =
    (field: Field, set: (value: string) => void) => (e: { target: { value: string } }) => {
      set(e.target.value);
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current || save.isPending) return;
    const trimmed = { name: name.trim(), school: school.trim(), major: major.trim() };
    const found = validate(trimmed.name, trimmed.school, trimmed.major);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    locked.current = true;
    save.mutate(
      {
        name: trimmed.name,
        highSchoolName: trimmed.school === '' ? null : trimmed.school,
        grade: profile?.grade ?? null,
        interestedMajor: trimmed.major === '' ? null : trimmed.major,
      },
      {
        onSuccess: () => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 저장이 한 번 더 나가지 않는다.
          toast('내 정보를 저장했어요.');
          void navigate('/me', { replace: true });
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
      className="flex flex-col gap-3"
    >
      <TextField
        label="이름"
        showLabel
        autoComplete="name"
        value={name}
        error={errors.name}
        onChange={change('name', setName)}
      />
      <TextField
        label="학교"
        showLabel
        placeholder="재학 중인 고등학교"
        autoComplete="off"
        value={school}
        error={errors.highSchoolName}
        onChange={change('highSchoolName', setSchool)}
      />
      <TextField label="이메일" showLabel readOnly value={me.email} />
      <TextField
        label="관심 전공"
        showLabel
        placeholder="예: 디자인 · 산업디자인"
        autoComplete="off"
        value={major}
        error={errors.interestedMajor}
        onChange={change('interestedMajor', setMajor)}
      />
      <p className="px-1 text-[13px] text-muted">
        코스 추천은 각 탐방 신청서에 작성한 ‘하고 싶은 것’을 기준으로 생성돼요.
      </p>
      <Button type="submit" loading={save.isPending} disabled={save.isPending}>
        변경사항 저장
      </Button>
    </form>
  );
}

/** H17 내 정보 수정(hs-a03). 이름 · 학교 · 관심 전공을 `PATCH /users/me`로 저장하고 MY로 돌아간다. */
export function MeEditPage() {
  const meQuery = useMe();
  const me = meQuery.data;

  let body;
  if (me === undefined && meQuery.isError) {
    body = <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />;
  } else if (me === undefined) {
    body = <Skeleton className="h-[360px] rounded-lg" />;
  } else {
    body = <EditForm me={me} />;
  }

  return (
    <>
      <TopBar title="내 정보 수정" back="/me" />
      <Page className="flex flex-col gap-4">
        <PageHeading
          as="h2"
          title="내 정보를 업데이트해요."
          description="탐방 신청에 사용하는 기본 프로필이에요."
        />
        {body}
      </Page>
    </>
  );
}
