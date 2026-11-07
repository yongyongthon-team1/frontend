import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { getLandingPath } from '@/features/auth/landing';
import { hasGuideProfile } from '@/features/auth/guide';
import type { Me } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import { useUniversities } from '@/features/campuses/queries';
import { campusLabel } from '@/features/tours/model';
import { PROOF_ACCEPT, proofFileError } from '@/features/verification/model';
import { useSubmitEnrollment } from '@/features/verification/queries';
import { VerificationStatusCard } from '@/features/verification/components/VerificationStatusCard';
import { errorMessage } from '@/shared/lib/errors';
import type { ActionLink } from '@/shared/lib/types';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FileField } from '@/shared/ui/FileField';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TopBar } from '@/shared/ui/TopBar';

const NOT_APPROVED_NOTICE = '승인 전에는 탐방을 개설할 수 없습니다.';
const UNIVERSITY_REQUIRED = '용용톤 참여 대학을 선택해 주세요.';
const FILE_REQUIRED = '학생증 또는 재학증명서 사진을 올려 주세요.';

type Submit = ReturnType<typeof useSubmitEnrollment>;

/**
 * 제출 폼(미제출 · 반려). 제출은 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다(`locked`). 성공하면 새 내 정보로
 * 첫 화면을 다시 정해 이동한다(학과가 없으면 프로필 작성, 있으면 가이드 홈). 제출 훅은 폼이 사라져도 이동이 끝나도록 페이지가 가진다.
 */
function EnrollmentForm({ me, submit }: { me: Me; submit: Submit }) {
  const navigate = useNavigate();
  const universities = useUniversities();
  const locked = useRef(false);
  // 반려면 직전에 낸 대학을 미리 고른다(없으면 고르지 않음).
  const [universityId, setUniversityId] = useState(
    me.verificationStatus === 'REJECTED' && me.guideProfile?.universityId != null
      ? String(me.guideProfile.universityId)
      : '',
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
        onSuccess: (newMe) => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 제출이 한 번 더 나가지 않는다.
          toast('재학 인증을 제출했어요.');
          void navigate(getLandingPath(newMe), { replace: true });
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
        label="용용톤 참여 대학 선택"
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {universityField}
      <FileField
        label="학생증·재학증명서 이미지 업로드"
        description="이미지 형식·용량 확인 후 운영자 심사 대기"
        hint="jpg · png, 5MB 이하"
        accept={PROOF_ACCEPT}
        file={file}
        error={errors.file}
        disabled={submit.isPending}
        validate={proofFileError}
        onChange={(next) => {
          setFile(next.file);
          setErrors((prev) => ({ ...prev, file: next.error ?? undefined }));
        }}
      />
      <InfoCard muted title="심사 중 → 승인 / 반려" description={NOT_APPROVED_NOTICE} />
      <Button type="submit" loading={submit.isPending} disabled={submit.isPending}>
        재학 인증 제출하기
      </Button>
      <p className="text-[13px] text-muted">5개교 이외 학교 선택 시 제출할 수 없어요.</p>
    </form>
  );
}

/** 심사 중 · 승인일 때 폼 대신 보이는 다음 행동 링크: 학과가 없으면 프로필부터. */
function nextAction(me: Me): ActionLink {
  if (!hasGuideProfile(me)) return { label: '가이드 프로필 작성하기', to: '/guide/me/profile' };
  return me.verificationStatus === 'APPROVED'
    ? { label: '새 탐방 개설하기', to: '/guide/tours/new' }
    : { label: '내가 개설한 탐방', to: '/guide/tours' };
}

/**
 * 대학생 재학 인증(guide-a01, V2에 없음). 미제출 · 반려는 폼, 심사 중 · 승인은 상태 카드와 다음 행동. 반려면 맨 위에 반려 사유 카드.
 * 제출한 대학은 `me.guideProfile.universityId`(서버가 제출 때 맞춘다)로 찾는다.
 */
export function GuideVerifyPage() {
  const meQuery = useMe();
  const universities = useUniversities();
  const submit = useSubmitEnrollment();
  const me = meQuery.data;

  let body;
  if (me === undefined && meQuery.isError) {
    body = <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />;
  } else if (me === undefined) {
    body = <Skeleton className="h-[200px] rounded-lg" />;
  } else if (me.verificationStatus === 'NONE' || me.verificationStatus === 'REJECTED') {
    body = (
      <>
        {me.verificationStatus === 'REJECTED' ? (
          <VerificationStatusCard
            title="재학 인증 상태 · 반려"
            rejectionReason={me.rejectionReason}
            description={NOT_APPROVED_NOTICE}
          />
        ) : null}
        <EnrollmentForm me={me} submit={submit} />
      </>
    );
  } else {
    const approved = me.verificationStatus === 'APPROVED';
    const universityId = me.guideProfile?.universityId ?? null;
    const university =
      universityId === null ? undefined : universities.data?.find((u) => u.id === universityId);
    body = (
      <VerificationStatusCard
        title={`재학 인증 상태 · ${approved ? '승인' : '심사 중'}`}
        description={
          <div className="flex flex-col gap-1">
            {university ? <p>{campusLabel(university.name, university.campusName)}</p> : null}
            <p>{approved ? '학생증 심사 완료 · 인증 배지 노출' : NOT_APPROVED_NOTICE}</p>
          </div>
        }
        action={nextAction(me)}
      />
    );
  }

  return (
    <>
      <TopBar title="대학생 재학 인증" />
      <div className="px-[var(--gutter)] pt-3">
        <StatusChip tone="info">가이드 권한 인증</StatusChip>
      </div>
      <Page className="mt-3 flex flex-col gap-3">{body}</Page>
    </>
  );
}
