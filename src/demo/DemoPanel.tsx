import { useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  DEMO_P1_ACCOUNTS,
  DEMO_ROLES,
  SEED_CHECKPOINTS,
  type DemoRole,
  type SeedCheckpoint,
} from '@/shared/config/demoAccounts';
import { env, type ApiMode } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { errorMessage } from '@/shared/lib/errors';
import { ApiError } from '@/shared/lib/http';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { StatusChip } from '@/shared/ui/StatusChip';
import { useBootStatus } from './bootStatus';
import { useDemoStore, validLastCoupon, type AiSpeed, type MapMode } from './demoStore';
import { quickLogin, switchToCouponOwner, useQuickLoginAvailable } from './quickLogin';
import {
  RESET_FAILED,
  RESET_MISSING_REASON,
  resetDemoData,
  resetFailureDescription,
} from './resetDemo';

const ROLE_LABEL: Record<DemoRole, string> = {
  student: '고교생',
  guide: '가이드',
  owner: '사장님',
  admin: '운영자',
};

const CHECKPOINT_LABEL: Record<SeedCheckpoint, string> = {
  START: '처음',
  APPLIED: '신청 완료',
  APPROVED: '승인 완료',
  CONFIRMED: '코스 확정',
};

const CHECKPOINT_OPTIONS = SEED_CHECKPOINTS.map((value) => ({
  value,
  label: CHECKPOINT_LABEL[value],
}));

const P1_ACCOUNT_OPTIONS = DEMO_P1_ACCOUNTS.map(({ email, label }) => ({ value: email, label }));

const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : undefined);

/** 역할 전환 실패: 지금 세션 · 화면은 그대로이고 이유만 알린다(판정 31). */
function switchFailed(error: unknown) {
  toast.error(errorMessage(errorCode(error)));
}

function resetFailed(error: unknown) {
  toast.error(RESET_FAILED, { description: resetFailureDescription(error) });
}

type Action = DemoRole | 'coupon' | 'account' | 'reset';

/**
 * 시연 패널(설계 5.8). DOM 하나이고 배치만 CSS가 바꾼다(판정 Task 21): 폭 900px 이상이면 프레임 옆(`MobileFrame`의
 * aside 슬롯), 좁으면 프레임 오른쪽 위의 토글 버튼 뒤에 접힌다. 발표 모드에서는 역할 버튼 4개와 작은 설정 표시만
 * 남은 세로 막대다. 시연 도구가 켜졌을 때만 그린다(`useDemoToolsOn` — AppShell). 역할 전환 · 발표 모드는 빠른
 * 로그인이 되는 목업(스텁)에서만 있다 — 실서버에서는 직접 로그인한다(11/10, `useQuickLoginAvailable`).
 */
export function DemoPanel() {
  const quickLoginOn = useQuickLoginAvailable();
  const presentMode = useDemoStore((s) => s.presentMode) === true && quickLoginOn;
  // 목업을 뺀 빌드(라이브 배포)는 늘 실서버라 모드를 따로 알리지 않는다. 목업 UI 조건은 빌드 상수 `__MOCK_API__`를 앞에
  // 둬서 그 빌드에서는 문구까지 번들에서 지워지고, 테스트는 `env.mockApi`를 바꿔 확인한다.
  const isReal = useBootStatus((s) => s.apiMode) === 'real' && __MOCK_API__ && env.mockApi;
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const actions = useDemoActions(() => setOpen(false));

  return (
    <section aria-label="시연 패널" className="relative">
      <button
        type="button"
        aria-label="시연 패널"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border bg-surface text-ink min-[900px]:hidden',
          // 실서버일 때는 접힌 버튼에도 보인다 — 목업 데이터를 실서버 데이터로 착각하지 않게(11/9).
          isReal ? 'border-local px-3 text-xs font-bold' : 'border-border',
        )}
      >
        <SlidersHorizontal aria-hidden className="size-5" />
        {isReal ? <span aria-hidden>실서버</span> : null}
      </button>
      <div
        id={bodyId}
        className={cn(
          'absolute top-[calc(100%+8px)] right-0 max-h-[calc(100dvh-88px)] overflow-y-auto rounded-lg',
          open ? 'block' : 'hidden',
          'min-[900px]:static min-[900px]:block min-[900px]:max-h-none min-[900px]:overflow-visible',
        )}
      >
        {presentMode ? <RoleBar actions={actions} /> : <FullPanel actions={actions} />}
      </div>
    </section>
  );
}

