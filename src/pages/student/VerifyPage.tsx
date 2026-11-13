import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { studentAfterEnrollmentPath } from '@/features/auth/landing';
import { HIGH_SCHOOL_NAME_MAX, type Me } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import { EnrollmentScreen } from '@/features/verification/components/EnrollmentScreen';
import { EnrollmentStatusView } from '@/features/verification/components/EnrollmentStatusView';
import { verifySteps } from '@/features/verification/model';
import { useSubmitEnrollment } from '@/features/verification/queries';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import type { ActionLink } from '@/shared/lib/types';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Page } from '@/shared/ui/Page';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

/** 뒤로 가기가 가는 곳: 고교생의 MY(판정 A8). */
const BACK_TO = '/me';

const GRADE_OPTIONS = [
  { value: '', label: '학년 선택' },
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
];

type Submit = ReturnType<typeof useSubmitEnrollment>;

/**
 * 재학 인증 폼(C03 미제출 · C08 반려). 판정 A1에 따라 학교 이름 · 학년 칸은 남긴다(학교 이름은 지금 프로필 값으로 시작, 학년 · 사진은 빈칸).
 * 제출은 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다(`locked`). 성공하면 보호자 동의 요청(C04)이나 인증 상태(C07)로 간다.
 * 제출 훅은 폼이 사라져도 이동이 끝나도록 페이지가 가진다.
 */
function EnrollmentForm({
  me,
  submit,
  mode,
}: {
  me: Me;
  submit: Submit;
  mode: 'FIRST' | 'RESUBMIT';
}) {
  const navigate = useNavigate();
  const locked = useRef(false);
  const [school, setSchool] = useState(me.studentProfile?.highSchoolName ?? '');
  const [grade, setGrade] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ school?: string; grade?: string; file?: string }>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current || submit.isPending) return;
    const schoolName = school.trim();
    const next: typeof errors = {};
    if (schoolName === '') next.school = '학교 이름을 입력해 주세요.';
    else if (schoolName.length > HIGH_SCHOOL_NAME_MAX) {
      next.school = `${HIGH_SCHOOL_NAME_MAX}자 이내로 적어 주세요.`;
    }
    if (grade === '') next.grade = '학년을 골라 주세요.';
    // 틀린 파일을 막 버린 경우에는 그 오류 문구를 그대로 둔다.
    if (file === null) next.file = errors.file ?? '학생증 사진을 올려 주세요.';
    setErrors(next);
    if (next.school || next.grade || file === null) return;

    locked.current = true;
    submit.mutate(
      { role: 'HIGH_SCHOOL', schoolName, grade: Number(grade), document: file },
      {
        onSuccess: (newMe) => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 제출이 한 번 더 나가지 않는다.
          void navigate(studentAfterEnrollmentPath(newMe), { replace: true });
        },
        onError: (error) => {
          locked.current = false; // 실패하면 다시 낼 수 있다
          const fields = error.fieldErrors ?? {};
          if (fields.document !== undefined) {
            setFile(null); // 서버가 거절한 사진은 비운다
            setErrors((prev) => ({ ...prev, file: fields.document }));
            return;
          }
          if (fields.schoolName !== undefined) {
            setErrors((prev) => ({ ...prev, school: fields.schoolName }));
            return;
          }
          toast.error(errorMessage(error.code));
        },
      },
    );
  }

  return (
    <EnrollmentScreen
      mode={mode}
      backTo={BACK_TO}
      rejectionReason={me.rejectionReason}
      file={file}
      fileError={errors.file}
      pending={submit.isPending}
      onSubmit={onSubmit}
      onFileChange={(next) => {
        setFile(next.file);
        setErrors((prev) => ({ ...prev, file: next.error ?? undefined }));
      }}
      fields={
        <>
          <TextField
            label="학교 이름"
            showLabel
            placeholder="예: 수원영통고등학교"
            value={school}
            error={errors.school}
            disabled={submit.isPending}
            onKeyDown={preventImeEnter}
            onChange={(e) => {
              setSchool(e.target.value);
              setErrors((prev) => ({ ...prev, school: undefined }));
            }}
          />
          <Select
            label="학년"
            showLabel
            options={GRADE_OPTIONS}
            value={grade}
            error={errors.grade}
            disabled={submit.isPending}
            onChange={(e) => {
              setGrade(e.target.value);
              setErrors((prev) => ({ ...prev, grade: undefined }));
            }}
          />
        </>
      }
    />
  );
}

/** 심사 중 · 승인일 때 다음 행동: 보호자 쪽이 남았으면 C04, 다 끝났으면 탐방 찾기(승인) · 인증 상태(심사 중). */
function nextAction(me: Me): ActionLink {
  switch (me.guardianStatus) {
    case 'NONE':
    case 'REJECTED':
    case 'EXPIRED':
      return { label: '보호자 동의 요청하기', to: '/verify/guardian' };
    case 'PENDING':
      return { label: '보호자 동의 현황 보기', to: '/verify/guardian' };
    case 'AGREED':
      return me.verificationStatus === 'APPROVED'
        ? { label: '투어 찾아보기', to: '/' }
        : { label: '인증 상태 보기', to: '/me/status' };
  }
}

/**
 * 재학 인증(C03 · C08 · 상태, 새 시안). 미제출은 C03, 반려는 C08, 심사 중 · 승인은 상태를 보인다.
 * 보호자 동의 요청은 `/verify/guardian`(C04)으로 떼어 냈다.
 */
export function VerifyPage() {
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

  const step = verifySteps(me).student;
  if (step === 'FORM' || step === 'RESUBMIT') {
    return <EnrollmentForm me={me} submit={submit} mode={step === 'FORM' ? 'FIRST' : 'RESUBMIT'} />;
  }
  return (
    <EnrollmentStatusView
      status={step === 'IN_REVIEW' ? 'PENDING' : 'APPROVED'}
      backTo={BACK_TO}
      notice={
        step === 'IN_REVIEW'
          ? [
              '운영자가 학생증을 확인하고 있어요. 결과는 여기와 내 정보에서 볼 수 있어요.',
              '승인 전에는 투어 신청·개설이 제한돼요',
            ]
          : ['학생증 심사 완료']
      }
      action={nextAction(me)}
    />
  );
}
