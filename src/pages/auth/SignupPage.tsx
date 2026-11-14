import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { getLandingPath } from '@/features/auth/landing';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX,
  PASSWORD_PATTERN,
  SIGNUP_ROLES,
  type SignupRole,
} from '@/features/auth/model';
import { useSignup } from '@/features/auth/queries';
import { cn } from '@/shared/lib/cn';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { BrandMark } from '@/shared/ui/BrandMark';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TextField } from '@/shared/ui/TextField';

const signupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, '이메일 주소를 입력해 주세요.')
      .max(EMAIL_MAX_LENGTH, '이메일 주소가 너무 길어요.')
      .pipe(z.email('이메일 주소 형식을 확인해 주세요.')),
    password: z
      .string()
      .min(1, '비밀번호를 입력해 주세요.')
      .regex(PASSWORD_PATTERN, '비밀번호는 영문과 숫자를 섞어 8자 이상으로 정해 주세요.'),
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
    name: z
      .string()
      .trim()
      .min(1, '이름을 입력해 주세요.')
      .max(NAME_MAX, `이름은 ${NAME_MAX}자 이내로 적어 주세요.`),
  })
  // 다른 칸에 오류가 있어도 확인 칸 불일치를 함께 알린다(기본은 오류가 있으면 이 검사를 건너뛴다).
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 서로 달라요.',
    when: (payload) => {
      const v = payload.value as { password?: string; passwordConfirm?: string } | undefined;
      return !!v?.passwordConfirm && !!v.password && !payload.issues?.some(isConfirmIssue);
    },
  });

const isConfirmIssue = (issue: { path?: PropertyKey[] }) => issue.path?.[0] === 'passwordConfirm';

type Field = keyof z.input<typeof signupSchema>;
/** 서버 칸 오류를 붙일 수 있는 칸(`passwordConfirm`은 서버에 없다). */
const SERVER_FIELDS: readonly Field[] = ['email', 'password', 'name'];
/** API로 보내는 1단계 값(확인 칸 · 약관은 화면 검증만 하고 보내지 않는다). */
type Account = { email: string; password: string; name: string };

const ROLE_CARDS: Record<SignupRole, { badge: string; title: string; features: string }> = {
  HIGH_SCHOOL: {
    badge: '고교생',
    title: '미래의 대학을 만나고 싶어요',
    features: '학교 · 학과와 희망 사항으로 탐방 찾기 · 탐방 신청 · 쿠폰',
  },
  UNIVERSITY: {
    badge: '대학생 가이드',
    title: '학교와 전공을 소개할게요',
    features: '탐방 개설 · 신청 관리 · 코스 설계',
  },
  OWNER: {
    badge: '동네 가게 사장님',
    title: '탐방객을 가게로 맞이할게요',
    features: '가게 연결 · 제휴 할인 · 쿠폰 사용',
  },
};