interface DemoActions {
  running: Action | null;
  switchRole(role: DemoRole): void;
  switchCouponOwner(): void;
  switchAccount(email: string): void;
  reset(checkpoint: SeedCheckpoint): void;
}

/** 패널의 동작. 한 번에 하나만 실행하고(연타 · 겹친 전환 방지), 실패는 토스트로 알린다. */
function useDemoActions(onDone: () => void): DemoActions {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [running, setRunning] = useState<Action | null>(null);
  const runningRef = useRef(false);
  // 역할 전환의 이동: 지금 기록을 바꿔 쓰고(뒤로 가기로 이전 역할 화면에 돌아가지 않게), flushSync로 그린다 —
  // 바로 앞에서 바꾼 신원과 새 주소가 한 번의 렌더로 들어간다(판정 31).
  const deps = {
    queryClient,
    navigate: (to: string) => void navigate(to, { replace: true, flushSync: true }),
  };

  async function run(action: Action, task: () => Promise<void>, onError: (error: unknown) => void) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(action);
    try {
      await task();
      onDone();
    } catch (error) {
      onError(error);
    } finally {
      runningRef.current = false;
      setRunning(null);
    }
  }

  return {
    running,
    switchRole: (role) => void run(role, () => quickLogin(role, deps), switchFailed),
    switchCouponOwner: () => void run('coupon', () => switchToCouponOwner(deps), switchFailed),
    switchAccount: (email) => void run('account', () => quickLogin({ email }, deps), switchFailed),
    reset: (checkpoint) =>
      void run(
        'reset',
        async () => {
          await resetDemoData({ checkpoint }, { queryClient });
          // 초기화는 세션도 비운다 — 지난 데이터의 주소를 `next`로 남기지 않고 로그인 화면에서 역할을 다시 고른다.
          void navigate('/login', { replace: true });
          toast.success('시연 데이터를 초기화했어요.');
        },
        resetFailed,
      ),
  };
}

/** 역할 버튼 4개. `ownerToCoupon`이면 `사장님`이 쿠폰 가게 사장님 전환을 대신한다(발표 모드 — 판정 32). */
function RoleButtons({
  actions,
  ownerToCoupon = false,
}: {
  actions: DemoActions;
  ownerToCoupon?: boolean;
}) {
  return DEMO_ROLES.map((role) => {
    const toCoupon = ownerToCoupon && role === 'owner';
    return (
      <Button
        key={role}
        size="sm"
        variant="secondary"
        className="px-2"
        loading={actions.running === (toCoupon ? 'coupon' : role)}
        onClick={() => (toCoupon ? actions.switchCouponOwner() : actions.switchRole(role))}
      >
        {ROLE_LABEL[role]}
      </Button>
    );
  });
}

/**
 * 발표 모드: 역할 버튼 4개만 남은 작은 세로 막대. `사장님`은 학생이 마지막으로 본 쿠폰이 있으면 그 쿠폰을 발급한
 * 가게의 사장님으로 바꾸고 사용 처리 화면에 코드를 채운다 — 무대에서 다섯째 버튼을 고르지 않게, 사장님 = 방금 본
 * 쿠폰의 사장님이다(판정 32). 쿠폰이 없으면 평소처럼 owner1. 아래에는 지금 설정을 작게 보인다(판정 33).
 */
function RoleBar({ actions }: { actions: DemoActions }) {
  const coupon = validLastCoupon(useDemoStore((s) => s.lastCoupon));
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2">
      <RoleButtons actions={actions} ownerToCoupon={coupon !== null} />
      <RoleBarStatus />
    </div>
  );
}

