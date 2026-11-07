import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { EMAIL_MAX_LENGTH, HIGH_SCHOOL_NAME_MAX, type Me } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import {
  GUARDIAN_NAME_MAX,
  GUARDIAN_STATUS_LABEL,
  GUARDIAN_TONE,
  PROOF_ACCEPT,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_TONE,
  proofFileError,
  verifySteps,
} from '@/features/verification/model';
import {
  useDecideConsent,
  useDemoConsentToken,
  useRequestGuardianConsent,
  useSubmitEnrollment,
} from '@/features/verification/queries';
import { VerificationStatusCard } from '@/features/verification/components/VerificationStatusCard';
import { useDemoToolsOn } from '@/demo/demoStore';
import { qk } from '@/shared/api/queryKeys';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FileField } from '@/shared/ui/FileField';
import { InfoCard } from '@/shared/ui/InfoCard';
import { Page } from '@/shared/ui/Page';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

const GRADE_OPTIONS = [
  { value: '', label: '학년 선택' },
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
];

const emailSchema = z.email();

/** 소제목 · 카드 안 문단의 공통 모양. */
const subheadingClass = 'text-[15px] font-bold text-ink';

/**
 * 재학 인증 STEP 1의 폼(미제출 · 반려). 학교 이름은 지금 프로필 값으로 시작하고, 학년 · 사진은 비어 있다.
 * 제출은 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다(`locked`). 제출이 성공하면 내 정보가 심사 중으로 바뀌어 이 폼은 사라진다.
 */
function EnrollmentForm({ me }: { me: Me }) {
  const submit = useSubmitEnrollment();
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
        onError: (error) => {
          locked.current = false; // 실패하면 다시 낼 수 있다(성공하면 폼이 사라진다)
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <h2 className={subheadingClass}>학교 · 학년</h2>
      <TextField
        label="학교 이름"
        showLabel
        hint="예: 수원영통고등학교"
        value={school}
        error={errors.school}
        onKeyDown={preventImeEnter}
        onChange={(e) => {
          setSchool(e.target.value);
          setErrors((prev) => ({ ...prev, school: undefined }));
        }}
      />
      <Select
        label="학년 선택"
        options={GRADE_OPTIONS}
        value={grade}
        error={errors.grade}
        onChange={(e) => {
          setGrade(e.target.value);
          setErrors((prev) => ({ ...prev, grade: undefined }));
        }}
      />
      <FileField
        label="학생증 / 재학증명서 업로드"
        description="사진 업로드 후 심사 중 상태로 전환"
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
      <Button type="submit" loading={submit.isPending} disabled={submit.isPending}>
        재학 인증 제출하기
      </Button>
    </form>
  );
}

function Step1Card({ me, step }: { me: Me; step: ReturnType<typeof verifySteps>['student'] }) {
  const status = me.verificationStatus;
  return (
    <VerificationStatusCard
      title="STEP 1 · 재학 인증"
      badge={{ label: VERIFICATION_STATUS_LABEL[status], tone: VERIFICATION_TONE[status] }}
      rejectionReason={step === 'RESUBMIT' ? me.rejectionReason : null}
      description={
        step === 'IN_REVIEW'
          ? '운영자가 학생증을 확인하고 있어요. 결과는 여기와 내 정보에서 볼 수 있어요.'
          : step === 'DONE'
            ? '학생증 심사 완료'
            : undefined
      }
    >
      {step === 'FORM' || step === 'RESUBMIT' ? <EnrollmentForm me={me} /> : null}
    </VerificationStatusCard>
  );
}

/**
 * 보호자 동의 요청 폼(미요청 · 거부 · 만료). 빈칸에서 시작한다 — 보호자 이름 · 이메일은 내 정보에 없다(2B′-R9).
 * 요청은 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다. 성공하면 내 정보가 동의 대기로 바뀌어 이 폼은 사라진다.
 */
function ConsentRequestForm() {
  const request = useRequestGuardianConsent();
  const locked = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked.current || request.isPending) return;
    const guardianName = name.trim();
    const guardianEmail = email.trim();
    const next: typeof errors = {};
    if (guardianName === '') next.name = '보호자 성함을 입력해 주세요.';
    else if (guardianName.length > GUARDIAN_NAME_MAX) {
      next.name = `${GUARDIAN_NAME_MAX}자 이내로 적어 주세요.`;
    }
    if (guardianEmail === '') next.email = '보호자 이메일을 입력해 주세요.';
    else if (
      guardianEmail.length > EMAIL_MAX_LENGTH ||
      !emailSchema.safeParse(guardianEmail).success
    ) {
      next.email = '이메일 주소 형식을 확인해 주세요.';
    }
    setErrors(next);
    if (next.name || next.email) return;

    locked.current = true;
    request.mutate(
      { guardianName, guardianEmail },
      {
        onError: (error) => {
          locked.current = false;
          const fields = error.fieldErrors ?? {};
          if (fields.guardianName !== undefined || fields.guardianEmail !== undefined) {
            setErrors({ name: fields.guardianName, email: fields.guardianEmail });
            return;
          }
          toast.error(errorMessage(error.code));
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <TextField
        label="보호자 성함"
        showLabel
        value={name}
        error={errors.name}
        autoComplete="off"
        onKeyDown={preventImeEnter}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
      />
      <TextField
        label="보호자 이메일"
        showLabel
        type="email"
        inputMode="email"
        autoComplete="off"
        value={email}
        error={errors.email}
        onKeyDown={preventImeEnter}
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors((prev) => ({ ...prev, email: undefined }));
        }}
      />
      <Button type="submit" loading={request.isPending} disabled={request.isPending}>
        동의 링크 보내기
      </Button>
    </form>
  );
}

