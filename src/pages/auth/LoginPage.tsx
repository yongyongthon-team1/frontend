import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { getLandingPath } from '@/features/auth/landing';
import { useLogin } from '@/features/auth/queries';
import { cn } from '@/shared/lib/cn';
import { errorMessage } from '@/shared/lib/errors';
import { preventImeEnter } from '@/shared/lib/ime';
import { BrandMark } from '@/shared/ui/BrandMark';
import { Button } from '@/shared/ui/Button';
import { buttonClass } from '@/shared/ui/buttonStyles';
import { InfoCard } from '@/shared/ui/InfoCard';
import { TextField } from '@/shared/ui/TextField';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, '이메일 주소를 입력해 주세요.')
    .pipe(z.email('이메일 주소 형식을 확인해 주세요.')),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

/**
 * 로그인 뒤 돌아갈 주소(`?next=`). 앱 안 경로만 받는다(`//다른도메인`, 브라우저가 `//`로 읽는 `/\` 거부).
 * `/`는 역할 · 인증 상태별 첫 화면 규칙(설계 5.4)을 따르게 버린다.
 */
function nextPath(next: string | null): string | null {
  if (!next || next === '/' || !next.startsWith('/')) return null;
  if (next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}

/** 로그인(hs-s01, V2에는 없는 화면 — 브랜드 표식 + 슬로건 + V2 입력 · 버튼으로 맞춘다). 성공하면 `next` 또는 내 첫 화면으로 간다. */
export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: ({ me }) => {
        void navigate(nextPath(searchParams.get('next')) ?? getLandingPath(me), { replace: true });
      },
    });
  });

  // 서버 오류 문구는 다시 입력하기 시작하면 지운다.
  const clearServerError = () => {
    if (login.isError) login.reset();
  };

  return (
    <>
      <main className="px-[var(--gutter)] pt-10 pb-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <div aria-hidden>
            <BrandMark variant="icon" />
          </div>
          <h1>
            <span className="sr-only">유니로 </span>
            <BrandMark variant="wordmark" />
          </h1>
          <p className="text-sm font-medium text-muted">“ 대학으로, 동네로, 유니로. ”</p>
        </header>
        <h2 className="mt-8 text-2xl leading-snug font-bold whitespace-pre-line text-ink">
          {'대학생이 직접 안내하는\n나만의 캠퍼스 탐방'}
        </h2>
        <InfoCard
          muted
          className="mt-5"
          title="고등학생 · 대학생 · 사장님"
          description="각 역할에 맞는 탐방과 상권 서비스를 이용해요."
        />
        <h3 className="mt-7 text-lg font-bold text-ink">이메일로 시작하기</h3>
        <form
          className="mt-4 flex flex-col gap-3"
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
            {...register('email', { onChange: clearServerError })}
          />
          <TextField
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password', { onChange: clearServerError })}
          />
          {login.isError ? (
            <p role="alert" className="px-1 text-sm font-medium text-danger">
              {errorMessage(login.error.code)}
            </p>
          ) : null}
          <Button type="submit" loading={login.isPending}>
            로그인
          </Button>
        </form>
        <Link to="/signup" className={cn(buttonClass('secondary'), 'mt-3')}>
          새 계정 만들기
        </Link>
        <p className="mt-4 text-sm text-muted">
          가입 시 고교생 / 대학생 / 사장님 중 역할을 선택해요.
        </p>
      </main>
    </>
  );
}
