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
import { BOTTOM_ACTION_PAGE_TAB_ROOT, BottomAction } from '@/shared/ui/BottomAction';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { PageHeading } from '@/shared/ui/PageHeading';
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

/**
 * 로그인(C01, 새 시안). 하단 GNB · 상단 바가 없는 브랜드 머리(워드마크 → 제목 · 설명) + 보이는 라벨 칸 + 안내 상자,
 * 로그인 버튼은 하단 고정, 그 아래 텍스트 링크로 회원가입(C01A)에 간다. 성공하면 `next` 또는 내 첫 화면으로 간다.
 */
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
    <Page className={cn(BOTTOM_ACTION_PAGE_TAB_ROOT, 'pt-9')}>
      <div>
        <BrandMark variant="wordmark" />
      </div>
      <PageHeading
        className="mt-6"
        title="다시 만나 반가워요."
        description="UNIRO에서 나에게 맞는 캠퍼스를 발견해요."
      />
      <form
        className="mt-6 flex flex-1 flex-col"
        onSubmit={onSubmit}
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
            {...register('email', { onChange: clearServerError })}
          />
          <TextField
            showLabel
            label="비밀번호"
            placeholder="비밀번호를 입력해 주세요"
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
          <Notice>계정이 없다면 아래 회원가입에서 시작해 주세요.</Notice>
        </div>
        <BottomAction>
          <Button type="submit" loading={login.isPending}>
            로그인
          </Button>
          <Link
            to="/signup"
            className="mt-2 flex min-h-11 items-center justify-center text-[13px] text-muted"
          >
            아직 계정이 없나요?&nbsp;<span className="font-bold text-ink">회원가입</span>
          </Link>
        </BottomAction>
      </form>
    </Page>
  );
}
