import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { EMAIL_MAX_LENGTH, type GuardianStatus, type Me } from '@/features/auth/model';
import { useMe } from '@/features/auth/queries';
import { FirstEntryLogout } from '@/features/verification/components/FirstEntryLogout';
import { ProgressCard } from '@/features/verification/components/ProgressCard';
import {
  GUARDIAN_NAME_MAX,
  GUARDIAN_STATUS_LABEL,
  GUARDIAN_TONE,
  verifySteps,
} from '@/features/verification/model';
import {
  useDecideConsent,
  useDemoConsentToken,
  useRequestGuardianConsent,
} from '@/features/verification/queries';
import { useDemoToolsOn } from '@/demo/demoStore';
import { qk } from '@/shared/api/queryKeys';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { Badge } from '@/shared/ui/Badge';
import { BOTTOM_ACTION_PAGE, BottomAction } from '@/shared/ui/BottomAction';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

/** 뒤로 가기가 가는 곳: 고교생의 MY(판정 A8). */
const BACK_TO = '/me';

const emailSchema = z.email();

/** 진행 상태 카드의 제목. 대기만 시안 문구(`동의 요청 대기`)이고 나머지는 상태 이름 그대로다. */
const CARD_TITLE: Record<GuardianStatus, string> = {
  ...GUARDIAN_STATUS_LABEL,
  PENDING: '동의 요청 대기',
};

function cardDescription(status: GuardianStatus): string {
  switch (status) {
    case 'REJECTED':
      return '보호자가 동의하지 않았어요. 이야기를 나눈 뒤 다시 요청해 주세요.';
    case 'EXPIRED':
      return '동의 링크가 만료됐어요. 다시 보내 주세요.';
    case 'PENDING':
      return '보호자에게 동의 링크를 보냈어요. 보호자가 동의하면 여기에 표시돼요.';
    case 'AGREED':
      return '보호자가 동의했어요.';
    case 'NONE':
      return '동의가 완료되면 탐방을 신청할 수 있어요.'; // 시안 문구
  }
}

/**
 * 시연 조작(2B′-R10 · 판정 A9): 같은 탭에서 보호자 페이지를 열거나 동의를 건너뛴다. 건너뛰기는 되돌릴 수 없어 처리 중에 잠기고
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

/**
 * 요청 폼(미요청 · 거부 · 만료) + 진행 상태 카드. 판정 A1에 따라 보호자 성함 칸은 남긴다. 빈칸에서 시작한다 — 보호자 이름 · 이메일은
 * 내 정보에 없다(2B′-R9). 요청은 되돌릴 수 없어 처리 중에 잠기고 연타해도 요청은 한 번이다.
 * 성공하면 내 정보가 동의 대기로 바뀌어 폼과 버튼이 사라진다(대기 중에는 다시 보낼 수 없다).
 */
function ConsentRequestForm({ status }: { status: GuardianStatus }) {
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
    <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-1 flex-col">
      <div className="flex flex-col gap-3">
        <TextField
          label="보호자 성함"
          showLabel
          placeholder="보호자 성함을 입력해 주세요"
          value={name}
          error={errors.name}
          autoComplete="off"
          disabled={request.isPending}
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
          placeholder="guardian@example.com"
          autoComplete="off"
          value={email}
          error={errors.email}
          disabled={request.isPending}
          onKeyDown={preventImeEnter}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        <Notice>
          입력한 이메일로 동의 링크가 전송돼요. 링크에서 탐방 참여 동의를 완료해 주세요.
        </Notice>
        <ProgressCard
          tone={GUARDIAN_TONE[status]}
          title={CARD_TITLE[status]}
          description={cardDescription(status)}
        />
      </div>
      <BottomAction>
        <Button type="submit" loading={request.isPending} disabled={request.isPending}>
          동의 링크 보내기
        </Button>
        <FirstEntryLogout />
      </BottomAction>
    </form>
  );
}

/** 대기 중: 다시 보낼 수 없어 폼을 숨기고 카드 · 7일 안내 · (시연 도구가 켜지고 확장 토큰이 있으면) 시연 조작을 그린다. */
function WaitingView({ me }: { me: Me }) {
  const demoOn = useDemoToolsOn();
  // 확장 토큰은 목업만 준다. 실서버(확장 없음)에서는 null이라 시연 조작을 그리지 않는다.
  const tokenQuery = useDemoConsentToken(demoOn);
  const token = typeof tokenQuery.data === 'string' ? tokenQuery.data : null;
  return (
    <div className="mt-5 flex flex-col gap-3">
      <ProgressCard
        tone={GUARDIAN_TONE[me.guardianStatus]}
        title={CARD_TITLE[me.guardianStatus]}
        description={cardDescription(me.guardianStatus)}
      >
        <p className="text-[13px] text-muted">링크는 보낸 때부터 7일 동안 열 수 있어요.</p>
      </ProgressCard>
      {demoOn && token !== null ? <DemoConsentTools token={token} /> : null}
    </div>
  );
}

/** 동의 완료: 카드와 다음 행동(승인됐으면 탐방 찾기, 아니면 인증 상태). */
function DoneView({ me }: { me: Me }) {
  const approved = me.verificationStatus === 'APPROVED';
  return (
    <>
      <div className="mt-5 flex-1">
        <ProgressCard
          tone={GUARDIAN_TONE[me.guardianStatus]}
          title={CARD_TITLE[me.guardianStatus]}
          description={cardDescription(me.guardianStatus)}
        />
      </div>
      <BottomAction>
        <Link to={approved ? '/' : '/me/status'} className={buttonClass('primary')}>
          {approved ? '탐방 찾아보기' : '인증 상태 보기'}
        </Link>
      </BottomAction>
    </>
  );
}

/**
 * 보호자 동의 요청(C04, 새 시안). 예전 `/verify`의 STEP 2를 떼어 낸 화면이다. 미요청 · 거부 · 만료는 요청 폼, 동의 대기는 대기 카드
 * (+ 시연 조작), 동의 완료는 완료 카드. 상단 바 뒤로 가기만 있고 하단 탭은 없다(판정 A8).
 */
export function GuardianRequestPage() {
  const meQuery = useMe();
  const me = meQuery.data;

  let body;
  if (me === undefined) {
    body = meQuery.isError ? (
      <ErrorState error={meQuery.error} onRetry={() => void meQuery.refetch()} />
    ) : (
      <Skeleton className="mt-5 h-[200px] rounded-lg" />
    );
  } else {
    const step = verifySteps(me).guardian;
    if (step === 'FORM' || step === 'REREQUEST') {
      body = <ConsentRequestForm status={me.guardianStatus} />;
    } else if (step === 'WAITING') {
      body = <WaitingView me={me} />;
    } else {
      body = <DoneView me={me} />;
    }
  }

  return (
    <>
      <TopBar title="보호자 동의 요청" back={BACK_TO} />
      <Page className={`${BOTTOM_ACTION_PAGE} pt-3`}>
        <PageHeading
          as="h2"
          title="보호자 동의가 필요해요."
          description="고교생은 신청 전 보호자 동의를 받아야 해요."
        />
        {body}
      </Page>
    </>
  );
}