/**
 * 발표 모드에서는 환경 토글이 안 보이므로 지금 API 모드(`목업` · `실서버`)를 늘 작게 보이고, 기본값이 아닌 설정
 * (AI 느리게 · 지도 도식)은 켜져 있을 때만 보인다 — 지난 리허설의 설정이 무대에서 몰래 남지 않게(판정 33).
 * 목업을 뺀 빌드(라이브 배포)는 모드가 하나뿐이고 AI 속도는 목업 전용이라 둘 다 보이지 않는다.
 */
function RoleBarStatus() {
  const apiMode = useBootStatus((s) => s.apiMode);
  const aiSpeed = useDemoStore((s) => s.aiSpeed);
  const mapMode = useDemoStore((s) => s.mapMode);
  return (
    <ul aria-label="시연 설정" className="flex flex-col items-center gap-1 text-xs font-semibold">
      {__MOCK_API__ && env.mockApi ? (
        <li className="text-muted">{apiMode === 'real' ? '실서버' : '목업'}</li>
      ) : null}
      {__MOCK_API__ && env.mockApi && aiSpeed === 'slow' ? (
        <li>
          <StatusChip tone="warning">AI 느리게</StatusChip>
        </li>
      ) : null}
      {mapMode === 'schematic' ? (
        <li>
          <StatusChip tone="warning">지도 도식</StatusChip>
        </li>
      ) : null}
    </ul>
  );
}

function FullPanel({ actions }: { actions: DemoActions }) {
  const mockWorkerFailed = useBootStatus((s) => s.mockWorkerFailed);
  const apiMode = useBootStatus((s) => s.apiMode);
  const coupon = validLastCoupon(useDemoStore((s) => s.lastCoupon));
  const mapMode = useDemoStore((s) => s.mapMode);
  const aiSpeed = useDemoStore((s) => s.aiSpeed);
  const resetMissing = useDemoStore((s) => s.resetMissing);
  const quickLoginOn = useQuickLoginAvailable();
  const { setApiModeOverride, setMapMode, setAiSpeed, setPresentMode } = useDemoStore.getState();
  const [checkpoint, setCheckpoint] = useState<SeedCheckpoint>('START');
  const [p1Email, setP1Email] = useState(P1_ACCOUNT_OPTIONS[0]?.value ?? '');

  // 가장 작은 무대 뷰포트(1280×590 — 프레임 높이 558px)에서도 스크롤 없이 들어가게 촘촘히 둔다.
  return (
    <div className="flex w-80 max-w-[calc(100vw-24px)] flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      {__MOCK_API__ && env.mockApi && apiMode === 'real' ? (
        <StatusChip tone="warning" className="text-sm">
          실서버에 연결돼 있어요
        </StatusChip>
      ) : null}
      {__MOCK_API__ && mockWorkerFailed ? (
        <p
          role="alert"
          className="rounded-sm bg-danger-soft px-3 py-2 text-sm font-bold text-danger"
        >
          목업 워커를 켜지 못했어요
        </p>
      ) : null}

      <Group title="역할 전환">
        {quickLoginOn ? (
          <RoleSwitch actions={actions} p1Email={p1Email} setP1Email={setP1Email} coupon={coupon} />
        ) : (
          <p className="text-sm text-muted">{QUICK_LOGIN_OFF_NOTE}</p>
        )}
      </Group>

      <Group title="시연 데이터">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Select
              label="체크포인트"
              className="h-11 text-sm"
              options={CHECKPOINT_OPTIONS}
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value as SeedCheckpoint)}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            loading={actions.running === 'reset'}
            disabled={resetMissing}
            hint={resetMissing ? { reason: RESET_MISSING_REASON } : undefined}
            onClick={() => actions.reset(checkpoint)}
          >
            시연 데이터 초기화
          </Button>
        </div>
      </Group>

      <Group title="환경">
        {/* 목업을 뺀 빌드(라이브 배포)는 늘 실서버라 모드 전환과 목업 AI 속도가 없다. */}
        {__MOCK_API__ && env.mockApi ? (
          <Segmented<ApiMode>
            label="API 모드"
            value={apiMode}
            options={[
              ['mock', '목업'],
              ['real', '실서버'],
            ]}
            disabledOption={
              env.realApi ? undefined : { value: 'real', reason: REAL_API_MISSING_REASON }
            }
            onChange={(mode) => {
              // 모드는 부트스트랩에서 한 번 정한다(목업 워커 · HTTP) — 저장하고 다시 불러온다.
              setApiModeOverride(mode);
              window.location.reload();
            }}
          />
        ) : null}
        <Segmented<MapMode>
          label="지도"
          value={mapMode === 'schematic' ? 'schematic' : 'auto'}
          options={[
            ['auto', '자동'],
            ['schematic', '도식'],
          ]}
          onChange={setMapMode}
        />
        {__MOCK_API__ && env.mockApi ? (
          <Segmented<AiSpeed>
            label="AI 속도"
            value={aiSpeed === 'slow' ? 'slow' : 'normal'}
            options={[
              ['normal', '보통'],
              ['slow', '느리게'],
            ]}
            onChange={setAiSpeed}
          />
        ) : null}
        {quickLoginOn ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              aria-pressed={false}
              onClick={() => setPresentMode(true)}
            >
              발표 모드
            </Button>
          </div>
        ) : null}
      </Group>
    </div>
  );
}