/** 역할 선택 카드(C02). 숨긴 radio + 카드 전체가 라벨이다. 고른 카드는 brand 테두리 + brand-soft 바탕(키보드 초점은 outline). */
function RoleCard({
  role,
  checked,
  disabled,
  onSelect,
}: {
  role: SignupRole;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { badge, title, features } = ROLE_CARDS[role];
  return (
    <label
      className={cn(
        'block rounded-lg border-2 p-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent',
        checked ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <input
        type="radio"
        name="role"
        value={role}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <StatusChip tone="info" dot={false} className={checked ? 'bg-surface' : undefined}>
        {badge}
      </StatusChip>
      <span className="mt-2 block text-[17px] font-bold text-ink">{title}</span>
      <span className="mt-1 block text-[13px] text-muted">{features}</span>
    </label>
  );
}

/**
 * 회원가입(C01A → C02, 새 시안). 한 라우트 안의 두 단계다. 1단계(계정)는 화면 검증만 하고 `?step=role`로 넘어가며,
 * 2단계(역할)에서 `POST /auth/signup`을 한 번 보낸다(역할이 API 필수). 단계는 주소에 있어 뒤로 가기로 1단계에 돌아오고
 * 입력값은 폼에 남는다. 1단계 값 없이 2단계를 바로 열면(새로고침 · 직접 주소) 1단계로 되돌린다.
 * 가입은 되돌릴 수 없는 쓰기라 처리 중에 잠기고 연타해도 요청은 한 번이다(`locked`).
 */
export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signup = useSignup();
  const locked = useRef(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', passwordConfirm: '', name: '' },
  });

  const onRoleStep = searchParams.get('step') === 'role';
  if (onRoleStep && account === null) return <Navigate to="/signup" replace />;

  /** 1단계 값이 바뀌면 통과한 값을 버린다 — 뒤로 갔다 고친 뒤 앞으로 가기로 옛 값의 2단계에 닿지 않게. */
  const edited = (field?: Field) => {
    setAccount(null);
    if (field) clearErrors(field);
    if (field === 'email') setEmailTaken(false);
    setFormError(null);
  };

  const onNext = handleSubmit(({ email, password, name }) => {
    setAccount({ email, password, name });
    void navigate('/signup?step=role');
  });

  const onSignup = () => {
    if (account === null || role === null || locked.current) return;
    locked.current = true;
    setFormError(null);
    signup.mutate(
      { ...account, role },
      {
        onSuccess: ({ me }) => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 가입이 한 번 더 나가지 않는다.
          void navigate(getLandingPath(me), { replace: true });
        },
        onError: (error) => {
          locked.current = false;
          let shown = 0;
          for (const [name, message] of Object.entries(error.fieldErrors ?? {})) {
            const field = SERVER_FIELDS.find((f) => f === name);
            if (field === undefined) continue;
            setError(field, { type: 'server', message });
            shown += 1;
          }
          setEmailTaken(error.code === 'EMAIL_DUPLICATE');
          if (shown > 0) {
            // 오류가 붙은 칸은 1단계에 있다 — 값은 그대로 두고 1단계로 돌아가 보여 준다.
            void navigate(-1);
          } else {
            setFormError(errorMessage(error.code));
          }
        },
      },
    );
  };

  if (onRoleStep) {
    const pending = signup.isPending;
    return (
      <Page className={cn(BOTTOM_ACTION_PAGE_TAB_ROOT, 'pt-9')}>
        <div>
          <BrandMark variant="wordmark" />
        </div>
        <PageHeading
          className="mt-6"
          title="어떤 분이신가요?"
          description="역할에 따라 필요한 기능을 안내해 드려요."
        />
        <form
          className="mt-6 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSignup();
          }}
        >
          <div role="radiogroup" aria-label="가입 역할" className="flex flex-col gap-3">
            {SIGNUP_ROLES.map((r) => (
              <RoleCard
                key={r}
                role={r}
                checked={role === r}
                disabled={pending}
                onSelect={() => setRole(r)}
              />
            ))}
          </div>
          {formError !== null ? (
            <p role="alert" className="mt-3 px-1 text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <BottomAction>
            <Button
              type="submit"
              loading={pending}
              disabled={role === null}
              hint={role === null ? { reason: '역할을 하나 골라 주세요.' } : undefined}
            >
              선택하고 계속하기
            </Button>
          </BottomAction>
        </form>
      </Page>
    );
  }

  const agreed = agreeTerms && agreePrivacy;
  return (
    <Page className={cn(BOTTOM_ACTION_PAGE_TAB_ROOT, 'pt-9')}>
      <div>
        <BrandMark variant="wordmark" />
      </div>
      <PageHeading
        className="mt-6"
        title="UNIRO에 가입해요."
        description="계정을 만들고 나에게 맞는 역할을 선택해요."
      />
      <form
        className="mt-6 flex flex-1 flex-col"
        onSubmit={onNext}
        onKeyDown={preventImeEnter}
        noValidate
      >
        <div className="flex flex-col gap-3">
          <TextField
            showLabel
            label="이메일"
            placeholder="이메일 주소를 입력해 주세요"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', { onChange: () => edited('email') })}
          />
          {emailTaken ? (
            <Link
              to="/login"
              className="-mt-1 inline-flex min-h-11 items-center self-start px-1 text-sm font-bold text-brand"
            >
              로그인하기
            </Link>
          ) : null}
          <TextField
            showLabel
            label="비밀번호"
            placeholder="영문·숫자 포함 8자 이상"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password', { onChange: () => edited('password') })}
          />
          <TextField
            showLabel
            label="비밀번호 확인"
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            type="password"
            autoComplete="new-password"
            error={errors.passwordConfirm?.message}
            {...register('passwordConfirm', { onChange: () => edited('passwordConfirm') })}
          />
          <TextField
            showLabel
            label="이름"
            placeholder="이름을 입력해 주세요"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name', { onChange: () => edited('name') })}
          />
          <div className="flex flex-col">
            <Checkbox
              label="[필수] 이용약관 동의"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                edited();
              }}
            />
            <Checkbox
              label="[필수] 개인정보 처리 동의"
              checked={agreePrivacy}
              onChange={(e) => {
                setAgreePrivacy(e.target.checked);
                edited();
              }}
            />
          </div>
          <Notice>고교생은 탐방 신청 전 보호자 동의가 필요해요.</Notice>
        </div>
        <BottomAction>
          <Button
            type="submit"
            disabled={!agreed}
            hint={
              agreed ? undefined : { reason: '필수 약관에 모두 동의하면 다음으로 갈 수 있어요.' }
            }
          >
            가입하고 역할 선택하기
          </Button>
          <Link
            to="/login"
            className="mt-2 flex min-h-11 items-center justify-center text-[13px] text-muted"
          >
            이미 계정이 있나요?&nbsp;<span className="font-bold text-ink">로그인</span>
          </Link>
        </BottomAction>
      </form>
    </Page>
  );
}
