import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
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
import { Button } from '@/shared/ui/Button';
import { Page } from '@/shared/ui/Page';
import { StatusChip } from '@/shared/ui/StatusChip';
import { TextField } from '@/shared/ui/TextField';
import { TopBar } from '@/shared/ui/TopBar';

const signupSchema = z.object({
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
  name: z
    .string()
    .trim()
    .min(1, '이름을 입력해 주세요.')
    .max(NAME_MAX, `이름은 ${NAME_MAX}자 이내로 적어 주세요.`),
});

type Field = keyof z.input<typeof signupSchema>;
const FIELDS: readonly Field[] = ['email', 'password', 'name'];

const ROLE_CARDS: Record<SignupRole, { title: string; description: string }> = {
  HIGH_SCHOOL: { title: '고등학생', description: '캠퍼스 탐방을 추천받고 신청해요.' },
  UNIVERSITY: { title: '대학생 가이드', description: '개인 자율 탐방을 개설하고 관리해요.' },
  OWNER: { title: '사장님', description: '상점을 연결하고 방문 쿠폰을 처리해요.' },
};

/** 역할 라디오 카드. 보이는 입력은 숨기고 카드 전체가 라벨이다(키보드 초점은 카드 테두리에 outline). */
function RoleCard({
  role,
  checked,
  onSelect,
}: {
  role: SignupRole;
  checked: boolean;
  onSelect: () => void;
}) {
  const { title, description } = ROLE_CARDS[role];
  return (
    <label
      className={cn(
        'flex min-h-[72px] cursor-pointer items-center gap-3 rounded-lg border-2 p-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent',
        checked ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface',
      )}
    >
      <input
        type="radio"
        name="role"
        value={role}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-brand' : 'border-muted',
        )}
      >
        {checked ? <span className="size-2.5 rounded-full bg-brand" /> : null}
      </span>
      <span className="block min-w-0">
        <span className="block text-[17px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted">{description}</span>
      </span>
    </label>
  );
}

/**
 * 회원가입(hs-a01, V2에 없는 화면). 가입은 되돌릴 수 없는 쓰기라 처리 중에 잠기고 연타해도 요청은 한 번이다(`locked`).
 * 성공하면 새 계정의 역할별 첫 화면으로 간다(`?next=`는 따르지 않는다).
 */
export function SignupPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const locked = useRef(false);
  const [role, setRole] = useState<SignupRole>('HIGH_SCHOOL');
  const [emailTaken, setEmailTaken] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', name: '' },
  });

  const onSubmit = handleSubmit((values) => {
    if (locked.current) return;
    locked.current = true;
    setFormError(null);
    signup.mutate(
      { ...values, role },
      {
        onSuccess: ({ me }) => {
          // 잠금은 풀지 않는다 — 이동 중에 다시 눌러도 가입이 한 번 더 나가지 않는다.
          void navigate(getLandingPath(me), { replace: true });
        },
        onError: (error) => {
          locked.current = false;
          let shown = 0;
          for (const [name, message] of Object.entries(error.fieldErrors ?? {})) {
            const field = FIELDS.find((f) => f === name);
            if (field === undefined) continue;
            setError(field, { type: 'server', message });
            shown += 1;
          }
          setEmailTaken(error.code === 'EMAIL_DUPLICATE');
          if (shown === 0) setFormError(errorMessage(error.code));
        },
      },
    );
  });

  // 서버 오류 문구는 다시 입력하기 시작하면 지운다.
  const clearServerError = (field: Field) => {
    clearErrors(field);
    if (field === 'email') setEmailTaken(false);
    setFormError(null);
  };

  return (
    <>
      <TopBar title="회원가입 · 역할 선택" />
      <Page className="flex flex-col gap-4">
        <StatusChip tone="info">신규 회원가입 · 역할 1개 선택</StatusChip>
        <form
          className="flex flex-col gap-3"
          onSubmit={onSubmit}
          onKeyDown={preventImeEnter}
          noValidate
        >
          <TextField
            label="이메일 주소"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', { onChange: () => clearServerError('email') })}
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
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password', { onChange: () => clearServerError('password') })}
          />
          <TextField
            label="이름"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name', { onChange: () => clearServerError('name') })}
          />
          <fieldset className="mt-2 flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-bold text-ink">
              가입 유형을 선택해 주세요
            </legend>
            {SIGNUP_ROLES.map((r) => (
              <RoleCard key={r} role={r} checked={role === r} onSelect={() => setRole(r)} />
            ))}
          </fieldset>
          {formError !== null ? (
            <p role="alert" className="px-1 text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <Button type="submit" loading={signup.isPending}>
            계정 생성하고 인증하기
          </Button>
        </form>
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-brand"
        >
          이미 계정이 있다면 로그인하기
        </Link>
      </Page>
    </>
  );
}