/** 실서버에서 역할 전환 대신 보이는 안내(빠른 로그인은 목업에서만, 11/10). */
const QUICK_LOGIN_OFF_NOTE =
  '실서버에서는 빠른 로그인을 쓰지 않아요. 로그인 화면에서 직접 로그인해 주세요.';

/** 역할 버튼 · P1 계정 전환 · 쿠폰 가게 사장님 전환(빠른 로그인이 되는 목업에서만). */
function RoleSwitch({
  actions,
  p1Email,
  setP1Email,
  coupon,
}: {
  actions: DemoActions;
  p1Email: string;
  setP1Email(email: string): void;
  coupon: ReturnType<typeof validLastCoupon>;
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <RoleButtons actions={actions} />
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Select
            label="P1 계정"
            className="h-11 text-sm"
            options={P1_ACCOUNT_OPTIONS}
            value={p1Email}
            onChange={(e) => setP1Email(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          loading={actions.running === 'account'}
          onClick={() => actions.switchAccount(p1Email)}
        >
          이 계정으로 전환
        </Button>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={coupon === null}
        loading={actions.running === 'coupon'}
        hint={coupon === null ? { reason: '학생 쿠폰 화면을 먼저 열어 주세요.' } : undefined}
        onClick={actions.switchCouponOwner}
      >
        쿠폰 가게 사장님으로 전환
      </Button>
      {coupon !== null ? <StatusChip tone="info">{`최근 쿠폰 ${coupon.code}`}</StatusChip> : null}
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-bold text-muted">{title}</h2>
      {children}
    </div>
  );
}

/** 두 값 중 하나를 고르는 버튼 묶음(눌린 쪽 = 지금 값). */
/** 백엔드가 연결되지 않은 배포(`VITE_REAL_API=off`)에서 실서버 버튼이 잠긴 사유. */
const REAL_API_MISSING_REASON = '이 배포에는 백엔드가 연결되지 않았어요.';

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabledOption,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange(value: T): void;
  /** 고를 수 없는 선택지와 그 사유(버튼 설명으로 읽히고 아래에 작게 보인다). */
  disabledOption?: { value: T; reason: string };
}) {
  const labelId = useId();
  const reasonId = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span id={labelId} className="text-sm text-ink">
          {label}
        </span>
        <div
          role="group"
          aria-labelledby={labelId}
          className="flex overflow-hidden rounded-md bg-neutral-100"
        >
          {options.map(([option, text]) => {
            const off = disabledOption?.value === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={option === value}
                disabled={off}
                aria-describedby={off ? reasonId : undefined}
                onClick={() => {
                  if (option !== value) onChange(option);
                }}
                className={cn(
                  'min-h-11 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50',
                  option === value
                    ? 'bg-brand text-on-primary'
                    : 'text-muted hover:bg-neutral-300/40',
                )}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
      {disabledOption ? (
        <p id={reasonId} className="mt-1 text-right text-xs text-muted">
          {disabledOption.reason}
        </p>
      ) : null}
    </div>
  );
}
