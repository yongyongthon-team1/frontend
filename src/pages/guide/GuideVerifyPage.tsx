import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { hasGuideProfile } from '@/features/auth/guide';
import type { Me } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import { useUniversities } from '@/features/campuses/queries';
import { campusLabel } from '@/features/tours/model';
import { EnrollmentScreen } from '@/features/verification/components/EnrollmentScreen';
import { EnrollmentStatusView } from '@/features/verification/components/EnrollmentStatusView';
import { useSubmitEnrollment } from '@/features/verification/queries';
import { errorMessage } from '@/shared/lib/errors';
import type { ActionLink } from '@/shared/lib/types';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusRow } from '@/shared/ui/StatusRow';
import { TopBar } from '@/shared/ui/TopBar';

/** 뒤로 가기가 가는 곳: 가이드의 MY(판정 A8). */
const BACK_TO = '/guide/me';

const NOT_APPROVED_NOTICE = '승인 전에는 투어를 개설할 수 없습니다.';
const UNIVERSITY_REQUIRED = '용용톤 참여 대학을 선택해 주세요.';
const FILE_REQUIRED = '학생증 또는 재학증명서 사진을 올려 주세요.';

type Submit = ReturnType<typeof useSubmitEnrollment>;

/**
 * 재학 인증 폼(C03 미제출 · C08 반려). 판정 A1에 따라 캠퍼스(참여 대학) 칸은 남긴다. 제출은 되돌릴 수 없어 처리 중에 잠기고
 * 연타해도 요청은 한 번이다(`locked`). 성공하면 인증 상태(C07)로 간다. 제출 훅은 폼이 사라져도 이동이 끝나도록 페이지가 가진다.
 */
function EnrollmentForm({ me, submit }: { me: Me; submit: Submit }) {
  const navigate = useNavigate();
  const universities = useUniversities();
  const locked = useRef(false);
  const rejected = me.verificationStatus === 'REJECTED';
  // 반려면 직전에 낸 대학을 미리 고른다(없으면 고르지 않음).
  const [universityId, setUniversityId] = useState(
    rejected && me.guideProfile?.universityId != null ? String(me.guideProfile.universityId) : '',
  );
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ university?: string; file?: string }>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current || submit.isPending) return;
    const next: typeof errors = {};
    if (universityId === '') next.university = UNIVERSITY_REQUIRED;
    // 틀린 파일을 막 버린 경우에는 그 오류 문구를 그대로 둔다.
    if (file === null) next.file = errors.file ?? FILE_REQUIRED;
    setErrors(next);
    if (next.university || file === null) return;

    locked.current = true;
    submit.mutate(
      { role: 'UNIVERSITY', universityId: Number(universityId), document: file },
      {
        onSuccess: () => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 제출이 한 번 더 나가지 않는다.
          toast('재학 인증을 제출했어요.');
          void navigate('/guide/me/status', { replace: true });
        },
        onError: (error) => {
          locked.current = false; // 실패하면 다시 낼 수 있다
          const fields = error.fieldErrors ?? {};
          if (fields.document !== undefined) {
            setFile(null); // 서버가 거절한 사진은 비운다
            setErrors((prev) => ({ ...prev, file: fields.document }));
            return;
          }
          if (fields.campusId !== undefined) {
            setErrors((prev) => ({ ...prev, university: fields.campusId }));
            return;
          }
          toast.error(errorMessage(error.code));
        },
      },
    );
  }

  let universityField;
  if (universities.data === undefined && universities.isError) {
    universityField = (
      <ErrorState error={universities.error} onRetry={() => void universities.refetch()} />
    );
  } else if (universities.data === undefined) {
    universityField = <Skeleton className="h-14 rounded-md" />;
  } else {
    universityField = (
      <Select
        label="용용톤 참여 대학"
        showLabel
        options={[
          { value: '', label: '용용톤 참여 대학 선택' },
          ...universities.data.map((u) => ({
            value: String(u.id),
            label: `${u.shortName} ${u.campusName}`,
          })),
        ]}
        value={universityId}
        error={errors.university}
        disabled={submit.isPending}
        onChange={(e) => {
          setUniversityId(e.target.value);
          setErrors((prev) => ({ ...prev, university: undefined }));
        }}
      />
    );
  }

  return (
    <EnrollmentScreen
      mode={rejected ? 'RESUBMIT' : 'FIRST'}
      backTo={BACK_TO}
      rejectionReason={me.rejectionReason}
      fields={universityField}
      file={file}
      fileError={errors.file}
      pending={submit.isPending}
      onSubmit={onSubmit}
      onFileChange={(next) => {
        setFile(next.file);
        setErrors((prev) => ({ ...prev, file: next.error ?? undefined }));
      }}
    />
  );
}

/** 심사 중 · 승인일 때 다음 행동 링크: 학과가 없으면 프로필부터. */
function nextAction(me: Me): ActionLink {
  if (!hasGuideProfile(me)) return { label: '가이드 프로필 작성하기', to: '/guide/me/profile' };
  return me.verificationStatus === 'APPROVED'
    ? { label: '새 투어 개설하기', to: '/guide/tours/new' }
    : { label: '내가 개설한 투어', to: '/guide/tours' };
}

/** 심사 중 · 승인 상태 모습. 제출한 대학은 `me.guideProfile.universityId`(서버가 제출 때 맞춘다)로 찾는다. */
function GuideEnrollmentStatus({ me }: { me: Me }) {
  const universities = useUniversities();
  const approved = me.verificationStatus === 'APPROVED';
  const universityId = me.guideProfile?.universityId ?? null;
  const university =
    universityId === null ? undefined : universities.data?.find((u) => u.id === universityId);
  return (
    <EnrollmentStatusView
      status={approved ? 'APPROVED' : 'PENDING'}
      backTo={BACK_TO}
      extra={
        university ? (
          <StatusRow
            label="참여 대학"
            value={campusLabel(university.name, university.campusName)}
          />
        ) : null
      }
      notice={approved ? ['학생증 심사 완료 · 인증 배지 노출'] : [NOT_APPROVED_NOTICE]}
      action={nextAction(me)}
    />
  );
}

/**
 * 대학생 재학 인증(C03 · C08 · 상태, 새 시안). 미제출은 C03, 반려는 C08(사유가 맨 위 danger 안내 상자), 심사 중 · 승인은 상태를 보인다.
 * 고교생 `/verify`와 같은 화면 모양이다.
 */
export function GuideVerifyPage() {
  const meQuery = useMe();
  const submit = useSubmitEnrollment();
  const me = meQuery.data;

  if (me === undefined) {
    return (
      <>
        <TopBar title="재학 인증" back={BACK_TO} />
        <Page className="mt-3 flex flex-col gap-3">
          {meQuery.isError ? (
            <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />
          ) : (
            <Skeleton className="h-[200px] rounded-lg" />
          )}
        </Page>
      </>
    );
  }
  if (me.verificationStatus === 'NONE' || me.verificationStatus === 'REJECTED') {
    return <EnrollmentForm me={me} submit={submit} />;
  }
  return <GuideEnrollmentStatus me={me} />;
}
