import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { qk } from '@/shared/api/queryKeys';
import {
  DEMO_ROLES,
  SEED_CHECKPOINTS,
  type DemoRole,
  type SeedCheckpoint,
} from '@/shared/config/demoAccounts';
import type { ApiMode } from '@/shared/config/env';
import { cn } from '@/shared/lib/cn';
import { errorMessage } from '@/shared/lib/errors';
import { ApiError, request } from '@/shared/lib/http';
import type { Tone } from '@/shared/lib/types';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { useBootStatus } from './bootStatus';
import { useDemoStore, validLastCoupon, type AiSpeed, type MapMode } from './demoStore';
import { quickLogin, switchToCouponOwner } from './quickLogin';
import { resetDemoData } from './resetDemo';

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

const RESET_FAILED = '시연 데이터를 초기화하지 못했어요.';

const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : undefined);

/** 역할 전환 실패: 지금 세션 · 화면은 그대로이고 이유만 알린다(판정 31). */
function switchFailed(error: unknown) {
  toast.error(errorMessage(errorCode(error)));
}

function resetFailed(error: unknown) {
  const code = errorCode(error);
  toast.error(RESET_FAILED, { description: code ? errorMessage(code) : undefined });
}

type Action = DemoRole | 'coupon' | 'reset';

/**
 * 시연 패널(설계 5.8). DOM 하나이고 배치만 CSS가 바꾼다(판정 Task 21): 폭 900px 이상이면 프레임 옆(`MobileFrame`의
 * aside 슬롯), 좁으면 프레임 오른쪽 위의 토글 버튼 뒤에 접힌다. 발표 모드에서는 역할 버튼 4개와 작은 설정 표시만
 * 남은 세로 막대다. 시연 도구가 켜졌을 때만 그린다(`useDemoToolsOn` — AppShell).
 */
export function DemoPanel() {
  const presentMode = useDemoStore((s) => s.presentMode) === true;
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
        className="flex size-11 items-center justify-center rounded-full border border-border bg-bg text-ink shadow-md min-[900px]:hidden"
      >
        <SlidersHorizontal aria-hidden className="size-5" />
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
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-2 shadow-md">
      <RoleButtons actions={actions} ownerToCoupon={coupon !== null} />
      <RoleBarStatus />
    </div>
  );
}

/**
 * 발표 모드에서는 환경 토글이 안 보이므로 지금 API 모드(`목업` · `실서버`)를 늘 작게 보이고, 기본값이 아닌 설정
 * (AI 느리게 · 지도 도식)은 켜져 있을 때만 보인다 — 지난 리허설의 설정이 무대에서 몰래 남지 않게(판정 33).
 */
function RoleBarStatus() {
  const apiMode = useBootStatus((s) => s.apiMode);
  const aiSpeed = useDemoStore((s) => s.aiSpeed);
  const mapMode = useDemoStore((s) => s.mapMode);
  return (
    <ul aria-label="시연 설정" className="flex flex-col items-center gap-1 text-xs font-semibold">
      <li className="text-muted">{apiMode === 'real' ? '실서버' : '목업'}</li>
      {aiSpeed === 'slow' ? (
        <li>
          <Badge tone="warning">AI 느리게</Badge>
        </li>
      ) : null}
      {mapMode === 'schematic' ? (
        <li>
          <Badge tone="warning">지도 도식</Badge>
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
  const { setApiModeOverride, setMapMode, setAiSpeed, setPresentMode } = useDemoStore.getState();
  const [checkpoint, setCheckpoint] = useState<SeedCheckpoint>('START');

  // 가장 작은 무대 뷰포트(1280×590 — 프레임 높이 558px)에서도 스크롤 없이 들어가게 촘촘히 둔다.
  return (
    <div className="flex w-80 max-w-[calc(100vw-24px)] flex-col gap-3 rounded-lg border border-border bg-bg p-3 shadow-md">
      {mockWorkerFailed ? (
        <p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
          목업 워커를 켜지 못했어요
        </p>
      ) : null}

      <Group title="역할 전환">
        <div className="grid grid-cols-4 gap-2">
          <RoleButtons actions={actions} />
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
        {coupon !== null ? (
          <p className="px-1 text-sm text-muted">{`최근 쿠폰 ${coupon.code}`}</p>
        ) : null}
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
            onClick={() => actions.reset(checkpoint)}
          >
            시연 데이터 초기화
          </Button>
        </div>
      </Group>

      <Group title="환경">
        <Segmented<ApiMode>
          label="API 모드"
          value={apiMode}
          options={[
            ['mock', '목업'],
            ['real', '실서버'],
          ]}
          onChange={(mode) => {
            // 모드는 부트스트랩에서 한 번 정한다(목업 워커 · HTTP) — 저장하고 다시 불러온다.
            setApiModeOverride(mode);
            window.location.reload();
          }}
        />
        <Setting label="백엔드">
          <HealthBadge />
        </Setting>
        <Segmented<MapMode>
          label="지도"
          value={mapMode === 'schematic' ? 'schematic' : 'auto'}
          options={[
            ['auto', '자동'],
            ['schematic', '도식'],
          ]}
          onChange={setMapMode}
        />
        <Segmented<AiSpeed>
          label="AI 속도"
          value={aiSpeed === 'slow' ? 'slow' : 'normal'}
          options={[
            ['normal', '보통'],
            ['slow', '느리게'],
          ]}
          onChange={setAiSpeed}
        />
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={false}
          onClick={() => setPresentMode(true)}
        >
          발표 모드
        </Button>
      </Group>
    </div>
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

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <span className="text-sm text-ink">{label}</span>
      {children}
    </div>
  );
}

/** 두 값 중 하나를 고르는 버튼 묶음(눌린 쪽 = 지금 값). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange(value: T): void;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={labelId} className="text-sm text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex overflow-hidden rounded-sm border border-border"
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => {
              if (option !== value) onChange(option);
            }}
            className={cn(
              'min-h-11 px-3 text-sm font-bold',
              option === value ? 'bg-primary text-on-primary' : 'bg-bg text-ink hover:bg-surface',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 백엔드 상태: `/api/health`를 15초마다 확인한다(판정 27). */
function HealthBadge() {
  const health = useQuery({
    queryKey: qk.health,
    queryFn: () => request<unknown>('/health'),
    refetchInterval: 15_000,
    retry: false,
  });
  const [tone, label]: [Tone, string] =
    health.status === 'success'
      ? ['success', '정상']
      : health.status === 'error'
        ? ['danger', '응답 없음']
        : ['neutral', '확인 중'];
  return <Badge tone={tone}>{label}</Badge>;
}