/**
 * 시연 조작(2B′-R10): 같은 탭에서 보호자 페이지를 열거나 동의를 건너뛴다. 건너뛰기는 되돌릴 수 없어 처리 중에 잠기고
 * 연타해도 요청은 한 번이다. 성공하면 훅이 내 정보를 다시 읽어 이 카드가 `동의 완료`로 바뀐다(새로고침 없이).
 * 보호자 페이지에서 동의하고 돌아오면 캐시된 대기 카드가 먼저 보이므로, 내 정보를 다시 읽는 동안에는 건너뛰기를 잠근다
 * (이미 처리된 요청으로 무대에서 오류 토스트가 뜨지 않게).
 */
function DemoConsentTools({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const refreshing = useMe().isFetching;
  const decide = useDecideConsent(token);
  const locked = useRef(false);

  function onSkip() {
    if (locked.current || decide.isPending) return;
    locked.current = true;
    decide.mutate('AGREED', {
      onSuccess: () => toast.success('시연용으로 보호자 동의를 마쳤어요.'),
      onError: (error) => {
        locked.current = false;
        toast.error(errorMessage(error.code));
        // 그 사이 이미 처리됐다면 화면이 낡았다 — 내 정보를 다시 읽는다.
        if (error.code === 'ALREADY_PROCESSED') {
          void queryClient.invalidateQueries({ queryKey: qk.me });
        }
      },
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <Link
          to={`/consent/${encodeURIComponent(token)}`}
          className="inline-flex min-h-11 items-center px-1 text-sm font-bold text-brand underline underline-offset-2"
        >
          보호자 페이지 열기
        </Link>
        <Badge tone="info">시연</Badge>
      </div>
      <Button
        variant="secondary"
        size="sm"
        loading={decide.isPending}
        disabled={decide.isPending || refreshing}
        onClick={onSkip}
      >
        동의 완료로 건너뛰기
      </Button>
    </div>
  );
}

function Step2Card({ me, step }: { me: Me; step: ReturnType<typeof verifySteps>['guardian'] }) {
  const status = me.guardianStatus;
  const demoOn = useDemoToolsOn();
  const waiting = step === 'WAITING';
  // 확장 토큰은 목업만 준다. 실서버(확장 없음)에서는 null이라 시연 조작을 그리지 않는다.
  const tokenQuery = useDemoConsentToken(demoOn && waiting);
  const token = typeof tokenQuery.data === 'string' ? tokenQuery.data : null;

  let description: string | undefined;
  if (step === 'REREQUEST') {
    description =
      status === 'EXPIRED'
        ? '동의 링크가 만료됐어요. 다시 보내 주세요.'
        : '보호자가 동의하지 않았어요. 이야기를 나눈 뒤 다시 요청해 주세요.';
  } else if (waiting) {
    description = '보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.';
  } else if (step === 'DONE') {
    description = '보호자가 동의했어요.';
  }

  return (
    <VerificationStatusCard
      title="STEP 2 · 보호자 동의 요청"
      badge={{ label: GUARDIAN_STATUS_LABEL[status], tone: GUARDIAN_TONE[status] }}
      description={description}
    >
      {step === 'FORM' || step === 'REREQUEST' ? <ConsentRequestForm /> : null}
      {waiting ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">링크는 보낸 때부터 7일 동안 열 수 있어요.</p>
          {demoOn && token !== null ? <DemoConsentTools token={token} /> : null}
        </div>
      ) : null}
    </VerificationStatusCard>
  );
}

/**
 * 재학 인증 · 보호자 동의(hs-s02, V2에 없음). 두 단계는 따로 제출하는 별도 폼이고 순서 제약이 없다. 둘 다 끝나면 맨 위에
 * 완료 카드. 시연 도구가 켜지고 목업이 보호자 링크 토큰을 주면 STEP 2에 시연 조작이 붙는다.
 */
export function VerifyPage() {
  const meQuery = useMe();
  const me = meQuery.data;

  let body;
  if (me === undefined && meQuery.isError) {
    body = <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />;
  } else if (me === undefined) {
    body = (
      <>
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[160px] rounded-lg" />
      </>
    );
  } else {
    const steps = verifySteps(me);
    body = (
      <>
        {steps.done ? (
          <InfoCard
            tone="brand"
            title="인증이 끝났어요"
            description="이제 탐방을 신청할 수 있어요."
          >
            <Link to="/" className={buttonClass('soft')}>
              탐방 찾아보기
            </Link>
          </InfoCard>
        ) : null}
        <Step1Card me={me} step={steps.student} />
        <Step2Card me={me} step={steps.guardian} />
        <div className="flex flex-col items-start gap-1">
          <p className="text-[13px] text-muted">인증 전에도 홈과 탐방 목록은 둘러볼 수 있어요.</p>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center px-1 text-sm font-bold text-brand underline underline-offset-2"
          >
            홈 둘러보기
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="인증하고 탐방 신청하기" />
      <div className="px-[var(--gutter)] pt-3">
        <StatusChip tone="info">STEP 1 · 재학 인증 / STEP 2 · 보호자</StatusChip>
      </div>
      <Page className="mt-3 flex flex-col gap-3">{body}</Page>
    </>
  );
}
